/**
 * Communication Hub (Feedback) — role-aware feedback inbox/composer.
 *
 * Three views share the same shell:
 *   - SuperAdmin: every feedback record in the school (table + filters)
 *   - Admin / Teacher: feedback they received (card list + acknowledge)
 *   - Student: send + received feedback (compose form + card list)
 *
 * Visual layer is fully shadcn-driven and matches the Announcements page.
 * Service calls and data shapes are unchanged.
 */
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  MessageSquare, RefreshCw, Plus, Send, Check, Search, Download,
  User, Inbox, BookOpen, GraduationCap,
} from 'lucide-react';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import {
  feedbackService, SENTIMENT_META, CATEGORY_LABELS,
  STUDENT_FEEDBACK_CATEGORIES,
} from '../services/communicationsService';
import ManagementNoteModal from '../components/ManagementNoteModal';
import StudentFeedbackModal from '../components/StudentFeedbackModal';
import FeedbackDetailModal from '../components/FeedbackDetailModal';

// shadcn
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// shadcn-backed shared
import { PageHeader } from '@/shared/ui/PageHeader';
import { Badge } from '@/shared/ui/Badge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Field } from '@/shared/ui/Field';
import { OptionGroup } from '@/shared/ui/OptionGroup';

dayjs.extend(relativeTime);

const SENTIMENTS = ['positive', 'neutral', 'needs_improvement'];

const SENTIMENT_VARIANT = {
  positive: 'success',
  neutral: 'neutral',
  needs_improvement: 'warning',
};

