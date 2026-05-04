import express, { type Request, type Response, type NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { renderTermReportPdf, renderAnnualReportPdf, renderExamReportPdf } from './render.js';

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

const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

  // Per-request Supabase client bound to this JWT
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

app.listen(PORT, () => {
  console.log(`PDF service listening on :${PORT}`);
});
