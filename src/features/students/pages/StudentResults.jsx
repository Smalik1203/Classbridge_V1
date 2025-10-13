import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Table, Tag, Progress, Row, Col, Statistic,
  Alert, Spin, Empty, Space, Tabs, Tooltip, Button
} from 'antd';
import {
  TrophyOutlined, FileTextOutlined, BarChartOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StarOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getStudentCode, getSchoolCode } from '@/shared/utils/metadata';
import { useTheme } from '@/contexts/ThemeContext';
import EmptyState from '@/shared/ui/EmptyState';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const StudentResults = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [onlineTests, setOnlineTests] = useState([]);
  const [offlineTests, setOfflineTests] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('online');

  // Fetch student data
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user) return;

      setLoading(true);
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

        // Fetch all results
        await Promise.all([
          fetchOnlineTests(data),
          fetchOfflineTests(data),
          fetchExamResults(data)
        ]);
      } catch (err) {
        console.error('Failed to fetch student:', err);
        setAlert({ 
          type: 'error', 
          message: err.message || 'Failed to load student data. Please contact support.' 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [user]);

  const fetchOnlineTests = async (studentData) => {
    try {
      const { data, error } = await supabase
        .from('test_attempts')
        .select(`
          id,
          completed_at,
          earned_points,
          total_points,
          status,
          tests!inner(id, title, subjects(subject_name))
        `)
        .eq('student_id', studentData.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (error) throw error;

      setOnlineTests(data || []);
    } catch (err) {
      console.error('Failed to fetch online tests:', err);
    }
  };

  const fetchOfflineTests = async (studentData) => {
    try {
      const { data, error } = await supabase
        .from('test_marks')
        .select(`
          id,
          marks_obtained,
          max_marks,
          remarks,
          created_at,
          tests!inner(id, title, subjects(subject_name))
        `)
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOfflineTests(data || []);
    } catch (err) {
      console.error('Failed to fetch offline tests:', err);
    }
  };

  const fetchExamResults = async (studentData) => {
    try {
      const { data, error } = await supabase
        .from('student_results')
        .select(`
          id,
          total_obtained_marks,
          total_max_marks,
          percentage,
          overall_grade,
          class_rank,
          section_rank,
          created_at,
          is_published,
          exams!inner(id, exam_name, exam_type, exam_date)
        `)
        .eq('student_id', studentData.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setExamResults(data || []);
    } catch (err) {
      console.error('Failed to fetch exam results:', err);
    }
  };

  const getGradeColor = (grade) => {
    const gradeColors = {
      'A+': 'green',
      'A': 'green',
      'B+': 'blue',
      'B': 'blue',
      'C+': 'orange',
      'C': 'orange',
      'D': 'red',
      'F': 'red'
    };
    return gradeColors[grade] || 'default';
  };

  const getPercentageColor = (percentage) => {
    if (percentage >= 90) return theme.token.colorSuccess;
    if (percentage >= 75) return theme.token.colorPrimary;
    if (percentage >= 60) return theme.token.colorWarning;
    return theme.token.colorError;
  };

  const onlineTestColumns = [
    {
      title: 'Test Name',
      dataIndex: ['tests', 'title'],
      key: 'title',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Subject',
      dataIndex: ['tests', 'subjects', 'subject_name'],
      key: 'subject',
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Score',
      key: 'score',
      render: (_, record) => (
        <Space>
          <Text strong>{record.earned_points}/{record.total_points}</Text>
          <Text type="secondary">
            ({record.total_points > 0 ? Math.round((record.earned_points / record.total_points) * 100) : 0}%)
          </Text>
        </Space>
      )
    },
    {
      title: 'Performance',
      key: 'performance',
      render: (_, record) => {
        const percentage = record.total_points > 0 
          ? Math.round((record.earned_points / record.total_points) * 100) 
          : 0;
        return (
          <Progress
            percent={percentage}
            size="small"
            strokeColor={getPercentageColor(percentage)}
          />
        );
      }
    },
    {
      title: 'Date',
      dataIndex: 'completed_at',
      key: 'completed_at',
      render: (date) => new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    }
  ];

  const offlineTestColumns = [
    {
      title: 'Test Name',
      dataIndex: ['tests', 'title'],
      key: 'title',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Subject',
      dataIndex: ['tests', 'subjects', 'subject_name'],
      key: 'subject',
      render: (text) => <Tag color="purple">{text}</Tag>
    },
    {
      title: 'Marks',
      key: 'marks',
      render: (_, record) => (
        <Space>
          <Text strong>{record.marks_obtained}/{record.max_marks}</Text>
          <Text type="secondary">
            ({Math.round((record.marks_obtained / record.max_marks) * 100)}%)
          </Text>
        </Space>
      )
    },
    {
      title: 'Performance',
      key: 'performance',
      render: (_, record) => {
        const percentage = Math.round((record.marks_obtained / record.max_marks) * 100);
        return (
          <Progress
            percent={percentage}
            size="small"
            strokeColor={getPercentageColor(percentage)}
          />
        );
      }
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (text) => text || '-'
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    }
  ];

  const examResultColumns = [
    {
      title: 'Exam',
      key: 'exam',
      render: (_, record) => (
        <div>
          <Text strong>{record.exams.exam_name}</Text>
          <br />
          <Tag color="gold">{record.exams.exam_type}</Tag>
        </div>
      )
    },
    {
      title: 'Total Marks',
      key: 'marks',
      render: (_, record) => (
        <Text strong>{record.total_obtained_marks}/{record.total_max_marks}</Text>
      )
    },
    {
      title: 'Percentage',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (value) => (
        <Text strong style={{ color: getPercentageColor(value) }}>
          {value.toFixed(2)}%
        </Text>
      )
    },
    {
      title: 'Grade',
      dataIndex: 'overall_grade',
      key: 'grade',
      render: (grade) => (
        <Tag color={getGradeColor(grade)} style={{ fontSize: 14, fontWeight: 600 }}>
          {grade}
        </Tag>
      )
    },
    {
      title: 'Class Rank',
      dataIndex: 'class_rank',
      key: 'class_rank',
      render: (rank) => rank ? (
        <Space>
          <TrophyOutlined style={{ color: theme.token.colorWarning }} />
          <Text strong>{rank}</Text>
        </Space>
      ) : '-'
    },
    {
      title: 'Exam Date',
      dataIndex: ['exams', 'exam_date'],
      key: 'exam_date',
      render: (date) => date ? new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) : '-'
    }
  ];

  // Calculate overall stats
  const overallStats = React.useMemo(() => {
    const totalTests = onlineTests.length + offlineTests.length;
    const totalExams = examResults.length;

    // Calculate average percentage for online tests
    const onlineAvg = onlineTests.length > 0
      ? onlineTests.reduce((sum, test) => {
          const pct = test.total_points > 0 ? (test.earned_points / test.total_points) * 100 : 0;
          return sum + pct;
        }, 0) / onlineTests.length
      : 0;

    // Calculate average percentage for offline tests
    const offlineAvg = offlineTests.length > 0
      ? offlineTests.reduce((sum, test) => {
          const pct = (test.marks_obtained / test.max_marks) * 100;
          return sum + pct;
        }, 0) / offlineTests.length
      : 0;

    // Calculate average for exams
    const examAvg = examResults.length > 0
      ? examResults.reduce((sum, result) => sum + result.percentage, 0) / examResults.length
      : 0;

    const overallAvg = totalTests > 0 || totalExams > 0
      ? ((onlineAvg * onlineTests.length) + (offlineAvg * offlineTests.length) + (examAvg * examResults.length)) 
        / (totalTests + totalExams)
      : 0;

    return {
      totalTests,
      totalExams,
      onlineAvg: Math.round(onlineAvg),
      offlineAvg: Math.round(offlineAvg),
      examAvg: Math.round(examAvg),
      overallAvg: Math.round(overallAvg)
    };
  }, [onlineTests, offlineTests, examResults]);

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
            My Results & Performance
          </Title>
          {student && (
            <Text type="secondary" style={{ fontSize: '14px' }}>
              Track your test scores and exam performance
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

        {/* Overall Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card style={{ textAlign: 'center', borderRadius: 8 }}>
              <Statistic
                title="Total Tests"
                value={overallStats.totalTests}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: theme.token.colorPrimary }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ textAlign: 'center', borderRadius: 8 }}>
              <Statistic
                title="Total Exams"
                value={overallStats.totalExams}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: theme.token.colorWarning }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ textAlign: 'center', borderRadius: 8 }}>
              <Statistic
                title="Test Average"
                value={Math.round((overallStats.onlineAvg + overallStats.offlineAvg) / 2)}
                suffix="%"
                prefix={<BarChartOutlined />}
                valueStyle={{ color: theme.token.colorInfo }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ textAlign: 'center', borderRadius: 8 }}>
              <Statistic
                title="Overall Average"
                value={overallStats.overallAvg}
                suffix="%"
                prefix={<StarOutlined />}
                valueStyle={{ color: getPercentageColor(overallStats.overallAvg) }}
              />
            </Card>
          </Col>
        </Row>

        {/* Results Tabs */}
        <Card style={{ borderRadius: 8 }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
            <TabPane
              tab={
                <Space>
                  <FileTextOutlined />
                  <span>Online Tests</span>
                  <Tag color="blue">{onlineTests.length}</Tag>
                </Space>
              }
              key="online"
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Spin size="large" />
                </div>
              ) : onlineTests.length > 0 ? (
                <Table
                  columns={onlineTestColumns}
                  dataSource={onlineTests}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 800 }}
                />
              ) : (
                <EmptyState
                  icon={<FileTextOutlined />}
                  title="No online test results"
                  description="You haven't completed any online tests yet."
                />
              )}
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <FileTextOutlined />
                  <span>Offline Tests</span>
                  <Tag color="purple">{offlineTests.length}</Tag>
                </Space>
              }
              key="offline"
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Spin size="large" />
                </div>
              ) : offlineTests.length > 0 ? (
                <Table
                  columns={offlineTestColumns}
                  dataSource={offlineTests}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 800 }}
                />
              ) : (
                <EmptyState
                  icon={<FileTextOutlined />}
                  title="No offline test results"
                  description="You don't have any offline test results yet."
                />
              )}
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <TrophyOutlined />
                  <span>Exams</span>
                  <Tag color="gold">{examResults.length}</Tag>
                </Space>
              }
              key="exams"
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Spin size="large" />
                </div>
              ) : examResults.length > 0 ? (
                <Table
                  columns={examResultColumns}
                  dataSource={examResults}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 800 }}
                />
              ) : (
                <EmptyState
                  icon={<TrophyOutlined />}
                  title="No exam results"
                  description="Your exam results will appear here once they are published."
                />
              )}
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default StudentResults;

