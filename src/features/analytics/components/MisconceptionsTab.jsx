import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Row, Col, Statistic, Alert, Select, Space, Button, Collapse, Tag, Typography, Progress, Divider } from 'antd';
import { ExclamationCircleOutlined, DownloadOutlined, BulbOutlined } from '@ant-design/icons';
import { getQuestionMisconceptionReport, dominantWrongOption } from '../services/analyticsService';
import { downloadCsv } from '../utils/exportUtils';
import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Panel } = Collapse;

function bgFor(q) {
  if (!q.total_answers) return '#f3f4f6';
  if (q.accuracy_percent >= 70) return '#10b981';
  if (q.accuracy_percent >= 40) return '#f59e0b';
  return '#ef4444';
}

export default function MisconceptionsTab({ scope, schoolCode, classId, dateRange, subjectId }) {
  const [tests, setTests] = useState([]);
  const [testId, setTestId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [explanation, setExplanation] = useState(null);

  // Load picker options
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q = supabase
        .from('tests')
        .select('id, title, test_type, test_date, subject_id, class_instance_id, subjects:subject_id(name), class_instances:class_instance_id(grade, section, school_code)')
        .order('test_date', { ascending: false })
        .limit(200);
      if (scope === 'class' && classId) q = q.eq('class_instance_id', classId);
      if (subjectId && subjectId !== 'all') q = q.eq('subject_id', subjectId);
      if (dateRange?.[0]) q = q.gte('test_date', dayjs(dateRange[0]).format('YYYY-MM-DD'));
      if (dateRange?.[1]) q = q.lte('test_date', dayjs(dateRange[1]).format('YYYY-MM-DD'));
      const { data } = await q;
      const filtered = (data || []).filter((t) => scope !== 'school' || t.class_instances?.school_code === schoolCode);
      if (!cancelled) setTests(filtered);
    })();
    return () => { cancelled = true; };
  }, [scope, schoolCode, classId, subjectId, dateRange]);

  useEffect(() => {
    if (!testId) { setQuestions([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getQuestionMisconceptionReport(testId);
        if (!cancelled) setQuestions(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [testId]);

  const summary = useMemo(() => {
    const tested = questions.filter((q) => q.total_answers > 0);
    const avg = tested.length ? tested.reduce((s, q) => s + q.accuracy_percent, 0) / tested.length : 0;
    const problem = tested.filter((q) => q.accuracy_percent < 50).length;
    const misconceptions = tested.filter((q) => dominantWrongOption(q)).length;
    return {
      avg: Math.round(avg * 10) / 10,
      tested: tested.length,
      total: questions.length,
      problem,
      misconceptions,
    };
  }, [questions]);

  function generateExplanation() {
    const top = questions
      .filter((q) => q.total_answers > 0 && q.accuracy_percent < 50)
      .sort((a, b) => a.accuracy_percent - b.accuracy_percent)
      .slice(0, 5);
    if (!top.length) {
      setExplanation('No clear problem questions in this test — students performed evenly. Consider raising difficulty or adding more challenging items.');
      return;
    }
    const lines = top.map((q, i) => {
      const dom = dominantWrongOption(q);
      const topic = q.topic_title ? `(${q.chapter_title} → ${q.topic_title})` : '';
      let line = `${i + 1}. "${q.question_text.slice(0, 80)}${q.question_text.length > 80 ? '…' : ''}" ${topic} — only ${Math.round(q.accuracy_percent)}% correct.`;
      if (dom) line += ` ${dom.percent}% picked option ${dom.letter} ("${(dom.text || '').slice(0, 40)}"), suggesting a likely misconception.`;
      return line;
    });
    setExplanation(
      `${top.length} question${top.length === 1 ? '' : 's'} stand out as problem areas:\n\n${lines.join('\n\n')}\n\nRecommended actions: re-teach the topics above, focus on the dominant wrong options as common misconceptions, and add 2–3 practice items per topic to reinforce.`
    );
  }

  const exportCsv = () => {
    downloadCsv('misconceptions', questions, [
      { dataIndex: 'question_text', title: 'Question' },
      { dataIndex: 'chapter_title', title: 'Chapter' },
      { dataIndex: 'topic_title', title: 'Topic' },
      { dataIndex: 'difficulty_level', title: 'Difficulty' },
      { dataIndex: 'total_answers', title: 'Answered' },
      { dataIndex: 'correct_count', title: 'Correct' },
      { dataIndex: 'accuracy_percent', title: 'Accuracy %', render: (v) => Math.round(v * 10) / 10 },
      {
        dataIndex: 'option_distribution',
        title: 'Top wrong option',
        render: (_, q) => {
          const d = dominantWrongOption(q);
          return d ? `${d.letter} (${d.percent}%): ${d.text}` : '';
        },
      },
    ]);
  };

  return (
    <>
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 14 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Text strong>Test:</Text>
              <Select
                placeholder="Select a test"
                style={{ width: 360 }}
                showSearch
                optionFilterProp="label"
                value={testId}
                onChange={setTestId}
                options={tests.map((t) => ({
                  value: t.id,
                  label: `${t.title}${t.subjects?.name ? ` · ${t.subjects.name}` : ''}${t.test_date ? ` · ${dayjs(t.test_date).format('DD MMM')}` : ''}`,
                }))}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<BulbOutlined />} onClick={generateExplanation} disabled={!questions.length}>
                Explain
              </Button>
              <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!questions.length}>
                Export CSV
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {!testId && <Alert type="info" message="Pick a test to see per-question misconception analysis." />}

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}

      {!loading && testId && questions.length > 0 && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={6}><Card><Statistic title="Avg accuracy" value={summary.avg} suffix="%" valueStyle={{ color: summary.avg >= 60 ? '#10b981' : summary.avg >= 40 ? '#f59e0b' : '#ef4444' }} /></Card></Col>
            <Col xs={6}><Card><Statistic title="Tested" value={`${summary.tested}/${summary.total}`} /></Card></Col>
            <Col xs={6}><Card><Statistic title="Below 50%" value={summary.problem} valueStyle={{ color: '#ef4444' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
            <Col xs={6}><Card><Statistic title="Misconceptions" value={summary.misconceptions} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
          </Row>

          {explanation && (
            <Alert
              type="info"
              showIcon
              icon={<BulbOutlined />}
              message="Insights"
              description={<div style={{ whiteSpace: 'pre-wrap' }}>{explanation}</div>}
              closable
              onClose={() => setExplanation(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Card title="Legend" size="small" style={{ marginBottom: 12 }}>
            <Space>
              <Tag color="green">≥70%</Tag>
              <Tag color="orange">40–69%</Tag>
              <Tag color="red">&lt;40%</Tag>
              <Tag>No responses</Tag>
            </Space>
          </Card>

          <Collapse accordion>
            {questions.map((q, i) => {
              const dom = dominantWrongOption(q);
              return (
                <Panel
                  key={q.question_id}
                  header={
                    <Row align="middle" gutter={8}>
                      <Col>
                        <div style={{
                          width: 36, height: 36, borderRadius: 18,
                          background: bgFor(q), color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 600, fontSize: 13,
                        }}>Q{i + 1}</div>
                      </Col>
                      <Col flex="auto">
                        <Text style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>
                          {q.question_text}
                        </Text>
                        <div style={{ marginTop: 2 }}>
                          {q.chapter_title && <Tag>{q.chapter_title}{q.topic_title ? ` › ${q.topic_title}` : ''}</Tag>}
                          {q.difficulty_level && <Tag color="blue">{q.difficulty_level}</Tag>}
                          {dom && <Tag color="red">misconception</Tag>}
                        </div>
                      </Col>
                      <Col>
                        <Title level={4} style={{ margin: 0, color: bgFor(q) }}>
                          {q.total_answers ? `${Math.round(q.accuracy_percent)}%` : '—'}
                        </Title>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {q.correct_count}/{q.total_answers}
                        </Text>
                      </Col>
                    </Row>
                  }
                >
                  {q.total_answers > 0 ? (
                    <>
                      <Text strong>Answer distribution</Text>
                      <Divider style={{ margin: '8px 0' }} />
                      {(q.options || []).map((opt, idx) => {
                        const count = q.option_distribution?.[String(idx)] || 0;
                        const pct = q.total_answers ? (count / q.total_answers) * 100 : 0;
                        const isCorrect = idx === q.correct_index;
                        const letter = String.fromCharCode(65 + idx);
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 14,
                              background: isCorrect ? '#10b981' : '#e5e7eb',
                              color: isCorrect ? 'white' : '#374151',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
                            }}>{letter}</div>
                            <div style={{ flex: 1 }}>
                              <Text style={{ display: 'block', marginBottom: 2 }}>{opt}</Text>
                              <Progress
                                percent={Math.round(pct)}
                                showInfo={false}
                                strokeColor={isCorrect ? '#10b981' : '#ef4444'}
                                size="small"
                              />
                            </div>
                            <Text strong style={{ minWidth: 50, textAlign: 'right', fontWeight: pct > 30 ? 700 : 400 }}>
                              {Math.round(pct)}% ({count})
                            </Text>
                          </div>
                        );
                      })}
                      {q.option_distribution?.skipped > 0 && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Skipped: {q.option_distribution.skipped}
                        </Text>
                      )}
                      {dom && (
                        <Alert
                          style={{ marginTop: 12 }}
                          type="warning"
                          showIcon
                          message={`${dom.percent}% chose ${dom.letter}: "${dom.text}" — common misconception.`}
                        />
                      )}
                    </>
                  ) : (
                    <Empty description="No responses to this question yet" />
                  )}
                </Panel>
              );
            })}
          </Collapse>
        </>
      )}

      {!loading && testId && questions.length === 0 && (
        <Card><Empty description="No question data for this test yet" /></Card>
      )}
    </>
  );
}
