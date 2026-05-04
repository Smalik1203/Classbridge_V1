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

// ── Annual Term-End Report (St George layout: Term I/II + CCA + footer) ────
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
