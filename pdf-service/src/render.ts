import puppeteer, { type Browser } from 'puppeteer';
import Handlebars from 'handlebars';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTermReportData, fetchAnnualReportData, fetchExamReportData } from './data.js';
import { TERM_TEMPLATE, ANNUAL_TEMPLATE, EXAM_TEMPLATE, ST_GEORGE_TEMPLATE } from './templates/registry.js';
import { ST_GEORGE_LOGO_DATA_URL, ST_GEORGE_SEAL_DATA_URL } from './templates/assets/st-george/index.js';

// ── Shared Puppeteer browser ────────────────────────────────────────────────
//
// Starting a Chromium process costs ~500-800ms. We launch once and reuse
// across requests. The container restarts cleanly on errors via Railway's
// restart policy if Puppeteer ever wedges.
let browserPromise: Promise<Browser> | null = null;
const getBrowser = (): Promise<Browser> => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',  // /dev/shm is tiny in containers
        '--disable-gpu',
        '--no-zygote',
      ],
    });
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
};

// ── Handlebars helpers ──────────────────────────────────────────────────────
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
Handlebars.registerHelper('add', (a, b) => Number(a || 0) + Number(b || 0));
Handlebars.registerHelper('inc', (n) => Number(n || 0) + 1);
Handlebars.registerHelper('toFixed', (n, d) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(Number(d) || 0);
});
Handlebars.registerHelper('roman', (n) => {
  const r = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return r[Number(n)] || String(n);
});
Handlebars.registerHelper('upper', (s) => String(s || '').toUpperCase());
Handlebars.registerHelper('or', (...args) => {
  const opts = args.pop(); // last arg is Handlebars options
  return args.find((v) => v != null && v !== '') ?? '';
});

// Compile templates once at module load
const termTemplate = Handlebars.compile(TERM_TEMPLATE);
const annualTemplate = Handlebars.compile(ANNUAL_TEMPLATE);
const examTemplate = Handlebars.compile(EXAM_TEMPLATE);
const stGeorgeTemplate = Handlebars.compile(ST_GEORGE_TEMPLATE);

// Per-school template registry. A school can override any of the three
// report kinds (term / annual / exam). Each entry returns:
//   - template: the Handlebars template to render
//   - enrich:   optional hook that mutates the data context (used to inject
//               codebase-shipped assets like inlined logos/watermarks, and
//               to set the `is_annual` / `is_term` / `is_exam` flags the
//               unified St. George template branches on)
interface SchoolTemplateEntry {
  template: HandlebarsTemplateDelegate;
  enrich?: (data: any) => any;
}
type ReportKind = 'term' | 'annual' | 'exam';

// Lookup keys, in priority order:
//   1. `schools.report_template_key` — explicit opt-in (preferred long-term)
//   2. `exam_groups.school_code`     — convenience for demo/onboarding so a
//      school gets the bespoke template without a schema change
//
// Add new entries as schools onboard with bespoke designs. The St. George
// template handles all three kinds via an internal `is_annual` switch on
// the academic-performance table — same look everywhere, just different
// columns of marks.
const stGeorgeEnrich = (kind: ReportKind) => (data: any) => ({
  ...data,
  st_george_logo_url: ST_GEORGE_LOGO_DATA_URL,
  st_george_seal_url: ST_GEORGE_SEAL_DATA_URL,
  is_annual: kind === 'annual',
  is_term:   kind === 'term',
  is_exam:   kind === 'exam',
  // CCA + health + attendance only make visual sense for full-term
  // reports; suppress them on single Unit Test exam reports.
  show_extras: kind !== 'exam',
});

const TEMPLATE_BY_KEY: Record<string, Partial<Record<ReportKind, SchoolTemplateEntry>>> = {
  'SCH019': {
    annual: { template: stGeorgeTemplate, enrich: stGeorgeEnrich('annual') },
    term:   { template: stGeorgeTemplate, enrich: stGeorgeEnrich('term') },
    exam:   { template: stGeorgeTemplate, enrich: stGeorgeEnrich('exam') },
  },
  'st-george': {
    annual: { template: stGeorgeTemplate, enrich: stGeorgeEnrich('annual') },
    term:   { template: stGeorgeTemplate, enrich: stGeorgeEnrich('term') },
    exam:   { template: stGeorgeTemplate, enrich: stGeorgeEnrich('exam') },
  },
};

const FALLBACK_TEMPLATE: Record<ReportKind, SchoolTemplateEntry> = {
  term:   { template: termTemplate },
  annual: { template: annualTemplate },
  exam:   { template: examTemplate },
};

const pickTemplate = (kind: ReportKind, data: any): SchoolTemplateEntry => {
  const key = data?.branding?.report_template_key || data?.school_code;
  return (key && TEMPLATE_BY_KEY[key]?.[kind]) || FALLBACK_TEMPLATE[kind];
};

// ── Render helpers ──────────────────────────────────────────────────────────

// A4 portrait at 96dpi = 794×1123 px. We render the .page div at its natural
// height, then if it overflows the printable area we scale the whole page
// down (uniform, top-left origin) so the report ALWAYS fits on one A4 page.
// Scale-down ratio is bounded by MIN_SCALE so type never becomes illegible —
// if a report has so many subjects it can't fit at MIN_SCALE, it'll still be
// one page but with content slightly clipped (acceptable degradation).
const A4_HEIGHT_PX = 1123;
const MIN_SCALE = 0.65;

