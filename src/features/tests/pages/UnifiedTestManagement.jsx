import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Edit, Eye, FileSpreadsheet, MoreHorizontal, PlayCircle,
  Plus, RefreshCw, Trash2, Trophy, Upload, Zap,
} from 'lucide-react';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { useErrorHandler } from '@/shared/hooks/useErrorHandler';
import {
  getTests, createTest, updateTest, deleteTest,
  getClassInstances, getSubjects,
} from '../services/testService';

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { PageHeader } from '@/shared/ui/PageHeader';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FormDialog } from '@/shared/ui/FormDialog';
import { Field } from '@/shared/ui/Field';
import { Badge } from '@/shared/ui/Badge';

import QuestionBuilder from '@/features/tests/components/QuestionBuilder';
import TestImportModal from '@/features/tests/components/TestImportModal';
import PreviewQuestionsModal from '@/features/tests/components/PreviewQuestionsModal';
import OfflineTestMarksManager from '@/features/tests/components/OfflineTestMarksManagerCorrect';
import AITestGeneratorWizard from '@/features/tests/components/AITestGeneratorWizard';

const TH = 'text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[color:var(--fg-muted)]';
const TH_FIRST = `${TH} px-5`;

const EMPTY_FORM = {
  title: '', description: '', test_mode: 'online', test_type: '',
  subject_id: '', class_instance_id: '', test_date: '',
  time_limit_seconds: '', allow_reattempts: false, status: 'active',
};

