import React, { useEffect, useRef, useState } from 'react';
import { Button, Empty, Spin, Space } from 'antd';
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, LabelList,
} from 'recharts';
import { supabase } from '@/config/supabaseClient';

// Resolve a stored logo path into a usable URL.
// Accepts: full URL ("https://…"), bucket-prefixed path ("school-branding/SCH019/logo.jpg"),
// or bucket-relative key ("SCH019/logo.jpg"). Returns null if no path.
function resolveLogoUrl(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  // Strip leading bucket name if the row stored "<bucket>/<key>"
  const BUCKET = 'school-branding';
  const key = s.startsWith(`${BUCKET}/`) ? s.slice(BUCKET.length + 1) : s;
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

const styles = `
  /* Force all elements to print background colors / images.
     Without this, browsers strip the colored header band, table header,
     hero tile, and pass/fail tints — leaving a black-and-white skeleton. */
  .rc-page, .rc-page * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  @media print {
    .rc-no-print { display: none !important; }
    body { background: #fff !important; }
    /* Hide everything by default during print — only the report card and its
       ancestors (the dialog overlay, the page wrapper) reveal themselves below.
       Without this the gradebook table and sidebar print as extra pages. */
    body * { visibility: hidden !important; }
    .rc-page, .rc-page * { visibility: visible !important; }
    /* Pull the report card out of the modal it lives in so it prints from the
       page origin, not nested inside the dialog's transformed container. */
    .rc-page {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 24px 28px 28px !important;
      max-width: none !important;
      width: 100% !important;
      min-height: auto !important;
      transform: none !important;
    }
    /* A4 portrait. Margins set on @page; rc-page padding is inside that. */
    @page { margin: 10mm; size: A4 portrait; }
    /* Avoid splitting major blocks across pages */
    .rc-table, .rc-cca-table, .rc-footer-grid, .rc-summary, .rc-meta-grid, .rc-sign {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Tables internally: keep rows together */
    .rc-table tr, .rc-cca-table tr { page-break-inside: avoid !important; break-inside: avoid !important; }
  }
  /* On-screen the page renders at true A4 dimensions so the layout matches
     what gets printed. 210mm × 297mm is the ISO A4 size. */
  .rc-page {
    background: #fff;
    color: #1f1f1f;
    padding: 32px 40px 40px;
    width: 210mm;
    min-height: 297mm;
    max-width: 100%;
    margin: 0 auto;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-sizing: border-box;
  }

  /* HEADER — solid school-color band. Bleeds edge-to-edge.
     Thin accent stripe at the bottom for warmth. */
  .rc-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 20px;
    padding: 26px 32px;
    margin: -32px -40px 0;          /* bleed to page edges */
    background: var(--rc-primary, #6B3FA0);
    color: #fff;
    position: relative;
  }
  .rc-header::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: 0; height: 5px;
    background: var(--rc-accent, #F59E0B);
  }
  .rc-logo-wrap {
    width: 110px; height: 110px;
    border-radius: 50%;
    background: #fff;
    border: 4px solid #fff;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  }
  .rc-logo { width: 100px; height: 100px; object-fit: contain; }
  .rc-logo-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: var(--rc-primary, #6B3FA0); font-weight: 800; font-size: 36px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--rc-primary, #6B3FA0) 8%, #fff), #fff);
  }
  .rc-school-block { text-align: center; min-width: 0; }
  .rc-school-name {
    font-size: 28px; font-weight: 800; margin: 0;
    color: #fff;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    line-height: 1.15;
    text-shadow: 0 1px 2px rgba(0,0,0,0.12);
  }
  .rc-school-tagline {
    font-size: 11px; font-weight: 500;
    color: rgba(255,255,255,0.85);
    text-transform: uppercase; letter-spacing: 1.5px;
    margin-top: 6px;
  }
  .rc-school-meta {
    font-size: 12px;
    color: rgba(255,255,255,0.92);
    margin-top: 6px; line-height: 1.45;
  }
  .rc-school-meta b { color: #fff; font-weight: 600; }
  /* Year chip — white sticker on the colored band, slightly tilted,
     drop shadow so it reads like an affixed label. */
  .rc-cardtype {
    background: #fff;
    border-radius: 4px;
    padding: 10px 14px;
    text-align: center;
    min-width: 130px;
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
    transform: rotate(2deg);
  }
  .rc-cardtype-label {
    font-size: 11px; font-weight: 700;
    color: var(--rc-primary, #6B3FA0);
    letter-spacing: 1px;
  }
  .rc-cardtype-year {
    font-size: 16px; font-weight: 800;
    color: #1f1f1f; margin-top: 4px;
    border-top: 1px solid color-mix(in srgb, var(--rc-primary, #6B3FA0) 25%, #fff);
    padding-top: 4px;
    letter-spacing: 0.5px;
  }

  /* Title strip — slimmer, with side rules so it reads like a section header
     in a document, not a UI banner. */
  .rc-title-bar {
    margin: 32px 0 4px;
    text-align: center;
    color: var(--rc-primary, #6B3FA0);
    font-weight: 700; font-size: 13px;
    letter-spacing: 3px;
    text-transform: uppercase;
    display: flex; align-items: center; gap: 14px;
  }
  .rc-title-bar::before, .rc-title-bar::after {
    content: ''; flex: 1; height: 2px;
    background: var(--rc-primary, #6B3FA0);
    opacity: 0.25;
  }

  /* Student details — fielded form layout with underlined fill-in lines.
     Mirrors how physical school report cards print blanks for the registrar. */
  .rc-meta-grid {
    margin-top: 18px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px 28px;
    font-size: 13px;
  }
  .rc-meta-grid .rc-field {
    display: flex; align-items: baseline; gap: 8px;
    border-bottom: 1px solid #d4d4d4;
    padding-bottom: 4px;
  }
  .rc-meta-grid .rc-field-label {
    color: #6b6b6b; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.6px;
    flex-shrink: 0;
  }
  .rc-meta-grid .rc-field-value {
    color: #1f1f1f; font-weight: 600; font-size: 14px;
  }

  /* Marks table — official-document feel: every cell enclosed by a border so
     the structure reads at a glance, like a printed CBSE report card. */
  .rc-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 26px;
    font-size: 13px;
    border: 1.5px solid #1f1f1f;
  }
  .rc-table thead th {
    background: var(--rc-primary, #6B3FA0); color: #fff;
    padding: 10px 12px;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.8px; text-transform: uppercase;
    text-align: left;
    border: 1px solid color-mix(in srgb, var(--rc-primary, #6B3FA0) 60%, #000);
    vertical-align: middle;
  }
  .rc-table tbody td {
    padding: 10px 12px;
    border: 1px solid #1f1f1f;
    color: #1f1f1f;
    background: #fff;
  }
  .rc-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .rc-table tfoot td {
    font-weight: 700;
    background: color-mix(in srgb, var(--rc-primary, #6B3FA0) 10%, #fff);
    color: var(--rc-primary, #6B3FA0);
    padding: 12px;
    border: 1.5px solid var(--rc-primary, #6B3FA0);
    font-size: 14px;
  }

  /* Summary tiles — Percentage is the hero, others supporting.
     Each tile has its own accent so grade/result/percent are visually distinct. */
  .rc-summary {
    margin-top: 18px;
    margin-bottom: 4px;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: 12px;
  }
  .rc-stat {
    border-radius: 10px;
    padding: 14px 16px;
    text-align: center;
    border: 1px solid #ececec;
    background: #fff;
  }
  .rc-stat .label {
    font-size: 10px; color: #888;
    text-transform: uppercase; letter-spacing: 1px;
    font-weight: 600;
  }
  .rc-stat .value {
    font-size: 22px; font-weight: 800; color: #1f1f1f;
    margin-top: 6px; letter-spacing: -0.3px;
  }
  /* Hero tile — Percentage. Filled with primary color, biggest number. */
  .rc-stat--hero {
    background: var(--rc-primary, #6B3FA0);
    border-color: var(--rc-primary, #6B3FA0);
  }
  .rc-stat--hero .label { color: rgba(255,255,255,0.78); }
  .rc-stat--hero .value { color: #fff; font-size: 28px; }
  /* Result tile — colored by pass/fail. */
  .rc-stat--pass {
    background: #ecfdf5; border-color: #a7f3d0;
  }
  .rc-stat--pass .value { color: #047857; }
  .rc-stat--fail {
    background: #fef2f2; border-color: #fecaca;
  }
  .rc-stat--fail .value { color: #b91c1c; }
  /* Analytics — subject-wise performance chart. Sits between the marks table
     and the summary tiles. Sized to fit on the same A4 page as the rest of
     the card without forcing a page break. */
  .rc-analytics {
    margin-top: 18px;
    padding: 12px 14px 8px;
    border: 1px solid #ececec;
    border-radius: 10px;
    background: #fff;
    page-break-inside: avoid;
  }
  .rc-analytics-title {
    font-size: 11px; font-weight: 700;
    color: var(--rc-primary, #6B3FA0);
    text-transform: uppercase; letter-spacing: 1.2px;
    margin-bottom: 4px;
  }
  .rc-analytics-sub {
    font-size: 10px; color: #888; margin-bottom: 6px;
  }
  .rc-analytics-legend {
    display: flex; flex-wrap: wrap; gap: 10px 14px; margin-top: 4px;
    font-size: 10px; color: #555;
  }
  .rc-analytics-legend .sw {
    display: inline-block; width: 9px; height: 9px;
    border-radius: 2px; margin-right: 5px; vertical-align: middle;
  }
  @media print {
    .rc-analytics { margin-top: 14px; padding: 10px 12px 6px; }
  }

  .rc-remarks { margin-top: 16px; font-size: 13px; }
  .rc-remarks .row { padding: 8px 0; border-bottom: 1px dashed #e5e5e5; }
  .rc-sign { display: flex; justify-content: space-between; margin-top: 48px; font-size: 12px; color: #555; }
  .rc-sign div { text-align: center; }
  .rc-sign .line { border-top: 1px solid #999; padding-top: 4px; min-width: 160px; display: inline-block; }

  /* ── Annual (St George) extras: section heading, CCA table, mini fact tables,
     remarks/result lines. The marks table style is reused. ── */
  .rc-section-title {
    margin-top: 22px;
    color: var(--rc-primary, #6B3FA0);
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .rc-cca-table { margin-top: 8px; }
  .rc-cca-table tbody td:last-child { background: #fff; }
  .rc-footer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
  }
  .rc-mini-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #1f1f1f;
    font-size: 13px;
  }
  .rc-mini-table td {
    border: 1px solid #1f1f1f;
    padding: 8px 12px;
  }
  .rc-mini-label { font-weight: 600; background: #f5f5f5; width: 50%; }
  .rc-mini-value { background: #fff; }
  .rc-remarks-line {
    margin-top: 14px;
    font-size: 13px;
    color: #1f1f1f;
  }
  .rc-result-line {
    margin-top: 6px;
    font-size: 13px;
    color: #1f1f1f;
  }
  .rc-result-fill {
    display: inline-block;
    min-width: 40px;
    border-bottom: 1px solid #1f1f1f;
    padding: 0 6px;
    font-weight: 700;
  }

  /* Responsive — keep print layout intact, but fit on small screens */
  @media screen and (max-width: 760px) {
    .rc-page { padding: 20px 18px 24px; }
    .rc-header {
      grid-template-columns: 1fr;
      gap: 14px;
      padding: 18px 20px;
      margin: -20px -18px 0;
      text-align: center;
    }
    .rc-logo-wrap { margin: 0 auto; width: 80px; height: 80px; }
    .rc-logo { width: 72px; height: 72px; }
    .rc-cardtype { transform: none; min-width: 0; align-self: center; }
    .rc-summary { grid-template-columns: 1fr 1fr; }
    .rc-stat--hero .value { font-size: 22px; }
    .rc-table { font-size: 12px; }
    .rc-sign { flex-direction: column; gap: 28px; align-items: center; }
  }
`;

const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}
function formatPeriod(start, end) {
  if (!start && !end) return '—';
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start || end);
}
function prettifyExamType(t) {
  if (!t) return '';
  return String(t).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Roman numerals up to XX is plenty for term columns.
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
               'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
function toRoman(n) { return ROMAN[n] || String(n); }

// Static Co-Curricular Activities list (St George format). Each row gets an
// empty grade cell when CCA data isn't yet captured in the system.
const CCA_AREAS = [
  'Physical & Health Education',
  'Art & Cultural Education',
  'Value Education & Life Skills',
  'Sports',
  'Library & Daily News Paper',
  'Discipline',
  'Performing Arts',
  'GK',
  'Art & Craft',
];

export default function ReportCardPreview({ data, loading = false }) {
  const printRef = useRef(null);

  useEffect(() => {
    const id = 'rc-print-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id;
      tag.innerHTML = styles;
      document.head.appendChild(tag);
    }
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;
  if (!data) return <Empty description="No report card data" />;

  const { branding, group, student, subjects, totals, overall_grade } = data;
  const primary = branding?.primary_color || '#6B3FA0';
  const logoUrl = resolveLogoUrl(branding?.logo_url);

  const schoolName = branding?.school_name || 'School';

  // Compact one-line address — drop the verbose Address-1/Building-Number/etc
  // labels that older onboarding produced. Keep meaningful parts only.
  const compactAddress = (() => {
    const raw = branding?.school_address || '';
    if (!raw) return '';
    if (!raw.includes('\n') && raw.length < 80) return raw; // already clean
    const parts = raw
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter((s) =>
        s &&
        !/^address\s*\d*\s*:?$/i.test(s) &&
        !/^(building number|street name|street address|state|city|post code|postcode|pin)\s*:/i.test(s)
      )
      .map((s) => s.replace(/^(building number|street name|street address|state|city|post code|postcode|pin)\s*:\s*/i, ''));
    return parts.slice(0, 4).join(', ');
  })();

  // Academic-year label for the "Progress Card" chip.
  // Prefer group.academic_year_label if buildReportCardData resolves it,
  // else derive from group.start_date / end_date when they span a year,
  // else fall back to the start year alone.
  const academicYearLabel = (() => {
    if (group?.academic_year_label) return group.academic_year_label;
    const s = group?.start_date?.slice(0, 4);
    const e = group?.end_date?.slice(0, 4);
    if (s && e && s !== e) return `${s}-${e}`;
    if (s) return `${s}-${(parseInt(s, 10) + 1).toString()}`;
    return '';
  })();

  // Build a clean filename like "Avni-Mehta_Unit-Test-1_2026-04.pdf".
  // Browsers default the saved-PDF filename to document.title, so we swap
  // it just for the print, then restore.
  const buildFilename = () => {
    const slug = (s) => String(s || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '');
    const parts = [
      slug(student?.full_name) || 'Student',
      slug(group?.name) || 'ReportCard',
      group?.start_date ? group.start_date.slice(0, 7) : '',
    ].filter(Boolean);
    return parts.join('_');
  };

  // window.print() — browser-side print dialog. Free, immediate, but quality
  // depends on user's browser. Used as fallback or by users who want to
  // print directly without a server roundtrip.
  const triggerPrint = () => {
    const original = document.title;
    document.title = buildFilename();
    window.print();
    setTimeout(() => { document.title = original; }, 1000);
  };

  // Server-rendered PDF via the Railway PDF service. Pixel-perfect, identical
  // across devices. Falls back to window.print() if the service URL isn't
  // configured (dev) or the request fails.
  const [downloading, setDownloading] = useState(false);
  const triggerDownloadPdf = async () => {
    const serviceUrl = import.meta.env.VITE_PDF_SERVICE_URL;
    if (!serviceUrl) {
      // No service configured — fall back to browser print.
      triggerPrint();
      return;
    }
    if (!group?.id || !student?.id) {
      triggerPrint();
      return;
    }
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');

      // Send the right ID field based on report kind. Server auto-detects
      // template from the exam_groups row, but using the matching field name
      // makes the request log self-describing.
      const idField = group?.kind === 'term_report' ? 'termReportId' : 'examGroupId';
      const res = await fetch(`${serviceUrl.replace(/\/+$/, '')}/render-report-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [idField]: group.id, studentId: student.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `PDF service returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${buildFilename()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      // Surface the error and fall back to browser print so user isn't blocked.
      console.error('PDF service failed, falling back to browser print:', err);
      triggerPrint();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="rc-no-print" style={{ marginBottom: 12, textAlign: 'right' }}>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={triggerPrint}>
            Print
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={triggerDownloadPdf} loading={downloading}>
            {downloading ? 'Generating…' : 'Download PDF'}
          </Button>
        </Space>
      </div>

      <div ref={printRef} className="rc-page" style={{ ['--rc-primary']: primary, ['--rc-accent']: branding?.accent_color || '#F59E0B' }}>
        <div className="rc-header">
          <div className="rc-logo-wrap">
            {logoUrl ? (
              <img
                className="rc-logo"
                src={logoUrl}
                alt="School logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="rc-logo-fallback">
                {(branding?.school_name || 'S').trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="rc-school-block">
            <h1 className="rc-school-name">{schoolName}</h1>
            {branding?.tagline && <div className="rc-school-tagline">{branding.tagline}</div>}
            {compactAddress && <div className="rc-school-meta">{compactAddress}</div>}
            {branding?.school_phone && (
              <div className="rc-school-meta">Phone: {branding.school_phone}</div>
            )}
          </div>

          <div className="rc-cardtype">
            <div className="rc-cardtype-label">PROGRESS CARD</div>
            <div className="rc-cardtype-year">{academicYearLabel || '—'}</div>
          </div>
        </div>

        <div className="rc-title-bar">{group?.name || 'Report Card'}</div>

        <div className="rc-meta-grid">
          <div className="rc-field">
            <span className="rc-field-label">Student Name</span>
            <span className="rc-field-value">{student?.full_name || '—'}</span>
          </div>
          <div className="rc-field">
            <span className="rc-field-label">Roll No.</span>
            <span className="rc-field-value">{student?.student_code || '—'}</span>
          </div>
          <div className="rc-field">
            <span className="rc-field-label">Examination</span>
            <span className="rc-field-value">
              {group?.mode === 'annual'
                ? 'Term End Report'
                : prettifyExamType(group?.exam_type) || '—'}
            </span>
          </div>
          <div className="rc-field">
            <span className="rc-field-label">Period</span>
            <span className="rc-field-value">{formatPeriod(group?.start_date, group?.end_date)}</span>
          </div>
        </div>

        <div className="rc-summary">
          <div className="rc-stat rc-stat--hero">
            <div className="label">Percentage</div>
            <div className="value">{totals?.percentage != null ? `${totals.percentage}%` : '—'}</div>
          </div>
          <div className="rc-stat">
            <div className="label">Total</div>
            <div className="value">{fmt(totals?.obtained)}/{fmt(totals?.max)}</div>
          </div>
          <div className="rc-stat">
            <div className="label">Grade</div>
            <div className="value">{overall_grade || '—'}</div>
          </div>
          <div className={`rc-stat ${totals?.percentage == null ? '' : (totals.percentage >= 33 ? 'rc-stat--pass' : 'rc-stat--fail')}`}>
            <div className="label">Result</div>
            <div className="value">{totals?.percentage != null ? (totals.percentage >= 33 ? 'PASS' : 'FAIL') : '—'}</div>
          </div>
        </div>

        {/*
          Three layouts:
            • Annual term-end report (group.mode === 'annual'): St George
              format — Subject | Term-I | Term-II | ... | Total | Grade.
            • Term Report (group.kind === 'term_report'): "Periodic
              Assessment | Term | Total | %" columns.
            • Single-exam report card: legacy layout (Marks Obtained / Max / %).
        */}
        {group?.mode === 'annual' ? (() => {
          const sources = data?.sources || [];
          const sourceTotals = sources.map((src) => {
            const obt = subjects.reduce((a, s) => {
              const cell = (s.term_components || []).find((c) => c.source_id === src.id);
              return a + Number(cell?.marks || 0);
            }, 0);
            const max = subjects.reduce((a, s) => {
              const cell = (s.term_components || []).find((c) => c.source_id === src.id);
              return a + Number(cell?.max || 0);
            }, 0);
            return { id: src.id, name: src.name, obt, max };
          });
          // Per-subject max (assuming all subjects share the same max per term —
          // typical for CBSE schools). Pull from the first subject that has a
          // cell for each source. Headers read e.g. "Term-I (50M)".
          const perSubjectMax = (sourceId) => {
            for (const s of subjects) {
              const cell = (s.term_components || []).find((c) => c.source_id === sourceId);
              if (cell?.max > 0) return cell.max;
            }
            return 0;
          };
          const subjectTotalMax = sources.reduce((a, src) => a + (perSubjectMax(src.id) || 0), 0);
          // Per-subject grade for the GRADE column was attached server-side.
          return (
            <table className="rc-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Subject</th>
                  {sources.map((src, i) => {
                    const m = perSubjectMax(src.id);
                    return (
                      <th key={src.id} className="num">
                        {`Term-${toRoman(i + 1)}`}
                        {m > 0 && ` (${fmt(m)}M)`}
                      </th>
                    );
                  })}
                  <th className="num" style={{ width: 100 }}>
                    Total{subjectTotalMax > 0 ? ` (${fmt(subjectTotalMax)}M)` : ''}
                  </th>
                  <th className="num" style={{ width: 70 }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {subjects.length === 0 ? (
                  <tr><td colSpan={4 + sources.length} style={{ textAlign: 'center', color: '#999' }}>No subjects</td></tr>
                ) : subjects.map((s, i) => (
                  <tr key={s.subject_id || i}>
                    <td>{i + 1}</td>
                    <td style={{ color: 'var(--rc-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {s.subject_name}
                    </td>
                    {(s.term_components || []).map((c) => (
                      <td key={c.source_id} className="num">
                        {c.marks == null ? '—' : fmt(c.marks)}
                      </td>
                    ))}
                    <td className="num">{s.any_marks ? fmt(s.marks_obtained) : '—'}</td>
                    <td className="num">{s.grade || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>TOTAL</td>
                  {sourceTotals.map((t) => (
                    <td key={t.id} className="num">{fmt(t.obt)}</td>
                  ))}
                  <td className="num">{fmt(totals?.obtained)}/{fmt(totals?.max)}</td>
                  <td className="num">{overall_grade || '—'}</td>
                </tr>
              </tfoot>
            </table>
          );
        })() : group?.kind === 'term_report' ? (() => {
          // Per the school's setup, all subjects share the same PA + Term max.
          // Pull those off the first subject that has them so the column header
          // can display the max (e.g., "Periodic Assessment (20M)").
          const firstWithPa = subjects.find((s) => s.best_pa);
          const firstWithTerm = subjects.find((s) => s.term);
          const paMax = firstWithPa?.best_pa?.max || 0;
          const termMax = firstWithTerm?.term?.max || 0;
          const subjectMax = paMax + termMax;
          const paObtTotal = subjects.reduce((a, s) => a + (s.best_pa?.marks || 0), 0);
          const termObtTotal = subjects.reduce((a, s) => a + (s.term?.marks || 0), 0);
          return (
            <table className="rc-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Subject</th>
                  <th className="num" style={{ width: 130 }}>
                    Periodic Assessment{paMax > 0 ? ` (${fmt(paMax)}M)` : ''}
                  </th>
                  <th className="num" style={{ width: 100 }}>
                    Term{termMax > 0 ? ` (${fmt(termMax)}M)` : ''}
                  </th>
                  <th className="num" style={{ width: 100 }}>
                    Total{subjectMax > 0 ? ` (${fmt(subjectMax)}M)` : ''}
                  </th>
                  <th className="num" style={{ width: 70 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {subjects.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>No subjects</td></tr>
                ) : subjects.map((s, i) => (
                  <tr key={s.subject_id || i}>
                    <td>{i + 1}</td>
                    <td>{s.subject_name}</td>
                    <td className="num">{s.best_pa ? fmt(s.best_pa.marks) : '—'}</td>
                    <td className="num">{s.term ? fmt(s.term.marks) : '—'}</td>
                    <td className="num">{s.any_marks ? fmt(s.marks_obtained) : '—'}</td>
                    <td className="num">{s.percentage != null ? `${s.percentage}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>TOTAL</td>
                  <td className="num">{paMax > 0 ? fmt(paObtTotal) : '—'}</td>
                  <td className="num">{termMax > 0 ? fmt(termObtTotal) : '—'}</td>
                  <td className="num">{fmt(totals?.obtained)}/{fmt(totals?.max)}</td>
                  <td className="num">{totals?.percentage != null ? `${totals.percentage}%` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          );
        })() : (
          <table className="rc-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Subject</th>
                <th className="num" style={{ width: 90 }}>Marks Obtained</th>
                <th className="num" style={{ width: 70 }}>Max</th>
                <th className="num" style={{ width: 70 }}>%</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>No subjects in this exam</td></tr>
              ) : subjects.map((s, i) => (
                <tr key={s.test_id}>
                  <td>{i + 1}</td>
                  <td>{s.subject_name}</td>
                  <td className="num">{fmt(s.marks_obtained)}</td>
                  <td className="num">{fmt(s.max_marks)}</td>
                  <td className="num">{s.percentage != null ? `${s.percentage}%` : '—'}</td>
                  <td>{s.remarks || ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>TOTAL</td>
                <td className="num">{fmt(totals?.obtained)}</td>
                <td className="num">{fmt(totals?.max)}</td>
                <td className="num">{totals?.percentage != null ? `${totals.percentage}%` : '—'}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Annual-only: CCA section + footer fields, mirroring St George format */}
        {group?.mode === 'annual' && (
          <>
            <div className="rc-section-title">Co-Curricular Activities (CCA)</div>
            <table className="rc-table rc-cca-table">
              <thead>
                <tr>
                  <th>Area</th>
                  <th className="num" style={{ width: 140 }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {CCA_AREAS.map((area) => (
                  <tr key={area}>
                    <td>{area}</td>
                    <td className="num">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="rc-footer-grid">
              <table className="rc-mini-table">
                <tbody>
                  <tr>
                    <td className="rc-mini-label">No. of Working Days</td>
                    <td className="rc-mini-value">&nbsp;</td>
                  </tr>
                  <tr>
                    <td className="rc-mini-label">Days Present</td>
                    <td className="rc-mini-value">&nbsp;</td>
                  </tr>
                </tbody>
              </table>
              <table className="rc-mini-table">
                <tbody>
                  <tr>
                    <td className="rc-mini-label">Height (in Cms)</td>
                    <td className="rc-mini-value">&nbsp;</td>
                  </tr>
                  <tr>
                    <td className="rc-mini-label">Weight (in Kgs)</td>
                    <td className="rc-mini-value">&nbsp;</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rc-remarks-line">
              <strong>Remarks:</strong> Outstanding / Excellent / Very Good / Needs Improvement
            </div>
            <div className="rc-result-line">
              <strong>Result:</strong> CONGRATULATIONS !! Promoted to Grade:{' '}
              <span className="rc-result-fill">
                {(() => {
                  const g = student?.class_instances?.grade;
                  return g != null ? Number(g) + 1 : '_____';
                })()}
              </span>
            </div>
          </>
        )}

        {/* Skip the chart in annual mode — St George format doesn't have one. */}
        {group?.mode !== 'annual' && subjects.length > 0 && (
          <div className="rc-analytics">
            <div className="rc-analytics-title">Subject-wise Performance</div>
            <div className="rc-analytics-sub">
              Percentage scored in each subject. Dashed line marks the {totals?.percentage != null ? `class-overall ${totals.percentage}%` : 'pass mark'}.
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={subjects.map((s) => ({
                  name: s.subject_name,
                  pct: s.percentage != null ? Number(s.percentage) : 0,
                  obtained: s.marks_obtained,
                  max: s.max_marks,
                }))}
                margin={{ top: 18, right: 8, bottom: 4, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#1f1f1f' }}
                  interval={0}
                  height={36}
                  tickFormatter={(v) => (String(v).length > 10 ? `${String(v).slice(0, 10)}…` : v)}
                />
                <YAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#888' }}
                  tickFormatter={(v) => `${v}%`}
                  width={36}
                />
                <Tooltip
                  formatter={(v, _n, p) => [`${v}% (${p.payload.obtained}/${p.payload.max})`, 'Score']}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <ReferenceLine
                  y={totals?.percentage != null ? Number(totals.percentage) : 33}
                  stroke={primary}
                  strokeDasharray="4 4"
                />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={42}>
                  {subjects.map((s, i) => {
                    const p = s.percentage != null ? Number(s.percentage) : 0;
                    const fill = p >= 75 ? '#10b981' : p >= 50 ? primary : p >= 33 ? '#f59e0b' : '#ef4444';
                    return <Cell key={i} fill={fill} />;
                  })}
                  <LabelList
                    dataKey="pct"
                    position="top"
                    formatter={(v) => `${v}%`}
                    style={{ fontSize: 10, fill: '#1f1f1f', fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="rc-analytics-legend">
              <span><span className="sw" style={{ background: '#10b981' }} />Distinction (≥75%)</span>
              <span><span className="sw" style={{ background: primary }} />Strong (50–74%)</span>
              <span><span className="sw" style={{ background: '#f59e0b' }} />Pass (33–49%)</span>
              <span><span className="sw" style={{ background: '#ef4444' }} />Below pass (&lt;33%)</span>
            </div>
          </div>
        )}

        <div className="rc-sign">
          <div><div className="line">Class Teacher</div></div>
          <div><div className="line">Principal</div></div>
          <div><div className="line">Parent / Guardian</div></div>
        </div>
      </div>
    </div>
  );
}