function exportCsv(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

// ─────────────────────────────────────────────────────────────────────────────
// Page entry — role router + shared shell
// ─────────────────────────────────────────────────────────────────────────────
export default function CommunicationHub() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const schoolCode = getSchoolCode(user);
  const authUserId = user?.id;

  const isSuperAdmin = role === 'superadmin';
  const isAdminOrTeacher = role === 'admin' || role === 'teacher';
  const isStudent = role === 'student';

  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title="Feedback"
        subtitle="Two-way feedback between students, teachers and the school admin team."
      />

      {isSuperAdmin && <SuperAdminDashboard schoolCode={schoolCode} currentUserId={authUserId} />}
      {!isSuperAdmin && isAdminOrTeacher && (
        <AdminInbox authUserId={authUserId} schoolCode={schoolCode} currentUserId={authUserId} />
      )}
      {isStudent && <StudentForm schoolCode={schoolCode} currentUserId={authUserId} />}
      {!isSuperAdmin && !isAdminOrTeacher && !isStudent && (
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)]">
          <EmptyState icon={Inbox} title="No access" sub="Your role doesn't have a feedback inbox yet." />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Super admin — full school feedback table
// ─────────────────────────────────────────────────────────────────────────────
function SuperAdminDashboard({ schoolCode, currentUserId }) {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState([]);
  const [tab, setTab] = useState('from_students');
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState('all');
  const [ackFilter, setAckFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [studentOpen, setStudentOpen] = useState(false);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await feedbackService.listAllSchool(schoolCode);
      setFeedback(data);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const filtered = useMemo(() => {
    let rows = feedback;
    if (tab === 'from_students') rows = rows.filter((r) => r.feedback_type === 'student_to_admin');
    else if (tab === 'management') rows = rows.filter((r) => r.feedback_type === 'management_note' || r.feedback_type === 'superadmin_to_admin');
    else if (tab === 'to_students') rows = rows.filter((r) => r.feedback_type === 'admin_to_student');

    if (sentiment !== 'all') rows = rows.filter((r) => r.sentiment === sentiment);
    if (ackFilter === 'pending') rows = rows.filter((r) => r.requires_acknowledgement && !r.acknowledged_at);
    if (ackFilter === 'acknowledged') rows = rows.filter((r) => r.acknowledged_at);

    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => (
      (r.content || '').toLowerCase().includes(q)
      || (r.from_user?.full_name || '').toLowerCase().includes(q)
      || (r.to_user?.full_name || '').toLowerCase().includes(q)
      || (CATEGORY_LABELS[r.category] || r.category || '').toLowerCase().includes(q)
    ));
    return rows;
  }, [feedback, tab, sentiment, ackFilter, search]);

  const counts = useMemo(() => ({
    fromStudents: feedback.filter((r) => r.feedback_type === 'student_to_admin').length,
    management: feedback.filter((r) => r.feedback_type === 'management_note' || r.feedback_type === 'superadmin_to_admin').length,
    toStudents: feedback.filter((r) => r.feedback_type === 'admin_to_student').length,
    pending: feedback.filter((r) => r.requires_acknowledgement && !r.acknowledged_at).length,
  }), [feedback]);

  const onExport = () => {
    const rows = filtered.map((r) => ({
      created_at: r.created_at,
      type: r.feedback_type,
      from: r.from_user?.full_name || '',
      to: r.to_user?.full_name || '',
      category: CATEGORY_LABELS[r.category] || r.category || '',
      sentiment: r.sentiment || '',
      acknowledged: r.acknowledged_at ? 'yes' : 'no',
      content: r.content,
    }));
    exportCsv(rows, `feedback-${tab}-${dayjs().format('YYYYMMDD')}.csv`);
  };

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <KpiTile label="From students" value={counts.fromStudents} sub="all-time" />
        <KpiTile label="Management notes" value={counts.management} sub="internal threads" />
        <KpiTile label="To students" value={counts.toStudents} sub="admin-issued" />
        <KpiTile
          label="Pending acknowledgement"
          value={counts.pending}
          sub={counts.pending ? 'awaiting reply' : 'all clear'}
          tone={counts.pending ? 'warn' : null}
        />
      </div>

      {/* Tabs + filters + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-[color:var(--border)]">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="bg-transparent p-0 h-auto gap-2 rounded-none">
            {[
              ['from_students', `From students (${counts.fromStudents})`],
              ['management', `Management (${counts.management})`],
              ['to_students', `To students (${counts.toStudents})`],
            ].map(([k, label]) => (
              <TabsTrigger
                key={k}
                value={k}
                className="px-3 pb-3 pt-0 text-[13.5px] font-medium rounded-none text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] data-[state=active]:bg-transparent shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 pb-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-subtle)] pointer-events-none"
            />
            <Input
              placeholder="Search content / people"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[260px] h-9"
            />
          </div>

          <Select value={sentiment} onValueChange={setSentiment}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sentiments</SelectItem>
              {SENTIMENTS.map((s) => (
                <SelectItem key={s} value={s}>{SENTIMENT_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ackFilter} onValueChange={setAckFilter}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All acknowledgements</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} disabled={!filtered.length}>
          <Download size={14} />
          Export CSV
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
          <Plus size={14} />
          Management note
        </Button>
        <Button size="sm" onClick={() => setStudentOpen(true)}>
          <Send size={14} />
          Send to student
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No feedback records"
            sub="Records matching the current filter will show up here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[color:var(--bg-subtle)]">
                <TableHead className="text-[12px] font-medium text-[color:var(--fg-muted)] uppercase tracking-[0.04em] px-5">From</TableHead>
                <TableHead className="text-[12px] font-medium text-[color:var(--fg-muted)] uppercase tracking-[0.04em]">To</TableHead>
                <TableHead className="text-[12px] font-medium text-[color:var(--fg-muted)] uppercase tracking-[0.04em]">Category</TableHead>
                <TableHead className="text-[12px] font-medium text-[color:var(--fg-muted)] uppercase tracking-[0.04em]">Sentiment</TableHead>
                <TableHead className="text-[12px] font-medium text-[color:var(--fg-muted)] uppercase tracking-[0.04em] w-[40%]">Content</TableHead>
                <TableHead className="text-[12px] font-medium text-[color:var(--fg-muted)] uppercase tracking-[0.04em]">Status</TableHead>
                <TableHead className="text-[12px] font-medium text-[color:var(--fg-muted)] uppercase tracking-[0.04em] px-5">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => setDetail(r)}
                  className="cursor-pointer"
                >
                  <TableCell className="px-5 py-3">
                    <UserChip name={r.from_user?.full_name} />
                  </TableCell>
                  <TableCell className="py-3">
                    <UserChip name={r.to_user?.full_name} tone="success" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="neutral">{CATEGORY_LABELS[r.category] || r.category}</Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    {r.sentiment ? (
                      <Badge variant={SENTIMENT_VARIANT[r.sentiment] || 'neutral'} dot>
                        {SENTIMENT_META[r.sentiment]?.label || r.sentiment}
                      </Badge>
                    ) : (
                      <span className="text-[color:var(--fg-faint)]">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="py-3 max-w-0 text-[13px] text-[color:var(--fg-muted)] truncate"
                    title={r.content}
                  >
                    <div className="truncate">{r.content}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    {r.acknowledged_at ? (
                      <Badge variant="success" dot>Acknowledged</Badge>
                    ) : r.requires_acknowledgement ? (
                      <Badge variant="warning" dot>Pending</Badge>
                    ) : (
                      <span className="text-[color:var(--fg-faint)]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-3 text-[13px] text-[color:var(--fg-muted)] tabular-nums">
                    {dayjs(r.created_at).format('DD MMM YYYY')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ManagementNoteModal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        onSaved={load}
        schoolCode={schoolCode}
        fromUserId={currentUserId}
      />
      <StudentFeedbackModal
        open={studentOpen}
        onClose={() => setStudentOpen(false)}
        onSaved={load}
        schoolCode={schoolCode}
        fromUserId={currentUserId}
      />
      <FeedbackDetailModal
        open={!!detail}
        item={detail}
        onClose={() => setDetail(null)}
        currentUserId={currentUserId}
        onChanged={load}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin / Teacher inbox
// ─────────────────────────────────────────────────────────────────────────────
function AdminInbox({ authUserId, schoolCode, currentUserId }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [studentOpen, setStudentOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await feedbackService.listReceivedByAdmin(authUserId);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [authUserId]);

  const ack = async (id) => {
    try {
      setBusyId(id);
      await feedbackService.acknowledge(id);
      await load();
    } finally { setBusyId(null); }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'positive') return items.filter((i) => i.sentiment === 'positive');
    if (filter === 'needs') return items.filter((i) => i.sentiment === 'needs_improvement');
    if (filter === 'pending') return items.filter((i) => !i.acknowledged_at);
    return items;
  }, [items, filter]);

  const stats = useMemo(() => ({
    total: items.length,
    positive: items.filter((i) => i.sentiment === 'positive').length,
    needs: items.filter((i) => i.sentiment === 'needs_improvement').length,
    pending: items.filter((i) => i.requires_acknowledgement && !i.acknowledged_at).length,
  }), [items]);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <KpiTile label="Total" value={stats.total} sub="received" />
        <KpiTile label="Positive" value={stats.positive} sub="from students" tone="ok" />
        <KpiTile label="Needs improvement" value={stats.needs} sub="follow up" tone="warn" />
        <KpiTile
          label="Pending acknowledgement"
          value={stats.pending}
          sub={stats.pending ? 'awaiting reply' : 'all clear'}
          tone={stats.pending ? 'danger' : null}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <OptionGroup
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'positive', label: 'Positive' },
            { value: 'needs', label: 'Needs improvement' },
            { value: 'pending', label: 'Pending' },
          ]}
          size="sm"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setStudentOpen(true)}>
            <Send size={14} />
            Send to student
          </Button>
        </div>
      </div>

      {loading ? (
        <CardListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)]">
          <EmptyState
            icon={MessageSquare}
            title="No feedback yet"
            sub="When students or admins write to you, it'll show up here."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((f) => (
            <InboxRow
              key={f.id}
              item={f}
              busy={busyId === f.id}
              onAck={() => ack(f.id)}
            />
          ))}
        </div>
      )}

      <StudentFeedbackModal
        open={studentOpen}
        onClose={() => setStudentOpen(false)}
        onSaved={load}
        schoolCode={schoolCode}
        fromUserId={currentUserId}
      />
    </>
  );
}

function InboxRow({ item: f, busy, onAck }) {
  const sentiment = f.sentiment ? SENTIMENT_META[f.sentiment] : null;
  const sentimentVariant = SENTIMENT_VARIANT[f.sentiment] || 'neutral';
  const ackTone = f.acknowledged_at ? 'success' : f.requires_acknowledgement ? 'warning' : null;
  const ackLabel = f.acknowledged_at ? 'Acknowledged' : f.requires_acknowledgement ? 'Pending' : null;

  return (
    <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center flex-wrap gap-2">
            <Badge variant="neutral">{CATEGORY_LABELS[f.category] || f.category}</Badge>
            {sentiment && <Badge variant={sentimentVariant} dot>{sentiment.label}</Badge>}
            {ackLabel && <Badge variant={ackTone} dot>{ackLabel}</Badge>}
          </div>

          {!f.acknowledged_at ? (
            <Button size="sm" variant="outline" onClick={onAck} disabled={busy}>
              <Check size={14} />
              Acknowledge
            </Button>
          ) : (
            <span className="text-[12.5px] text-[color:var(--fg-subtle)]">
              {dayjs(f.acknowledged_at).fromNow()}
            </span>
          )}
        </div>

        <p className="text-[13.5px] text-[color:var(--fg)] leading-[1.55] whitespace-pre-wrap m-0">
          {f.content}
        </p>

        <div className="flex items-center flex-wrap gap-3 mt-3 text-[12.5px] text-[color:var(--fg-muted)]">
          {f.subject_name && (
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={12} />
              {f.subject_name}
            </span>
          )}
          {f.grade && (
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap size={12} />
              Grade {f.grade}{f.section ? `-${f.section}` : ''}
            </span>
          )}
          <span className="text-[color:var(--fg-faint)]">·</span>
          <span>{dayjs(f.created_at).format('DD MMM YYYY')}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student — compose + received
// ─────────────────────────────────────────────────────────────────────────────
function StudentForm({ schoolCode, currentUserId }) {
  const [recipients, setRecipients] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('send');

  const [form, setForm] = useState({
    subject_id: '',
    to_user_id: '',
    sentiment: 'neutral',
    category: 'general',
    content: '',
  });
  const [error, setError] = useState(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [r, s, rec] = await Promise.all([
        feedbackService.listRecipients(schoolCode),
        feedbackService.listSubjects(schoolCode),
        feedbackService.listForStudent(currentUserId),
      ]);
      setRecipients(r);
      setSubjects(s);
      setReceived(rec);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [schoolCode, currentUserId]);

  const submit = async () => {
    setError(null);
    if (!form.to_user_id) { setError('Choose someone to send your feedback to'); return; }
    const text = (form.content || '').trim();
    if (!text) { setError('Write your feedback'); return; }
    if (text.length > 300) { setError('Keep it under 300 characters'); return; }

    try {
      setSubmitting(true);
      await feedbackService.submitStudentFeedback({
        from_user_id: currentUserId,
        to_user_id: form.to_user_id,
        subject_id: form.subject_id || null,
        sentiment: form.sentiment,
        category: form.category,
        content: text,
        school_code: schoolCode,
      });
      setForm({ subject_id: '', to_user_id: '', sentiment: 'neutral', category: 'general', content: '' });
      loadAll();
    } catch (e) {
      setError(e.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-6 border-b border-[color:var(--border)]">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="bg-transparent p-0 h-auto gap-2 rounded-none">
            <TabsTrigger
              value="send"
              className="px-3 pb-3 pt-0 text-[13.5px] font-medium rounded-none text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] data-[state=active]:bg-transparent shadow-none"
            >
              Send feedback
            </TabsTrigger>
            <TabsTrigger
              value="received"
              className="px-3 pb-3 pt-0 text-[13.5px] font-medium rounded-none text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] data-[state=active]:bg-transparent shadow-none"
            >
              Received ({received.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'send' && (
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] p-6 max-w-[720px]">
          <div className="flex flex-col gap-4">
            <Field label="Subject" hint="Optional · helpful when feedback is about a specific class">
              <Select
                value={form.subject_id || '__none'}
                onValueChange={(v) => setForm((p) => ({ ...p, subject_id: v === '__none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No specific subject</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Recipient" required>
              <Select
                value={form.to_user_id}
                onValueChange={(v) => setForm((p) => ({ ...p, to_user_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a teacher or admin" />
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

            <Field label="Sentiment" required>
              <OptionGroup
                value={form.sentiment}
                onChange={(v) => setForm((p) => ({ ...p, sentiment: v }))}
                options={SENTIMENTS.map((s) => ({ value: s, label: SENTIMENT_META[s].label }))}
              />
            </Field>

            <Field label="Category" required>
              <OptionGroup
                value={form.category}
                onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                options={STUDENT_FEEDBACK_CATEGORIES.map((c) => ({
                  value: c,
                  label: CATEGORY_LABELS[c],
                }))}
                size="sm"
              />
            </Field>

            <Field label="Your feedback" required hint={`${form.content.length}/300`}>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Share what's going well or what could be better…"
                rows={5}
                maxLength={300}
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

            <div>
              <Button onClick={submit} disabled={submitting}>
                <Send size={14} />
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'received' && (
        loading ? <CardListSkeleton />
        : received.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)]">
            <EmptyState
              icon={MessageSquare}
              title="No feedback received yet"
              sub="When a teacher or admin writes to you, it'll appear here."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {received.map((f) => (
              <div
                key={f.id}
                className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] px-5 py-4"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={f.from_user?.full_name || 'Teacher'} />
                    <span className="text-[13.5px] font-semibold text-[color:var(--fg)]">
                      {f.from_user?.full_name || 'Teacher'}
                    </span>
                    <Badge variant="neutral">{CATEGORY_LABELS[f.category] || f.category}</Badge>
                  </div>
                  <span className="text-[12.5px] text-[color:var(--fg-subtle)]">
                    {dayjs(f.created_at).format('DD MMM')}
                  </span>
                </div>
                <p className="text-[13.5px] text-[color:var(--fg-muted)] leading-[1.55] whitespace-pre-wrap m-0">
                  {f.content}
                </p>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bits
// ─────────────────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, tone }) {
  const subColor =
    tone === 'ok' ? 'var(--success)'
    : tone === 'warn' ? 'var(--warning)'
    : tone === 'danger' ? 'var(--danger)'
    : 'var(--fg-subtle)';
  return (
    <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] px-5 py-4">
      <div className="text-[12px] font-medium text-[color:var(--fg-muted)]">{label}</div>
      <div className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums leading-tight mt-2 text-[color:var(--fg)]">
        {value}
      </div>
      {sub && (
        <div className="text-[11.5px] mt-1.5" style={{ color: subColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Avatar({ name, tone = 'brand' }) {
  const palette = tone === 'success'
    ? { bg: 'oklch(0.94 0.06 160)', fg: 'oklch(0.45 0.13 160)' }
    : { bg: 'oklch(0.95 0.04 240)', fg: 'oklch(0.50 0.14 240)' };
  return (
    <div
      className="size-7 rounded-full grid place-items-center font-semibold text-[10.5px] shrink-0"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {initials(name)}
    </div>
  );
}

function UserChip({ name, tone }) {
  if (!name) return <span className="text-[color:var(--fg-faint)]">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-[color:var(--fg)]">
      <Avatar name={name} tone={tone} />
      <span>{name}</span>
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="p-5">
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="cb-skel size-7 rounded-full" />
            <div className="cb-skel h-3 w-32 rounded" />
            <div className="cb-skel h-3 w-20 rounded" />
            <div className="cb-skel h-3 flex-1 rounded" />
            <div className="cb-skel h-3 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] px-5 py-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="cb-skel h-4 w-20 rounded" />
            <div className="cb-skel h-4 w-16 rounded" />
          </div>
          <div className="cb-skel h-3 w-full rounded mb-2" />
          <div className="cb-skel h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  );
}
