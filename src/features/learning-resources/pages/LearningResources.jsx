/**
 * LearningResources — admin/superadmin (and direct-URL student) view of the
 * school's learning resources library. Filter by class + subject + type,
 * preview videos/PDFs in-app, and add/edit/delete records.
 *
 * Visual layer is fully shadcn-driven. Data flow (resourceService, supabase
 * queries, storage upload) is unchanged.
 */
import { useEffect, useState } from 'react';
import {
  Plus, Search, RefreshCw, Pencil, Trash2,
  PlayCircle, FileText, ListChecks, Download, X, Upload,
} from 'lucide-react';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole, getStudentCode } from '@/shared/utils/metadata';
import { useAcademicYear } from '@/features/analytics/context/AcademicYearContext';
import { supabase } from '@/config/supabaseClient';
import {
  getLearningResources,
  getStudentResources,
  createLearningResource,
  updateLearningResource,
  deleteLearningResource,
} from '../services/resourceService';
import VideoPlayer from '../components/VideoPlayer';

// shadcn
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

// shadcn-backed shared
import { PageHeader } from '@/shared/ui/PageHeader';
import { Badge } from '@/shared/ui/Badge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FormDialog } from '@/shared/ui/FormDialog';
import { Field } from '@/shared/ui/Field';
import { OptionGroup } from '@/shared/ui/OptionGroup';

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'Lms';

const TYPE_META = {
  video: { label: 'Video', icon: PlayCircle, variant: 'info', primary: 'Watch' },
  pdf:   { label: 'PDF',   icon: FileText,   variant: 'info', primary: 'Read' },
  quiz:  { label: 'Quiz',  icon: ListChecks, variant: 'accent', primary: 'Attempt' },
};

const TYPE_TABS = [
  { key: 'all',   label: 'All' },
  { key: 'video', label: 'Lectures' },
  { key: 'pdf',   label: 'Study materials' },
  { key: 'quiz',  label: 'Practice tests' },
];

