import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Select, Space, Tree, Progress, Tag, Row, Col,
  Statistic, Alert, Spin, Empty, Divider, Button, Collapse
} from 'antd';
import {
  BookOutlined, CheckCircleOutlined, ClockCircleOutlined,
  FileTextOutlined, TrophyOutlined, DownOutlined
} from '@ant-design/icons';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getStudentCode, getSchoolCode } from '@/shared/utils/metadata';
import { useTheme } from '@/contexts/ThemeContext';
import EmptyState from '@/shared/ui/EmptyState';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const StudentSyllabus = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [syllabus, setSyllabus] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [taughtTopics, setTaughtTopics] = useState(new Set());
  const [taughtChapters, setTaughtChapters] = useState(new Set());
  const [alert, setAlert] = useState(null);

  // Fetch student data
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user) return;

      try {
        const studentCode = getStudentCode(user);
        const schoolCode = getSchoolCode(user);

        if (!schoolCode) {
          throw new Error('School information not found. Please ensure your account is properly set up.');
        }

        // Try to find student by auth_user_id first (most reliable)
        let { data, error } = await supabase
          .from('student')
          .select('id, full_name, student_code, class_instance_id, school_code')
          .eq('auth_user_id', user.id)
          .eq('school_code', schoolCode)
          .maybeSingle();

        // If not found by auth_user_id, try by student_code or email
        if (!data && !error) {
          let query = supabase
            .from('student')
            .select('id, full_name, student_code, class_instance_id, school_code')
            .eq('school_code', schoolCode);

          if (studentCode) {
            query = query.eq('student_code', studentCode);
          } else if (user.email) {
            query = query.eq('email', user.email);
          }

          const result = await query.maybeSingle();
          data = result.data;
          error = result.error;
        }

        if (error) throw error;
        if (!data) {
          throw new Error('Student record not found. Please contact your administrator to link your account.');
        }

        setStudent(data);

        // Clear any previous alerts on success
        setAlert(null);

        // Fetch subjects for the student's class
        await fetchSubjects(data.class_instance_id, schoolCode);
      } catch (err) {
        console.error('Failed to fetch student:', err);
        setAlert({ 
          type: 'error', 
          message: err.message || 'Failed to load student data. Please contact support.' 
        });
      }
    };

    fetchStudent();
  }, [user]);

  const fetchSubjects = async (classInstanceId, schoolCode) => {
    try {
      // Get all syllabi for the class instance
      const { data: syllabi, error: syllabiError } = await supabase
        .from('syllabi')
        .select('subject_id, subjects(id, subject_name)')
        .eq('class_instance_id', classInstanceId)
        .eq('school_code', schoolCode);

      if (syllabiError) throw syllabiError;

      const subjectsData = syllabi
        ?.map(s => s.subjects)
        .filter(Boolean)
        .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

      setSubjects(subjectsData || []);
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
    }
  };

  // Fetch syllabus when subject changes
  useEffect(() => {
    if (student && selectedSubject) {
      fetchSyllabus();
    }
  }, [student, selectedSubject]);

  const fetchSyllabus = async () => {
    if (!student?.class_instance_id || !selectedSubject) return;

    setLoading(true);
    try {
      // Fetch syllabus
      const { data: syllabusData, error: syllabusError } = await supabase
        .from('syllabi')
        .select('id')
        .eq('school_code', student.school_code)
        .eq('class_instance_id', student.class_instance_id)
        .eq('subject_id', selectedSubject)
        .maybeSingle();

      if (syllabusError) throw syllabusError;

      if (!syllabusData) {
        setSyllabus(null);
        setChapters([]);
        return;
      }

      setSyllabus(syllabusData);

      // Fetch chapters and topics
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('syllabus_chapters')
        .select(`
          id,
          chapter_no,
          title,
          description,
          syllabus_topics(id, topic_no, title, description)
        `)
        .eq('syllabus_id', syllabusData.id)
        .order('chapter_no', { ascending: true });

      if (chaptersError) throw chaptersError;

      setChapters(chaptersData || []);

      // Fetch taught progress
      await fetchProgress(syllabusData.id);
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to load syllabus' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async (syllabusId) => {
    try {
      const { data, error } = await supabase
        .from('syllabus_progress')
        .select('syllabus_chapter_id, syllabus_topic_id')
        .eq('school_code', student.school_code)
        .eq('class_instance_id', student.class_instance_id);

      if (error) throw error;

      const taughtChaptersSet = new Set();
      const taughtTopicsSet = new Set();

      (data || []).forEach(progress => {
        if (progress.syllabus_chapter_id) {
          taughtChaptersSet.add(progress.syllabus_chapter_id);
        }
        if (progress.syllabus_topic_id) {
          taughtTopicsSet.add(progress.syllabus_topic_id);
        }
      });

      setTaughtChapters(taughtChaptersSet);
      setTaughtTopics(taughtTopicsSet);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  };

  // Calculate progress stats
  const progressStats = React.useMemo(() => {
    const totalChapters = chapters.length;
    const totalTopics = chapters.reduce((sum, ch) => sum + (ch.syllabus_topics?.length || 0), 0);
    const taughtChaptersCount = Array.from(taughtChapters).length;
    const taughtTopicsCount = Array.from(taughtTopics).length;

    const chapterProgress = totalChapters > 0 ? Math.round((taughtChaptersCount / totalChapters) * 100) : 0;
    const topicProgress = totalTopics > 0 ? Math.round((taughtTopicsCount / totalTopics) * 100) : 0;

    return {
      totalChapters,
      totalTopics,
      taughtChaptersCount,
      taughtTopicsCount,
      chapterProgress,
      topicProgress,
      overallProgress: topicProgress
    };
  }, [chapters, taughtChapters, taughtTopics]);

  const renderChapter = (chapter) => {
    const topics = chapter.syllabus_topics || [];
    const isChapterTaught = taughtChapters.has(chapter.id);
    const taughtTopicsInChapter = topics.filter(t => taughtTopics.has(t.id)).length;
    const chapterCompletion = topics.length > 0 ? Math.round((taughtTopicsInChapter / topics.length) * 100) : 0;

    return (
      <Panel
        key={chapter.id}
        header={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 }}>
            <Space>
              <BookOutlined style={{ color: isChapterTaught ? theme.token.colorSuccess : theme.token.colorTextSecondary }} />
              <Text strong>Chapter {chapter.chapter_no}: {chapter.title}</Text>
              {isChapterTaught && <Tag color="success" icon={<CheckCircleOutlined />}>Covered</Tag>}
            </Space>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {taughtTopicsInChapter}/{topics.length} topics
              </Text>
              <Progress
                type="circle"
                percent={chapterCompletion}
                width={36}
                strokeWidth={8}
                strokeColor={chapterCompletion === 100 ? theme.token.colorSuccess : theme.token.colorPrimary}
              />
            </div>
          </div>
        }
        extra={null}
      >
        {chapter.description && (
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            background: theme.token.colorBgLayout,
            borderRadius: 6 
          }}>
            <Text style={{ fontSize: 13, color: theme.token.colorTextSecondary }}>
              {chapter.description}
            </Text>
          </div>
        )}

        {topics.length > 0 ? (
          <div style={{ paddingLeft: 24 }}>
            {topics.map((topic, index) => {
              const isTopicTaught = taughtTopics.has(topic.id);
              return (
                <div
                  key={topic.id}
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    background: isTopicTaught ? theme.token.colorSuccessBg : theme.token.colorBgContainer,
                    border: `1px solid ${isTopicTaught ? theme.token.colorSuccessBorder : theme.token.colorBorder}`,
                    borderRadius: 6
                  }}
                >
                  <Space>
                    {isTopicTaught ? (
                      <CheckCircleOutlined style={{ color: theme.token.colorSuccess }} />
                    ) : (
                      <ClockCircleOutlined style={{ color: theme.token.colorTextSecondary }} />
                    )}
                    <Text strong={isTopicTaught}>
                      {topic.topic_no}. {topic.title}
                    </Text>
                    {isTopicTaught && <Tag color="success" size="small">Completed</Tag>}
                  </Space>
                  {topic.description && (
                    <div style={{ marginTop: 6, marginLeft: 24 }}>
                      <Text style={{ fontSize: 12, color: theme.token.colorTextSecondary }}>
                        {topic.description}
                      </Text>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No topics in this chapter"
          />
        )}
      </Panel>
    );
  };

  if (!student && !loading) {
    return (
      <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
        <Card>
          <Alert
            type="error"
            message="Student data not found"
            description="Unable to load your student information. Please contact support."
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, color: '#1f2937' }}>
            My Syllabus
          </Title>
          {student && (
            <Text type="secondary" style={{ fontSize: '14px' }}>
              Track your learning progress across subjects
            </Text>
          )}
        </div>

        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            showIcon
            closable
            onClose={() => setAlert(null)}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Subject Selection */}
        <Card style={{ marginBottom: 24, borderRadius: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Select Subject</Text>
              <Select
                placeholder="Choose a subject to view syllabus"
                style={{ width: '100%', maxWidth: 400 }}
                value={selectedSubject}
                onChange={setSelectedSubject}
                size="large"
              >
                {subjects.map(subject => (
                  <Select.Option key={subject.id} value={subject.id}>
                    {subject.subject_name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Space>
        </Card>

        {selectedSubject && syllabus && chapters.length > 0 && (
          <>
            {/* Progress Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={6}>
                <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Statistic
                    title="Total Chapters"
                    value={progressStats.totalChapters}
                    prefix={<BookOutlined />}
                    valueStyle={{ color: theme.token.colorPrimary }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Statistic
                    title="Chapters Covered"
                    value={progressStats.taughtChaptersCount}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: theme.token.colorSuccess }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Statistic
                    title="Topics Covered"
                    value={`${progressStats.taughtTopicsCount}/${progressStats.totalTopics}`}
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: theme.token.colorWarning }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Statistic
                    title="Overall Progress"
                    value={progressStats.overallProgress}
                    suffix="%"
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: theme.token.colorInfo }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Overall Progress Bar */}
            <Card style={{ marginBottom: 24, borderRadius: 8 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Text strong>Course Progress</Text>
                <Progress
                  percent={progressStats.overallProgress}
                  strokeColor={{
                    '0%': theme.token.colorPrimary,
                    '100%': theme.token.colorSuccess,
                  }}
                  status={progressStats.overallProgress === 100 ? 'success' : 'active'}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {progressStats.taughtTopicsCount} out of {progressStats.totalTopics} topics completed
                </Text>
              </Space>
            </Card>

            {/* Chapters */}
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>Syllabus Content</span>
                </Space>
              }
              style={{ borderRadius: 8 }}
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Spin size="large" />
                </div>
              ) : (
                <Collapse
                  bordered={false}
                  expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
                  style={{ background: 'transparent' }}
                >
                  {chapters.map(renderChapter)}
                </Collapse>
              )}
            </Card>
          </>
        )}

        {selectedSubject && !loading && !syllabus && (
          <Card>
            <EmptyState
              icon={<BookOutlined />}
              title="No syllabus available"
              description="The syllabus for this subject has not been created yet. Please check back later or contact your teacher."
            />
          </Card>
        )}

        {!selectedSubject && !loading && (
          <Card>
            <EmptyState
              icon={<BookOutlined />}
              title="Select a subject"
              description="Choose a subject from the dropdown above to view its syllabus and track your progress."
            />
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentSyllabus;

