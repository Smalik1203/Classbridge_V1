/**
 * AnnouncementFormModal — shadcn Dialog version of the post/edit announcement
 * form. Same fields, same validation, same service calls; the visual layer
 * uses the reusable FormDialog + Field + OptionGroup primitives so this
 * modal looks identical to every other CRUD modal in the app.
 */
import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, ImagePlus } from 'lucide-react';

import { announcementsService, PRIORITY_META } from '../services/communicationsService';
import AnnouncementImage from './AnnouncementImage';

// shadcn primitives
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

// shadcn-backed shared
import { FormDialog } from '@/shared/ui/FormDialog';
import { Field } from '@/shared/ui/Field';
import { OptionGroup, RadioRow } from '@/shared/ui/OptionGroup';
import { MultiSelect } from '@/shared/ui/MultiSelect';
import { Badge } from '@/shared/ui/Badge';

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];

export default function AnnouncementFormModal({
  open, onClose, onSaved, schoolCode, classes = [], editing,
}) {
  const isEdit = !!editing;
  const fileInputRef = useRef(null);

  // Form state — kept local; submitted via FormDialog's onSubmit.
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [targetType, setTargetType] = useState('all');
  const [classIds, setClassIds] = useState([]);
  const [imagePath, setImagePath] = useState(null);
  const [imageName, setImageName] = useState('');

  // Submit / upload state
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);

  // Reset whenever opened (or `editing` changes).
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title || '');
    setMessage(editing?.message || '');
    setPriority(editing?.priority || 'medium');
    setTargetType(editing?.target_type || 'all');
    setClassIds(
      editing?.class_instance_ids?.length
        ? editing.class_instance_ids
        : (editing?.class_instance_id ? [editing.class_instance_id] : [])
    );
    setImagePath(editing?.image_url || null);
    setImageName('');
    setError(null);
  }, [open, editing]);

  // ── handlers ────────────────────────────────────────────────────────────
  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      setError(null);
      const path = await announcementsService.uploadImage(file, schoolCode);
      setImagePath(path);
      setImageName(file.name);
    } catch (e2) {
      setError(e2.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
      // reset the input so re-selecting the same file fires onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setImagePath(null);
    setImageName('');
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation — keep parity with the previous AntD rules.
    const msg = (message || '').trim();
    if (!msg) {
      setError('Message is required');
      return;
    }
    if (targetType === 'class' && classIds.length === 0) {
      setError('Select at least one class');
      return;
    }

    const finalTitle = (title || '').trim() || msg.slice(0, 60);
    const class_instance_ids = targetType === 'class' ? classIds : [];

    const payload = {
      title: finalTitle,
      message: msg,
      priority,
      target_type: targetType,
      class_instance_id: class_instance_ids[0] || null,
      class_instance_ids,
      image_url: imagePath || null,
      school_code: schoolCode,
    };

    try {
      setSubmitting(true);
      if (isEdit) {
        await announcementsService.update(editing.id, {
          title: payload.title,
          message: payload.message,
          priority: payload.priority,
          image_url: payload.image_url,
          target_type: payload.target_type,
          class_instance_id: payload.class_instance_id,
          class_instance_ids: payload.class_instance_ids,
        });
      } else {
        await announcementsService.create(payload);
      }
      onSaved?.();
      onClose?.();
    } catch (e2) {
      setError(e2.message || 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Announcement' : 'Post Announcement'}
      submitLabel={isEdit ? 'Save changes' : 'Post'}
      onSubmit={handleSubmit}
      submitting={submitting}
      width={680}
    >
      <Field label="Title" hint="Optional · auto-fills from message if blank">
        <Input
          placeholder="e.g. Mid-term exams begin Monday, May 5"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
      </Field>

      <Field label="Message" required>
        <Textarea
          placeholder="Share an update with the school…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="min-h-[112px]"
        />
      </Field>

      <Field label="Priority">
        <OptionGroup
          value={priority}
          onChange={setPriority}
          options={PRIORITIES.map((p) => ({
            value: p,
            label: PRIORITY_META[p].label,
            icon: PRIORITY_META[p].icon,
          }))}
        />
      </Field>

      <Field label="Audience">
        <RadioRow
          value={targetType}
          onChange={setTargetType}
          options={[
            { value: 'all', label: 'Everyone in school' },
            { value: 'class', label: 'Specific classes' },
          ]}
        />
      </Field>

      {targetType === 'class' && (
        <Field label="Classes" required>
          <MultiSelect
            value={classIds}
            onChange={setClassIds}
            options={classes.map((c) => ({
              value: c.id,
              label: `Grade ${c.grade}${c.section ? '-' + c.section : ''}`,
            }))}
            // Collapse duplicate display labels (DB has dupes for some grades)
            dedupeKey={(opt) => opt.label}
            placeholder="Pick one or more classes"
            searchPlaceholder="Search classes…"
            emptyText="No classes match"
          />
        </Field>
      )}

      <Field label="Image" hint={
        <span>
          Optional · stored in the <Badge variant="neutral">Lms</Badge> bucket
          {' '}at <code className="font-mono text-[11.5px] px-1 py-0.5 rounded bg-[color:var(--bg-subtle)] border border-[color:var(--border)]">announcements/{schoolCode}/…</code>
        </span>
      }>
        {imagePath ? (
          <div className="flex flex-col gap-2">
            <div className="rounded-md overflow-hidden border border-[color:var(--border)] max-w-md">
              <AnnouncementImage path={imagePath} height={180} />
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeImage}
                className="text-[color:var(--danger)] hover:text-[color:var(--danger)]"
              >
                <Trash2 size={14} />
                Remove image
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              <ImagePlus size={14} />
              {uploadingImage ? 'Uploading…' : 'Choose image'}
            </Button>
            {imageName && (
              <span className="text-[12.5px] text-[color:var(--fg-subtle)]">{imageName}</span>
            )}
          </div>
        )}
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

