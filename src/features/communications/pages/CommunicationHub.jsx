import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Tabs, Table, Tag, Space, Typography, Input, Button, Segmented,
  App, Empty, Skeleton, Form, Select, Radio, Statistic, Avatar, Tooltip, Badge,
} from 'antd';
import {
  MessageOutlined, ReloadOutlined, PlusOutlined, SendOutlined, CheckOutlined,
  InboxOutlined, SearchOutlined, ExportOutlined, UserOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import {
  feedbackService, SENTIMENT_META, CATEGORY_LABELS,
  STUDENT_FEEDBACK_CATEGORIES,
} from '../services/communicationsService';
import ManagementNoteModal from '../components/ManagementNoteModal';
import StudentFeedbackModal from '../components/StudentFeedbackModal';
import FeedbackDetailModal from '../components/FeedbackDetailModal';

dayjs.extend(relativeTime);
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SENTIMENTS = ['positive', 'neutral', 'needs_improvement'];

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

// ─────────────────────────────────────────────────────────────────────────────
// Super admin dashboard
// ─────────────────────────────────────────────────────────────────────────────
function SuperAdminDashboard({ schoolCode, currentUserId }) {
  const { message } = App.useApp();
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
      message.error(e.message || 'Failed to load feedback');
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

  const columns = [
    {
      title: 'From',
      key: 'from',
      render: (_, r) => r.from_user
        ? <Space size={6}><Avatar size="small" icon={<UserOutlined />} />{r.from_user.full_name}</Space>
        : '—',
    },
    {
      title: 'To',
      key: 'to',
      render: (_, r) => r.to_user
        ? <Space size={6}><Avatar size="small" style={{ background: '#10B981' }} icon={<UserOutlined />} />{r.to_user.full_name}</Space>
        : '—',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      render: (v) => <Tag>{CATEGORY_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Sentiment',
      dataIndex: 'sentiment',
      render: (v) => v ? <Tag color={SENTIMENT_META[v]?.color === '#059669' ? 'green' : SENTIMENT_META[v]?.color === '#D97706' ? 'orange' : 'default'}>{SENTIMENT_META[v]?.label || v}</Tag> : '—',
    },
    {
      title: 'Content',
      dataIndex: 'content',
      ellipsis: true,
      render: (v) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: (_, r) => r.acknowledged_at
        ? <Tag color="green">Acknowledged</Tag>
        : (r.requires_acknowledgement ? <Tag color="orange">Pending</Tag> : <Tag>—</Tag>),
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      width: 140,
      render: (v) => dayjs(v).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
    },
  ];

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
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Card><Statistic title="From students" value={counts.fromStudents} prefix={<MessageOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Management notes" value={counts.management} valueStyle={{ color: '#7C3AED' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="To students" value={counts.toStudents} valueStyle={{ color: '#0EA5E9' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Pending ack." value={counts.pending} valueStyle={{ color: '#D97706' }} /></Card></Col>
      </Row>

      <Card size="small">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={9}>
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                { key: 'from_students', label: <Badge count={counts.fromStudents} offset={[10, 0]} size="small">From Students</Badge> },
                { key: 'management', label: <Badge count={counts.management} offset={[10, 0]} size="small">Management</Badge> },
                { key: 'to_students', label: <Badge count={counts.toStudents} offset={[10, 0]} size="small">To Students</Badge> },
              ]}
            />
          </Col>
          <Col xs={24} md={6}>
            <Input prefix={<SearchOutlined />} placeholder="Search content / people" allowClear value={search} onChange={(e) => setSearch(e.target.value)} />
          </Col>
          <Col xs={12} md={4}>
            <Select value={sentiment} onChange={setSentiment} style={{ width: '100%' }}
              options={[{ value: 'all', label: 'All sentiments' }, ...SENTIMENTS.map((s) => ({ value: s, label: SENTIMENT_META[s].label }))]}
            />
          </Col>
          <Col xs={12} md={5}>
            <Select value={ackFilter} onChange={setAckFilter} style={{ width: '100%' }}
              options={[
                { value: 'all', label: 'All acknowledgements' },
                { value: 'pending', label: 'Pending acknowledgement' },
                { value: 'acknowledged', label: 'Acknowledged' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Space wrap>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        <Button icon={<ExportOutlined />} onClick={onExport} disabled={!filtered.length}>Export CSV</Button>
        <Button icon={<PlusOutlined />} onClick={() => setNoteOpen(true)}>Add management note</Button>
        <Button type="primary" icon={<SendOutlined />} onClick={() => setStudentOpen(true)}>Send feedback to student</Button>
      </Space>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          onRow={(record) => ({ onClick: () => setDetail(record), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty description="No feedback records" /> }}
        />
      </Card>

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
    </Space>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin / Teacher view — feedback they received
// ─────────────────────────────────────────────────────────────────────────────
function AdminInbox({ authUserId, schoolCode, currentUserId }) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [studentOpen, setStudentOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await feedbackService.listReceivedByAdmin(authUserId);
      setItems(data);
    } catch (e) {
      message.error(e.message || 'Failed to load feedback');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [authUserId]);

  const ack = async (id) => {
    try {
      await feedbackService.acknowledge(id);
      message.success('Acknowledged');
      load();
    } catch (e) { message.error(e.message || 'Failed'); }
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
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Card><Statistic title="Total" value={stats.total} prefix={<MessageOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Positive" value={stats.positive} valueStyle={{ color: '#059669' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Needs improvement" value={stats.needs} valueStyle={{ color: '#D97706' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Pending ack." value={stats.pending} valueStyle={{ color: '#DC2626' }} /></Card></Col>
      </Row>

      <Space wrap>
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'positive', label: 'Positive' },
            { value: 'needs', label: 'Needs improvement' },
            { value: 'pending', label: 'Pending' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        <Button type="primary" icon={<SendOutlined />} onClick={() => setStudentOpen(true)}>Send feedback to student</Button>
      </Space>

      {loading ? (
        <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
      ) : filtered.length === 0 ? (
        <Card><Empty description="No feedback yet" /></Card>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {filtered.map((f) => {
            const sentiment = f.sentiment ? SENTIMENT_META[f.sentiment] : null;
            return (
              <Card
                key={f.id}
                size="small"
                title={
                  <Space wrap>
                    <Tag>{CATEGORY_LABELS[f.category] || f.category}</Tag>
                    {sentiment && (
                      <Tag color={sentiment.color === '#059669' ? 'green' : sentiment.color === '#D97706' ? 'orange' : 'default'}>
                        {sentiment.label}
                      </Tag>
                    )}
                    {f.acknowledged_at
                      ? <Tag color="green">Acknowledged</Tag>
                      : f.requires_acknowledgement && <Tag color="orange">Pending</Tag>}
                  </Space>
                }
                extra={
                  !f.acknowledged_at
                    ? <Button size="small" icon={<CheckOutlined />} onClick={() => ack(f.id)}>Acknowledge</Button>
                    : <Text type="secondary">{dayjs(f.acknowledged_at).fromNow()}</Text>
                }
              >
                <Paragraph style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{f.content}</Paragraph>
                <Space size="large" wrap>
                  {f.subject_name && <Text type="secondary">📚 {f.subject_name}</Text>}
                  {f.grade && <Text type="secondary">🎓 Grade {f.grade}-{f.section}</Text>}
                  <Text type="secondary">📅 {dayjs(f.created_at).format('DD MMM YYYY')}</Text>
                </Space>
              </Card>
            );
          })}
        </Space>
      )}

      <StudentFeedbackModal
        open={studentOpen}
        onClose={() => setStudentOpen(false)}
        onSaved={load}
        schoolCode={schoolCode}
        fromUserId={currentUserId}
      />
    </Space>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student view — submit + receive
// ─────────────────────────────────────────────────────────────────────────────
function StudentForm({ schoolCode, currentUserId }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [recipients, setRecipients] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('send');

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
      message.error(e.message || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [schoolCode, currentUserId]);

  const submit = async () => {
    let v;
    try { v = await form.validateFields(); } catch { return; }
    try {
      setSubmitting(true);
      await feedbackService.submitStudentFeedback({
        from_user_id: currentUserId,
        to_user_id: v.to_user_id,
        subject_id: v.subject_id || null,
        sentiment: v.sentiment,
        category: v.category,
        content: v.content,
        school_code: schoolCode,
      });
      message.success('Feedback submitted');
      form.resetFields();
      loadAll();
    } catch (e) {
      message.error(e.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <Tabs
      activeKey={tab}
      onChange={setTab}
      items={[
        {
          key: 'send',
          label: 'Send feedback',
          children: (
            <Card style={{ maxWidth: 720 }}>
              <Form layout="vertical" form={form} initialValues={{ sentiment: 'neutral', category: 'general' }}>
                <Form.Item label="Subject (optional)" name="subject_id">
                  <Select
                    allowClear placeholder="Choose a subject" showSearch optionFilterProp="label"
                    options={subjects.map((s) => ({ value: s.id, label: s.subject_name }))}
                  />
                </Form.Item>
                <Form.Item label="Recipient" name="to_user_id" rules={[{ required: true, message: 'Choose someone' }]}>
                  <Select
                    showSearch placeholder="Pick a teacher or admin" optionFilterProp="label"
                    options={recipients.map((u) => ({ value: u.id, label: `${u.full_name} (${u.role})` }))}
                  />
                </Form.Item>
                <Form.Item label="Sentiment" name="sentiment" rules={[{ required: true }]}>
                  <Radio.Group buttonStyle="solid" optionType="button">
                    {SENTIMENTS.map((s) => (
                      <Radio.Button key={s} value={s}>{SENTIMENT_META[s].label}</Radio.Button>
                    ))}
                  </Radio.Group>
                </Form.Item>
                <Form.Item label="Category" name="category" rules={[{ required: true }]}>
                  <Select options={STUDENT_FEEDBACK_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
                </Form.Item>
                <Form.Item label="Your feedback" name="content"
                  rules={[{ required: true, whitespace: true, message: 'Write your feedback' }, { max: 300 }]}
                >
                  <TextArea autoSize={{ minRows: 4, maxRows: 8 }} maxLength={300} showCount />
                </Form.Item>
                <Button type="primary" icon={<SendOutlined />} onClick={submit} loading={submitting}>
                  Submit feedback
                </Button>
              </Form>
            </Card>
          ),
        },
        {
          key: 'received',
          label: <Badge count={received.length} offset={[10, 0]} size="small">Received</Badge>,
          children: loading ? <Skeleton active />
            : received.length === 0 ? <Empty description="No feedback received yet" />
            : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {received.map((f) => (
                  <Card key={f.id} size="small" title={
                    <Space wrap>
                      <Avatar size="small" icon={<UserOutlined />} />
                      <Text strong>{f.from_user?.full_name || 'Teacher'}</Text>
                      <Tag>{CATEGORY_LABELS[f.category] || f.category}</Tag>
                    </Space>
                  } extra={<Text type="secondary">{dayjs(f.created_at).format('DD MMM')}</Text>}>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{f.content}</Paragraph>
                  </Card>
                ))}
              </Space>
            ),
        },
      ]}
    />
  );
}

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
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center">
        <MessageOutlined style={{ fontSize: 28, color: '#10B981' }} />
        <Title level={3} style={{ margin: 0 }}>Communication Hub</Title>
      </Space>

      {isSuperAdmin && <SuperAdminDashboard schoolCode={schoolCode} currentUserId={authUserId} />}
      {!isSuperAdmin && isAdminOrTeacher && <AdminInbox authUserId={authUserId} schoolCode={schoolCode} currentUserId={authUserId} />}
      {isStudent && <StudentForm schoolCode={schoolCode} currentUserId={authUserId} />}
      {!isSuperAdmin && !isAdminOrTeacher && !isStudent && (
        <Card><Empty description="No access to Communication Hub" /></Card>
      )}
    </Space>
  );
}
