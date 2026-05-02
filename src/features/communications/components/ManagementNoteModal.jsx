/**
 * ManagementNoteModal — superadmin writes an internal note to an admin or
 * teacher (optionally requiring acknowledgement). shadcn Dialog version.
 */
import { useEffect, useState } from 'react';

import {
  feedbackService, MANAGEMENT_NOTE_CATEGORIES, CATEGORY_LABELS,
} from '../services/communicationsService';

import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { FormDialog } from '@/shared/ui/FormDialog';
import { Field } from '@/shared/ui/Field';
import { OptionGroup } from '@/shared/ui/OptionGroup';

export default function ManagementNoteModal({
  open, onClose, onSaved, schoolCode, fromUserId,
}) {
  const [recipients, setRecipients] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [category, setCategory] = useState('observation');
  const [content, setContent] = useState('');
  const [requiresAck, setRequiresAck] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRecipientId('');
    setCategory('observation');
    setContent('');
    setRequiresAck(false);
    setError(null);
    feedbackService.listRecipients(schoolCode)
      .then((r) => setRecipients(
        r.filter((u) => u.role === 'admin' || u.role === 'teacher')
      ))
      .catch((e) => setError(e.message || 'Failed to load recipients'));
  }, [open, schoolCode]);

  const handleSubmit = async () => {
    setError(null);
    if (!recipientId) { setError('Pick a recipient'); return; }
    const text = (content || '').trim();
    if (!text) { setError('Write your note'); return; }

    try {
      setSubmitting(true);
      await feedbackService.addManagementNote({
        from_user_id: fromUserId,
        to_user_id: recipientId,
        category,
        content: text,
        requires_acknowledgement: requiresAck,
        school_code: schoolCode,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e.message || 'Failed to send note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Add management note"
      submitLabel="Send note"
      onSubmit={handleSubmit}
      submitting={submitting}
      width={620}
    >
      <Field label="Recipient" required>
        <Select value={recipientId} onValueChange={setRecipientId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose teacher or admin" />
          </SelectTrigger>
          <SelectContent>
            {recipients.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Category" required>
        <OptionGroup
          value={category}
          onChange={setCategory}
          options={MANAGEMENT_NOTE_CATEGORIES.map((c) => ({
            value: c, label: CATEGORY_LABELS[c],
          }))}
          size="sm"
        />
      </Field>

      <Field label="Note" required>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share an observation, feedback or expectation…"
          rows={5}
          className="min-h-[112px]"
        />
      </Field>

      <Label className="flex items-center gap-2 text-[13px] text-[color:var(--fg)] cursor-pointer">
        <Checkbox
          checked={requiresAck}
          onCheckedChange={(v) => setRequiresAck(!!v)}
        />
        <span>Require recipient to acknowledge</span>
      </Label>

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
