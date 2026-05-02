/**
 * StudentFeedbackModal — admin/teacher composes a feedback note addressed to
 * one specific student. shadcn Dialog version.
 */
import { useEffect, useMemo, useState } from 'react';

import {
  feedbackService, STUDENT_REMARK_CATEGORIES, CATEGORY_LABELS,
} from '../services/communicationsService';
import { useAcademicYear } from '@/features/analytics/context/AcademicYearContext';

import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { FormDialog } from '@/shared/ui/FormDialog';
import { Field } from '@/shared/ui/Field';
import { OptionGroup } from '@/shared/ui/OptionGroup';

export default function StudentFeedbackModal({
  open, onClose, onSaved, schoolCode, fromUserId,
}) {
  const { selectedAyId } = useAcademicYear();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState('observation');
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClassFilter('');
    setStudentId('');
    setCategory('observation');
    setContent('');
    setError(null);
    Promise.all([
      feedbackService.listStudents(schoolCode),
      feedbackService.listClasses(schoolCode, selectedAyId),
    ])
      .then(([s, c]) => { setStudents(s); setClasses(c); })
      .catch((e) => setError(e.message || 'Failed to load students'));
  }, [open, schoolCode, selectedAyId]);

  const filteredStudents = useMemo(() => {
    if (!classFilter) return students;
    return students.filter((s) => s.class_instance_id === classFilter);
  }, [students, classFilter]);

  const handleSubmit = async () => {
    setError(null);
    if (!studentId) { setError('Choose a student'); return; }
    const text = (content || '').trim();
    if (!text) { setError('Write your feedback'); return; }

    try {
      setSubmitting(true);
      await feedbackService.sendStudentFeedback({
        from_user_id: fromUserId,
        to_user_id: studentId,
        class_instance_id: classFilter || null,
        category,
        content: text,
        school_code: schoolCode,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e.message || 'Failed to send');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Send feedback to a student"
      submitLabel="Send feedback"
      onSubmit={handleSubmit}
      submitting={submitting}
      width={620}
    >
      <Field label="Class" hint="Optional · narrows the student list">
        <Select
          value={classFilter || '__all'}
          onValueChange={(v) => { setClassFilter(v === '__all' ? '' : v); setStudentId(''); }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                Grade {c.grade}{c.section ? `-${c.section}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Student" required>
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a student" />
          </SelectTrigger>
          <SelectContent>
            {filteredStudents.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Category" required>
        <OptionGroup
          value={category}
          onChange={setCategory}
          options={STUDENT_REMARK_CATEGORIES.map((c) => ({
            value: c, label: CATEGORY_LABELS[c],
          }))}
          size="sm"
        />
      </Field>

      <Field label="Feedback" required>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share remark, appreciation or improvement note…"
          rows={5}
          className="min-h-[112px]"
        />
      </Field>

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
