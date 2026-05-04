import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Pencil, FileText, Sparkles, Loader2, Upload, Check } from 'lucide-react';
import { message } from 'antd';

import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';

import {
  generateClubbedReport,
  buildTermReportCardData,
  getTermReportWithSources,
  getStudentsForClass,
  generateAnnualReport,
  publishTermReport,
} from '@/features/tests/services/gradebookService';
import ReportCardPreview from '@/features/tests/components/ReportCardPreview';

/**
 * Detail page for a Term Report (kind='term_report').
 *
 * - Renders the wide pivot of source assessments × students for the picked class.
 * - Greys out PA rows that lost the best-of-N ranking.
 * - "Generate Report Card" per student → opens the standard ReportCardPreview
 *   with combined data (per-subject marks summed across included sources).
 * - No marks entry here; data is purely derived.
 */
export default function TermReportView({
  termReport,        // exam_groups row with kind='term_report' and class_instance_ids[]
  classes = [],      // all class_instances loaded by parent
  schoolCode,
  onBack,
  onEdit,            // () => void  parent opens TermReportEditor
}) {
  const coveredIds = useMemo(
    () => Array.isArray(termReport?.class_instance_ids) ? termReport.class_instance_ids : [],
    [termReport],
  );
  const [activeClassId, setActiveClassId] = useState(coveredIds[0] || '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Annual mode: when sources are themselves term_reports we read from the
  // term_report_subject_totals snapshots via the generate_annual_report RPC.
  // One round-trip, no per-student fan-out.
  const [isAnnual, setIsAnnual] = useState(false);
  const [annualPivot, setAnnualPivot] = useState(null); // { sources, students }
  const [unpublishedSources, setUnpublishedSources] = useState([]); // names
  const [publishing, setPublishing] = useState(false);
  const [publishedAt, setPublishedAt] = useState(termReport.published_at || null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Default class when termReport changes
  useEffect(() => {
    setActiveClassId(coveredIds[0] || '');
  }, [coveredIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute pivot data when class changes. Branches on mode:
  //  - Term mode: call generate_clubbed_report (paBestOf=1) and aggregate cells.
  //  - Annual mode (sources are term_reports): build per-student data via
  //    buildTermReportCardData, which recursively halves each source's totals.
  useEffect(() => {
    if (!termReport?.id || !activeClassId) {
      setRows([]); setAnnualRows([]); return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      // Detect mode: are the sources term_reports?
      const trRes = await getTermReportWithSources(termReport.id);
      if (cancelled) return;
      if (!trRes.success) {
        setLoading(false); setError(trRes.error || 'Failed to load sources'); return;
      }
      const sources = trRes.data?.sources || [];
      const annual = sources.length > 0 && sources.every((s) => s?.kind === 'term_report');
      setIsAnnual(annual);

      if (!annual) {
        // Term mode (existing behavior)
        const r = await generateClubbedReport({
          examGroupIds: termReport.source_group_ids || [],
          classInstanceId: activeClassId,
          paBestOf: 1,
        });
        if (cancelled) return;
        setLoading(false);
        if (!r.success) { setError(r.error || 'Failed to compute report'); return; }
        setRows(r.data || []);
        setAnnualRows([]);
        return;
      }

      // Annual mode: single RPC call, reads from snapshots.
      const ar = await generateAnnualReport({
        termReportIds: termReport.source_group_ids || [],
        classInstanceId: activeClassId,
      });
      if (cancelled) return;
      if (!ar.success) {
        setLoading(false); setError(ar.error || 'Failed to load annual report'); return;
      }

      // Identify any source term_reports that haven't been published yet.
      const presentTermIds = new Set(ar.data.map((r) => r.term_report_id));
      const missing = sources.filter((s) => !presentTermIds.has(s.id));
      setUnpublishedSources(missing.map((s) => s.name));

      // Pivot: { sources: [{id,name,sequence}], students: [{ id, name, code, subjects: [{ subject_id, subject_name, cells: Map<source_id, row> }] }] }
      const sourcesMap = new Map();
      ar.data.forEach((r) => {
        if (!sourcesMap.has(r.term_report_id)) {
          sourcesMap.set(r.term_report_id, {
            id: r.term_report_id,
            name: r.term_report_name,
            sequence: r.term_report_sequence,
          });
        }
      });
      const annualSources = Array.from(sourcesMap.values()).sort((a, b) => a.sequence - b.sequence);

      const studentTree = new Map();
      ar.data.forEach((r) => {
        if (!studentTree.has(r.student_id)) {
          studentTree.set(r.student_id, {
            id: r.student_id,
            name: r.student_name,
            code: r.student_code,
            subjects: new Map(),
          });
        }
        const sNode = studentTree.get(r.student_id);
        if (!sNode.subjects.has(r.subject_id)) {
          sNode.subjects.set(r.subject_id, {
            subject_id: r.subject_id,
            subject_name: r.subject_name,
            cells: new Map(),
          });
        }
        sNode.subjects.get(r.subject_id).cells.set(r.term_report_id, r);
      });

      const students = Array.from(studentTree.values())
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map((s) => ({
          ...s,
          subjects: Array.from(s.subjects.values())
            .sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || '')),
        }));

      setAnnualPivot({ sources: annualSources, students });
      setRows([]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [termReport?.id, termReport?.source_group_ids, activeClassId, schoolCode]);

  // Halve helper: matches buildTermReportCardData. Single source of truth would
  // be nicer but it's a one-liner; keeping it inline avoids extra imports.
  const halve = (n) => Math.round((Number(n) / 2) * 2) / 2;

  // Pivot rows → wide table. Same logic as the dialog.
  const pivot = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const colsMap = new Map();
    rows.forEach((r) => {
      if (!colsMap.has(r.exam_group_id)) {
        colsMap.set(r.exam_group_id, {
          exam_group_id: r.exam_group_id,
          exam_group_name: r.exam_group_name,
          is_pa: r.is_pa,
        });
      }
    });
    const cols = Array.from(colsMap.values()).sort((a, b) => {
      if (a.is_pa !== b.is_pa) return a.is_pa ? -1 : 1;
      return a.exam_group_name.localeCompare(b.exam_group_name);
    });
    const tree = new Map();
    rows.forEach((r) => {
      if (!tree.has(r.student_id)) {
        tree.set(r.student_id, {
          student_id: r.student_id,
          student_name: r.student_name,
          student_code: r.student_code,
          subjects: new Map(),
        });
      }
      const sNode = tree.get(r.student_id);
      if (!sNode.subjects.has(r.subject_id)) {
        sNode.subjects.set(r.subject_id, {
          subject_id: r.subject_id,
          subject_name: r.subject_name,
          cells: new Map(),
        });
      }
      sNode.subjects.get(r.subject_id).cells.set(r.exam_group_id, r);
    });
    return {
      cols,
      students: Array.from(tree.values())
        .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''))
        .map((s) => ({
          ...s,
          subjects: Array.from(s.subjects.values())
            .sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || '')),
        })),
    };
  }, [rows]);

  // Per-subject derived buckets: best PA (raw + halved), summed term, total.
  // Mirrors buildTermReportCardData but for the in-table preview.
  const computeRowTotals = (subjectNode) => {
    let bestPa = null;       // { marks, max, exam_group_id } — raw
    let termObt = 0;
    let termMax = 0;
    let anyTermMarks = false;
    subjectNode.cells.forEach((c) => {
      if (c.is_pa) {
        // RPC was called with paBestOf=1, so the rank-1 PA is the only included one.
        if (c.included && c.has_any_marks) {
          bestPa = {
            marks: Number(c.marks_obtained || 0),
            max: Number(c.max_marks || 0),
            exam_group_id: c.exam_group_id,
          };
        }
      } else {
        termObt += Number(c.marks_obtained || 0);
        termMax += Number(c.max_marks || 0);
        if (c.has_any_marks) anyTermMarks = true;
      }
    });
    const bestPaScaled = bestPa
      ? { marks: halve(bestPa.marks), max: halve(bestPa.max) }
      : null;
    const totalObt = (bestPaScaled?.marks || 0) + (anyTermMarks ? termObt : 0);
    const totalMax = (bestPaScaled?.max || 0) + termMax;
    const anyMarks = !!bestPa || anyTermMarks;
    const pct = totalMax > 0 && anyMarks
      ? Number(((totalObt / totalMax) * 100).toFixed(2))
      : null;
    return {
      bestPaRaw: bestPa,
      bestPa: bestPaScaled,
      term: anyTermMarks ? { marks: termObt, max: termMax }
                         : (termMax > 0 ? { marks: 0, max: termMax } : null),
      total: { marks: totalObt, max: totalMax },
      pct,
      anyMarks,
    };
  };

  // Per-student summary (sum across subjects)
  const studentSummary = (s) => {
    let obt = 0, max = 0, hasAny = false;
    s.subjects.forEach((subj) => {
      const t = computeRowTotals(subj);
      obt += t.total.marks; max += t.total.max;
      if (t.anyMarks) hasAny = true;
    });
    const pct = max > 0 && hasAny ? Number(((obt / max) * 100).toFixed(2)) : null;
    return { obt, max, pct, hasAny };
  };

  const openReport = async (student) => {
    setReportOpen(true);
    setReportLoading(true);
    setReportData(null);
    const r = await buildTermReportCardData({
      termReportId: termReport.id,
      studentId: student.student_id,
      schoolCode,
    });
    setReportLoading(false);
    if (!r.success) { message.error(r.error || 'Failed to build report card'); setReportOpen(false); return; }
    setReportData(r.data);
  };

  const classLabel = (cid) => {
    const c = classes.find((x) => x.id === cid);
    return c ? `Grade ${c.grade}-${c.section}` : '—';
  };

  const paCols = pivot ? pivot.cols.filter((c) => c.is_pa) : [];
  const termCols = pivot ? pivot.cols.filter((c) => !c.is_pa) : [];
  const paCount = paCols.length;
  const termCount = termCols.length;

  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft size={13} /> Back
        </Button>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[color:var(--fg)] m-0">
          {termReport.name}
        </h1>
        <Badge variant="accent" className="text-[10.5px] uppercase tracking-wider flex items-center gap-1">
          <Sparkles size={10} /> Term Report
        </Badge>
        <span className="text-[12.5px] text-[color:var(--fg-muted)]">
          {isAnnual
            ? `Annual report · ${(termReport.source_group_ids || []).length} term reports clubbed (each halved)`
            : `${paCount} PA · ${termCount} term · best PA ÷ 2 + term sum`}
        </span>
        {!isAnnual && publishedAt && (
          <span className="text-[11.5px] text-[color:var(--success,#16a34a)] flex items-center gap-1">
            <Check size={12} /> Published
            <span className="text-[color:var(--fg-muted)]">
              {' · '}{new Date(publishedAt).toLocaleString()}
            </span>
          </span>
        )}
        {!isAnnual && !publishedAt && (
          <span className="text-[11.5px] text-[color:var(--fg-muted)]">
            Not yet published
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!isAnnual && (
            <Button
              variant={publishedAt ? 'outline' : 'default'}
              size="sm"
              disabled={publishing}
              onClick={async () => {
                setPublishing(true);
                const r = await publishTermReport(termReport.id);
                setPublishing(false);
                if (!r.success) { message.error(r.error || 'Failed to publish'); return; }
                setPublishedAt(new Date().toISOString());
                message.success(`Published — ${r.data.rowsWritten} subject totals snapshotted`);
              }}
            >
              {publishing
                ? <Loader2 size={13} className="animate-spin" />
                : <Upload size={13} />}
              {publishedAt ? 'Re-publish' : 'Publish'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil size={13} /> Edit
          </Button>
        </div>
      </div>

      {/* Unpublished-sources warning (annual mode only) */}
      {isAnnual && unpublishedSources.length > 0 && (
        <div className="mb-4 px-3 py-2.5 rounded-md border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] text-[12.5px] text-[color:var(--danger)] flex items-start gap-2">
          <Sparkles size={14} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Source term reports not published</div>
            <div className="leading-snug">
              {unpublishedSources.join(', ')} {unpublishedSources.length === 1 ? 'has' : 'have'} no
              published snapshot yet. Open and publish {unpublishedSources.length === 1 ? 'it' : 'them'} to
              see annual data.
            </div>
          </div>
        </div>
      )}

      {/* Class picker + table */}
      <Card
        title="Consolidated Marks"
        actions={
          coveredIds.length > 1 ? (
            <Select value={activeClassId} onValueChange={setActiveClassId}>
              <SelectTrigger className="w-[180px] h-8 text-[13px]">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {coveredIds.map((cid) => (
                  <SelectItem key={cid} value={cid}>{classLabel(cid)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-[12.5px] text-[color:var(--fg-muted)]">
              Class: {classLabel(activeClassId)}
            </span>
          )
        }
      >
        {loading ? (
          <div className="text-center py-10 text-[13px] text-[color:var(--fg-muted)] flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Computing…
          </div>
        ) : error ? (
          <div className="px-3 py-2.5 rounded-md bg-[color:var(--danger-soft)] text-[color:var(--danger)] text-[12.5px]">
            {error}
          </div>
        ) : isAnnual ? (
          // ── Annual pivot: reads from term_report_subject_totals snapshots ──
          !annualPivot || annualPivot.students.length === 0 ? (
            <div className="text-[12.5px] text-[color:var(--fg-muted)] py-6 text-center">
              {unpublishedSources.length > 0
                ? `Publish ${unpublishedSources.join(' and ')} first to see annual data.`
                : 'No students in this class.'}
            </div>
          ) : (() => {
            // Per-row helpers
            const computeRow = (subj) => {
              let obt = 0, max = 0, hasAny = false;
              subj.cells.forEach((c) => {
                obt += Number(c.halved_marks || 0);
                max += Number(c.halved_max || 0);
                if (c.has_any_marks) hasAny = true;
              });
              return { obt, max, hasAny, pct: max > 0 && hasAny ? Number(((obt / max) * 100).toFixed(2)) : null };
            };
            const computeStudentTotal = (s) => {
              let obt = 0, max = 0, hasAny = false;
              s.subjects.forEach((subj) => {
                const t = computeRow(subj); obt += t.obt; max += t.max; if (t.hasAny) hasAny = true;
              });
              return { obt, max, hasAny, pct: max > 0 && hasAny ? Number(((obt / max) * 100).toFixed(2)) : null };
            };
            return (
              <div className="border border-[color:var(--border)] rounded-md overflow-auto bg-[color:var(--bg-elev)]">
                <table className="w-full text-[12.5px] tabular-nums border-collapse">
                  <thead>
                    <tr className="bg-[color:var(--bg-subtle)]">
                      <th className="text-left px-3 py-2 font-semibold border-b border-[color:var(--border)] sticky left-0 bg-[color:var(--bg-subtle)] z-[2] min-w-[200px]">Student</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-[color:var(--border)] min-w-[140px]">Subject</th>
                      {annualPivot.sources.map((src) => (
                        <th key={src.id} className="text-right px-3 py-2 font-semibold border-b border-[color:var(--border)] whitespace-nowrap">
                          {src.name}
                        </th>
                      ))}
                      <th className="text-right px-3 py-2 font-semibold border-b border-l border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">Total</th>
                      <th className="text-right px-3 py-2 font-semibold border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">%</th>
                      <th className="text-center px-2 py-2 font-semibold border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">Card</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualPivot.students.map((stu) => {
                      const total = computeStudentTotal(stu);
                      return stu.subjects.map((subj, sIdx) => {
                        const row = computeRow(subj);
                        return (
                          <tr key={`${stu.id}-${subj.subject_id}`} className="hover:bg-[color:var(--bg-subtle)]/40">
                            {sIdx === 0 ? (
                              <td
                                rowSpan={stu.subjects.length}
                                className="align-top px-3 py-2 border-b border-[color:var(--border)] sticky left-0 bg-[color:var(--bg-elev)] z-[1]"
                              >
                                <div className="font-medium text-[color:var(--fg)]">{stu.name}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)]">{stu.code}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)] mt-1">
                                  {total.hasAny ? (
                                    <>
                                      Total:{' '}
                                      <span className="font-semibold text-[color:var(--fg)]">
                                        {total.obt}/{total.max} ({total.pct}%)
                                      </span>
                                    </>
                                  ) : '—'}
                                </div>
                              </td>
                            ) : null}
                            <td className="px-3 py-2 border-b border-[color:var(--border)] text-[color:var(--fg)]">
                              {subj.subject_name}
                            </td>
                            {annualPivot.sources.map((src) => {
                              const cell = subj.cells.get(src.id);
                              if (!cell) {
                                return <td key={src.id} className="px-3 py-2 border-b border-[color:var(--border)] text-right text-[color:var(--fg-muted)]">—</td>;
                              }
                              return (
                                <td key={src.id} className="px-3 py-2 border-b border-[color:var(--border)] text-right">
                                  {cell.has_any_marks ? Number(cell.halved_marks) : <span className="text-[color:var(--fg-muted)]">—</span>}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 border-b border-l border-[color:var(--border)] text-right bg-[color:var(--bg-subtle)]/70 font-semibold">
                              {row.hasAny ? row.obt : <span className="text-[color:var(--fg-muted)] font-normal">—</span>}
                            </td>
                            <td className="px-3 py-2 border-b border-[color:var(--border)] text-right bg-[color:var(--bg-subtle)]/70 font-semibold">
                              {row.pct == null ? <span className="text-[color:var(--fg-muted)] font-normal">—</span> : `${row.pct}%`}
                            </td>
                            {sIdx === 0 ? (
                              <td
                                rowSpan={stu.subjects.length}
                                className="align-middle px-2 py-2 border-b border-[color:var(--border)] text-center bg-[color:var(--bg-subtle)]/30"
                              >
                                <Button
                                  variant="outline" size="sm"
                                  className="h-7 px-2 text-[11.5px]"
                                  onClick={() => openReport({ student_id: stu.id })}
                                >
                                  <FileText size={12} /> Card
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        ) : !pivot || pivot.students.length === 0 ? (
          <div className="text-[12.5px] text-[color:var(--fg-muted)] py-6 text-center">
            No students or marks for this class.
          </div>
        ) : (
          <div className="border border-[color:var(--border)] rounded-md overflow-auto bg-[color:var(--bg-elev)]">
            <table className="w-full text-[12.5px] tabular-nums border-collapse">
              <thead>
                {/* Group header row: PAs (raw) | Best PA | Term papers | Term Total | Grand Total */}
                <tr className="bg-[color:var(--bg-subtle)] sticky top-0 z-10">
                  <th rowSpan={2} className="text-left px-3 py-2 font-semibold border-b border-[color:var(--border)] sticky left-0 bg-[color:var(--bg-subtle)] z-[11] min-w-[200px]">
                    Student
                  </th>
                  <th rowSpan={2} className="text-left px-3 py-2 font-semibold border-b border-[color:var(--border)] min-w-[140px]">
                    Subject
                  </th>
                  {paCount > 0 && (
                    <th colSpan={paCount} className="text-center px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[color:var(--brand)] border-b border-[color:var(--border)]">
                      Periodic Assessments (raw)
                    </th>
                  )}
                  {paCount > 0 && (
                    <th rowSpan={2} className="text-right px-3 py-2 font-semibold border-b border-l border-[color:var(--border)] bg-[color:var(--brand)]/5 whitespace-nowrap">
                      <div>Best PA</div>
                      <div className="text-[10px] text-[color:var(--fg-muted)] font-normal">÷ 2</div>
                    </th>
                  )}
                  {termCount > 0 && (
                    <th colSpan={termCount} className="text-center px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[color:var(--fg-subtle)] border-b border-l border-[color:var(--border)]">
                      Term Exams
                    </th>
                  )}
                  {termCount > 1 && (
                    <th rowSpan={2} className="text-right px-3 py-2 font-semibold border-b border-l border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">
                      Term Total
                    </th>
                  )}
                  <th rowSpan={2} className="text-right px-3 py-2 font-semibold border-b border-l-2 border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">
                    <div>Grand Total</div>
                    <div className="text-[10px] text-[color:var(--fg-muted)] font-normal">/ Max</div>
                  </th>
                  <th rowSpan={2} className="text-right px-3 py-2 font-semibold border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">
                    %
                  </th>
                  <th rowSpan={2} className="text-center px-2 py-2 font-semibold border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">
                    Card
                  </th>
                </tr>
                {/* Sub-header: individual PA / term column names */}
                <tr className="bg-[color:var(--bg-subtle)] sticky top-[35px] z-10">
                  {paCols.map((c) => (
                    <th key={c.exam_group_id} className="text-right px-3 py-1.5 text-[11px] font-medium border-b border-[color:var(--border)] whitespace-nowrap">
                      {c.exam_group_name}
                    </th>
                  ))}
                  {termCols.map((c, i) => (
                    <th key={c.exam_group_id} className={`text-right px-3 py-1.5 text-[11px] font-medium border-b border-[color:var(--border)] whitespace-nowrap ${i === 0 && paCount > 0 ? 'border-l' : ''}`}>
                      {c.exam_group_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivot.students.map((s) => {
                  const summary = studentSummary(s);
                  return s.subjects.map((subj, sIdx) => {
                    const totals = computeRowTotals(subj);
                    const winnerId = totals.bestPaRaw?.exam_group_id;
                    return (
                      <tr key={`${s.student_id}-${subj.subject_id}`} className="hover:bg-[color:var(--bg-subtle)]/40">
                        {sIdx === 0 ? (
                          <td
                            rowSpan={s.subjects.length}
                            className="align-top px-3 py-2 border-b border-[color:var(--border)] sticky left-0 bg-[color:var(--bg-elev)] z-[1]"
                          >
                            <div className="font-medium text-[color:var(--fg)]">{s.student_name}</div>
                            <div className="text-[11px] text-[color:var(--fg-muted)]">{s.student_code}</div>
                            <div className="text-[11px] text-[color:var(--fg-muted)] mt-1">
                              {summary.hasAny ? (
                                <>
                                  Grand Total:{' '}
                                  <span className="font-semibold text-[color:var(--fg)]">
                                    {summary.obt}/{summary.max} ({summary.pct}%)
                                  </span>
                                </>
                              ) : '—'}
                            </div>
                          </td>
                        ) : null}
                        <td className="px-3 py-2 border-b border-[color:var(--border)] text-[color:var(--fg)]">
                          {subj.subject_name}
                        </td>

                        {/* Raw PA cells: winner highlighted, losers struck-through */}
                        {paCols.map((c) => {
                          const cell = subj.cells.get(c.exam_group_id);
                          if (!cell) {
                            return <td key={c.exam_group_id} className="px-3 py-2 border-b border-[color:var(--border)] text-right text-[color:var(--fg-muted)]">—</td>;
                          }
                          const isWinner = cell.exam_group_id === winnerId;
                          const noMarks = !cell.has_any_marks;
                          const cls = noMarks
                            ? 'text-[color:var(--fg-muted)]'
                            : isWinner
                              ? 'text-[color:var(--brand)] font-semibold'
                              : 'text-[color:var(--fg-muted)] line-through';
                          return (
                            <td
                              key={c.exam_group_id}
                              className={`px-3 py-2 border-b border-[color:var(--border)] text-right ${cls}`}
                              title={noMarks ? 'No marks' : (isWinner ? 'Best PA — kept' : 'Dropped — not the highest PA')}
                            >
                              {noMarks ? '—' : <>{Number(cell.marks_obtained)}<span className="font-normal text-[color:var(--fg-muted)]">/{Number(cell.max_marks)}</span></>}
                            </td>
                          );
                        })}

                        {/* Best PA (halved) */}
                        {paCount > 0 && (
                          <td className="px-3 py-2 border-b border-l border-[color:var(--border)] text-right bg-[color:var(--brand)]/5 font-semibold">
                            {totals.bestPa ? (
                              <>{totals.bestPa.marks}<span className="text-[color:var(--fg-muted)] font-normal">/{totals.bestPa.max}</span></>
                            ) : (
                              <span className="text-[color:var(--fg-muted)] font-normal">—</span>
                            )}
                          </td>
                        )}

                        {/* Raw term cells */}
                        {termCols.map((c, i) => {
                          const cell = subj.cells.get(c.exam_group_id);
                          if (!cell) {
                            return <td key={c.exam_group_id} className={`px-3 py-2 border-b border-[color:var(--border)] text-right text-[color:var(--fg-muted)] ${i === 0 && paCount > 0 ? 'border-l' : ''}`}>—</td>;
                          }
                          const noMarks = !cell.has_any_marks;
                          return (
                            <td
                              key={c.exam_group_id}
                              className={`px-3 py-2 border-b border-[color:var(--border)] text-right ${noMarks ? 'text-[color:var(--fg-muted)]' : 'text-[color:var(--fg)]'} ${i === 0 && paCount > 0 ? 'border-l' : ''}`}
                            >
                              {noMarks ? '—' : <>{Number(cell.marks_obtained)}<span className="text-[color:var(--fg-muted)]">/{Number(cell.max_marks)}</span></>}
                            </td>
                          );
                        })}

                        {/* Term Total — only when more than one term cell */}
                        {termCount > 1 && (
                          <td className="px-3 py-2 border-b border-l border-[color:var(--border)] text-right bg-[color:var(--bg-subtle)]/50 font-semibold">
                            {totals.term ? (
                              <>{totals.term.marks}<span className="text-[color:var(--fg-muted)] font-normal">/{totals.term.max}</span></>
                            ) : (
                              <span className="text-[color:var(--fg-muted)] font-normal">—</span>
                            )}
                          </td>
                        )}

                        {/* Grand Total */}
                        <td className="px-3 py-2 border-b border-l-2 border-[color:var(--border)] text-right bg-[color:var(--bg-subtle)]/70 font-semibold">
                          {totals.anyMarks ? (
                            <>{totals.total.marks}<span className="text-[color:var(--fg-muted)] font-normal">/{totals.total.max}</span></>
                          ) : (
                            <span className="text-[color:var(--fg-muted)] font-normal">—</span>
                          )}
                        </td>

                        {/* % */}
                        <td className="px-3 py-2 border-b border-[color:var(--border)] text-right bg-[color:var(--bg-subtle)]/70 font-semibold">
                          {totals.pct == null ? (
                            <span className="text-[color:var(--fg-muted)] font-normal">—</span>
                          ) : `${totals.pct}%`}
                        </td>

                        {sIdx === 0 ? (
                          <td
                            rowSpan={s.subjects.length}
                            className="align-middle px-2 py-2 border-b border-[color:var(--border)] text-center bg-[color:var(--bg-subtle)]/30"
                          >
                            <Button
                              variant="outline" size="sm"
                              className="h-7 px-2 text-[11.5px]"
                              onClick={() => openReport(s)}
                            >
                              <FileText size={12} /> Card
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Per-student combined report card */}
      <Dialog open={reportOpen} onOpenChange={(o) => !o && setReportOpen(false)}>
        <DialogContent className="p-0 w-[min(96vw,860px)] max-w-[96vw] sm:max-w-[860px]">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-[color:var(--border)]">
            <DialogTitle>Term Report Card</DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-6 max-h-[80vh] overflow-auto">
            {reportLoading ? (
              <div className="text-center py-10 text-[13px] text-[color:var(--fg-muted)] flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : (
              <ReportCardPreview data={reportData} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
