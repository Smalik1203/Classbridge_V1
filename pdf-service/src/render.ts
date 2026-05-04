import puppeteer, { type Browser } from 'puppeteer';
import Handlebars from 'handlebars';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTermReportData, fetchAnnualReportData } from './data.js';
import { TERM_TEMPLATE, ANNUAL_TEMPLATE } from './templates/registry.js';

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
  const html = termTemplate(data);
  return htmlToPdf(html);
};

export const renderAnnualReportPdf = async (args: RenderArgs): Promise<Buffer> => {
  const data = await fetchAnnualReportData(args);
  const html = annualTemplate(data);
  return htmlToPdf(html);
};
