/**
 * FeedbackDetailModal — read-only deep-dive on one feedback record, with
 * "Acknowledge" and "Archive" actions. shadcn Dialog version.
 */
import { useState } from 'react';
import dayjs from 'dayjs';
import { Check, Archive } from 'lucide-react';

import {
  feedbackService, SENTIMENT_META, CATEGORY_LABELS,
} from '../services/communicationsService';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/shared/ui/Badge';

const TYPE_LABEL = {
  student_to_admin: 'From student',
  admin_to_student: 'To student',
  management_note: 'Management note',
  superadmin_to_admin: 'Super-admin → admin',
};

const SENTIMENT_VARIANT = {
  positive: 'success',
  neutral: 'neutral',
  needs_improvement: 'warning',
};

export default function FeedbackDetailModal({
  open, onClose, item, currentUserId, onChanged,
}) {
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const sentimentMeta = item.sentiment ? SENTIMENT_META[item.sentiment] : null;
  const fromUser = item.from_user;
  const toUser = item.to_user;
  const subj = item.subject;
  const cls = item.class;

  const archive = async () => {
    try {
      setBusy(true);
      await feedbackService.archive(item.id, currentUserId);
      onChanged?.();
      onClose?.();
    } finally { setBusy(false); }
  };

  const acknowledge = async () => {
    try {
      setBusy(true);
      await feedbackService.acknowledge(item.id);
      onChanged?.();
      onClose?.();
    } finally { setBusy(false); }
  };

  return (
    <Dialog
      open={!!open}
      onOpenChange={(o) => { if (!o && !busy) onClose?.(); }}
    >
      <DialogContent
        className="gap-0 p-0 sm:max-w-none flex flex-col max-h-[calc(100vh-64px)] bg-[color:var(--bg-elev)] border-[color:var(--border)] rounded-[var(--radius-lg)]"
        style={{ width: 640 }}
        showCloseButton={!busy}
      >
        <DialogHeader className="px-6 pt-[18px] pb-4 border-b border-[color:var(--border)] flex-row items-start justify-between gap-4 flex-shrink-0 space-y-0">
          <div className="text-left">
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.012em] text-[color:var(--fg)] leading-tight">
              Feedback details
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center flex-wrap gap-2">
            <Badge variant="info">{TYPE_LABEL[item.feedback_type] || item.feedback_type}</Badge>
            <Badge variant="neutral">{CATEGORY_LABELS[item.category] || item.category}</Badge>
            {sentimentMeta && (
              <Badge variant={SENTIMENT_VARIANT[item.sentiment] || 'neutral'} dot>
                {sentimentMeta.label}
              </Badge>
            )}
            {item.acknowledged_at ? (
              <Badge variant="success" dot>Acknowledged</Badge>
            ) : item.requires_acknowledgement ? (
              <Badge variant="warning" dot>Pending acknowledgement</Badge>
            ) : null}
          </div>

          <dl className="rounded-[var(--radius-lg)] border border-[color:var(--border)] divide-y divide-[color:var(--border)] overflow-hidden">
            <DetailRow label="From" value={fromUser ? `${fromUser.full_name} (${fromUser.role})` : '—'} />
            <DetailRow label="To" value={toUser ? `${toUser.full_name} (${toUser.role})` : '—'} />
            {subj && <DetailRow label="Subject" value={subj.subject_name} />}
            {cls && <DetailRow label="Class" value={`Grade ${cls.grade}-${cls.section}`} />}
            <DetailRow label="Date" value={dayjs(item.created_at).format('DD MMM YYYY · HH:mm')} />
          </dl>

          <div>
            <div className="text-[12.5px] font-medium text-[color:var(--fg)] mb-1.5">Content</div>
            <p className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-subtle)] px-3 py-2.5 text-[13.5px] text-[color:var(--fg)] leading-[1.55] whitespace-pre-wrap m-0">
              {item.content}
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-3.5 border-t border-[color:var(--border)] bg-[color:var(--bg-subtle)] flex-shrink-0 sm:justify-end gap-2 flex-row">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {item.requires_acknowledgement && !item.acknowledged_at && (
            <Button type="button" size="sm" onClick={acknowledge} disabled={busy}>
              <Check size={14} />
              Acknowledge
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={archive}
            disabled={busy}
            className="text-[color:var(--danger)] hover:text-[color:var(--danger)]"
          >
            <Archive size={14} />
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] text-[13px]">
      <dt className="px-3 py-2 bg-[color:var(--bg-subtle)] text-[color:var(--fg-muted)] font-medium">
        {label}
      </dt>
      <dd className="px-3 py-2 text-[color:var(--fg)] m-0">{value}</dd>
    </div>
  );
}