export default function UnifiedTestManagement() {
  const { user } = useAuth();
  const { showError } = useErrorHandler();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState([]);
  const [classInstances, setClassInstances] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('all');

  const [selectedTest, setSelectedTest] = useState(null);
  const [questionBuilderOpen, setQuestionBuilderOpen] = useState(false);
  const [testImportOpen, setTestImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [marksManagerOpen, setMarksManagerOpen] = useState(false);
  const [marksModalOpen, setMarksModalOpen] = useState(false);
  const [currentTestId, setCurrentTestId] = useState(null);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);

  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create' });
  const [editingTest, setEditingTest] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (searchParams.get('mode') === 'ai') setAiWizardOpen(true);
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const schoolCode = getSchoolCode(user);
      if (!schoolCode) { showError('School code not found.'); return; }
      const [testsData, classData, subjectsData] = await Promise.all([
        getTests(schoolCode),
        getClassInstances(schoolCode),
        getSubjects(schoolCode),
      ]);
      setTests(testsData || []);
      setClassInstances(classData || []);
      setSubjects(subjectsData || []);
    } catch (err) {
      showError('Failed to fetch data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const c = { total: tests.length, online: 0, offline: 0, active: 0 };
    for (const t of tests) {
      if (t.test_mode === 'online') c.online++;
      else if (t.test_mode === 'offline') c.offline++;
      if (t.is_active) c.active++;
    }
    return c;
  }, [tests]);

  const filteredTests = useMemo(() => {
    let list = tests.filter(t => t.test_mode === 'online');
    if (selectedClassId !== 'all')
      list = list.filter(t => t.class_instance_id === selectedClassId);
    return list;
  }, [tests, selectedClassId]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingTest(null);
    setFormDialog({ open: true, mode: 'create' });
  };

  const openEdit = (test) => {
    setForm({
      title: test.title || '',
      description: test.description || '',
      test_mode: test.test_mode || 'online',
      test_type: test.test_type || '',
      subject_id: test.subject_id || '',
      class_instance_id: test.class_instance_id || '',
      test_date: test.test_date || '',
      time_limit_seconds: String(test.time_limit_seconds || ''),
      allow_reattempts: test.allow_reattempts || false,
      status: test.status || 'active',
    });
    setFormErrors({});
    setEditingTest(test);
    setFormDialog({ open: true, mode: 'edit' });
  };

  const validateForm = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Required';
    if (!form.test_type.trim()) errs.test_type = 'Required';
    if (!form.subject_id) errs.subject_id = 'Required';
    if (!form.class_instance_id) errs.class_instance_id = 'Required';
    return errs;
  };

  const handleSave = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    const schoolCode = getSchoolCode(user);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      test_mode: form.test_mode,
      test_type: form.test_type.trim(),
      subject_id: form.subject_id,
      class_instance_id: form.class_instance_id,
      test_date: form.test_date || null,
      time_limit_seconds: form.time_limit_seconds ? parseInt(form.time_limit_seconds) : null,
      allow_reattempts: form.allow_reattempts,
      status: form.status || 'active',
    };
    if (formDialog.mode === 'create') {
      await createTest({ ...payload, school_code: schoolCode, created_by: user.id });
    } else {
      await updateTest(editingTest.id, payload);
    }
    setFormDialog(d => ({ ...d, open: false }));
    fetchData();
  };

  const runDelete = async () => {
    await deleteTest(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
    fetchData();
  };

  const handleManageQuestions = (test) => {
    setSelectedTest(test);
    if (test.test_mode === 'offline') {
      setMarksManagerOpen(true);
    } else {
      setQuestionBuilderOpen(true);
    }
  };

  const closeAiWizard = () => {
    setAiWizardOpen(false);
    if (searchParams.get('mode')) {
      const next = new URLSearchParams(searchParams);
      next.delete('mode');
      setSearchParams(next, { replace: true });
    }
  };

  const classLabel = (c) => `Grade ${c.grade ?? ''}${c.section ? ` ${c.section}` : ''}`;

  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title="Test Management"
        subtitle="Manage online tests. Offline assessments now live under Gradebook."
        actions={
          <div className="flex items-center gap-2">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[180px] h-8 text-[13px]">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classInstances.map(c => (
                  <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh All
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Tests',   value: counts.total,   icon: Trophy,          color: '--brand'   },
          { label: 'Online Tests',  value: counts.online,  icon: PlayCircle,      color: '--brand'   },
          { label: 'Offline Tests', value: counts.offline, icon: FileSpreadsheet, color: '--warning' },
          { label: 'Active Tests',  value: counts.active,  icon: Trophy,          color: '--success' },
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

      <div className="flex items-center justify-between mb-4">
        <span className="text-[15px] font-semibold text-[color:var(--fg)]">
          Online Tests ({filteredTests.length})
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTestImportOpen(true)}>
            <Upload size={13} /> Import Tests
          </Button>
          <Button
            variant="outline" size="sm"
            className="border-[color:var(--brand)] text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)]"
            onClick={() => setAiWizardOpen(true)}
          >
            <Zap size={13} /> Generate with AI
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus size={13} /> Create Online Test
          </Button>
        </div>
      </div>

      <Card padded={false}>
            {loading ? (
              <div className="p-10 text-center text-[13px] text-[color:var(--fg-subtle)]">Loading…</div>
            ) : filteredTests.length === 0 ? (
              <EmptyState
                type="tests"
                action={
                  <Button size="sm" className="mt-3" onClick={openCreate}>
                    <Plus size={13} /> Create first test
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[color:var(--bg-subtle)]">
                    <TableHead className={TH_FIRST}>Test Title</TableHead>
                    <TableHead className={TH}>Subject</TableHead>
                    <TableHead className={TH}>Class</TableHead>
                    <TableHead className={TH}>Type</TableHead>
                    <TableHead className={TH}>Test Date</TableHead>
                    <TableHead className={TH}>Status</TableHead>
                    <TableHead className={TH}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests.map(t => (
                    <TableRow key={t.id} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                      <TableCell className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-[color:var(--fg)]">{t.title}</span>
                          <Badge variant={t.test_mode === 'online' ? 'accent' : 'warning'} className="capitalize">
                            {t.test_mode}
                          </Badge>
                        </div>
                        {t.description && (
                          <div className="text-[12px] text-[color:var(--fg-muted)] mt-0.5">{t.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="info">{t.subject_name || '—'}</Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="success">{t.class_name || '—'}</Badge>
                      </TableCell>
                      <TableCell className="py-3 text-[13px] text-[color:var(--fg-muted)]">
                        {t.test_mode === 'online'
                          ? `${t.question_count || 0} questions`
                          : `${t.marks_uploaded || 0}/${t.total_students || 0} marks`}
                      </TableCell>
                      <TableCell className="py-3 text-[13px] text-[color:var(--fg-muted)] tabular-nums">
                        {t.test_date ? new Date(t.test_date).toLocaleDateString('en-IN') : 'Not set'}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant={t.status === 'active' ? 'success' : 'neutral'} className="capitalize">
                          {t.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handleManageQuestions(t)}>
                            <PlayCircle size={12} />
                            {t.test_mode === 'online' ? 'Manage Questions' : 'Upload Marks'}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {t.test_mode === 'online' && (
                                <DropdownMenuItem onClick={() => { setSelectedTest(t); setPreviewOpen(true); }}>
                                  <Eye size={13} /> Preview Questions
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openEdit(t)}>
                                <Edit size={13} /> Edit Test
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteConfirm({ open: true, id: t.id })}>
                                <Trash2 size={13} /> Delete Test
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
      </Card>

      {/* Create / Edit dialog */}
      <FormDialog
        open={formDialog.open}
        onClose={() => setFormDialog(d => ({ ...d, open: false }))}
        title={formDialog.mode === 'create' ? 'Create Test' : 'Edit Test'}
        onSubmit={handleSave}
        submitLabel={formDialog.mode === 'create' ? 'Create Test' : 'Save Changes'}
        width={600}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Test Title" required error={formErrors.title} className="col-span-2">
            <Input
              placeholder="e.g. Math Quiz 1, Science Test"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </Field>

          <Field label="Description" className="col-span-2">
            <Textarea
              placeholder="Optional description of the test"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </Field>

          <Field label="Test Type" required error={formErrors.test_type}>
            <Input
              placeholder="e.g. Unit Test, Quiz, Final Exam"
              value={form.test_type}
              onChange={e => setForm(f => ({ ...f, test_type: e.target.value }))}
            />
          </Field>

          <Field label="Test Date">
            <Input
              type="date"
              value={form.test_date}
              onChange={e => setForm(f => ({ ...f, test_date: e.target.value }))}
            />
          </Field>

          <Field label="Subject" required error={formErrors.subject_id}>
            <Select value={form.subject_id || ''} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Class" required error={formErrors.class_instance_id}>
            <Select value={form.class_instance_id || ''} onValueChange={v => setForm(f => ({ ...f, class_instance_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classInstances.map(c => (
                  <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Time Limit (minutes)">
            <Input
              type="number"
              placeholder="60"
              value={form.time_limit_seconds}
              onChange={e => setForm(f => ({ ...f, time_limit_seconds: e.target.value }))}
            />
          </Field>

          <Field label="Status">
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Allow Reattempts" className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allow_reattempts}
                onChange={e => setForm(f => ({ ...f, allow_reattempts: e.target.checked }))}
                className="rounded border-[color:var(--border)] accent-[color:var(--brand)]"
              />
              <span className="text-[13px] text-[color:var(--fg)]">Students can retake this test</span>
            </label>
          </Field>
        </div>
      </FormDialog>

      {/* Delete confirm */}
      <FormDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm(d => ({ ...d, open: false }))}
        title="Delete Test"
        onSubmit={runDelete}
        submitLabel="Delete"
        destructive
        width={420}
      >
        <p className="text-[13.5px] text-[color:var(--fg-subtle)]">
          Are you sure you want to delete this test? This action cannot be undone.
        </p>
      </FormDialog>

      {/* AI Wizard */}
      <Dialog open={aiWizardOpen} onOpenChange={open => { if (!open) closeAiWizard(); }}>
        <DialogContent className="max-w-[920px] p-0" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Zap size={16} style={{ color: 'var(--brand)' }} /> AI Test Generator
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4">
            <AITestGeneratorWizard
              onCancel={closeAiWizard}
              onSaved={() => { closeAiWizard(); fetchData(); }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Builder */}
      {selectedTest?.test_mode === 'online' && (
        <QuestionBuilder
          visible={questionBuilderOpen}
          onClose={() => { setQuestionBuilderOpen(false); setSelectedTest(null); fetchData(); }}
          test={selectedTest}
        />
      )}

      {/* Test Import */}
      <TestImportModal
        visible={testImportOpen}
        onClose={() => { setTestImportOpen(false); fetchData(); }}
        classInstances={classInstances}
        subjects={subjects}
        schoolCode={getSchoolCode(user)}
        userId={user?.id}
      />

      {/* Preview Questions */}
      {selectedTest?.test_mode === 'online' && (
        <PreviewQuestionsModal
          visible={previewOpen}
          onClose={() => { setPreviewOpen(false); setSelectedTest(null); }}
          test={selectedTest}
        />
      )}

      {/* Offline Marks Manager (from row action) */}
      {selectedTest?.test_mode === 'offline' && (
        <OfflineTestMarksManager
          visible={marksManagerOpen}
          onClose={() => { setMarksManagerOpen(false); setSelectedTest(null); fetchData(); }}
          test={selectedTest}
        />
      )}

      {/* Offline Marks Manager (from marks panel) */}
      {currentTestId && (
        <OfflineTestMarksManager
          open={marksModalOpen}
          onClose={() => { setMarksModalOpen(false); setCurrentTestId(null); fetchData(); }}
          testId={currentTestId}
        />
      )}
    </div>
  );
}
