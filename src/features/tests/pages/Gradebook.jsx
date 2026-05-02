import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Award, Pencil } from 'lucide-react';

import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import {
  listExamGroups, createExamGroup, updateExamGroup, deleteExamGroup,
  buildReportCardData,
  listSchoolSubjects, createSubjectTestForGroup,
  listGradingScales, getGroupTests,
} from '@/features/tests/services/gradebookService';
import ReportCardPreview from '@/features/tests/components/ReportCardPreview';
import MarksGrid from '@/features/tests/components/MarksGrid';
import GradeProfilesDialog from '@/features/tests/components/GradeProfilesDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FormDialog } from '@/shared/ui/FormDialog';
import { Field } from '@/shared/ui/Field';
import { Badge } from '@/shared/ui/Badge';

const EXAM_TYPES = [
  { value: 'unit_test',   label: 'Unit Test' },
  { value: 'midterm',     label: 'Mid Term' },
  { value: 'quarterly',   label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'final',       label: 'Final' },
  { value: 'annual',      label: 'Annual' },
  { value: 'custom',      label: 'Custom' },
];

const TH = 'text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[color:var(--fg-muted)]';
const TH_FIRST = `${TH} px-5`;

const EMPTY_CREATE = {
  name: '', exam_type: 'unit_test', academic_year_id: '', class_instance_ids: [],
  start_date: '', end_date: '', grading_scale_id: '',
};
const EMPTY_ADD_SUBJECT = { picks: [], test_date: '' };
// picks shape: [{ subject_id, max_marks }]

