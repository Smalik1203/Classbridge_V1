import React, { useEffect, useRef } from 'react';
import { Button, Empty, Spin, Space } from 'antd';
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
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
    .rc-page {
      box-shadow: none !important;
      margin: 0 !important;
      max-width: none !important;
    }
    /* Tighter page margins so the colored header bleeds to paper edges. */
    @page { margin: 12mm; size: A4; }
  }
  .rc-page {
    background: #fff;
    color: #1f1f1f;
    padding: 32px 40px 40px;
    max-width: 820px;
    margin: 0 auto;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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

  /* Marks table — official document feel. Header band uses primary color,
     zebra rows for readability, total row highlighted. */
  .rc-table { width: 100%; border-collapse: collapse; margin-top: 26px; font-size: 13px; }
  .rc-table thead th {
    background: var(--rc-primary, #6B3FA0); color: #fff;
    padding: 10px 12px;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.8px; text-transform: uppercase;
    text-align: left;
    border: none;
  }
  .rc-table tbody td {
    padding: 10px 12px;
    border-bottom: 1px solid #ececec;
    color: #1f1f1f;
  }
  .rc-table tbody tr:nth-child(odd) td { background: #fafafa; }
  .rc-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .rc-table tfoot td {
    font-weight: 700;
    background: color-mix(in srgb, var(--rc-primary, #6B3FA0) 8%, #fff);
    color: var(--rc-primary, #6B3FA0);
    padding: 12px;
    border-top: 2px solid var(--rc-primary, #6B3FA0);
    border-bottom: none;
    font-size: 14px;
  }

  /* Summary tiles — Percentage is the hero, others supporting.
     Each tile has its own accent so grade/result/percent are visually distinct. */
  .rc-summary {
    margin-top: 22px;
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
  .rc-remarks { margin-top: 16px; font-size: 13px; }
  .rc-remarks .row { padding: 8px 0; border-bottom: 1px dashed #e5e5e5; }
  .rc-sign { display: flex; justify-content: space-between; margin-top: 48px; font-size: 12px; color: #555; }
  .rc-sign div { text-align: center; }
  .rc-sign .line { border-top: 1px solid #999; padding-top: 4px; min-width: 160px; display: inline-block; }
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

  const triggerPrint = () => {
    const original = document.title;
    document.title = buildFilename();
    // Some browsers read the title at the moment the dialog opens.
    window.print();
    // Restore shortly after — afterprint event isn't reliable across all browsers.
    setTimeout(() => { document.title = original; }, 1000);
  };

  return (
    <div>
      <div className="rc-no-print" style={{ marginBottom: 12, textAlign: 'right' }}>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={triggerPrint}>
            Print
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={triggerPrint}>
            Download PDF
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
            <span className="rc-field-value">{prettifyExamType(group?.exam_type) || '—'}</span>
          </div>
          <div className="rc-field">
            <span className="rc-field-label">Period</span>
            <span className="rc-field-value">{formatPeriod(group?.start_date, group?.end_date)}</span>
          </div>
        </div>

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

        <div className="rc-sign">
          <div><div className="line">Class Teacher</div></div>
          <div><div className="line">Principal</div></div>
          <div><div className="line">Parent / Guardian</div></div>
        </div>
      </div>
    </div>
  );
}
