import express, { type Request, type Response, type NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import { renderTermReportPdf, renderAnnualReportPdf, renderExamReportPdf, renderReportCardsBulk, renderFeeReceiptPdf } from './render.js';

const PORT = Number(process.env.PORT) || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // CORS

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required env: SUPABASE_URL, SUPABASE_ANON_KEY');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '256kb' }));

// CORS — frontend lives on a different origin
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check (Railway uses /health for readiness)
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ── Auth middleware ────────────────────────────────────────────────────────
//
// Pulls Supabase JWT from Authorization: Bearer <token>, attaches a
// supabase client (bound to that JWT, so RLS uses the user's identity)
// and the resolved user record onto req.

interface AuthedRequest extends Request {
  supabase: SupabaseClient;
  user: { id: string; email?: string };
}

// Service-to-service bypass token. When set, requests bearing this exact
// string in Authorization: Bearer <...> skip the user-JWT verification and
// use the service-role key to talk to Supabase. Used by the
// process-report-card-jobs worker (and other server-side callers) which
// don't have a user JWT but still need to render PDFs that read across
// schools. If unset, server-to-server calls are rejected.
const PDF_SERVICE_BYPASS_TOKEN = process.env.PDF_SERVICE_BYPASS_TOKEN || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

  // Service-to-service: token matches the configured bypass shared secret.
  // We build a service-role Supabase client (bypasses RLS) so the renderer
  // can read any school's data. Requires SUPABASE_SERVICE_ROLE_KEY env var.
  if (PDF_SERVICE_BYPASS_TOKEN && token === PDF_SERVICE_BYPASS_TOKEN) {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Service-role key not configured on pdf-service' });
    }
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    (req as AuthedRequest).supabase = supabase;
    (req as AuthedRequest).user = { id: 'service-account', email: undefined };
    return next();
  }

  // Normal end-user path: validate the JWT against Supabase.
  // Per-request Supabase client bound to this JWT (so RLS uses the user's identity).
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  (req as AuthedRequest).supabase = supabase;
  (req as AuthedRequest).user = { id: user.id, email: user.email };
  next();
};

// ── POST /render-report-card ──────────────────────────────────────────────
//
// Body shapes (any of the following):
//   { termReportId: uuid, studentId: uuid }       — legacy: term/annual report
//   { examGroupId: uuid, studentId: uuid }        — single-exam report
//
// Routing logic (auto-detects template from the exam_groups row):
//   - kind='term_report' with source_group_ids that are themselves term_reports
//       → ANNUAL template
//   - kind='term_report' otherwise
//       → TERM template (PA + Term layout)
//   - any other kind (e.g. assessment / unit_test / exam)
//       → EXAM template (single marks column)

