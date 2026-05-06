// Handlebars templates as TS strings. No separate .hbs files = simpler tsc build,
// no asset-bundling step. Each template owns its <style> block.

const SHARED_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Times New Roman", serif;
         color: #1f1f1f; }
  @page { size: A4 portrait; margin: 8mm; }

  .page { padding: 14px 18px 16px; }

  /* HEADER — coloured band that bleeds to the page edges */
  .header { display: grid; grid-template-columns: auto 1fr auto; align-items: center;
            gap: 16px; padding: 14px 22px; margin: -14px -18px 0;
            background: var(--primary); color: #fff; position: relative; }
  .header::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0;
                   height: 5px; background: var(--accent); }
  .logo-wrap { width: 70px; height: 70px; border-radius: 50%; background: #fff;
               border: 2px solid #fff; display: flex; align-items: center; justify-content: center;
               overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .logo-wrap img { width: 64px; height: 64px; object-fit: contain; }
  .logo-fallback { width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;
                   background: #f5f5f5; color: #555; font-weight: 800; font-size: 26px; }
  .school-block { text-align: center; }
  .school-name { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 0 0 4px; }
  .school-tagline { font-size: 11px; opacity: 0.9; margin-bottom: 4px; }
  .school-meta { font-size: 11px; opacity: 0.85; }

  .cardtype { background: #fff; color: var(--primary); padding: 10px 14px;
              border-radius: 4px; text-align: center; min-width: 110px; }
  .cardtype-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; }
  .cardtype-year { font-size: 16px; font-weight: 800; margin-top: 2px; }

  /* Title bar */
  .title-bar { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 2px;
               text-transform: uppercase; padding: 8px 0; border-bottom: 2px solid var(--primary);
               margin: 12px 0 10px; color: var(--primary); }

  /* Student details */
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px;
               border: 1.5px solid #1f1f1f; padding: 10px 14px; }
  .meta-row { display: flex; gap: 8px; align-items: baseline; font-size: 12px; }
  .meta-label { font-weight: 700; min-width: 130px; color: #555; }
  .meta-value { color: #1f1f1f; font-weight: 600; }

  /* Stat tiles (kept minimal vs ReportCardPreview to save space) */
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
             margin-top: 10px; }
  .stat { border: 1.5px solid #1f1f1f; padding: 7px; text-align: center; }
  .stat .label { font-size: 9px; font-weight: 700; text-transform: uppercase;
                 letter-spacing: 0.6px; color: #555; }
  .stat .value { font-size: 16px; font-weight: 800; margin-top: 3px; }
  .stat--hero { background: var(--primary); color: #fff; border-color: var(--primary); }
  .stat--hero .label, .stat--hero .value { color: #fff; }
  .stat--pass { background: #ecfdf5; border-color: #10b981; color: #047857; }
  .stat--pass .label, .stat--pass .value { color: #047857; }
  .stat--fail { background: #fef2f2; border-color: #b91c1c; color: #991b1b; }

  /* Marks table */
  table.marks { width: 100%; border-collapse: collapse; margin-top: 10px;
                border: 1.5px solid #1f1f1f; font-size: 11px; }
  table.marks thead th { background: var(--primary); color: #fff; padding: 6px 8px;
                         font-size: 9.5px; font-weight: 700; letter-spacing: 0.7px;
                         text-transform: uppercase; border: 1px solid var(--primary-dark, #4a2a70);
                         text-align: left; vertical-align: middle; }
  table.marks tbody td { padding: 5px 8px; border: 1px solid #1f1f1f; background: #fff; }
  table.marks tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.marks tbody td.subject-name { color: var(--primary); font-weight: 700;
                                      text-transform: uppercase; letter-spacing: 0.4px; }
  table.marks tfoot td { font-weight: 700; padding: 6px 8px;
                         background: color-mix(in srgb, var(--primary) 10%, #fff);
                         color: var(--primary); border: 1.5px solid var(--primary);
                         font-size: 12px; }
  table.marks tfoot td.num { text-align: right; font-variant-numeric: tabular-nums; }

  /* Avoid splitting blocks */
  table.marks, table.cca, .summary, .meta-grid, .footer-grid, .signatures { page-break-inside: avoid; break-inside: avoid; }
  tr { page-break-inside: avoid; break-inside: avoid; }

  /* CCA + footer */
  .section-title { margin: 10px 0 4px; color: var(--primary); font-size: 11px;
                   font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; }
  table.cca { width: 100%; border-collapse: collapse; border: 1.5px solid #1f1f1f;
              font-size: 11px; }
  table.cca th { background: var(--primary); color: #fff; padding: 5px 8px;
                 font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.6px;
                 border: 1px solid var(--primary-dark, #4a2a70); text-align: left; }
  table.cca td { padding: 3px 8px; border: 1px solid #1f1f1f; background: #fff; }
  table.cca td.grade-cell { width: 140px; height: 16px; }

  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
  table.mini { width: 100%; border-collapse: collapse; border: 1.5px solid #1f1f1f;
               font-size: 11px; }
  table.mini td { padding: 4px 8px; border: 1px solid #1f1f1f; }
  table.mini .label-cell { font-weight: 700; background: #f5f5f5; width: 50%; }
  .remarks-line, .result-line { margin-top: 8px; font-size: 11px; }
  .result-fill { display: inline-block; min-width: 36px; padding: 0 6px;
                 border-bottom: 1px solid #1f1f1f; font-weight: 700; }

  .signatures { display: flex; justify-content: space-between; margin-top: 18px; font-size: 10px; color: #555; }
  .signatures .sig { text-align: center; }
  .signatures .line { border-top: 1px solid #999; padding-top: 3px; min-width: 130px; display: inline-block; }

  /* Meta-grid tighter */
  .meta-grid { padding: 7px 10px; }
  .meta-row { font-size: 11px; }
  .meta-label { min-width: 110px; }
`;

// ── Term Report (mid-term: PA + Term layout) ────────────────────────────────
export const TERM_TEMPLATE = `<!doctype html>
<html><head><meta charset="utf-8"/><title>{{group.name}}</title>
<style>:root { --primary: {{primary_color}}; --accent: {{accent_color}}; }${SHARED_CSS}</style>
</head><body>
<div class="page">
  <div class="header">
    <div class="logo-wrap">
      {{#if branding.logo_url}}<img src="{{branding.logo_url}}" alt="logo"/>{{else}}
        <div class="logo-fallback">{{upper (or branding.school_name 'S')}}</div>
      {{/if}}
    </div>
    <div class="school-block">
      <div class="school-name">{{upper (or branding.school_name 'School')}}</div>
      {{#if branding.tagline}}<div class="school-tagline">{{branding.tagline}}</div>{{/if}}
      {{#if branding.school_address}}<div class="school-meta">{{branding.school_address}}</div>{{/if}}
      {{#if branding.school_phone}}<div class="school-meta">Phone: {{branding.school_phone}}</div>{{/if}}
    </div>
    <div class="cardtype">
      <div class="cardtype-label">PROGRESS CARD</div>
      <div class="cardtype-year">{{group.academic_year_label}}</div>
    </div>
  </div>

  <div class="title-bar">{{upper group.name}}</div>

  <div class="meta-grid">
    <div class="meta-row"><span class="meta-label">Student Name</span><span class="meta-value">{{student.full_name}}</span></div>
    <div class="meta-row"><span class="meta-label">Roll No.</span><span class="meta-value">{{student.student_code}}</span></div>
    <div class="meta-row"><span class="meta-label">Examination</span><span class="meta-value">Term Report</span></div>
    <div class="meta-row"><span class="meta-label">Class</span><span class="meta-value">Grade {{student.grade}}-{{student.section}}</span></div>
  </div>

  <div class="summary">
    <div class="stat stat--hero"><div class="label">Percentage</div><div class="value">{{#if totals.percentage}}{{totals.percentage}}%{{else}}—{{/if}}</div></div>
    <div class="stat"><div class="label">Total</div><div class="value">{{toFixed totals.obtained 1}}/{{toFixed totals.max 0}}</div></div>
    <div class="stat"><div class="label">Grade</div><div class="value">{{#if overall_grade}}{{overall_grade}}{{else}}—{{/if}}</div></div>
    <div class="stat {{#if (eq result 'PASS')}}stat--pass{{/if}}{{#if (eq result 'FAIL')}}stat--fail{{/if}}"><div class="label">Result</div><div class="value">{{#if result}}{{result}}{{else}}—{{/if}}</div></div>
  </div>

  <table class="marks">
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Subject</th>
        <th class="num" style="width:120px">Periodic Assessment{{#if (gt pa_max_per_subject 0)}} ({{pa_max_per_subject}}M){{/if}}</th>
        <th class="num" style="width:90px">Term{{#if (gt term_max_per_subject 0)}} ({{term_max_per_subject}}M){{/if}}</th>
        <th class="num" style="width:90px">Total{{#if (gt total_per_subject 0)}} ({{total_per_subject}}M){{/if}}</th>
        <th class="num" style="width:60px">%</th>
      </tr>
    </thead>
    <tbody>
      {{#each subjects}}
      <tr>
        <td>{{inc @index}}</td>
        <td class="subject-name">{{subject_name}}</td>
        <td class="num">{{#if pa_marks}}{{pa_marks}}{{else}}—{{/if}}</td>
        <td class="num">{{#if term_marks}}{{term_marks}}{{else}}—{{/if}}</td>
        <td class="num">{{#if total_marks}}{{toFixed total_marks 1}}{{else}}—{{/if}}</td>
        <td class="num">{{#if percentage}}{{percentage}}%{{else}}—{{/if}}</td>
      </tr>
      {{/each}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOTAL</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num">{{toFixed totals.obtained 1}}/{{toFixed totals.max 0}}</td>
        <td class="num">{{#if totals.percentage}}{{totals.percentage}}%{{else}}—{{/if}}</td>
      </tr>
    </tfoot>
  </table>

  <div class="signatures">
    <div class="sig"><div class="line">Class Teacher</div></div>
    <div class="sig"><div class="line">Principal</div></div>
    <div class="sig"><div class="line">Parent / Guardian</div></div>
  </div>
</div>
</body></html>`;

// ── Single-Exam Report (Unit Test, ad-hoc assessment) ──────────────────────
// Simpler than TERM_TEMPLATE: one marks column, no PA/Term split.
export const EXAM_TEMPLATE = `<!doctype html>
<html><head><meta charset="utf-8"/><title>{{group.name}}</title>
<style>:root { --primary: {{primary_color}}; --accent: {{accent_color}}; }${SHARED_CSS}</style>
</head><body>
<div class="page">
  <div class="header">
    <div class="logo-wrap">
      {{#if branding.logo_url}}<img src="{{branding.logo_url}}" alt="logo"/>{{else}}
        <div class="logo-fallback">{{upper (or branding.school_name 'S')}}</div>
      {{/if}}
    </div>
    <div class="school-block">
      <div class="school-name">{{upper (or branding.school_name 'School')}}</div>
      {{#if branding.tagline}}<div class="school-tagline">{{branding.tagline}}</div>{{/if}}
      {{#if branding.school_address}}<div class="school-meta">{{branding.school_address}}</div>{{/if}}
      {{#if branding.school_phone}}<div class="school-meta">Phone: {{branding.school_phone}}</div>{{/if}}
    </div>
    <div class="cardtype">
      <div class="cardtype-label">PROGRESS CARD</div>
      <div class="cardtype-year">{{group.academic_year_label}}</div>
    </div>
  </div>

  <div class="title-bar">{{upper group.name}}</div>

  <div class="meta-grid">
    <div class="meta-row"><span class="meta-label">Student Name</span><span class="meta-value">{{student.full_name}}</span></div>
    <div class="meta-row"><span class="meta-label">Roll No.</span><span class="meta-value">{{student.student_code}}</span></div>
    <div class="meta-row"><span class="meta-label">Examination</span><span class="meta-value">{{examination_label}}</span></div>
    <div class="meta-row"><span class="meta-label">Class</span><span class="meta-value">Grade {{student.grade}}-{{student.section}}</span></div>
  </div>

  <div class="summary">
    <div class="stat stat--hero"><div class="label">Percentage</div><div class="value">{{#if totals.percentage}}{{totals.percentage}}%{{else}}—{{/if}}</div></div>
    <div class="stat"><div class="label">Total</div><div class="value">{{toFixed totals.obtained 1}}/{{toFixed totals.max 0}}</div></div>
    <div class="stat"><div class="label">Grade</div><div class="value">{{#if overall_grade}}{{overall_grade}}{{else}}—{{/if}}</div></div>
    <div class="stat {{#if (eq result 'PASS')}}stat--pass{{/if}}{{#if (eq result 'FAIL')}}stat--fail{{/if}}"><div class="label">Result</div><div class="value">{{#if result}}{{result}}{{else}}—{{/if}}</div></div>
  </div>

  <table class="marks">
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Subject</th>
        <th class="num" style="width:130px">Marks Obtained</th>
        <th class="num" style="width:80px">Max</th>
        <th class="num" style="width:60px">%</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>
      {{#each subjects}}
      <tr>
        <td>{{inc @index}}</td>
        <td class="subject-name">{{subject_name}}</td>
        <td class="num">{{#if marks_obtained}}{{marks_obtained}}{{else}}—{{/if}}</td>
        <td class="num">{{max_marks}}</td>
        <td class="num">{{#if percentage}}{{percentage}}%{{else}}—{{/if}}</td>
        <td>{{#if remarks}}{{remarks}}{{/if}}</td>
      </tr>
      {{/each}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOTAL</td>
        <td class="num">{{toFixed totals.obtained 1}}</td>
        <td class="num">{{toFixed totals.max 0}}</td>
        <td class="num">{{#if totals.percentage}}{{totals.percentage}}%{{else}}—{{/if}}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="signatures">
    <div class="sig"><div class="line">Class Teacher</div></div>
    <div class="sig"><div class="line">Principal</div></div>
    <div class="sig"><div class="line">Parent / Guardian</div></div>
  </div>
</div>
</body></html>`;

// ── Annual Term-End Report (generic layout: Term I/II + CCA + footer) ─────
export const ANNUAL_TEMPLATE = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Term End Report</title>
<style>:root { --primary: {{primary_color}}; --accent: {{accent_color}}; }${SHARED_CSS}</style>
</head><body>
<div class="page">
  <div class="header">
    <div class="logo-wrap">
      {{#if branding.logo_url}}<img src="{{branding.logo_url}}" alt="logo"/>{{else}}
        <div class="logo-fallback">{{upper (or branding.school_name 'S')}}</div>
      {{/if}}
    </div>
    <div class="school-block">
      <div class="school-name">{{upper (or branding.school_name 'School')}}</div>
      {{#if branding.tagline}}<div class="school-tagline">{{branding.tagline}}</div>{{/if}}
      {{#if branding.school_address}}<div class="school-meta">{{branding.school_address}}</div>{{/if}}
      {{#if branding.school_phone}}<div class="school-meta">Phone: {{branding.school_phone}}</div>{{/if}}
    </div>
    <div class="cardtype">
      <div class="cardtype-label">TERM END REPORT</div>
      <div class="cardtype-year">{{group.academic_year_label}}</div>
    </div>
  </div>

  <div class="title-bar">{{upper group.name}}</div>

  <div class="meta-grid">
    <div class="meta-row"><span class="meta-label">Student Name</span><span class="meta-value">{{student.full_name}}</span></div>
    <div class="meta-row"><span class="meta-label">Admission No.</span><span class="meta-value">{{student.student_code}}</span></div>
    <div class="meta-row"><span class="meta-label">Grade & Section</span><span class="meta-value">{{student.grade}}-{{student.section}}</span></div>
    <div class="meta-row"><span class="meta-label">Examination</span><span class="meta-value">Term End Report</span></div>
  </div>

  <div class="summary">
    <div class="stat stat--hero"><div class="label">Percentage</div><div class="value">{{#if totals.percentage}}{{totals.percentage}}%{{else}}—{{/if}}</div></div>
    <div class="stat"><div class="label">Total</div><div class="value">{{toFixed totals.obtained 1}}/{{toFixed totals.max 0}}</div></div>
    <div class="stat"><div class="label">Grade</div><div class="value">{{#if overall_grade}}{{overall_grade}}{{else}}—{{/if}}</div></div>
    <div class="stat {{#if (eq result 'PASS')}}stat--pass{{/if}}{{#if (eq result 'FAIL')}}stat--fail{{/if}}"><div class="label">Result</div><div class="value">{{#if result}}{{result}}{{else}}—{{/if}}</div></div>
  </div>

  <div class="section-title">Academic Performance</div>
  <table class="marks">
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Subject</th>
        {{#each sources}}
        <th class="num">Term-{{roman sequence}}{{#if ../per_term_max}} ({{../per_term_max}}M){{/if}}</th>
        {{/each}}
        <th class="num" style="width:90px">Total{{#if per_subject_max}} ({{per_subject_max}}M){{/if}}</th>
        <th class="num" style="width:60px">Grade</th>
      </tr>
    </thead>
    <tbody>
      {{#each subjects}}
      <tr>
        <td>{{inc @index}}</td>
        <td class="subject-name">{{subject_name}}</td>
        {{#each components}}
        <td class="num">{{#if marks}}{{marks}}{{else}}—{{/if}}</td>
        {{/each}}
        <td class="num">{{#if total_marks}}{{toFixed total_marks 1}}{{else}}—{{/if}}</td>
        <td class="num">{{#if grade}}{{grade}}{{else}}—{{/if}}</td>
      </tr>
      {{/each}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOTAL</td>
        {{#each sources}}<td class="num"></td>{{/each}}
        <td class="num">{{toFixed totals.obtained 1}}/{{toFixed totals.max 0}}</td>
        <td class="num">{{#if overall_grade}}{{overall_grade}}{{else}}—{{/if}}</td>
      </tr>
    </tfoot>
  </table>

  <div class="section-title">Co-Curricular Activities (CCA)</div>
  <table class="cca">
    <thead><tr><th>Area</th><th>Grade</th></tr></thead>
    <tbody>
      {{#each cca_areas}}
      <tr><td>{{this}}</td><td class="grade-cell">&nbsp;</td></tr>
      {{/each}}
    </tbody>
  </table>

  <div class="footer-grid">
    <table class="mini">
      <tbody>
        <tr><td class="label-cell">No. of Working Days</td><td>&nbsp;</td></tr>
        <tr><td class="label-cell">Days Present</td><td>&nbsp;</td></tr>
      </tbody>
    </table>
    <table class="mini">
      <tbody>
        <tr><td class="label-cell">Height (in Cms)</td><td>&nbsp;</td></tr>
        <tr><td class="label-cell">Weight (in Kgs)</td><td>&nbsp;</td></tr>
      </tbody>
    </table>
  </div>

  <div class="remarks-line"><strong>Remarks:</strong> Outstanding / Excellent / Very Good / Needs Improvement</div>
  <div class="result-line"><strong>Result:</strong> CONGRATULATIONS !! Promoted to Grade: <span class="result-fill">{{#if promoted_to_grade}}{{promoted_to_grade}}{{else}}_____{{/if}}</span></div>

  <div class="signatures">
    <div class="sig"><div class="line">Parent</div></div>
    <div class="sig"><div class="line">Class Teacher</div></div>
    <div class="sig"><div class="line">Principal</div></div>
  </div>
</div>
</body></html>`;

// ── St. George International School — pixel-accurate annual report ─────────
// Self-contained CSS (no SHARED_CSS) so the look can diverge freely from the
// generic templates. All measurements in mm to match the printed A4 output.
//
// Assets still pending from school: original logo (SVG/high-res PNG) and the
// watermark seal. Until those land, the template falls back to the generic
// branding.logo_url and a CSS-text watermark.
const ST_GEORGE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;
    font-family: "Times New Roman", Times, serif; color: #000; }
  @page { size: A4 portrait; margin: 0; }

  /* The page is a flex column: the body content flows naturally and the
     footer (signatures) gets margin-top: auto so it always sits flush at
     the bottom of the printable area, just like the reference.

     Watermark is rendered as a background-image on the page itself —
     simplest, most robust approach. Faded with the linear-gradient
     overlay (white at high opacity) so the seal shows but content
     above it stays readable. No flex/stacking quirks. */
  .page { position: relative; width: 210mm; min-height: 297mm;
          padding: 4mm 6mm 5mm; border: 1.2mm solid #000;
          display: flex; flex-direction: column;
          overflow: hidden;
          background-image:
            linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.78)),
            var(--watermark-url, none);
          background-repeat: no-repeat, no-repeat;
          background-position: center, center;
          background-size: 135mm 135mm, 135mm 135mm; }

  /* Legacy .watermark div is no longer used — hide it. */
  .watermark { display: none; }

  /* HEADER — 2 columns: logo block left, school info right.
     Anchored at the top, never reflows or overlaps. */
  .sg-header { display: grid; grid-template-columns: 1fr auto;
               align-items: center; column-gap: 6mm;
               padding: 1mm 1mm 3mm; }
  .sg-logo { display: flex; align-items: center; gap: 3mm;
             min-height: 30mm; }
  .sg-logo > img { width: 30mm; height: 30mm; object-fit: contain;
                   flex-shrink: 0; }
  .sg-logo-textwrap { display: flex; flex-direction: column;
                      justify-content: center; line-height: 1; }
  .sg-logo-fallback { font-family: Arial, "Helvetica Neue", sans-serif;
                      font-weight: 900; font-size: 14mm; line-height: 1;
                      color: #d40000; letter-spacing: 0.3mm;
                      white-space: nowrap; }
  .sg-logo-sub { font-family: Arial, "Helvetica Neue", sans-serif;
                 font-weight: 700; font-size: 3.4mm; letter-spacing: 2.1mm;
                 color: #003a99; margin-top: 1.5mm;
                 white-space: nowrap; }

  .sg-affil { font-family: Arial, "Helvetica Neue", sans-serif;
              font-size: 3.2mm; line-height: 1.45; color: #000;
              text-align: left; min-width: 75mm; }
  .sg-affil .affil-line { font-weight: 700; }
  .sg-affil .red { color: #d40000; font-weight: 800; }
  .sg-affil .blue { color: #003a99; font-weight: 800; }

  /* TITLE */
  .sg-title { text-align: center; font-weight: 800; font-size: 6mm;
              text-decoration: underline; margin: 4mm 0 1mm; }
  .sg-year { text-align: center; font-weight: 700; font-size: 4.4mm;
             margin-bottom: 4mm; }

  /* SECTION HEADINGS — red, uppercase, like the reference.
     Generous top margin separates each section visually. */
  .sg-section { color: #d40000; font-weight: 800; font-size: 4mm;
                letter-spacing: 0.2mm; margin: 5mm 0 1.5mm; }

  /* STUDENT PROFILE — labels readable, values bolder so name / DOB /
     father / contact stand out at a glance. */
  .sg-profile { display: grid; grid-template-columns: 50mm 4mm 1fr;
                row-gap: 2.4mm; column-gap: 0;
                font-size: 4mm; padding-left: 1mm;
                margin-bottom: 2mm; }
  .sg-profile .lbl   { font-weight: 600; }
  .sg-profile .colon { text-align: center; font-weight: 600; }
  .sg-profile .val   { border-bottom: 0; min-height: 4.2mm;
                       font-weight: 700; color: #000; }

  /* TABLES — shared base. Cells are transparent so the watermark
     shows through; only the subject cell has its own pink tint. */
  table.sg { width: 100%; border-collapse: collapse;
             font-size: 3.4mm; background: transparent; }
  table.sg th, table.sg td { border: 0.3mm solid #000; padding: 1mm 2mm;
                             vertical-align: middle; background: transparent; }
  table.sg thead th { color: #d40000; font-weight: 800;
                      text-transform: uppercase; letter-spacing: 0.2mm;
                      font-size: 3.2mm; text-align: center;
                      background: rgba(255,255,255,0.55); }
  table.sg .subject-cell { background: rgba(253, 231, 234, 0.85);
                           color: #000;
                           font-weight: 700; text-transform: uppercase;
                           font-family: Arial, "Helvetica Neue", sans-serif;
                           font-size: 3.2mm; letter-spacing: 0.1mm;
                           text-align: left; padding-left: 3mm; }
  table.sg.academic td { height: 7mm; }
  table.sg.academic td.num { text-align: center; }

  /* CCA */
  table.sg.cca thead th.area { width: 70%; }
  table.sg.cca tbody td.area { text-align: center;
                               font-family: Arial, "Helvetica Neue", sans-serif;
                               font-weight: 700; font-size: 3.2mm;
                               text-transform: uppercase; }
  table.sg.cca tbody td { height: 5.4mm; }

  /* FOOTER GRID — Working Days (left) + Height/Weight (right) */
  .sg-footer-grid { display: grid; grid-template-columns: 1fr 4mm 1fr;
                    gap: 0; margin-top: 5mm; }
  table.sg.mini td { padding: 1.2mm 2.5mm; height: 6mm; }
  table.sg.mini td.lbl { font-weight: 700; width: 55%;
                         font-family: Arial, "Helvetica Neue", sans-serif;
                         font-size: 3.2mm; }

  /* Remarks + Result */
  .sg-remarks { font-weight: 700; font-size: 3.4mm; margin-top: 5mm; }
  .sg-result  { font-weight: 700; font-size: 3.4mm; margin-top: 3mm; }
  .sg-result .fill { display: inline-block; min-width: 22mm;
                     border-bottom: 0.3mm solid #000;
                     padding: 0 2mm; font-weight: 700; }

  /* SIGNATURES — pinned to the bottom of the printable area.
     The page is a flex column, so margin-top: auto absorbs all
     remaining vertical space and pushes this row flush against
     the bottom border, matching the reference. min-margin keeps
     a comfortable gap from Result even on tall content. */
  .sg-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr;
                   font-weight: 800; font-family: Arial, "Helvetica Neue", sans-serif;
                   font-size: 3.6mm; letter-spacing: 0.3mm;
                   margin-top: auto; padding-top: 12mm; }
  .sg-signatures .left   { text-align: left; }
  .sg-signatures .center { text-align: center; }
  .sg-signatures .right  { text-align: right; }

  /* Pixel-perfect comparison overlay (dev only — set ?overlay=1) */
  .overlay-ref { position: absolute; inset: 0; width: 210mm; height: 297mm;
                 opacity: 0.45; z-index: 9999; pointer-events: none;
                 background-image: var(--overlay-url, none);
                 background-size: 210mm 297mm;
                 background-repeat: no-repeat; }
`;

export const ST_GEORGE_TEMPLATE = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Term End Report</title>
<style>
  :root {
    {{#if st_george_seal_url}}--watermark-url: url("{{st_george_seal_url}}");{{else}}{{#if branding.watermark_url}}--watermark-url: url("{{branding.watermark_url}}");{{/if}}{{/if}}
    {{#if overlay_url}}--overlay-url: url("{{overlay_url}}");{{/if}}
  }
  ${ST_GEORGE_CSS}
</style>
</head><body>
<div class="page" style="{{#if st_george_seal_url}}background-image: linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)), url('{{st_george_seal_url}}');{{/if}}">
  <div class="watermark"></div>

  <div class="sg-header">
    <div class="sg-logo">
      {{#if st_george_logo_url}}
        <img src="{{st_george_logo_url}}" alt="St. George International School"/>
        <div class="sg-logo-textwrap">
          <div class="sg-logo-fallback">St.GEORGE</div>
          <div class="sg-logo-sub">INTERNATIONAL SCHOOL</div>
        </div>
      {{else if branding.logo_url}}
        <img src="{{branding.logo_url}}" alt="{{branding.school_name}}"/>
      {{else}}
        <div>
          <div class="sg-logo-fallback">St.GEORGE</div>
          <div class="sg-logo-sub">INTERNATIONAL SCHOOL</div>
        </div>
      {{/if}}
    </div>
    <div class="sg-affil">
      <div class="affil-line">Pre KG to Grade-XII | CBSE with <span class="red">IIT/NEET</span></div>
      <div class="affil-line">and <span class="blue">CIVIL SERVICES</span> Academy</div>
      <div><strong>Affi. No: {{#if branding.affiliation_no}}{{branding.affiliation_no}}{{else}}3630296{{/if}} | Cell: {{#if branding.school_phone}}{{branding.school_phone}}{{else}}8977922604{{/if}}</strong></div>
      <div>{{#if branding.school_address}}{{branding.school_address}}{{else}}Near Govt. Medical College, Jagtial Road, Karimnagar-505451{{/if}}</div>
    </div>
  </div>

  <div class="sg-title">{{upper (or group.name 'TERM END REPORT')}}</div>
  <div class="sg-year">{{group.academic_year_label}}</div>

  <div class="sg-section">STUDENT PROFILE</div>
  <div class="sg-profile">
    <div class="lbl">Student Name</div><div class="colon">:</div><div class="val">{{student.full_name}}</div>
    <div class="lbl">Grade &amp; Section</div><div class="colon">:</div><div class="val">{{student.grade}}{{#if student.section}} - {{student.section}}{{/if}}</div>
    <div class="lbl">Admission Number</div><div class="colon">:</div><div class="val">{{student.student_code}}</div>
    <div class="lbl">Date of Birth</div><div class="colon">:</div><div class="val">{{student.date_of_birth}}</div>
    <div class="lbl">Father's Name</div><div class="colon">:</div><div class="val">{{student.father_name}}</div>
    <div class="lbl">Contact No.</div><div class="colon">:</div><div class="val">{{student.contact_no}}</div>
  </div>

  <div class="sg-section">ACADEMIC PERFORMANCE</div>
  {{#if is_annual}}
  {{!-- ANNUAL — Term I + Term II + Total + Grade --}}
  <table class="sg academic">
    <thead>
      <tr>
        <th style="width:32%">SUBJECT</th>
        {{#each sources}}
        <th>TERM &ndash; {{roman sequence}}{{#if ../per_term_max}} ({{../per_term_max}}M){{/if}}</th>
        {{/each}}
        <th>TOTAL{{#if per_subject_max}} ({{per_subject_max}}M){{/if}}</th>
        <th style="width:14%">GRADE</th>
      </tr>
    </thead>
    <tbody>
      {{#each subjects}}
      <tr>
        <td class="subject-cell">{{subject_name}}</td>
        {{#each components}}
        <td class="num">{{#if marks}}{{marks}}{{else}}&nbsp;{{/if}}</td>
        {{/each}}
        <td class="num">{{#if total_marks}}{{toFixed total_marks 1}}{{else}}&nbsp;{{/if}}</td>
        <td class="num">{{#if grade}}{{grade}}{{else}}&nbsp;{{/if}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{else if is_term}}
  {{!-- TERM (mid-term) — Periodic Assessment + Term + Total + Grade --}}
  <table class="sg academic">
    <thead>
      <tr>
        <th style="width:32%">SUBJECT</th>
        <th>PERIODIC ASSESSMENT{{#if pa_max_per_subject}} ({{pa_max_per_subject}}M){{/if}}</th>
        <th>TERM{{#if term_max_per_subject}} ({{term_max_per_subject}}M){{/if}}</th>
        <th>TOTAL{{#if total_per_subject}} ({{total_per_subject}}M){{/if}}</th>
        <th style="width:14%">GRADE</th>
      </tr>
    </thead>
    <tbody>
      {{#each subjects}}
      <tr>
        <td class="subject-cell">{{subject_name}}</td>
        <td class="num">{{#if pa_marks}}{{pa_marks}}{{else}}&nbsp;{{/if}}</td>
        <td class="num">{{#if term_marks}}{{term_marks}}{{else}}&nbsp;{{/if}}</td>
        <td class="num">{{#if total_marks}}{{toFixed total_marks 1}}{{else}}&nbsp;{{/if}}</td>
        <td class="num">{{#if grade}}{{grade}}{{else}}&nbsp;{{/if}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{else}}
  {{!-- SINGLE EXAM (Unit Test, ad-hoc) — one marks column --}}
  <table class="sg academic">
    <thead>
      <tr>
        <th style="width:40%">SUBJECT</th>
        <th>MARKS OBTAINED</th>
        <th>MAX</th>
        <th>%</th>
        <th style="width:14%">GRADE</th>
      </tr>
    </thead>
    <tbody>
      {{#each subjects}}
      <tr>
        <td class="subject-cell">{{subject_name}}</td>
        <td class="num">{{#if marks_obtained}}{{marks_obtained}}{{else}}&nbsp;{{/if}}</td>
        <td class="num">{{max_marks}}</td>
        <td class="num">{{#if percentage}}{{percentage}}%{{else}}&nbsp;{{/if}}</td>
        <td class="num">{{#if grade}}{{grade}}{{else}}&nbsp;{{/if}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{/if}}

  {{#if show_extras}}
  <div class="sg-section">CO-CURRICULAR ACTIVITIES (CCA)</div>
  <table class="sg cca">
    <thead><tr><th class="area">AREA</th><th>GRADE</th></tr></thead>
    <tbody>
      {{#each cca_areas}}
      <tr><td class="area">{{this}}</td><td>{{#if (lookup ../cca_grades this)}}{{lookup ../cca_grades this}}{{else}}&nbsp;{{/if}}</td></tr>
      {{/each}}
    </tbody>
  </table>

  <div class="sg-footer-grid">
    <table class="sg mini">
      <tbody>
        <tr><td class="lbl">No.of Working Days</td><td>{{#if attendance.working_days}}{{attendance.working_days}}{{else}}&nbsp;{{/if}}</td></tr>
        <tr><td class="lbl">Days Present</td><td>{{#if attendance.days_present}}{{attendance.days_present}}{{else}}&nbsp;{{/if}}</td></tr>
      </tbody>
    </table>
    <div></div>
    <table class="sg mini">
      <tbody>
        <tr><td class="lbl">Height (in Cms)</td><td>{{#if health.height_cm}}{{health.height_cm}}{{else}}&nbsp;{{/if}}</td></tr>
        <tr><td class="lbl">Weight (in Kgs)</td><td>{{#if health.weight_kg}}{{health.weight_kg}}{{else}}&nbsp;{{/if}}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="sg-remarks"><strong>Remarks :</strong> Outstanding / Excellent / Very Good / Needs Improvement</div>
  <div class="sg-result"><strong>Result :</strong> CONGRATULATIONS !! Promoted to Grade: <span class="fill">{{#if promoted_to_grade}}{{promoted_to_grade}}{{else}}&nbsp;{{/if}}</span></div>
  {{/if}}

  <div class="sg-signatures">
    <div class="left">PARENT</div>
    <div class="center">CLASS TEACHER</div>
    <div class="right">PRINCIPAL</div>
  </div>

  {{#if overlay_url}}<div class="overlay-ref"></div>{{/if}}
</div>
</body></html>`;