function classLabel(c) {
  if (!c) return '';
  return `Grade ${c.grade}${c.section ? `-${c.section}` : ''}`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function LearningResources() {
  const { user } = useAuth();
  const { selectedAyId } = useAcademicYear();
  const role = getUserRole(user);
  const isStudent = role === 'student';
  const canEdit = role === 'superadmin' || role === 'admin';

  const [resources, setResources] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [subjectId, setSubjectId] = useState('all');
  const [classId, setClassId] = useState('all');

  // dialogs
  const [previewItem, setPreviewItem] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── data loaders ────────────────────────────────────────────────────────
  const loadSubjects = async () => {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) return;
    const { data, error: e } = await supabase
      .from('subjects')
      .select('id, subject_name')
      .eq('school_code', schoolCode)
      .order('subject_name');
    if (!e) setSubjects(data || []);
  };

  const loadClasses = async () => {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode || !selectedAyId) { setClasses([]); return; }
    const { data, error: e } = await supabase
      .from('class_instances')
      .select('id, grade, section, school_code, academic_year_id')
      .eq('school_code', schoolCode)
      .eq('academic_year_id', selectedAyId)
      .order('grade').order('section');
    if (!e) setClasses(data || []);
  };

  // Lock students to their own class
  const loadStudentClass = async () => {
    if (!isStudent || !user) return;
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) return;
    const studentCode = getStudentCode(user);
    const base = supabase
      .from('student')
      .select('class_instance_id, school_code, student_code, email')
      .eq('school_code', schoolCode);
    const { data } = await (studentCode
      ? base.eq('student_code', studentCode)
      : base.eq('email', user.email)
    ).maybeSingle();
    if (data?.class_instance_id) setClassId(data.class_instance_id);
  };

  const loadResources = async () => {
    if (!user) return;
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) { setError('School information not found'); return; }

    try {
      setLoading(true); setError(null);
      const filters = {
        page: 1,
        limit: 100,
        search: search || undefined,
        resource_type: type !== 'all' ? type : undefined,
        subject_id: subjectId !== 'all' ? subjectId : undefined,
        class_instance_id: classId !== 'all' ? classId : undefined,
        school_code: schoolCode,
      };
      const result = isStudent
        ? await getStudentResources(user.id, filters)
        : await getLearningResources(filters);
      setResources(result?.data || []);
    } catch (e) {
      console.error('[learning-resources] load failed', e);
      setError(e.message || 'Failed to load resources');
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadSubjects();
    loadClasses();
    loadStudentClass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedAyId]);

  useEffect(() => {
    loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, search, type, subjectId, classId]);

  // ── actions ─────────────────────────────────────────────────────────────
  const onAdd = () => { setEditing(null); setFormOpen(true); };
  const onEdit = (r) => { setEditing(r); setFormOpen(true); };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteLearningResource(confirmDelete.id);
      setConfirmDelete(null);
      loadResources();
    } catch (e) {
      console.error('[learning-resources] delete failed', e);
    }
  };

  const onPrimary = (r) => {
    if (r.resource_type === 'quiz') {
      window.open(r.content_url, '_blank');
      return;
    }
    setPreviewItem(r);
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title="Resources"
        subtitle="Videos, study materials and practice tests organised by class and subject."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={loadResources} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            {canEdit && (
              <Button size="sm" onClick={onAdd}>
                <Plus size={14} />
                Add resource
              </Button>
            )}
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-subtle)] pointer-events-none"
          />
          <Input
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[280px] h-9"
          />
        </div>

        <Select
          value={classId}
          onValueChange={setClassId}
          disabled={isStudent}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type tabs */}
      <div className="border-b border-[color:var(--border)] mb-6">
        <Tabs value={type} onValueChange={setType}>
          <TabsList variant="line" className="bg-transparent p-0 h-auto gap-2 rounded-none">
            {TYPE_TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="px-3 pb-3 pt-0 text-[13.5px] font-medium rounded-none text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] data-[state=active]:bg-transparent shadow-none"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)]">
          <EmptyState
            title="Couldn't load resources"
            sub={error}
            action={
              <Button variant="outline" size="sm" onClick={loadResources}>
                <RefreshCw size={14} />
                Try again
              </Button>
            }
          />
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)]">
          <EmptyState
            icon={FileText}
            title="No resources yet"
            sub={
              search || type !== 'all' || subjectId !== 'all' || classId !== 'all'
                ? 'No resources match the current filters.'
                : 'Add a video, study material or quiz to get started.'
            }
            action={canEdit ? (
              <Button size="sm" onClick={onAdd}>
                <Plus size={14} />
                Add resource
              </Button>
            ) : null}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {resources.map((r) => (
            <ResourceRow
              key={r.id}
              resource={r}
              canEdit={canEdit}
              onPrimary={() => onPrimary(r)}
              onEdit={() => onEdit(r)}
              onDelete={() => setConfirmDelete(r)}
            />
          ))}
        </div>
      )}

      {/* Preview dialog (video / pdf) */}
      <PreviewDialog item={previewItem} onClose={() => setPreviewItem(null)} />

      {/* Add / edit dialog */}
      <ResourceFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => loadResources()}
        editing={editing}
        subjects={subjects}
        classes={classes}
        user={user}
      />

      {/* Delete confirm */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
      >
        <DialogContent
          className="gap-0 p-0 sm:max-w-none flex flex-col bg-[color:var(--bg-elev)] border-[color:var(--border)] rounded-[var(--radius-lg)]"
          style={{ width: 460 }}
        >
          <DialogHeader className="px-6 pt-[18px] pb-4 border-b border-[color:var(--border)]">
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.012em] text-[color:var(--fg)]">
              Delete resource
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 text-[13.5px] text-[color:var(--fg-muted)]">
            Delete <span className="font-medium text-[color:var(--fg)]">{confirmDelete?.title}</span>?
            This cannot be undone.
          </div>
          <DialogFooter className="px-6 py-3.5 border-t border-[color:var(--border)] bg-[color:var(--bg-subtle)] sm:justify-end gap-2 flex-row">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 size={14} />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────
