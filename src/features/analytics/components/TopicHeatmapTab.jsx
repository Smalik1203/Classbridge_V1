import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Row, Col, Statistic, Alert, Select, Space, Switch, Tag, Drawer, Typography, Button, List, Modal } from 'antd';
import { ExperimentOutlined, DownloadOutlined } from '@ant-design/icons';
import {
  getStudentTopicHeatmap, getClassWeakTopics, listSubjects, listStudents,
} from '../services/analyticsService';
import { downloadCsv } from '../utils/exportUtils';
import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

function color(acc, tested) {
  if (!tested) return '#f3f4f6';
  if (acc >= 70) return '#10b981';
  if (acc >= 40) return '#f59e0b';
  return '#ef4444';
}

export default function TopicHeatmapTab({ scope, schoolCode, classId, studentId, subjectId, onSubjectChange }) {
  const [internalSubject, setInternalSubject] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cells, setCells] = useState([]);
  const [classOverlay, setClassOverlay] = useState({}); // topic_id → class avg
  const [showOverlay, setShowOverlay] = useState(scope === 'student');
  const [selected, setSelected] = useState(null);
  const [questionDrill, setQuestionDrill] = useState(null);

  const effectiveSubject = subjectId && subjectId !== 'all' ? subjectId : internalSubject;

  useEffect(() => {
    if (scope !== 'student') return;
    listSubjects(schoolCode, classId).then(setSubjects).catch(() => setSubjects([]));
  }, [scope, schoolCode, classId]);

  useEffect(() => {
    if (scope === 'class' || scope === 'school') {
      listSubjects(schoolCode, scope === 'class' ? classId : null).then(setSubjects).catch(() => setSubjects([]));
      if (scope === 'class') listStudents(schoolCode, classId).then(setStudents).catch(() => setStudents([]));
    }
  }, [scope, schoolCode, classId]);

  // Load heatmap data (student-scope: per-topic cells; class-scope: per-class avg via weak-topics RPC with low threshold to fetch all)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectiveSubject || !classId) { setCells([]); return; }
      setLoading(true);
      try {
        if (scope === 'student' && studentId) {
          const data = await getStudentTopicHeatmap(studentId, classId, effectiveSubject);
          if (!cancelled) setCells(data);
          // overlay = class average per topic — fetch via weak-topics RPC at threshold 100 to get all topics
          if (showOverlay) {
            try {
              const all = await getClassWeakTopics(classId, effectiveSubject, 100);
              if (!cancelled) {
                const m = {};
                all.forEach((t) => { m[t.topic_id] = t.avg_class_accuracy; });
                setClassOverlay(m);
              }
            } catch { /* overlay optional */ }
          }
        } else if ((scope === 'class' || scope === 'school') && classId) {
          // class-aggregate heatmap = use weak-topics with threshold 100 (all topics)
          const all = await getClassWeakTopics(classId, effectiveSubject, 100);
          if (!cancelled) {
            // Reshape to look like TopicHeatmapCell
            const reshaped = all.map((t) => ({
              chapter_id: t.chapter_id,
              chapter_title: t.chapter_title,
              chapter_no: t.chapter_no,
              topic_id: t.topic_id,
              topic_title: t.topic_title,
              topic_no: t.topic_no,
              total_questions: t.total_students,
              correct_answers: Math.round((t.avg_class_accuracy / 100) * t.total_students),
              accuracy_percent: t.avg_class_accuracy,
              avg_time_seconds: null,
              test_count: null,
              last_tested_at: null,
            }));
            setCells(reshaped);
            setClassOverlay({});
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setCells([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, classId, studentId, effectiveSubject, showOverlay]);

  const grouped = useMemo(() => {
    const m = new Map();
    cells.forEach((c) => {
      if (!m.has(c.chapter_id)) m.set(c.chapter_id, { chapter_id: c.chapter_id, chapter_title: c.chapter_title, chapter_no: c.chapter_no, topics: [] });
      m.get(c.chapter_id).topics.push(c);
    });
    return Array.from(m.values()).sort((a, b) => (a.chapter_no || 0) - (b.chapter_no || 0));
  }, [cells]);

  const summary = useMemo(() => {
    const tested = cells.filter((c) => c.total_questions > 0);
    if (!tested.length) return { avg: 0, strong: 0, dev: 0, weak: 0, tested: 0, total: cells.length };
    const avg = tested.reduce((s, c) => s + c.accuracy_percent, 0) / tested.length;
    return {
      avg: Math.round(avg * 10) / 10,
      strong: tested.filter((c) => c.accuracy_percent >= 70).length,
      dev: tested.filter((c) => c.accuracy_percent >= 40 && c.accuracy_percent < 70).length,
      weak: tested.filter((c) => c.accuracy_percent < 40).length,
      tested: tested.length,
      total: cells.length,
    };
  }, [cells]);

  async function loadQuestionDrill(topic) {
    setQuestionDrill({ topic, loading: true, items: [] });
    try {
      let q = supabase
        .from('test_questions')
        .select('id, question_text, options, correct_index, difficulty_level, test_id, tests:test_id(id, title, test_date)')
        .eq('syllabus_topic_id', topic.topic_id)
        .limit(50);
      const { data: questions } = await q;
      const qIds = (questions || []).map((x) => x.id);
      let attempts = [];
      if (scope === 'student' && studentId && qIds.length) {
        const { data: ats } = await supabase
          .from('test_attempts')
          .select('test_id, student_id, answers, completed_at')
          .eq('student_id', studentId)
          .in('test_id', (questions || []).map((x) => x.test_id))
          .order('completed_at', { ascending: false });
        attempts = ats || [];
      }
      setQuestionDrill({
        topic,
        loading: false,
        items: (questions || []).map((qx) => {
          const att = attempts.find((a) => a.test_id === qx.test_id);
          const ans = att?.answers?.[qx.id];
          const correct = ans != null && qx.correct_index != null && Number(ans) === qx.correct_index;
          return {
            ...qx,
            studentAnswer: ans,
            isCorrect: ans == null ? null : correct,
            attemptDate: att?.completed_at,
          };
        }),
      });
    } catch (e) {
      console.error(e);
      setQuestionDrill({ topic, loading: false, items: [] });
    }
  }

  const exportCsv = () => {
    downloadCsv('topic_heatmap', cells, [
      { dataIndex: 'chapter_no', title: 'Ch No' },
      { dataIndex: 'chapter_title', title: 'Chapter' },
      { dataIndex: 'topic_no', title: 'Topic No' },
      { dataIndex: 'topic_title', title: 'Topic' },
      { dataIndex: 'accuracy_percent', title: 'Accuracy %', render: (v) => Math.round(v * 10) / 10 },
      { dataIndex: 'total_questions', title: 'Questions' },
      { dataIndex: 'correct_answers', title: 'Correct' },
      { dataIndex: 'last_tested_at', title: 'Last tested' },
    ]);
  };

  const needsSubject = !effectiveSubject;
  const needsClass = !classId;

  return (
    <>
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 14 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              {needsSubject && (
                <>
                  <Text strong>Subject:</Text>
                  <Select
                    placeholder="Select subject"
                    style={{ width: 220 }}
                    value={internalSubject || undefined}
                    onChange={(v) => { setInternalSubject(v); onSubjectChange?.(v); }}
                    options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </>
              )}
              {scope === 'student' && (
                <>
                  <Switch
                    checked={showOverlay}
                    onChange={setShowOverlay}
                    checkedChildren="Class avg"
                    unCheckedChildren="Class avg"
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>Overlay class average behind student bars</Text>
                </>
              )}
            </Space>
          </Col>
          <Col>
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!cells.length}>Export CSV</Button>
          </Col>
        </Row>
      </Card>

      {needsClass && <Alert type="info" message="Pick a class to view the topic heatmap." style={{ marginBottom: 16 }} />}
      {needsSubject && !needsClass && <Alert type="info" message="Pick a subject to view the topic heatmap." style={{ marginBottom: 16 }} />}

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}

      {!loading && cells.length > 0 && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={6}><Card><Statistic title="Avg accuracy" value={summary.avg} suffix="%" valueStyle={{ color: summary.avg >= 70 ? '#10b981' : summary.avg >= 40 ? '#f59e0b' : '#ef4444' }} /></Card></Col>
            <Col xs={6}><Card><Statistic title="Strong (≥70%)" value={summary.strong} valueStyle={{ color: '#10b981' }} /></Card></Col>
            <Col xs={6}><Card><Statistic title="Developing (40–69%)" value={summary.dev} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
            <Col xs={6}><Card><Statistic title="Weak (<40%)" value={summary.weak} valueStyle={{ color: '#ef4444' }} /></Card></Col>
          </Row>

          <Card title="Legend">
            <Space>
              <Tag color="green">≥70% Strong</Tag>
              <Tag color="orange">40–69% Developing</Tag>
              <Tag color="red">&lt;40% Weak</Tag>
              <Tag>Untested</Tag>
            </Space>
          </Card>

          <div style={{ height: 12 }} />

          {grouped.map((g) => {
            const tested = g.topics.filter((t) => t.total_questions > 0);
            const chAvg = tested.length ? Math.round((tested.reduce((s, t) => s + t.accuracy_percent, 0) / tested.length) * 10) / 10 : null;
            return (
              <Card key={g.chapter_id} style={{ marginBottom: 12 }} bodyStyle={{ padding: 12 }}>
                <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 8 }}>
                  <Col flex="auto">
                    <Text strong>{g.chapter_no ? `Chapter ${g.chapter_no}: ` : ''}{g.chapter_title}</Text>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {tested.length} / {g.topics.length} topics tested
                    </Text>
                  </Col>
                  {chAvg != null && (
                    <Col><Tag color={chAvg >= 70 ? 'green' : chAvg >= 40 ? 'orange' : 'red'}>{chAvg}%</Tag></Col>
                  )}
                </Row>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                  {g.topics.map((t) => {
                    const tested = t.total_questions > 0;
                    const overlay = showOverlay && classOverlay[t.topic_id];
                    return (
                      <div
                        key={t.topic_id}
                        onClick={() => setSelected(t)}
                        style={{
                          position: 'relative', cursor: 'pointer',
                          background: color(t.accuracy_percent, tested),
                          color: tested ? 'white' : '#9ca3af',
                          borderRadius: 8, padding: 10, minHeight: 64,
                          border: tested ? 'none' : '1px dashed #d1d5db',
                        }}
                      >
                        {overlay != null && (
                          <div style={{
                            position: 'absolute', inset: 0, borderRadius: 8,
                            background: color(overlay, true), opacity: 0.18, pointerEvents: 'none',
                          }} />
                        )}
                        <div style={{ position: 'relative', fontSize: 11, fontWeight: 500 }}>
                          {t.topic_no ? `${t.topic_no}. ` : ''}{t.topic_title}
                        </div>
                        <div style={{ position: 'relative', marginTop: 4, fontSize: 18, fontWeight: 700 }}>
                          {tested ? `${Math.round(t.accuracy_percent)}%` : '—'}
                        </div>
                        {overlay != null && tested && (
                          <div style={{ position: 'relative', fontSize: 10, opacity: 0.85 }}>
                            class avg {Math.round(overlay)}%
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </>
      )}

      {!loading && !needsClass && !needsSubject && cells.length === 0 && (
        <Card><Empty description="No topic data yet — once tests linked to chapters/topics are taken, you'll see a heatmap here." /></Card>
      )}

      <Drawer
        title={selected?.topic_title}
        placement="right"
        width={420}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <Title level={3} style={{ margin: 0, color: color(selected.accuracy_percent, selected.total_questions > 0) }}>
              {selected.total_questions > 0 ? `${Math.round(selected.accuracy_percent)}%` : 'Not tested yet'}
            </Title>
            <Text type="secondary">Chapter {selected.chapter_no}: {selected.chapter_title}</Text>
            <div style={{ marginTop: 16 }}>
              <Row gutter={[12, 12]}>
                <Col span={12}><Statistic title="Correct" value={selected.correct_answers || 0} /></Col>
                <Col span={12}><Statistic title="Total" value={selected.total_questions || 0} /></Col>
                {selected.test_count != null && <Col span={12}><Statistic title="Tests" value={selected.test_count || 0} /></Col>}
                {selected.avg_time_seconds != null && (
                  <Col span={12}><Statistic title="Avg time" value={selected.avg_time_seconds || 0} suffix="s" /></Col>
                )}
                {selected.last_tested_at && (
                  <Col span={24}><Text type="secondary" style={{ fontSize: 12 }}>Last tested {dayjs(selected.last_tested_at).format('DD MMM YYYY')}</Text></Col>
                )}
              </Row>
            </div>
            {selected.accuracy_percent < 60 && selected.total_questions > 0 && (
              <Alert
                style={{ marginTop: 16 }}
                type="warning"
                showIcon
                message="This topic needs more practice."
              />
            )}
            <Button
              style={{ marginTop: 16 }}
              icon={<ExperimentOutlined />}
              onClick={() => loadQuestionDrill(selected)}
              block
            >
              View questions on this topic
            </Button>
          </>
        )}
      </Drawer>

      <Modal
        title={questionDrill?.topic ? `Questions on "${questionDrill.topic.topic_title}"` : 'Questions'}
        open={!!questionDrill}
        onCancel={() => setQuestionDrill(null)}
        footer={null}
        width={720}
      >
        {questionDrill?.loading ? <Spin /> : (
          <List
            dataSource={questionDrill?.items || []}
            locale={{ emptyText: 'No questions found for this topic' }}
            renderItem={(q, i) => (
              <List.Item>
                <List.Item.Meta
                  title={<><Text strong>Q{i + 1}.</Text> <Text>{q.question_text}</Text></>}
                  description={
                    <>
                      <div style={{ marginTop: 6 }}>
                        {(q.options || []).map((opt, idx) => (
                          <div key={idx} style={{
                            padding: '4px 8px', marginBottom: 4, borderRadius: 4,
                            background: idx === q.correct_index ? '#dcfce7' : (idx === q.studentAnswer ? '#fee2e2' : '#f3f4f6'),
                            border: idx === q.studentAnswer ? '1px solid #ef4444' : '1px solid transparent',
                          }}>
                            <Text>{String.fromCharCode(65 + idx)}. {opt}</Text>
                            {idx === q.correct_index && <Tag color="green" style={{ marginLeft: 8 }}>Correct</Tag>}
                            {idx === q.studentAnswer && idx !== q.correct_index && <Tag color="red" style={{ marginLeft: 8 }}>Student picked</Tag>}
                          </div>
                        ))}
                      </div>
                      {q.tests?.title && <Text type="secondary" style={{ fontSize: 11 }}>From: {q.tests.title}</Text>}
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </>
  );
}