const htmlToPdf = async (html: string): Promise<Buffer> => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  // Set viewport to A4 width so element measurements match the print width
  await page.setViewport({ width: 794, height: A4_HEIGHT_PX, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Measure content + compute scale ratio if it overflows
    const naturalHeight = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.page');
      return el ? el.scrollHeight : document.body.scrollHeight;
    });

    if (naturalHeight > A4_HEIGHT_PX) {
      const scale = Math.max(MIN_SCALE, A4_HEIGHT_PX / naturalHeight);
      await page.evaluate((s) => {
        const el = document.querySelector<HTMLElement>('.page');
        if (el) {
          el.style.transformOrigin = 'top left';
          el.style.transform = `scale(${s})`;
          // Compensate width so scaled content still fills the page edge-to-edge
          el.style.width = `${100 / s}%`;
        }
      }, scale);
    }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }, // page CSS owns margins
      pageRanges: '1', // hard guarantee: never emit a 2nd page
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
};

export interface RenderArgs {
  supabase: SupabaseClient;
  termReportId: string;
  studentId: string;
}

export const renderTermReportPdf = async (args: RenderArgs): Promise<Buffer> => {
  const data = await fetchTermReportData(args);
  const entry = pickTemplate('term', data);
  const ctx = entry.enrich ? entry.enrich(data) : data;
  const html = entry.template(ctx);
  return htmlToPdf(html);
};

export const renderAnnualReportPdf = async (args: RenderArgs): Promise<Buffer> => {
  const data = await fetchAnnualReportData(args);
  const entry = pickTemplate('annual', data);
  const ctx = entry.enrich ? entry.enrich(data) : data;
  const html = entry.template(ctx);
  return htmlToPdf(html);
};

export interface RenderExamArgs {
  supabase: SupabaseClient;
  examGroupId: string;
  studentId: string;
}

export const renderExamReportPdf = async (args: RenderExamArgs): Promise<Buffer> => {
  const data = await fetchExamReportData(args);
  const entry = pickTemplate('exam', data);
  const ctx = entry.enrich ? entry.enrich(data) : data;
  const html = entry.template(ctx);
  return htmlToPdf(html);
};

// ── Bulk render ────────────────────────────────────────────────────────────
//
// Renders one report card per student in a class, then streams them as a ZIP.
// Concurrency is bounded so a class of 40 doesn't fork 40 Chromium pages.
//
// Auto-detects the right template (term / annual / exam) by inspecting the
// exam_groups row once, then reuses that decision for every student.

export interface BulkRenderArgs {
  supabase: SupabaseClient;
  examGroupId: string;
  studentIds: string[];
  /** Cap on parallel page renders. Higher = faster, more memory. */
  concurrency?: number;
  /** Called as each student's PDF lands. Used to log/stream progress. */
  onProgress?: (info: { done: number; total: number; studentId: string; ok: boolean; error?: string }) => void;
}

export interface BulkRenderResult {
  studentId: string;
  ok: boolean;
  pdf?: Buffer;
  error?: string;
}

// Decide which kind of report card this exam group produces — same logic
// as server.ts so the bulk path stays in sync with single-render.
const detectKind = async (
  supabase: SupabaseClient,
  examGroupId: string,
): Promise<'term' | 'annual' | 'exam'> => {
  const { data: eg, error } = await supabase
    .from('exam_groups')
    .select('id, kind, source_group_ids')
    .eq('id', examGroupId)
    .maybeSingle();
  if (error) throw error;
  if (!eg) throw new Error('Exam group not found');

  if (eg.kind !== 'term_report') return 'exam';
  if (Array.isArray(eg.source_group_ids) && eg.source_group_ids.length > 0) {
    const { data: srcs, error: sErr } = await supabase
      .from('exam_groups')
      .select('id, kind')
      .in('id', eg.source_group_ids);
    if (sErr) throw sErr;
    if ((srcs || []).length > 0 && srcs!.every((s: any) => s.kind === 'term_report')) {
      return 'annual';
    }
  }
  return 'term';
};

const renderOneFor = async (
  kind: 'term' | 'annual' | 'exam',
  supabase: SupabaseClient,
  examGroupId: string,
  studentId: string,
): Promise<Buffer> => {
  if (kind === 'annual') {
    return renderAnnualReportPdf({ supabase, termReportId: examGroupId, studentId });
  }
  if (kind === 'term') {
    return renderTermReportPdf({ supabase, termReportId: examGroupId, studentId });
  }
  return renderExamReportPdf({ supabase, examGroupId, studentId });
};

// Tiny worker-pool: keeps `concurrency` workers busy until the queue
// drains. Each worker pulls the next studentId, renders, reports, repeats.
// Errors per student don't fail the whole batch — they're captured in the
// returned result so the caller can include a manifest in the ZIP.
export const renderReportCardsBulk = async (
  args: BulkRenderArgs,
): Promise<BulkRenderResult[]> => {
  const concurrency = Math.max(1, Math.min(args.concurrency || 3, 6));
  const kind = await detectKind(args.supabase, args.examGroupId);

  const queue = [...args.studentIds];
  const results: BulkRenderResult[] = [];
  let done = 0;

  const worker = async () => {
    while (queue.length > 0) {
      const studentId = queue.shift();
      if (!studentId) break;
      try {
        const pdf = await renderOneFor(kind, args.supabase, args.examGroupId, studentId);
        const r: BulkRenderResult = { studentId, ok: true, pdf };
        results.push(r);
        done++;
        args.onProgress?.({ done, total: args.studentIds.length, studentId, ok: true });
      } catch (err: any) {
        const r: BulkRenderResult = { studentId, ok: false, error: err?.message || 'Render failed' };
        results.push(r);
        done++;
        args.onProgress?.({ done, total: args.studentIds.length, studentId, ok: false, error: r.error });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
};
