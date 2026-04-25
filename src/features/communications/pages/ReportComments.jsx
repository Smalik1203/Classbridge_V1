import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Button, Tag, Space, Typography, Input, Select, Segmented,
  App, Empty, Skeleton, Progress, Statistic, Avatar, Tooltip, Drawer, Divider,
} from 'antd';
import {
  ThunderboltOutlined, EditOutlined, CheckOutlined, ReloadOutlined,
  SettingOutlined, SearchOutlined, UserOutlined, ExportOutlined, RobotOutlined,
  CommentOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { reportCommentsService } from '../services/communicationsService';
import ReportCommentEditor from '../components/ReportCommentEditor';

const { Title, Text, Paragraph } = Typography;

const TONE_OPTS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'encouraging', label: 'Encouraging' },
];
const FOCUS_OPTS = [
  { value: 'academic', label: 'Academic' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'holistic', label: 'Holistic' },
];
const LANG_OPTS = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'bilingual', label: 'Bilingual' },
];

function wordCount(s) {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

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

export default function ReportComments() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { message, modal } = App.useApp();

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState();
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [comments, setComments] = useState([]); // { id, studentId, studentName, studentCode, status, generatedComment, editedComment, inputData, wordCount, positivityScore, approvedAt? }
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tone, setTone] = useState('professional');
  const [focus, setFocus] = useState('holistic');
  const [language, setLanguage] = useState('english');

  const [editing, setEditing] = useState(null);

  // Load classes
  useEffect(() => {
    if (!schoolCode) return;
    setLoadingClasses(true);
    reportCommentsService.listClasses(schoolCode)
      .then(setClasses)
      .catch((e) => message.error(e.message || 'Failed to load classes'))
      .finally(() => setLoadingClasses(false));
    // eslint-disable-next-line
  }, [schoolCode]);

  // Load students when class changes
  useEffect(() => {
    if (!selectedClassId) { setStudents([]); setComments([]); return; }
    setLoadingStudents(true);
    reportCommentsService.listStudentsInClass(selectedClassId)
      .then(setStudents)
      .catch((e) => message.error(e.message || 'Failed to load students'))
      .finally(() => setLoadingStudents(false));
    setComments([]);
  }, [selectedClassId, message]);

  const generateAll = async () => {
    if (!selectedClassId || students.length === 0) return;
    setComments([]);
    setGenerating(true);
    setProgress({ current: 0, total: students.length });
    const results = [];
    for (let i = 0; i < students.length; i += 1) {
      const s = students[i];
      try {
        const c = await reportCommentsService.generateForStudent({
          studentId: s.id,
          classInstanceId: selectedClassId,
          schoolCode,
          tone, focus, language,
        });
        if (c) {
          results.push({
            ...c,
            studentId: s.id,
            studentName: s.full_name,
            studentCode: s.student_code,
            status: c.status || 'draft',
          });
          setComments((prev) => [...prev, results[results.length - 1]]);
        }
      } catch (e) {
        message.error(`${s.full_name}: ${e.message || 'generation failed'}`);
      } finally {
        setProgress({ current: i + 1, total: students.length });
      }
    }
    setGenerating(false);
    if (results.length > 0) message.success(`Generated ${results.length} comments`);
  };

  const regenerateOne = async (c) => {
    const s = students.find((x) => x.id === c.studentId);
    if (!s) return;
    try {
      const fresh = await reportCommentsService.generateForStudent({
        studentId: s.id,
        classInstanceId: selectedClassId,
        schoolCode, tone, focus, language,
      });
      if (fresh) {
        setComments((prev) => prev.map((x) => x.studentId === s.id
          ? { ...fresh, studentId: s.id, studentName: s.full_name, studentCode: s.student_code, status: 'draft' }
          : x));
        message.success('Regenerated');
      }
    } catch (e) { message.error(e.message || 'Regenerate failed'); }
  };

  const approveOne = async (c) => {
    try {
      await reportCommentsService.approve(c.id, null);
      setComments((prev) => prev.map((x) => x.id === c.id
        ? { ...x, status: 'approved', approvedAt: new Date().toISOString() } : x));
      message.success('Approved');
    } catch (e) { message.error(e.message || 'Approve failed'); }
  };

  const approveAll = () => {
    const drafts = comments.filter((c) => c.status !== 'approved');
    if (drafts.length === 0) return;
    modal.confirm({
      title: `Approve all ${drafts.length} drafts?`,
      content: 'You can still edit individual comments after approval if needed.',
      okText: `Approve ${drafts.length}`,
      onOk: async () => {
        let ok = 0;
        for (const c of drafts) {
          try { await reportCommentsService.approve(c.id, null); ok += 1; }
          catch (e) { /* surface partial */ }
        }
        setComments((prev) => prev.map((c) => c.status === 'approved'
          ? c
          : { ...c, status: 'approved', approvedAt: new Date().toISOString() }));
        message.success(`Approved ${ok} of ${drafts.length}`);
      },
    });
  };

  const stats = useMemo(() => ({
    total: comments.length,
    approved: comments.filter((c) => c.status === 'approved').length,
    drafts: comments.filter((c) => c.status !== 'approved').length,
  }), [comments]);

  const filtered = useMemo(() => {
    let rows = comments;
    if (statusFilter === 'draft') rows = rows.filter((c) => c.status !== 'approved');
    if (statusFilter === 'approved') rows = rows.filter((c) => c.status === 'approved');
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((c) =>
      (c.studentName || '').toLowerCase().includes(q)
      || (c.studentCode || '').toLowerCase().includes(q)
    );
    return rows;
  }, [comments, statusFilter, search]);

  const onExport = () => {
    const rows = filtered.map((c) => ({
      student: c.studentName,
      code: c.studentCode || '',
      status: c.status,
      words: wordCount(c.editedComment || c.generatedComment),
      positivity: typeof c.positivityScore === 'number' ? Math.round(c.positivityScore * 100) : '',
      attendance_pct: c.inputData?.attendance?.percentage ?? '',
      comment: c.editedComment || c.generatedComment,
    }));
    exportCsv(rows, `report-comments-${selectedClassId || 'class'}.csv`);
  };

  if (loadingClasses) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]}>
        <Col>
          <Space align="center">
            <CommentOutlined style={{ fontSize: 28, color: '#7C3AED' }} />
            <Title level={3} style={{ margin: 0 }}>Report Comments</Title>
            <Tag icon={<RobotOutlined />} color="purple">AI-generated</Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
              Generation settings
            </Button>
            {comments.length > 0 && (
              <Button icon={<ExportOutlined />} onClick={onExport}>Export CSV</Button>
            )}
          </Space>
        </Col>
      </Row>

      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={10}>
            <Text strong>Class</Text>
            <Select
              value={selectedClassId}
              onChange={setSelectedClassId}
              placeholder="Choose a class to begin"
              style={{ width: '100%', marginTop: 4 }}
              showSearch optionFilterProp="label"
              options={classes.map((c) => ({ value: c.id, label: `Grade ${c.grade}-${c.section}` }))}
            />
          </Col>
          <Col xs={24} md={14}>
            <Space wrap>
              <Tag color="blue">Tone: {tone}</Tag>
              <Tag color="cyan">Focus: {focus}</Tag>
              <Tag color="purple">Language: {language}</Tag>
              <Tooltip title="Edit settings"><Button size="small" icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)} /></Tooltip>
            </Space>
          </Col>
        </Row>

        {selectedClassId && (
          <>
            <Divider />
            <Space wrap>
              <Text>Students in class: <Text strong>{students.length}</Text></Text>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                disabled={!students.length || generating}
                onClick={generateAll}
                loading={generating}
              >
                {comments.length > 0 ? 'Regenerate all' : 'Generate comments'}
              </Button>
              {comments.length > 0 && stats.drafts > 0 && (
                <Button icon={<CheckOutlined />} onClick={approveAll}>
                  Approve all drafts ({stats.drafts})
                </Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={() => {
                if (selectedClassId) {
                  reportCommentsService.listStudentsInClass(selectedClassId).then(setStudents);
                }
              }}>Refresh students</Button>
            </Space>
          </>
        )}
      </Card>

      {generating && (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Text strong>Generating…</Text>
              <Text>{progress.current} of {progress.total}</Text>
            </Space>
            <Progress percent={progress.total ? Math.round((progress.current / progress.total) * 100) : 0} />
          </Space>
        </Card>
      )}

      {!selectedClassId && (
        <Card>
          <Empty description="Select a class to generate report comments" />
        </Card>
      )}

      {selectedClassId && !loadingStudents && students.length === 0 && (
        <Card><Empty description="No students in this class" /></Card>
      )}

      {comments.length > 0 && (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={8}><Card><Statistic title="Total" value={stats.total} /></Card></Col>
            <Col xs={8}><Card><Statistic title="Approved" value={stats.approved} valueStyle={{ color: '#059669' }} /></Card></Col>
            <Col xs={8}><Card><Statistic title="Drafts" value={stats.drafts} valueStyle={{ color: '#D97706' }} /></Card></Col>
          </Row>

          <Card size="small">
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={12}>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Search student name or code"
                  allowClear value={search} onChange={(e) => setSearch(e.target.value)}
                />
              </Col>
              <Col xs={24} md={12}>
                <Segmented
                  options={[
                    { value: 'all', label: `All (${stats.total})` },
                    { value: 'draft', label: `Drafts (${stats.drafts})` },
                    { value: 'approved', label: `Approved (${stats.approved})` },
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  block
                />
              </Col>
            </Row>
          </Card>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {filtered.map((c) => {
              const text = c.editedComment || c.generatedComment || '';
              const wc = wordCount(text);
              const subjects = c.inputData?.subjects || [];
              const att = c.inputData?.attendance;
              const positivity = typeof c.positivityScore === 'number' ? Math.round(c.positivityScore * 100) : null;
              return (
                <Card
                  key={c.id || c.studentId}
                  title={
                    <Space>
                      <Avatar style={{ background: '#7C3AED' }} icon={<UserOutlined />} />
                      <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
                        <Text strong>{c.studentName}</Text>
                        {c.studentCode && <Text type="secondary" style={{ fontSize: 12 }}>{c.studentCode}</Text>}
                      </div>
                    </Space>
                  }
                  extra={c.status === 'approved'
                    ? <Tag color="green" icon={<CheckOutlined />}>Approved</Tag>
                    : <Tag color="orange" icon={<EditOutlined />}>Draft</Tag>}
                >
                  <Space wrap style={{ marginBottom: 8 }}>
                    <Tag>Subjects: {subjects.length}</Tag>
                    {att && <Tag>Attendance: {att.percentage}%</Tag>}
                    <Tag color={wc > 100 ? 'red' : wc < 60 ? 'orange' : 'green'}>{wc} words</Tag>
                    {positivity != null && (
                      <Tag color={positivity >= 70 ? 'green' : positivity >= 40 ? 'blue' : 'orange'}>
                        Positivity: {positivity}%
                      </Tag>
                    )}
                  </Space>
                  <Paragraph style={{
                    background: 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap', marginBottom: 8,
                  }}>{text}</Paragraph>
                  <Space wrap>
                    <Button icon={<EditOutlined />} onClick={() => setEditing(c)}>Edit</Button>
                    <Button icon={<ReloadOutlined />} onClick={() => regenerateOne(c)} disabled={generating}>
                      Regenerate
                    </Button>
                    {c.status !== 'approved' && (
                      <Button type="primary" icon={<CheckOutlined />} onClick={() => approveOne(c)}>
                        Approve
                      </Button>
                    )}
                  </Space>
                </Card>
              );
            })}
            {filtered.length === 0 && <Empty description="No comments match your filters" />}
          </Space>
        </>
      )}

      <Drawer
        title="Generation settings"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        width={420}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>Tone</Text>
            <Segmented block value={tone} onChange={setTone} options={TONE_OPTS} style={{ marginTop: 6 }} />
          </div>
          <div>
            <Text strong>Focus</Text>
            <Segmented block value={focus} onChange={setFocus} options={FOCUS_OPTS} style={{ marginTop: 6 }} />
          </div>
          <div>
            <Text strong>Language</Text>
            <Segmented block value={language} onChange={setLanguage} options={LANG_OPTS} style={{ marginTop: 6 }} />
          </div>
          <Text type="secondary">
            Settings affect new generations only. Re-run "Generate comments" to apply.
          </Text>
        </Space>
      </Drawer>

      <ReportCommentEditor
        open={!!editing}
        comment={editing}
        onClose={() => setEditing(null)}
        onApproved={(edited) => {
          setComments((prev) => prev.map((x) => x.id === editing?.id
            ? { ...x, status: 'approved', editedComment: edited, approvedAt: new Date().toISOString() }
            : x));
        }}
      />
    </Space>
  );
}
