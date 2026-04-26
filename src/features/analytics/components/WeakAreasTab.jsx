import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Segmented, Row, Col, Statistic, Alert, Button, List, Tag, Progress, Space, Select, Typography } from 'antd';
import { WarningOutlined, ExperimentOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getClassWeakTopics, getStudentTopicHeatmap, listSubjects,
} from '../services/analyticsService';
import { downloadCsv } from '../utils/exportUtils';

const { Text, Title } = Typography;

export default function WeakAreasTab({ scope, schoolCode, classId, studentId, subjectId, onSubjectChange }) {
  const [threshold, setThreshold] = useState(60);
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [internalSubject, setInternalSubject] = useState(null);
  const navigate = useNavigate();

  // Need a concrete subject for the RPC. Class scope → require subjectId; if 'all', show subject picker.
  const effectiveSubject = subjectId && subjectId !== 'all' ? subjectId : internalSubject;

  useEffect(() => {
    if (scope === 'school' || scope === 'class') {
      // load subject options scoped to class (or full school if school-scope)
      listSubjects(schoolCode, scope === 'class' ? classId : null).then(setSubjects).catch(() => setSubjects([]));
    }
  }, [scope, schoolCode, classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (scope === 'student' && studentId && classId && effectiveSubject) {
        setLoading(true);
        try {
          const cells = await getStudentTopicHeatmap(studentId, classId, effectiveSubject);
          if (cancelled) return;
          // Filter to weak topics (accuracy < threshold) and sort ascending
          const weak = cells
            .filter((c) => c.total_questions > 0 && c.accuracy_percent < threshold)
            .sort((a, b) => a.accuracy_percent - b.accuracy_percent)
            .map((c) => ({
              chapter_id: c.chapter_id, chapter_title: c.chapter_title, chapter_no: c.chapter_no,
              topic_id: c.topic_id, topic_title: c.topic_title, topic_no: c.topic_no,
              avg_class_accuracy: c.accuracy_percent,
              students_below_threshold: 1, total_students: 1,
              total_questions: c.total_questions, correct_answers: c.correct_answers,
            }));
          setTopics(weak);
        } catch (e) {
          console.error(e);
          setTopics([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else if ((scope === 'class' || scope === 'school') && classId && effectiveSubject) {
        setLoading(true);
        try {
          const data = await getClassWeakTopics(classId, effectiveSubject, threshold);
          if (!cancelled) setTopics(data);
        } catch (e) {
          console.error(e);
          setTopics([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        setTopics([]);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, classId, studentId, effectiveSubject, threshold]);

  const summary = useMemo(() => {
    const high = topics.filter((t) => t.avg_class_accuracy < 40).length;
    const med = topics.filter((t) => t.avg_class_accuracy >= 40 && t.avg_class_accuracy < 55).length;
    const low = topics.filter((t) => t.avg_class_accuracy >= 55).length;
    return { high, med, low };
  }, [topics]);

  const exportCsv = () => {
    downloadCsv('weak_areas', topics, [
      { dataIndex: 'chapter_no', title: 'Ch No' },
      { dataIndex: 'chapter_title', title: 'Chapter' },
      { dataIndex: 'topic_no', title: 'Topic No' },
      { dataIndex: 'topic_title', title: 'Topic' },
      { dataIndex: 'avg_class_accuracy', title: 'Avg accuracy %', render: (v) => Math.round(v * 10) / 10 },
      { dataIndex: 'students_below_threshold', title: 'Students below threshold' },
      { dataIndex: 'total_students', title: 'Total students' },
    ]);
  };

  const needsSubject = (scope === 'class' || scope === 'school' || scope === 'student') && !effectiveSubject;

  return (
    <>
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 14 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Text strong>Threshold:</Text>
              <Segmented
                value={threshold}
                onChange={setThreshold}
                options={[
                  { label: '50%', value: 50 },
                  { label: '60%', value: 60 },
                  { label: '70%', value: 70 },
                ]}
              />
              {needsSubject && (
                <>
                  <Text strong style={{ marginLeft: 16 }}>Subject:</Text>
                  <Select
                    placeholder="Select a subject"
                    style={{ width: 200 }}
                    value={internalSubject || undefined}
                    onChange={(v) => { setInternalSubject(v); onSubjectChange?.(v); }}
                    options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </>
              )}
            </Space>
          </Col>
          <Col>
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!topics.length}>Export CSV</Button>
          </Col>
        </Row>
      </Card>

      {(scope === 'student' && !classId) && (
        <Alert type="info" message="Pick a class to compute the student's weak areas." style={{ marginBottom: 16 }} />
      )}
      {needsSubject && (
        <Alert type="info" message="Pick a subject above to see weak topics." style={{ marginBottom: 16 }} />
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}

      {!loading && !needsSubject && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={8}><Card><Statistic title="High urgency (<40%)" value={summary.high} valueStyle={{ color: '#ef4444' }} prefix={<WarningOutlined />} /></Card></Col>
            <Col xs={8}><Card><Statistic title="Medium (40–55%)" value={summary.med} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
            <Col xs={8}><Card><Statistic title={`Below ${threshold}%`} value={topics.length} valueStyle={{ color: '#3b82f6' }} /></Card></Col>
          </Row>

          {!topics.length ? (
            <Card><Empty description={`No topics below ${threshold}% — great job!`} /></Card>
          ) : (
            <Card>
              <Alert
                style={{ marginBottom: 12 }}
                message={`${topics.length} topic${topics.length === 1 ? '' : 's'} where ${scope === 'student' ? 'the student is' : 'the class average is'} below ${threshold}%.`}
                type="info"
                showIcon
                icon={<ExperimentOutlined />}
              />
              <List
                dataSource={topics}
                renderItem={(t, idx) => {
                  const acc = Math.round(t.avg_class_accuracy * 10) / 10;
                  const urgency = acc < 40 ? 'high' : acc < 55 ? 'med' : 'low';
                  const colors = { high: '#ef4444', med: '#f59e0b', low: '#3b82f6' };
                  return (
                    <List.Item
                      actions={[
                        <Button
                          key="practice"
                          icon={<EditOutlined />}
                          size="small"
                          onClick={() => navigate(`/test-management?prefill_chapter=${t.chapter_id}&prefill_topic=${t.topic_id}&prefill_subject=${effectiveSubject}`)}
                        >
                          Create practice test
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: 44, height: 44, borderRadius: 22,
                            background: colors[urgency], color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 16,
                          }}>
                            #{idx + 1}
                          </div>
                        }
                        title={<Space wrap>
                          <Text strong>{t.topic_no ? `${t.topic_no}. ` : ''}{t.topic_title}</Text>
                          <Tag color={urgency === 'high' ? 'red' : urgency === 'med' ? 'orange' : 'blue'}>{acc}%</Tag>
                        </Space>}
                        description={
                          <>
                            <div>
                              <Text type="secondary">Ch {t.chapter_no}: {t.chapter_title}</Text>
                            </div>
                            <Progress percent={acc} strokeColor={colors[urgency]} size="small" style={{ maxWidth: 280 }} />
                            {scope !== 'student' && t.total_students > 0 && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {t.students_below_threshold} of {t.total_students} student{t.total_students === 1 ? '' : 's'} below threshold
                                {t.total_students > 0 && ` · ${Math.round((t.students_below_threshold / t.total_students) * 100)}% at risk`}
                              </Text>
                            )}
                          </>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </Card>
          )}
        </>
      )}
    </>
  );
}