function ResourceRow({ resource: r, canEdit, onPrimary, onEdit, onDelete }) {
  const meta = TYPE_META[r.resource_type] || TYPE_META.pdf;
  const Icon = meta.icon;
  const grade = r.class_instances ? classLabel(r.class_instances) : null;

  return (
    <div
      className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-[color:var(--border-strong)] transition-colors"
      onClick={onPrimary}
    >
      <div
        className="size-10 rounded-md grid place-items-center shrink-0"
        style={{ background: 'var(--bg-subtle)', color: 'var(--brand)' }}
      >
        <Icon size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-[14px] font-semibold tracking-[-0.012em] text-[color:var(--fg)] truncate m-0">
            {r.title}
          </h3>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        {r.description && (
          <p className="text-[12.5px] text-[color:var(--fg-muted)] truncate m-0">
            {r.description}
          </p>
        )}
        <div className="text-[11.5px] text-[color:var(--fg-subtle)] mt-1">
          {grade && <span>{grade}</span>}
          {grade && <span className="mx-1.5 text-[color:var(--fg-faint)]">·</span>}
          <span>{formatDate(r.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canEdit && (
          <>
            <Button
              variant="ghost" size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              aria-label="Edit"
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost" size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              aria-label="Delete"
              className="text-[color:var(--danger)] hover:text-[color:var(--danger)]"
            >
              <Trash2 size={14} />
            </Button>
          </>
        )}
        <Button
          size="sm"
          onClick={(e) => { e.stopPropagation(); onPrimary(); }}
        >
          {meta.primary}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview dialog
// ─────────────────────────────────────────────────────────────────────────────
function PreviewDialog({ item, onClose }) {
  if (!item) return null;
  const isVideo = item.resource_type === 'video';

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-none flex flex-col bg-[color:var(--bg-elev)] border-[color:var(--border)] rounded-[var(--radius-lg)]"
        style={{ width: 'min(1200px, 96vw)', height: 'calc(100dvh - 64px)' }}
        showCloseButton={false}
      >
        <DialogHeader className="px-5 py-3 border-b border-[color:var(--border)] flex-row items-center justify-between gap-4 flex-shrink-0 space-y-0">
          <DialogTitle className="text-[15px] font-semibold tracking-[-0.012em] text-[color:var(--fg)] flex items-center gap-2">
            {isVideo ? <PlayCircle size={16} /> : <FileText size={16} />}
            {item.title}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {!isVideo && (
              <Button
                variant="outline" size="sm"
                onClick={() => window.open(item.content_url, '_blank')}
              >
                <Download size={14} />
                Download
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
              <X size={16} />
            </Button>
          </div>
        </DialogHeader>

        <div className={`flex-1 min-h-0 bg-black overflow-hidden${isVideo ? ' flex items-center justify-center' : ''}`}>
          {isVideo ? (
            <VideoPlayer url={item.content_url} title={item.title} className="w-full" />
          ) : (
            <iframe
              src={`${item.content_url}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full border-0"
              title={item.title}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / edit dialog
// ─────────────────────────────────────────────────────────────────────────────
function ResourceFormDialog({ open, onClose, onSaved, editing, subjects, classes, user }) {
  const isEdit = !!editing;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState('video');
  const [subjectId, setSubjectId] = useState('');
  const [classInstanceId, setClassInstanceId] = useState('');
  const [contentUrl, setContentUrl] = useState('');
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title || '');
    setDescription(editing?.description || '');
    setResourceType(editing?.resource_type || 'video');
    setSubjectId(editing?.subject_id || '');
    setClassInstanceId(editing?.class_instance_id || '');
    setContentUrl(editing?.content_url || '');
    setUseFileUpload(false);
    setFile(null);
    setError(null);
  }, [open, editing]);

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim())          { setError('Title is required'); return; }
    if (!description.trim())    { setError('Description is required'); return; }
    if (!subjectId)             { setError('Choose a subject'); return; }
    if (!classInstanceId)       { setError('Choose a class'); return; }
    if (!useFileUpload && !contentUrl.trim()) { setError('Content URL is required'); return; }
    if (useFileUpload && !file) { setError('Choose a file to upload'); return; }

    const schoolCode = getSchoolCode(user);
    if (!schoolCode) { setError('School not found on your account'); return; }

    try {
      setSubmitting(true);

      let finalUrl = contentUrl.trim();
      if (useFileUpload && file) {
        const ext = file.name.split('.').pop();
        const path = `${schoolCode}/${classInstanceId}/${subjectId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase
          .storage.from(STORAGE_BUCKET)
          .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
        if (upErr) {
          throw new Error(
            (upErr.message || '').toLowerCase().includes('not found')
              ? `Storage bucket "${STORAGE_BUCKET}" not found.`
              : (upErr.message || 'Upload failed')
          );
        }
        const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        finalUrl = pub?.publicUrl || finalUrl;
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        resource_type: resourceType,
        content_url: finalUrl,
        school_code: schoolCode,
        subject_id: subjectId,
        class_instance_id: classInstanceId,
        uploaded_by: user.id,
      };

      if (isEdit) {
        await updateLearningResource(editing.id, payload);
      } else {
        await createLearningResource(payload);
      }

      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error('[learning-resources] save failed', e);
      setError(e.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit resource' : 'Add new resource'}
      submitLabel={isEdit ? 'Save changes' : 'Create resource'}
      onSubmit={handleSubmit}
      submitting={submitting}
      width={620}
    >
      <Field label="Title" required>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Photosynthesis — Chapter 6 lecture"
          maxLength={140}
        />
      </Field>

      <Field label="Description" required>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's in this resource?"
          rows={3}
          className="min-h-[88px]"
        />
      </Field>

      <Field label="Type" required>
        <OptionGroup
          value={resourceType}
          onChange={setResourceType}
          options={[
            { value: 'video', label: 'Video' },
            { value: 'pdf',   label: 'PDF' },
            { value: 'quiz',  label: 'Quiz' },
          ]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Subject" required>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Class" required>
          <Select value={classInstanceId} onValueChange={setClassInstanceId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Content source">
        <OptionGroup
          value={useFileUpload ? 'file' : 'url'}
          onChange={(v) => setUseFileUpload(v === 'file')}
          options={[
            { value: 'url',  label: 'Use URL' },
            { value: 'file', label: 'Upload file' },
          ]}
          size="sm"
        />
      </Field>

      {!useFileUpload ? (
        <Field label="Content URL" required>
          <Input
            value={contentUrl}
            onChange={(e) => setContentUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
      ) : (
        <Field
          label="Upload file"
          required
          hint={`Stored in the "${STORAGE_BUCKET}" bucket. Videos (mp4, webm, …) and PDFs supported.`}
        >
          <div className="flex items-center gap-3">
            <input
              id="resource-file"
              type="file"
              accept="video/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('resource-file')?.click()}
            >
              <Upload size={14} />
              {file ? 'Change file' : 'Choose file'}
            </Button>
            {file && (
              <span className="text-[12.5px] text-[color:var(--fg-subtle)] truncate">
                {file.name}
              </span>
            )}
          </div>
        </Field>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-3 py-2 text-[12.5px] text-[color:var(--danger)]"
        >
          {error}
        </div>
      )}
    </FormDialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] px-4 py-3 flex items-center gap-3"
        >
          <div className="cb-skel size-10 rounded-md" />
          <div className="flex-1 space-y-2">
            <div className="cb-skel h-3 w-1/3 rounded" />
            <div className="cb-skel h-3 w-2/3 rounded" />
          </div>
          <div className="cb-skel h-7 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}