app.post('/render-report-card', requireAuth, async (req, res) => {
  const { termReportId, examGroupId, studentId } = req.body || {};
  const groupId = termReportId || examGroupId;
  if (!groupId || !studentId) {
    return res.status(400).json({ error: 'examGroupId (or termReportId) + studentId required' });
  }

  const supabase = (req as AuthedRequest).supabase;

  try {
    // Resolve the exam_group row to decide which template to render.
    // No `kind` filter — we accept any exam group and route based on what we find.
    const { data: eg, error: egErr } = await supabase
      .from('exam_groups')
      .select('id, kind, name, source_group_ids, school_code')
      .eq('id', groupId)
      .maybeSingle();

    if (egErr) throw egErr;
    if (!eg) return res.status(404).json({ error: 'Exam group not found' });

    let pdfBuffer: Buffer;

    if (eg.kind === 'term_report') {
      // Annual mode: sources are themselves term_reports
      let isAnnual = false;
      if (Array.isArray(eg.source_group_ids) && eg.source_group_ids.length > 0) {
        const { data: srcs, error: sErr } = await supabase
          .from('exam_groups')
          .select('id, kind')
          .in('id', eg.source_group_ids);
        if (sErr) throw sErr;
        isAnnual = (srcs || []).length > 0 && srcs!.every((s: any) => s.kind === 'term_report');
      }
      pdfBuffer = isAnnual
        ? await renderAnnualReportPdf({ supabase, termReportId: groupId, studentId })
        : await renderTermReportPdf({ supabase, termReportId: groupId, studentId });
    } else {
      // Single-exam (assessment / unit test / etc.)
      pdfBuffer = await renderExamReportPdf({ supabase, examGroupId: groupId, studentId });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-card-${studentId.slice(0, 8)}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('render error', err);
    res.status(500).json({ error: err.message || 'Render failed' });
  }
});

// ── POST /render-report-cards-bulk ────────────────────────────────────────
//
// Bulk-renders one report card per student in a class and streams them as
// a ZIP. Used by the gradebook's "Download All Cards" button.
//
// Body: {
//   examGroupId: uuid,             // term report or exam group
//   studentIds:  uuid[],           // students to include (caller picks)
//   filename?:   string,           // optional ZIP filename override
// }
//
// Failure semantics: per-student render errors are *captured*, not fatal.
// The ZIP includes a manifest.txt listing successes and failures so the
// caller (or end-user) can see what succeeded.

app.post('/render-report-cards-bulk', requireAuth, async (req, res) => {
  const { examGroupId, studentIds, filename } = req.body || {};
  if (!examGroupId || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'examGroupId + non-empty studentIds[] required' });
  }
  // Hard cap so a misclick can't kick off a 5,000-student render.
  const MAX_BULK = 200;
  if (studentIds.length > MAX_BULK) {
    return res.status(400).json({ error: `Too many students (max ${MAX_BULK} per request)` });
  }

  const supabase = (req as AuthedRequest).supabase;

  // Look up student names once for nice file naming inside the ZIP.
  // Only the columns we need; RLS still applies via the JWT-bound client.
  const { data: students, error: sErr } = await supabase
    .from('student')
    .select('id, full_name, student_code')
    .in('id', studentIds);
  if (sErr) {
    return res.status(500).json({ error: sErr.message });
  }
  const studentMap = new Map<string, { full_name: string; student_code: string }>();
  for (const s of students || []) {
    studentMap.set(s.id, { full_name: s.full_name, student_code: s.student_code });
  }

  const safe = (s: string) => (s || 'student').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
  const zipName = filename
    ? safe(filename) + (filename.endsWith('.zip') ? '' : '.zip')
    : `report-cards-${examGroupId.slice(0, 8)}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  // Pipe ZIP straight to the response — bytes flush as they're written,
  // no need to hold all PDFs in memory at once.
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => {
    console.error('zip error', err);
    try { res.status(500).end(); } catch { /* response may already be partly sent */ }
  });
  archive.pipe(res);

  const successes: Array<{ studentId: string; fileName: string }> = [];
  const failures:  Array<{ studentId: string; error: string }> = [];

  try {
    const results = await renderReportCardsBulk({
      supabase,
      examGroupId,
      studentIds,
      concurrency: 3,
      onProgress: (info) => {
        if (info.ok) {
          // Append immediately so the ZIP grows as renders complete —
          // the user starts receiving bytes within a few seconds.
          const stu = studentMap.get(info.studentId);
          const code = stu?.student_code || info.studentId.slice(0, 8);
          const name = stu?.full_name || 'student';
          const fileName = `${safe(code)}_${safe(name)}.pdf`;
          // We can't append from inside onProgress (the buffer isn't here),
          // so we just log progress; actual append happens in the loop below.
          console.log(`[bulk] ${info.done}/${info.total} ${fileName}`);
        } else {
          console.warn(`[bulk] ${info.done}/${info.total} FAILED ${info.studentId}: ${info.error}`);
        }
      },
    });

    for (const r of results) {
      const stu = studentMap.get(r.studentId);
      const code = stu?.student_code || r.studentId.slice(0, 8);
      const name = stu?.full_name || 'student';
      if (r.ok && r.pdf) {
        const fileName = `${safe(code)}_${safe(name)}.pdf`;
        archive.append(r.pdf, { name: fileName });
        successes.push({ studentId: r.studentId, fileName });
      } else {
        failures.push({ studentId: r.studentId, error: r.error || 'unknown error' });
      }
    }

    // Manifest so users know what succeeded/failed without scanning the ZIP.
    const manifest = [
      `Report Card Bulk Render`,
      `Generated: ${new Date().toISOString()}`,
      `Exam Group: ${examGroupId}`,
      ``,
      `Succeeded (${successes.length}):`,
      ...successes.map((s) => `  ✓ ${s.fileName}`),
      ``,
      `Failed (${failures.length}):`,
      ...failures.map((f) => `  ✗ ${f.studentId}  ${f.error}`),
    ].join('\n');
    archive.append(manifest, { name: 'manifest.txt' });

    await archive.finalize();
  } catch (err: any) {
    console.error('bulk render error', err);
    // Best-effort: try to finalize the archive so the client at least
    // gets a (possibly partial) ZIP rather than a hung connection.
    try { archive.abort(); } catch { /* noop */ }
  }
});

// ── POST /render-fee-receipt ──────────────────────────────────────────────
//
// Renders a fee receipt as a real PDF. The HTML template lives in the
// `generate-invoice-document` Supabase edge function (which also server-computes
// totals + enforces school-level access). This endpoint forwards the user's JWT
// to that edge function, gets the HTML, and runs it through Puppeteer at the
// right page size:
//   - copies=1 → A5 portrait (148 × 210mm)
//   - copies=2 → A5 landscape (210 × 148mm) with two A6 invoices side-by-side
//
// Body: { invoiceId: uuid, copies?: 1 | 2, paperSize?: 'a4' | 'a5' }
// Returns: application/pdf binary
//
// Paper size defaults to A4 (works on every Indian school printer without
// tray reconfig — content pins to top half of A4 with a tear guide).
// A5 is edge-to-edge for schools with A5 paper or pre-torn half-A4 sheets.

app.post('/render-fee-receipt', requireAuth, async (req, res) => {
  const { invoiceId, copies: copiesIn, paperSize: paperIn } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });
  const copies: 1 | 2 = copiesIn === 2 ? 2 : 1;
  const paperSize: 'a4' | 'a5' = paperIn === 'a5' ? 'a5' : 'a4';

  // The JWT was already validated by requireAuth — we just need to forward it.
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  try {
    const { pdf, invoiceNumber } = await renderFeeReceiptPdf({
      authToken: token,
      invoiceId,
      copies,
      paperSize,
    });
    const safe = invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}.pdf"`);
    res.send(pdf);
  } catch (err: any) {
    console.error('fee receipt render error', err);
    res.status(500).json({ error: err?.message || 'Render failed' });
  }
});

app.listen(PORT, () => {
  console.log(`PDF service listening on :${PORT}`);
});
