import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, AlertTriangle, Loader2 } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/shared/ui/Badge';

import {
  listExamGroups,
  generateClubbedReport,
} from '@/features/tests/services/gradebookService';

/**
 * Combined Term Report dialog.
 *
 * Lets the user pick which exam groups to club into a single report. PA-flagged
 * groups are subject to best-of-N selection per (student, subject); non-PA
 * groups always pass through.
 *
 * Pure read — never mutates marks. Aggregation happens server-side via the
 * generate_clubbed_report RPC.
 */
export default function CombinedReportDialog({
  open,
  onClose,
  schoolCode,
  academicYearId,
  classInstanceId,
  classLabel,
  // optional: prefill the picked group + a single student
  defaultExamGroupIds = [],
  forStudent = null, // { id, full_name, student_code } | null
}) {
  const [allGroups, setAllGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [bestOf, setBestOf] = useState(2);

  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState(null); // null = not run yet
  const [error, setError] = useState(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setPicked(new Set(defaultExamGroupIds || []));
    setRows(null);
    setError(null);
    setBestOf(2);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load eligible exam groups (same school + AY + contains this class)
  useEffect(() => {
    if (!open || !schoolCode || !classInstanceId) return;
    setGroupsLoading(true);
    listExamGroups({
      schoolCode,
      academicYearId: academicYearId || null,
      classInstanceId,
    }).then((res) => {
      setGroupsLoading(false);
      if (res.success) setAllGroups(res.data || []);
      else setError(res.error || 'Failed to load exams');
    });
  }, [open, schoolCode, academicYearId, classInstanceId]);

  const togglePick = (id) => {
    setRows(null); // re-run required
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const paCount = useMemo(
    () => allGroups.filter((g) => picked.has(g.id) && g.is_pa).length,
    [allGroups, picked],
  );
  const nonPaCount = useMemo(
    () => allGroups.filter((g) => picked.has(g.id) && !g.is_pa).length,
    [allGroups, picked],
  );

  const effectiveBestOf = paCount > 0 ? Math.min(Number(bestOf) || 0, paCount) : 0;

  const handleGenerate = async () => {
    setRunning(true);
    setError(null);
    setRows(null);
    const r = await generateClubbedReport({
      examGroupIds: Array.from(picked),
      classInstanceId,
      studentId: forStudent?.id || null,
      paBestOf: paCount > 0 ? Number(bestOf) || 0 : 0,
    });
    setRunning(false);
    if (!r.success) {
      setError(r.error || 'Failed to generate report');
      return;
    }
    setRows(r.data || []);
  };

  // ── Pivot rows → wide table per student ──────────────────────────────────
  // We render: rows = students × subjects, columns = picked exam_groups + Total.
  const pivot = useMemo(() => {
    if (!rows || rows.length === 0) return null;

    // Stable column order: PA groups first (by name), then non-PA (by name).
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

    // student → subject → exam_group_id → row
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
      const subjNode = sNode.subjects.get(r.subject_id);
      subjNode.cells.set(r.exam_group_id, r);
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

  const computeRowTotals = (subjectNode) => {
    let obt = 0;
    let max = 0;
    let hasAny = false;
    subjectNode.cells.forEach((cell) => {
      if (!cell.included) return;
      obt += Number(cell.marks_obtained || 0);
      max += Number(cell.max_marks || 0);
      if (cell.has_any_marks) hasAny = true;
    });
    const pct = max > 0 ? Number(((obt / max) * 100).toFixed(2)) : null;
    return { obt, max, pct, hasAny };
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="p-0 w-[min(96vw,1080px)] max-w-[96vw] sm:max-w-[1080px]">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[color:var(--border)]">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-[color:var(--brand)]" />
            Combined Term Report
            {forStudent && (
              <span className="text-[12.5px] font-normal text-[color:var(--fg-muted)] ml-2">
                · {forStudent.full_name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-4 pb-4 max-h-[80vh] overflow-auto space-y-5">
          {/* Step 1: pick assessments */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold text-[color:var(--fg)] m-0">
                1. Pick assessments to combine
              </h3>
              <span className="text-[11.5px] text-[color:var(--fg-muted)]">
                {classLabel ? `Class: ${classLabel}` : ''}
              </span>
            </div>
            {groupsLoading ? (
              <div className="text-[12.5px] text-[color:var(--fg-muted)] py-4">Loading exams…</div>
            ) : allGroups.length === 0 ? (
              <div className="text-[12.5px] text-[color:var(--fg-muted)] py-4">
                No exams found for this class in the selected academic year.
              </div>
            ) : (
              <div className="border border-[color:var(--border)] rounded-md max-h-[220px] overflow-auto bg-[color:var(--bg-elev)] divide-y divide-[color:var(--border)]">
                {allGroups.map((g) => {
                  const checked = picked.has(g.id);
                  return (
                    <label
                      key={g.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-[color:var(--bg-subtle)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePick(g.id)}
                        className="rounded border-[color:var(--border)] accent-[color:var(--brand)]"
                      />
                      <span className="flex-1 text-[13px] text-[color:var(--fg)] truncate">
                        {g.name}
                      </span>
                      {g.is_pa && (
                        <Badge variant="accent" className="text-[10px] uppercase tracking-wider">
                          PA
                        </Badge>
                      )}
                      <Badge variant="neutral" className="capitalize text-[10.5px]">
                        {g.exam_type?.replace(/_/g, ' ') || '—'}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Step 2: best-of */}
            {paCount > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-3 px-3 py-2.5 border border-[color:var(--border)] rounded-md bg-[color:var(--bg-subtle)]">
                <span className="text-[12.5px] font-medium text-[color:var(--fg)]">
                  Best of (PA only):
                </span>
                <Input
                  type="number"
                  min={0}
                  max={paCount}
                  value={bestOf}
                  onChange={(e) => { setRows(null); setBestOf(e.target.value); }}
                  className="h-8 w-[80px] tabular-nums"
                />
                <span className="text-[11.5px] text-[color:var(--fg-muted)]">
                  Will keep top {effectiveBestOf} of {paCount} PA{paCount === 1 ? '' : 's'} per
                  student per subject. {nonPaCount > 0 && `${nonPaCount} non-PA exam${nonPaCount === 1 ? '' : 's'} always included.`}
                </span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={picked.size === 0 || running}
              >
                {running ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {running ? 'Generating…' : 'Generate'}
              </Button>
              <span className="text-[11.5px] text-[color:var(--fg-muted)]">
                {picked.size} selected
              </span>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-[color:var(--danger-soft)] border border-[color:var(--danger-border,var(--border))] text-[12.5px] text-[color:var(--danger)]">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </section>

          {/* Result */}
          {pivot && pivot.students.length > 0 && (
            <section>
              <h3 className="text-[13px] font-semibold text-[color:var(--fg)] m-0 mb-2 flex items-center gap-2">
                <Check size={14} className="text-[color:var(--success,#16a34a)]" />
                2. Combined report
                <span className="text-[11.5px] font-normal text-[color:var(--fg-muted)] ml-1">
                  · {pivot.students.length} student{pivot.students.length === 1 ? '' : 's'} ·{' '}
                  {pivot.cols.length} assessment{pivot.cols.length === 1 ? '' : 's'}
                </span>
              </h3>

              <div className="border border-[color:var(--border)] rounded-md overflow-auto bg-[color:var(--bg-elev)]">
                <table className="w-full text-[12.5px] tabular-nums border-collapse">
                  <thead>
                    <tr className="bg-[color:var(--bg-subtle)] sticky top-0">
                      <th className="text-left px-3 py-2 font-semibold border-b border-[color:var(--border)] sticky left-0 bg-[color:var(--bg-subtle)] z-10 min-w-[180px]">
                        Student
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-[color:var(--border)] min-w-[140px]">
                        Subject
                      </th>
                      {pivot.cols.map((c) => (
                        <th
                          key={c.exam_group_id}
                          className="text-right px-3 py-2 font-semibold border-b border-[color:var(--border)] whitespace-nowrap"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span>{c.exam_group_name}</span>
                            {c.is_pa && (
                              <span className="text-[9.5px] uppercase tracking-wider px-1 py-0.5 rounded bg-[color:var(--brand)]/10 text-[color:var(--brand)] font-bold">
                                PA
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="text-right px-3 py-2 font-semibold border-b border-l border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">
                        Total
                      </th>
                      <th className="text-right px-3 py-2 font-semibold border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] whitespace-nowrap">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivot.students.map((s) => (
                      s.subjects.map((subj, sIdx) => {
                        const totals = computeRowTotals(subj);
                        return (
                          <tr key={`${s.student_id}-${subj.subject_id}`} className="hover:bg-[color:var(--bg-subtle)]/40">
                            {sIdx === 0 ? (
                              <td
                                rowSpan={s.subjects.length}
                                className="align-top px-3 py-2 border-b border-[color:var(--border)] sticky left-0 bg-[color:var(--bg-elev)] z-[1]"
                              >
                                <div className="font-medium text-[color:var(--fg)]">{s.student_name}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)]">{s.student_code}</div>
                              </td>
                            ) : null}
                            <td className="px-3 py-2 border-b border-[color:var(--border)] text-[color:var(--fg)]">
                              {subj.subject_name}
                            </td>
                            {pivot.cols.map((c) => {
                              const cell = subj.cells.get(c.exam_group_id);
                              if (!cell) {
                                return (
                                  <td key={c.exam_group_id} className="px-3 py-2 border-b border-[color:var(--border)] text-right text-[color:var(--fg-muted)]">
                                    —
                                  </td>
                                );
                              }
                              const dropped = !cell.included;
                              const noMarks = !cell.has_any_marks;
                              return (
                                <td
                                  key={c.exam_group_id}
                                  className={`px-3 py-2 border-b border-[color:var(--border)] text-right ${
                                    dropped ? 'text-[color:var(--fg-muted)] line-through' : 'text-[color:var(--fg)]'
                                  }`}
                                  title={
                                    dropped
                                      ? `Dropped — not in best ${effectiveBestOf} for this student & subject`
                                      : noMarks
                                        ? 'No marks entered'
                                        : ''
                                  }
                                >
                                  {noMarks ? (
                                    <span className="text-[color:var(--fg-muted)]">—</span>
                                  ) : (
                                    <>
                                      {Number(cell.marks_obtained)}
                                      <span className="text-[color:var(--fg-muted)]">/{Number(cell.max_marks)}</span>
                                    </>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 border-b border-l border-[color:var(--border)] text-right bg-[color:var(--bg-subtle)]/50 font-semibold">
                              {totals.hasAny ? (
                                <>
                                  {totals.obt}
                                  <span className="text-[color:var(--fg-muted)] font-normal">/{totals.max}</span>
                                </>
                              ) : (
                                <span className="text-[color:var(--fg-muted)] font-normal">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-[color:var(--border)] text-right bg-[color:var(--bg-subtle)]/50 font-semibold">
                              {totals.pct == null ? (
                                <span className="text-[color:var(--fg-muted)] font-normal">—</span>
                              ) : (
                                `${totals.pct}%`
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-[11px] text-[color:var(--fg-muted)] leading-snug">
                Struck-through PA cells were dropped by best-of-{effectiveBestOf}. Totals only count
                included cells.
              </p>
            </section>
          )}

          {pivot && pivot.students.length === 0 && (
            <div className="text-[12.5px] text-[color:var(--fg-muted)]">
              No students found for this class.
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-[color:var(--border)]">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