export default function Gradebook() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);

  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createErrors, setCreateErrors] = useState({});
  const [editingGroupId, setEditingGroupId] = useState(null);

  const [activeGroup, setActiveGroup] = useState(null);
  const [activeClassId, setActiveClassId] = useState('');
  const [gridRefresh, setGridRefresh] = useState(0);

  const [subjects, setSubjects] = useState([]);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [addSubjectForm, setAddSubjectForm] = useState(EMPTY_ADD_SUBJECT);
  const [addSubjectErrors, setAddSubjectErrors] = useState({});
  const [existingSubjectIds, setExistingSubjectIds] = useState(new Set());

  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, group: null });

  const [gradingScales, setGradingScales] = useState([]);
  const [profilesDialogOpen, setProfilesDialogOpen] = useState(false);

  const loadGradingScales = useCallback(async () => {
    if (!schoolCode) return;
    const r = await listGradingScales(schoolCode);
    if (r.success) setGradingScales(r.data);
  }, [schoolCode]);

  useEffect(() => { loadGradingScales(); }, [loadGradingScales]);

  // When a group is opened, default the class filter to its first class.
  useEffect(() => {
    if (!activeGroup) { setActiveClassId(''); return; }
    const ids = activeGroup.class_instance_ids?.length
      ? activeGroup.class_instance_ids
      : (activeGroup.class_instance_id ? [activeGroup.class_instance_id] : []);
    setActiveClassId(ids[0] || '');
  }, [activeGroup]);

  const loadClassesAndYears = useCallback(async () => {
    if (!schoolCode) return;
    const [{ data: cls }, { data: ys }] = await Promise.all([
      supabase.from('class_instances').select('id, grade, section, academic_year_id')
        .eq('school_code', schoolCode).order('grade').order('section'),
      supabase.from('academic_years').select('id, year_start, year_end, is_active')
        .eq('school_code', schoolCode).order('year_start', { ascending: false }),
    ]);
    setClasses(cls || []);
    setYears(ys || []);
    const activeYear = (ys || []).find((y) => y.is_active) || (ys || [])[0];
    if (activeYear && !yearFilter) setYearFilter(activeYear.id);
  }, [schoolCode, yearFilter]);

  const loadGroups = useCallback(async () => {
    if (!schoolCode) return;
    setLoadingGroups(true);
    const res = await listExamGroups({
      schoolCode,
      academicYearId: yearFilter || null,
      classInstanceId: classFilter || null,
    });
    setLoadingGroups(false);
    if (res.success) setGroups(res.data);
    else console.error('listExamGroups failed:', res.error);
  }, [schoolCode, yearFilter, classFilter]);

  const loadSubjects = useCallback(async () => {
    if (!schoolCode) return;
    const r = await listSchoolSubjects(schoolCode);
    if (r.success) setSubjects(r.data);
  }, [schoolCode]);

  useEffect(() => { loadClassesAndYears(); loadSubjects(); }, [loadClassesAndYears, loadSubjects]);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  const openCreate = () => {
    const defaultScale = gradingScales.find((s) => s.is_default);
    setEditingGroupId(null);
    setCreateForm({
      ...EMPTY_CREATE,
      academic_year_id: yearFilter || '',
      class_instance_ids: classFilter ? [classFilter] : [],
      grading_scale_id: defaultScale?.id || '',
    });
    setCreateErrors({});
    setCreateOpen(true);
  };

  const openEdit = (group) => {
    const ids = group.class_instance_ids?.length
      ? group.class_instance_ids
      : (group.class_instance_id ? [group.class_instance_id] : []);
    setEditingGroupId(group.id);
    setCreateForm({
      name: group.name || '',
      exam_type: group.exam_type || 'unit_test',
      academic_year_id: group.academic_year_id || '',
      class_instance_ids: ids,
      start_date: group.start_date || '',
      end_date: group.end_date || '',
      grading_scale_id: group.grading_scale_id || '',
    });
    setCreateErrors({});
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const errs = {};
    if (!createForm.name.trim()) errs.name = 'Required';
    if (!createForm.exam_type) errs.exam_type = 'Required';
    if (!createForm.academic_year_id) errs.academic_year_id = 'Required';
    if (!createForm.class_instance_ids.length) errs.class_instance_ids = 'Pick at least one class';
    if (Object.keys(errs).length) { setCreateErrors(errs); return; }

    const payload = {
      school_code: schoolCode,
      academic_year_id: createForm.academic_year_id,
      class_instance_ids: createForm.class_instance_ids,
      name: createForm.name.trim(),
      exam_type: createForm.exam_type,
      start_date: createForm.start_date || null,
      end_date: createForm.end_date || null,
      grading_scale_id: createForm.grading_scale_id || null,
    };

    if (editingGroupId) {
      const res = await updateExamGroup(editingGroupId, payload);
      if (!res.success) return;
      setCreateOpen(false);
      setEditingGroupId(null);
      loadGroups();
      if (activeGroup?.id === editingGroupId) setActiveGroup(res.data);
      return;
    }

    const res = await createExamGroup({ ...payload, created_by: user?.id || null });
    if (!res.success) return;
    setCreateOpen(false);
    loadGroups();
    setActiveGroup(res.data);
  };

  const runDelete = async () => {
    const group = deleteConfirm.group;
    const r = await deleteExamGroup(group.id);
    setDeleteConfirm({ open: false, group: null });
    if (!r.success) return;
    if (activeGroup?.id === group.id) setActiveGroup(null);
    loadGroups();
  };

  const openAddSubject = async () => {
    setAddSubjectForm(EMPTY_ADD_SUBJECT);
    setAddSubjectErrors({});
    setExistingSubjectIds(new Set());
    setAddSubjectOpen(true);
    const gtRes = await getGroupTests(activeGroup.id);
    if (gtRes.success) {
      const ids = new Set(
        (gtRes.data || []).map((gt) => gt.tests?.subject_id).filter(Boolean)
      );
      setExistingSubjectIds(ids);
    }
  };

  const submitAddSubject = async () => {
    const errs = {};
    if (!(addSubjectForm.picks || []).length) errs.picks = 'Pick at least one subject';
    const badMax = (addSubjectForm.picks || []).find((p) => !p.max_marks || Number(p.max_marks) < 1);
    if (badMax) errs.picks = 'Every selected subject needs a max marks ≥ 1';
    if (Object.keys(errs).length) { setAddSubjectErrors(errs); return; }

    const tasks = (addSubjectForm.picks || []).map((p) => {
      const subj = subjects.find((s) => s.id === p.subject_id);
      return createSubjectTestForGroup({
        examGroup: activeGroup,
        subjectId: p.subject_id,
        title: `${activeGroup.name} — ${subj?.subject_name || 'Subject'}`,
        maxMarks: Number(p.max_marks) || 100,
        testDate: addSubjectForm.test_date || null,
        createdBy: user?.id || null,
      });
    });
    const results = await Promise.all(tasks);
    const failed = results.find((r) => !r.success);
    if (failed) {
      const dup = /already added/i.test(failed.error || '');
      setAddSubjectErrors({
        picks: dup
          ? 'One or more subjects are already added to this exam.'
          : (failed.error || 'Failed to add subjects'),
      });
      return;
    }
    setAddSubjectOpen(false);
    setGridRefresh((k) => k + 1);
  };

  const generateReport = async (student) => {
    if (!activeGroup) return;
    setReportOpen(true);
    setReportLoading(true);
    setReportData(null);
    const r = await buildReportCardData({
      examGroupId: activeGroup.id,
      studentId: student.id,
      schoolCode,
    });
    setReportLoading(false);
    if (!r.success) return;
    setReportData(r.data);
  };

  const classLabel = (c) => c ? `Grade ${c.grade}-${c.section}` : '—';
  const findClass = (id) => classes.find((c) => c.id === id);

  // ── Detail view ────────────────────────────────────────────────────────
  if (activeGroup) {
    const groupClassIds = activeGroup.class_instance_ids?.length
      ? activeGroup.class_instance_ids
      : (activeGroup.class_instance_id ? [activeGroup.class_instance_id] : []);
    return (
      <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
        <div className="flex items-center gap-3 mb-5">
          <Button variant="outline" size="sm" onClick={() => setActiveGroup(null)}>
            <ArrowLeft size={13} /> Back
          </Button>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[color:var(--fg)] m-0">
            {activeGroup.name}
          </h1>
          <Badge variant="neutral" className="capitalize">{activeGroup.exam_type?.replace(/_/g, ' ')}</Badge>
          <span className="text-[12.5px] text-[color:var(--fg-muted)]">
            {groupClassIds.length} class{groupClassIds.length === 1 ? '' : 'es'}
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => openEdit(activeGroup)}>
            <Pencil size={13} /> Edit
          </Button>
        </div>

        <Card
          title="Marks Entry"
          actions={
            <div className="flex items-center gap-2">
              {groupClassIds.length > 1 && (
                <Select value={activeClassId} onValueChange={setActiveClassId}>
                  <SelectTrigger className="w-[180px] h-8 text-[13px]">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupClassIds.map((cid) => (
                      <SelectItem key={cid} value={cid}>{classLabel(findClass(cid))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" onClick={openAddSubject}>
                <Plus size={13} /> Add Subject
              </Button>
            </div>
          }
        >
          <MarksGrid
            examGroup={activeGroup}
            selectedClassId={activeClassId || groupClassIds[0]}
            refreshKey={gridRefresh}
            onGenerateReport={generateReport}
          />
        </Card>

        {/* Add Subjects */}
        <FormDialog
          open={addSubjectOpen}
          onClose={() => setAddSubjectOpen(false)}
          title="Add Subjects to Exam"
          onSubmit={submitAddSubject}
          submitLabel={(addSubjectForm.picks || []).length > 1
            ? `Add ${(addSubjectForm.picks || []).length} Subjects`
            : 'Add Subject'}
          width={560}
        >
          <Field label="Subjects" required error={addSubjectErrors.picks}>
            {subjects.length === 0 ? (
              <div className="border border-[color:var(--border)] rounded-md p-3 text-[12.5px] text-[color:var(--fg-muted)] bg-[color:var(--bg-elev)]">
                No subjects defined for this school. Add subjects in the Subjects page first.
              </div>
            ) : (
              <div className="border border-[color:var(--border)] rounded-md max-h-[280px] overflow-auto bg-[color:var(--bg-elev)] divide-y divide-[color:var(--border)]">
                <div className="grid grid-cols-[1fr_120px] gap-2 px-3 py-2 bg-[color:var(--bg-subtle)] text-[11px] font-semibold uppercase tracking-[0.05em] text-[color:var(--fg-muted)] sticky top-0">
                  <span>Subject</span>
                  <span className="text-right pr-1">Max Marks</span>
                </div>
                {subjects.map((s) => {
                  const pick = (addSubjectForm.picks || []).find((p) => p.subject_id === s.id);
                  const checked = !!pick;
                  const alreadyAdded = existingSubjectIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`grid grid-cols-[1fr_120px] gap-2 items-center px-3 py-1.5 ${alreadyAdded ? 'opacity-50' : 'hover:bg-[color:var(--bg-subtle)]'}`}
                    >
                      <label className={`flex items-center gap-2 min-w-0 ${alreadyAdded ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyAdded}
                          onChange={(e) => {
                            setAddSubjectForm((f) => {
                              const cur = f.picks || [];
                              if (e.target.checked) {
                                return { ...f, picks: [...cur, { subject_id: s.id, max_marks: 100 }] };
                              }
                              return { ...f, picks: cur.filter((p) => p.subject_id !== s.id) };
                            });
                          }}
                          className="rounded border-[color:var(--border)] accent-[color:var(--brand)] disabled:cursor-not-allowed"
                        />
                        <span className="text-[13px] text-[color:var(--fg)] truncate">{s.subject_name}</span>
                        {alreadyAdded && (
                          <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-[color:var(--fg-muted)] shrink-0">
                            Added
                          </span>
                        )}
                      </label>
                      {alreadyAdded ? (
                        <span className="text-[12px] text-[color:var(--fg-muted)] text-right pr-2">—</span>
                      ) : checked ? (
                        <Input
                          type="number"
                          min={1}
                          max={1000}
                          value={pick.max_marks}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAddSubjectForm((f) => ({
                              ...f,
                              picks: (f.picks || []).map((p) => p.subject_id === s.id ? { ...p, max_marks: v } : p),
                            }));
                          }}
                          className="h-8 text-right tabular-nums"
                        />
                      ) : (
                        <span className="text-[12px] text-[color:var(--fg-muted)] text-right pr-2">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="text-[11.5px] text-[color:var(--fg-muted)] mt-1">
              {(addSubjectForm.picks || []).length} selected. Set max marks per subject.
            </div>
          </Field>

          <Field label="Test Date (optional)">
            <Input
              type="date"
              value={addSubjectForm.test_date}
              onChange={(e) => setAddSubjectForm((f) => ({ ...f, test_date: e.target.value }))}
            />
          </Field>
        </FormDialog>

        {/* Report Card */}
        <Dialog open={reportOpen} onOpenChange={(o) => !o && setReportOpen(false)}>
          <DialogContent
            className="p-0 w-[min(95vw,900px)] max-w-[95vw] sm:max-w-[900px]"
          >
            <DialogHeader className="px-6 pt-5 pb-3 border-b border-[color:var(--border)]">
              <DialogTitle>Report Card</DialogTitle>
            </DialogHeader>
            <div className="p-4 sm:p-6 max-h-[80vh] overflow-auto">
              {reportLoading ? (
                <div className="text-center py-10 text-[13px] text-[color:var(--fg-muted)]">Loading…</div>
              ) : (
                <ReportCardPreview data={reportData} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────
  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.022em] leading-[1.2] text-[color:var(--fg)] m-0 mb-1">
          Gradebook & Report Cards
        </h1>
        <p className="text-[13.5px] text-[color:var(--fg-muted)] m-0">
          Create an exam (e.g., "Unit Test 1"), add subject papers, enter marks, and print branded report cards.
        </p>
      </div>

      <Card padded className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-[color:var(--fg)]">Academic Year:</span>
          <Select
            value={yearFilter}
            onValueChange={(v) => { setYearFilter(v); setClassFilter(''); }}
          >
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.year_start}-{y.year_end}{y.is_active ? ' (active)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-[13px] font-medium text-[color:var(--fg)] ml-2">Class:</span>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              {classes
                .filter((c) => !yearFilter || c.academic_year_id === yearFilter)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>
                ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setProfilesDialogOpen(true)}>
              <Award size={13} /> Grade Profiles
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={13} /> New Exam
            </Button>
          </div>
        </div>
      </Card>

      <Card padded={false}>
        {loadingGroups ? (
          <div className="p-10 text-center text-[13px] text-[color:var(--fg-muted)]">Loading…</div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="No exams yet"
            sub="Click 'New Exam' to start."
            action={
              <Button size="sm" className="mt-3" onClick={openCreate}>
                <Plus size={13} /> New Exam
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[color:var(--bg-subtle)]">
                <TableHead className={TH_FIRST}>Name</TableHead>
                <TableHead className={TH}>Type</TableHead>
                <TableHead className={TH}>Class</TableHead>
                <TableHead className={TH}>Dates</TableHead>
                <TableHead className={TH}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                  <TableCell className="px-5 py-3">
                    <button
                      type="button"
                      className="text-[13.5px] font-semibold text-[color:var(--brand)] hover:underline text-left"
                      onClick={() => setActiveGroup(g)}
                    >
                      {g.name}
                    </button>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="neutral" className="capitalize">
                      {g.exam_type?.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {(g.class_instance_ids?.length ? g.class_instance_ids : [g.class_instance_id])
                        .filter(Boolean)
                        .map((cid) => (
                          <Badge key={cid} variant="accent">{classLabel(findClass(cid))}</Badge>
                        ))}
                      {!(g.class_instance_ids?.length || g.class_instance_id) && (
                        <span className="text-[13px] text-[color:var(--fg-muted)]">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-[13px] text-[color:var(--fg-muted)] tabular-nums">
                    {g.start_date ? `${g.start_date} → ${g.end_date || ''}` : '—'}
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => setActiveGroup(g)}>Open</Button>
                      <Button
                        variant="outline" size="icon-sm"
                        className="border-[color:var(--border)]"
                        title="Edit exam"
                        onClick={() => openEdit(g)}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="outline" size="icon-sm"
                        className="text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)] border-[color:var(--border)]"
                        title="Delete exam"
                        onClick={() => setDeleteConfirm({ open: true, group: g })}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* New / Edit Exam */}
      <FormDialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditingGroupId(null); }}
        title={editingGroupId ? 'Edit Exam' : 'New Exam'}
        onSubmit={submitCreate}
        submitLabel={editingGroupId ? 'Save Changes' : 'Create'}
        width={560}
      >
        <Field label="Exam Name" required error={createErrors.name}>
          <Input
            placeholder="e.g., Unit Test 1"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>

        <Field label="Type" required error={createErrors.exam_type}>
          <Select
            value={createForm.exam_type}
            onValueChange={(v) => setCreateForm((f) => ({ ...f, exam_type: v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXAM_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Academic Year" required error={createErrors.academic_year_id}>
          <Select
            value={createForm.academic_year_id}
            onValueChange={(v) => setCreateForm((f) => ({ ...f, academic_year_id: v }))}
          >
            <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={y.id}>{y.year_start}-{y.year_end}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Classes" required error={createErrors.class_instance_ids}>
          <div className="border border-[color:var(--border)] rounded-md p-2 max-h-[180px] overflow-auto bg-[color:var(--bg-elev)]">
            {classes
              .filter((c) => !createForm.academic_year_id || c.academic_year_id === createForm.academic_year_id)
              .map((c) => {
                const checked = createForm.class_instance_ids.includes(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[color:var(--bg-subtle)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...createForm.class_instance_ids, c.id]
                          : createForm.class_instance_ids.filter((x) => x !== c.id);
                        setCreateForm((f) => ({ ...f, class_instance_ids: next }));
                      }}
                      className="rounded border-[color:var(--border)] accent-[color:var(--brand)]"
                    />
                    <span className="text-[13px] text-[color:var(--fg)]">{classLabel(c)}</span>
                  </label>
                );
              })}
          </div>
          <div className="text-[11.5px] text-[color:var(--fg-muted)] mt-1">
            One exam group, applied to all selected classes. {createForm.class_instance_ids.length} selected.
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date">
            <Input
              type="date"
              value={createForm.start_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </Field>
          <Field label="End Date">
            <Input
              type="date"
              value={createForm.end_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Grade Profile">
          <div className="flex items-center gap-2">
            <Select
              value={createForm.grading_scale_id}
              onValueChange={(v) => setCreateForm((f) => ({ ...f, grading_scale_id: v }))}
            >
              <SelectTrigger className="flex-1"><SelectValue placeholder="School default" /></SelectTrigger>
              <SelectContent>
                {gradingScales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.is_default ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setProfilesDialogOpen(true)}
            >
              Manage
            </Button>
          </div>
        </Field>
      </FormDialog>

      {/* Delete confirm */}
      <FormDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, group: null })}
        title={deleteConfirm.group ? `Delete "${deleteConfirm.group.name}"?` : 'Delete'}
        onSubmit={runDelete}
        submitLabel="Delete"
        destructive
        width={440}
      >
        <p className="text-[13.5px] text-[color:var(--fg-subtle)]">
          This deletes the exam group, all its subject tests, and all marks for those tests.
        </p>
      </FormDialog>

      <GradeProfilesDialog
        open={profilesDialogOpen}
        onClose={() => setProfilesDialogOpen(false)}
        schoolCode={schoolCode}
        onChanged={loadGradingScales}
      />
    </div>
  );
}
