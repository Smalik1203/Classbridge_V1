import { useState, useMemo } from 'react';
import {
  BarChart2, BookOpen, Calendar, CheckCircle, Edit,
  Eye, FileText, MoreHorizontal, Plus, Trash2, Trophy,
} from 'lucide-react';

import {
  useSupabaseQuery, useSupabaseMutation, useSupabaseSubscription,
} from '@/shared/hooks/useSupabaseQuery';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { PageHeader } from '@/shared/ui/PageHeader';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FormDialog } from '@/shared/ui/FormDialog';
import { Field } from '@/shared/ui/Field';
import { Badge } from '@/shared/ui/Badge';

const EXAM_TYPES = ['Unit Test', 'Chapter Test', 'Assignment', 'Practical', 'Project'];

const STATUS_VARIANT = {
  draft:     'neutral',
  scheduled: 'accent',
  ongoing:   'warning',
  completed: 'success',
  graded:    'info',
};

const GRADE_VARIANT = (g) =>
  ['A+', 'A', 'B+', 'B'].includes(g) ? 'success' :
  ['C+', 'C'].includes(g) ? 'warning' : 'danger';

const TH = 'text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[color:var(--fg-muted)]';
const TH_FIRST = `${TH} px-5`;

const EMPTY_FORM = { title: '', subject: '', classId: '', type: '', totalMarks: '', duration: '', date: '', description: '' };

export default function Assessments() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const role = getUserRole(user);
  const canEdit = ['admin', 'superadmin'].includes(role);

  const [tab, setTab] = useState('assessments');
  const [dialog, setDialog] = useState({ open: false, mode: 'create', data: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

  const { data: assessments = [], loading: assessmentsLoading, refetch } = useSupabaseQuery('assessments', {
    select: `id, title, subject, exam_type, total_marks, duration, exam_date, description, status,
      class_instance_id, class_instances!inner(id, grade, section)`,
    filters: [{ column: 'school_code', operator: 'eq', value: schoolCode }],
  });

  const { data: results = [], loading: resultsLoading } = useSupabaseQuery('assessment_results', {
    select: `id, marks_obtained, max_marks, percentage, grade, remarks,
      student:student(full_name), assessment:assessments(title)`,
    filters: [{ column: 'school_code', operator: 'eq', value: schoolCode }],
  });

  const { data: classes = [] } = useSupabaseQuery('class_instances', {
    select: 'id, grade, section',
    filters: [{ column: 'school_code', operator: 'eq', value: schoolCode }],
  });

  const { insert, update, remove, loading: mutating } = useSupabaseMutation('assessments');

  useSupabaseSubscription('assessments', () => refetch(), [{ column: 'school_code', value: schoolCode }]);

  const classLabel = (c) => `Grade ${c.grade ?? ''}${c.section ? `-${c.section}` : ''}`;

  const counts = useMemo(() => {
    const c = { total: assessments.length, scheduled: 0, completed: 0, graded: 0 };
    for (const a of assessments) {
      if (a.status === 'scheduled') c.scheduled++;
      else if (a.status === 'completed') c.completed++;
      else if (a.status === 'graded') c.graded++;
    }
    return c;
  }, [assessments]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setDialog({ open: true, mode: 'create', data: null });
  };

  const openEdit = (a) => {
    setForm({
      title: a.title || '',
      subject: a.subject || '',
      classId: a.class_instance_id || '',
      type: a.exam_type || '',
      totalMarks: String(a.total_marks || ''),
      duration: String(a.duration || ''),
      date: a.exam_date || '',
      description: a.description || '',
    });
    setFormErrors({});
    setDialog({ open: true, mode: 'edit', data: a });
  };

  const openView = (a) => setDialog({ open: true, mode: 'view', data: a });

  const validateForm = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Required';
    if (!form.subject.trim()) errs.subject = 'Required';
    if (!form.classId) errs.classId = 'Required';
    if (!form.type) errs.type = 'Required';
    if (!form.totalMarks) errs.totalMarks = 'Required';
    if (!form.duration) errs.duration = 'Required';
    if (!form.date) errs.date = 'Required';
    return errs;
  };

  const handleSave = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    const payload = {
      title: form.title.trim(),
      subject: form.subject.trim(),
      class_instance_id: form.classId,
      exam_type: form.type,
      total_marks: parseInt(form.totalMarks),
      duration: parseInt(form.duration),
      exam_date: form.date,
      description: form.description.trim() || null,
    };

    if (dialog.mode === 'create') {
      await insert({ ...payload, school_code: schoolCode, created_by: user.id });
    } else {
      await update(dialog.data.id, payload);
    }
    setDialog(d => ({ ...d, open: false }));
    refetch();
  };

  const confirmDelete = (id) => setDeleteConfirm({ open: true, id });

  const runDelete = async () => {
    await remove(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    refetch();
  };

  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title="Assessments"
        subtitle="Create, manage, and track student assessments"
        actions={
          canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> Create assessment
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total',     value: counts.total,     icon: FileText,    color: '--brand'   },
          { label: 'Scheduled', value: counts.scheduled, icon: Calendar,    color: '--brand'   },
          { label: 'Completed', value: counts.completed, icon: CheckCircle, color: '--success' },
          { label: 'Graded',    value: counts.graded,    icon: Trophy,      color: '--warning' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label}
            className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-4 py-3.5">
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[color:var(--fg-muted)] mb-2">
              <Icon size={12} style={{ color: `var(${color})` }} />
              {label}
            </div>
            <div className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-[color:var(--fg)]">
              {value}
            </div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="assessments">
            <BookOpen size={13} /> Assessments
          </TabsTrigger>
          <TabsTrigger value="results">
            <BarChart2 size={13} /> Results
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'assessments' && (
        <Card padded={false}>
          {assessmentsLoading ? (
            <div className="p-10 text-center text-[13px] text-[color:var(--fg-subtle)]">Loading…</div>
          ) : assessments.length === 0 ? (
            <EmptyState
              type="tests"
              action={canEdit && (
                <Button size="sm" className="mt-3" onClick={openCreate}>
                  <Plus size={13} /> Create first assessment
                </Button>
              )}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[color:var(--bg-subtle)]">
                  <TableHead className={TH_FIRST}>Assessment</TableHead>
                  <TableHead className={TH}>Class</TableHead>
                  <TableHead className={TH}>Date</TableHead>
                  <TableHead className={TH}>Marks</TableHead>
                  <TableHead className={TH}>Status</TableHead>
                  <TableHead className="w-[48px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map(a => (
                  <TableRow key={a.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                    <TableCell className="px-5 py-3">
                      <div className="text-[13.5px] font-semibold text-[color:var(--fg)]">{a.title}</div>
                      <div className="text-[12px] text-[color:var(--fg-muted)] mt-0.5">
                        {a.subject}{a.exam_type ? ` · ${a.exam_type}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="accent">
                        {a.class_instances
                          ? classLabel(a.class_instances)
                          : '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-[13px] text-[color:var(--fg-muted)] tabular-nums">
                      {a.exam_date ? new Date(a.exam_date).toLocaleDateString('en-IN') : '—'}
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-[13px] font-semibold text-[color:var(--fg)]">{a.total_marks}</span>
                      {a.duration && (
                        <div className="text-[11.5px] text-[color:var(--fg-muted)]">{a.duration} min</div>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant={STATUS_VARIANT[a.status] ?? 'neutral'} className="capitalize">
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(a)}>
                            <Eye size={13} /> View
                          </DropdownMenuItem>
                          {canEdit && (
                            <>
                              <DropdownMenuItem onClick={() => openEdit(a)}>
                                <Edit size={13} /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => confirmDelete(a.id)}>
                                <Trash2 size={13} /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'results' && (
        <Card padded={false}>
          {resultsLoading ? (
            <div className="p-10 text-center text-[13px] text-[color:var(--fg-subtle)]">Loading…</div>
          ) : results.length === 0 ? (
            <EmptyState title="No results yet" sub="Results will appear here once assessments are graded." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[color:var(--bg-subtle)]">
                  <TableHead className={TH_FIRST}>Student</TableHead>
                  <TableHead className={TH}>Assessment</TableHead>
                  <TableHead className={TH}>Marks</TableHead>
                  <TableHead className={TH}>Grade</TableHead>
                  <TableHead className={TH}>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(r => (
                  <TableRow key={r.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                    <TableCell className="px-5 py-3 text-[13.5px] font-medium text-[color:var(--fg)]">
                      {r.student?.full_name || '—'}
                    </TableCell>
                    <TableCell className="py-3 text-[13px] text-[color:var(--fg-muted)]">
                      {r.assessment?.title || '—'}
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-[13px] font-semibold text-[color:var(--fg)] tabular-nums">
                        {r.marks_obtained}
                      </span>
                      <span className="text-[12px] text-[color:var(--fg-muted)]">/{r.max_marks}</span>
                      {r.percentage != null && (
                        <div className="text-[11.5px] text-[color:var(--fg-muted)]">
                          {Math.round(r.percentage)}%
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {r.grade
                        ? <Badge variant={GRADE_VARIANT(r.grade)}>{r.grade}</Badge>
                        : <span className="text-[color:var(--fg-muted)]">—</span>}
                    </TableCell>
                    <TableCell className="py-3 text-[13px] text-[color:var(--fg-muted)] max-w-[200px] truncate">
                      {r.remarks || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <FormDialog
        open={dialog.open && dialog.mode !== 'view'}
        onClose={() => setDialog(d => ({ ...d, open: false }))}
        title={dialog.mode === 'create' ? 'Create assessment' : 'Edit assessment'}
        onSubmit={handleSave}
        submitLabel={dialog.mode === 'create' ? 'Create assessment' : 'Save changes'}
        submitting={mutating}
        width={600}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" required error={formErrors.title} className="col-span-2">
            <Input
              placeholder="e.g. Mathematics Unit Test 1"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </Field>

          <Field label="Subject" required error={formErrors.subject}>
            <Input
              placeholder="e.g. Mathematics"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            />
          </Field>

          <Field label="Class" required error={formErrors.classId}>
            <Select value={form.classId || ''} onValueChange={v => setForm(f => ({ ...f, classId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Type" required error={formErrors.type}>
            <Select value={form.type || ''} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EXAM_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Date" required error={formErrors.date}>
            <Input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </Field>

          <Field label="Total marks" required error={formErrors.totalMarks}>
            <Input
              type="number"
              placeholder="100"
              value={form.totalMarks}
              onChange={e => setForm(f => ({ ...f, totalMarks: e.target.value }))}
            />
          </Field>

          <Field label="Duration (min)" required error={formErrors.duration}>
            <Input
              type="number"
              placeholder="90"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
            />
          </Field>

          <Field label="Description" className="col-span-2">
            <Textarea
              placeholder="Topics covered, instructions, etc."
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </Field>
        </div>
      </FormDialog>

      <FormDialog
        open={dialog.open && dialog.mode === 'view'}
        onClose={() => setDialog(d => ({ ...d, open: false }))}
        title="Assessment details"
        onSubmit={() => setDialog(d => ({ ...d, open: false }))}
        submitLabel="Close"
        cancelLabel={null}
        width={560}
      >
        {[
          ['Title',    dialog.data?.title],
          ['Subject',  dialog.data?.subject],
          ['Class',    dialog.data?.class_instances
            ? classLabel(dialog.data.class_instances)
            : '—'],
          ['Type',     dialog.data?.exam_type],
          ['Date',     dialog.data?.exam_date ? new Date(dialog.data.exam_date).toLocaleDateString('en-IN') : '—'],
          ['Marks',    dialog.data?.total_marks],
          ['Duration', dialog.data?.duration ? `${dialog.data.duration} min` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-3 py-1.5 border-b border-[color:var(--border)] last:border-0">
            <span className="text-[12.5px] font-medium text-[color:var(--fg-muted)] w-[90px] shrink-0">{label}</span>
            <span className="text-[13px] text-[color:var(--fg)]">{value ?? '—'}</span>
          </div>
        ))}
        {dialog.data?.status && (
          <div className="flex gap-3 py-1.5 border-b border-[color:var(--border)]">
            <span className="text-[12.5px] font-medium text-[color:var(--fg-muted)] w-[90px] shrink-0">Status</span>
            <Badge variant={STATUS_VARIANT[dialog.data.status] ?? 'neutral'} className="capitalize">
              {dialog.data.status}
            </Badge>
          </div>
        )}
        {dialog.data?.description && (
          <div className="flex gap-3 py-1.5">
            <span className="text-[12.5px] font-medium text-[color:var(--fg-muted)] w-[90px] shrink-0">Notes</span>
            <span className="text-[13px] text-[color:var(--fg)]">{dialog.data.description}</span>
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm(d => ({ ...d, open: false }))}
        title="Delete assessment"
        onSubmit={runDelete}
        submitLabel="Delete"
        destructive
        width={420}
      >
        <p className="text-[13.5px] text-[color:var(--fg-subtle)]">
          This assessment and all associated data will be permanently deleted. This cannot be undone.
        </p>
      </FormDialog>
    </div>
  );
}
