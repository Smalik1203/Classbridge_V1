// src/components/ResultsAnalytics.jsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Button,
  Typography,
  Statistic,
  Progress,
  Table,
  Tag,
  Space,
  Spin,
  Empty,
  Divider,
  Tabs,
  message
} from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  TrophyOutlined,
  UserOutlined,
  BookOutlined,
  RiseOutlined,
  DownloadOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { 
  getExams, 
  getExamResults, 
  getExamSummary, 
  getSubjectPerformance,
  getGradeColor,
  getRankSuffix
} from '../services/resultsService';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const ResultsAnalytics = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const schoolCode = user?.user_metadata?.school_code;

  // Chart colors
  const chartColors = [
    '#1890ff',
    '#52c41a',
    '#faad14',
    '#f5222d',
    '#722ed1',
    '#13c2c2',
    '#eb2f96',
    '#fa8c16'
  ];

  useEffect(() => {
    if (schoolCode) {
      fetchExams();
    }
  }, [schoolCode]);



  const fetchExams = async () => {
    setLoading(true);
    try {
      const data = await getExams(schoolCode);
      setExams(data);
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    if (!selectedExam) return;
    
    setResultsLoading(true);
    try {
      const data = await getExamResults(selectedExam.id);
      setResults(data);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setResultsLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    if (!results.length) return {};

    const totalStudents = results.length;
    const averagePercentage = results.reduce((sum, r) => sum + r.percentage, 0) / totalStudents;
    const topPerformers = results.filter(r => r.percentage >= 90).length;
    const needSupport = results.filter(r => r.percentage < 60).length;
    const passRate = results.filter(r => r.percentage >= 35).length / totalStudents * 100;

    return {
      totalStudents,
      averagePercentage,
      topPerformers,
      needSupport,
      passRate
    };
  };

  // Prepare grade distribution data
  const getGradeDistribution = () => {
    const gradeCounts = {};
    results.forEach(result => {
      const grade = result.overall_grade;
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    });

    return Object.entries(gradeCounts).map(([grade, count]) => ({
      grade,
      count,
      percentage: (count / results.length) * 100
    }));
  };

  // Prepare performance range data
  const getPerformanceRanges = () => {
    const ranges = [
      { range: '90-100%', min: 90, max: 100, color: '#52c41a' },
      { range: '80-89%', min: 80, max: 89, color: '#1890ff' },
      { range: '70-79%', min: 70, max: 79, color: '#faad14' },
      { range: '60-69%', min: 60, max: 69, color: '#fa8c16' },
      { range: '35-59%', min: 35, max: 59, color: '#f5222d' },
      { range: '0-34%', min: 0, max: 34, color: '#a8071a' }
    ];

    return ranges.map(range => {
      const count = results.filter(r => r.percentage >= range.min && r.percentage <= range.max).length;
      return {
        ...range,
        count,
        percentage: (count / results.length) * 100
      };
    });
  };

  // Prepare top performers data
  const getTopPerformers = () => {
    return results
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10)
      .map((result, index) => ({
        rank: index + 1,
                    name: result.student?.full_name,
            rollNumber: result.student?.student_code,
        percentage: result.percentage,
        grade: result.overall_grade,
        marks: `${result.total_obtained_marks}/${result.total_max_marks}`
      }));
  };

  // Prepare subject performance data
  const getSubjectPerformanceData = () => {
    if (!selectedExam?.exam_subjects) return [];

    return selectedExam.exam_subjects.map(es => {
      const subjectResults = results.flatMap(r => 
        r.subject_results?.filter(sr => sr.exam_subject_id === es.id) || []
      );

      if (!subjectResults.length) return null;

      const averageMarks = subjectResults.reduce((sum, sr) => sum + sr.obtained_marks, 0) / subjectResults.length;
      const averagePercentage = (averageMarks / es.max_marks) * 100;

      return {
        subject: es.subject?.subject_name,
        averageMarks: Math.round(averageMarks),
        maxMarks: es.max_marks,
        averagePercentage: Math.round(averagePercentage),
        totalStudents: subjectResults.length
      };
    }).filter(Boolean);
  };

  const stats = calculateStats();
  const gradeDistribution = getGradeDistribution();
  const performanceRanges = getPerformanceRanges();
  const topPerformers = getTopPerformers();
  const subjectPerformance = getSubjectPerformanceData();

  const renderOverview = () => (
    <div>
      {/* Key Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Students"
              value={stats.totalStudents || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: antdTheme.token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Average Percentage"
              value={stats.averagePercentage || 0}
              precision={1}
              suffix="%"
                             prefix={<RiseOutlined />}
              valueStyle={{ color: antdTheme.token.colorSuccess }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Top Performers"
              value={stats.topPerformers || 0}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: antdTheme.token.colorWarning }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              ≥90% marks
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pass Rate"
              value={stats.passRate || 0}
              precision={1}
              suffix="%"
              prefix={<BookOutlined />}
              valueStyle={{ color: antdTheme.token.colorInfo }}
            />
          </Card>
        </Col>
      </Row>

      {/* Performance Distribution */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="Performance Distribution" extra={<BarChartOutlined />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceRanges}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill={antdTheme.token.colorPrimary} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Grade Distribution" extra={<PieChartOutlined />}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={gradeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ grade, percentage }) => `${grade} (${percentage.toFixed(1)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {gradeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Performance Ranges Progress */}
      <Card title="Performance Analysis" style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {performanceRanges.map((range, index) => (
            <div key={range.range}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <Text>{range.range}</Text>
                <Text strong>{range.count} students ({range.percentage.toFixed(1)}%)</Text>
              </div>
              <Progress
                percent={range.percentage}
                strokeColor={range.color}
                showInfo={false}
              />
            </div>
          ))}
        </Space>
      </Card>
    </div>
  );

  const renderTopPerformers = () => (
    <div>
      <Card title="Top 10 Performers" extra={<TrophyOutlined />}>
        <Table
          dataSource={topPerformers}
          columns={[
            {
              title: 'Rank',
              dataIndex: 'rank',
              key: 'rank',
              render: (rank) => (
                <div style={{ textAlign: 'center' }}>
                  <Text strong style={{ fontSize: '16px' }}>
                    {rank}{getRankSuffix(rank)}
                  </Text>
                  {rank <= 3 && <TrophyOutlined style={{ color: '#faad14', marginLeft: '4px' }} />}
                </div>
              )
            },
            {
              title: 'Student',
              dataIndex: 'name',
              key: 'name',
              render: (name, record) => (
                <div>
                  <Text strong>{name}</Text>
                  <br />
                  <Text type="secondary">{record.rollNumber}</Text>
                </div>
              )
            },
            {
              title: 'Marks',
              dataIndex: 'marks',
              key: 'marks',
              align: 'center'
            },
            {
              title: 'Percentage',
              dataIndex: 'percentage',
              key: 'percentage',
              render: (percentage) => (
                <Text strong style={{ fontSize: '16px', color: antdTheme.token.colorSuccess }}>
                  {percentage.toFixed(1)}%
                </Text>
              ),
              align: 'center'
            },
            {
              title: 'Grade',
              dataIndex: 'grade',
              key: 'grade',
              render: (grade) => (
                <Tag color={getGradeColor(grade)} style={{ fontSize: '14px', padding: '4px 8px' }}>
                  {grade}
                </Tag>
              ),
              align: 'center'
            }
          ]}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );

  const renderSubjectAnalysis = () => (
    <div>
      <Card title="Subject-wise Performance" extra={<BarChartOutlined />}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={subjectPerformance} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis dataKey="subject" type="category" width={100} />
            <Tooltip />
            <Legend />
            <Bar dataKey="averagePercentage" fill={antdTheme.token.colorPrimary} name="Average %" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Subject Details" style={{ marginTop: '16px' }}>
        <Table
          dataSource={subjectPerformance}
          columns={[
            {
              title: 'Subject',
              dataIndex: 'subject',
              key: 'subject'
            },
            {
              title: 'Average Marks',
              dataIndex: 'averageMarks',
              key: 'averageMarks',
              render: (marks, record) => `${marks}/${record.maxMarks}`,
              align: 'center'
            },
            {
              title: 'Average Percentage',
              dataIndex: 'averagePercentage',
              key: 'averagePercentage',
              render: (percentage) => (
                <Text strong style={{ color: 
                  percentage >= 80 ? antdTheme.token.colorSuccess :
                  percentage >= 60 ? antdTheme.token.colorWarning :
                  antdTheme.token.colorError
                }}>
                  {percentage}%
                </Text>
              ),
              align: 'center'
            },
            {
              title: 'Students',
              dataIndex: 'totalStudents',
              key: 'totalStudents',
              align: 'center'
            },
            {
              title: 'Performance',
              key: 'performance',
              render: (_, record) => (
                <Progress
                  percent={record.averagePercentage}
                  size="small"
                  strokeColor={
                    record.averagePercentage >= 80 ? antdTheme.token.colorSuccess :
                    record.averagePercentage >= 60 ? antdTheme.token.colorWarning :
                    antdTheme.token.colorError
                  }
                />
              )
            }
          ]}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );

  const renderTrends = () => (
    <div>
      <Card title="Performance Trends" extra={<LineChartOutlined />}>
        <Empty
          description="Trend analysis will be available when multiple exams are available"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: antdTheme.token.colorText }}>
            Results Analytics
          </Title>
          <Text type="secondary" style={{ color: antdTheme.token.colorTextSecondary }}>
            Comprehensive analysis of exam performance and trends
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<DownloadOutlined />}>
              Export Report
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Exam Selection */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>Select Exam: </Text>
          </Col>
          <Col flex="auto">
            <Select
              style={{ width: '100%' }}
              placeholder="Choose an exam for analysis"
              value={selectedExam?.id}
              onChange={(examId) => {
                const exam = exams.find(e => e.id === examId);
                setSelectedExam(exam);
                setResults([]);
              }}
              loading={loading}
              allowClear={true}
            >
              {exams.map(exam => (
                <Option key={exam.id} value={exam.id}>
                  {exam.exam_name} - {exam.class_instance?.grade} {exam.class_instance?.section}
                </Option>
              ))}
            </Select>
          </Col>
          <Col>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['Start Date', 'End Date']}
              allowClear={true}
            />
          </Col>
          <Col>
            <Button 
              type="primary"
              onClick={() => {
                if (selectedExam) {
                  fetchResults();
                } else {
                  message.warning('Please select an exam before loading results');
                }
              }}
              disabled={!selectedExam}
              loading={resultsLoading}
            >
              {resultsLoading ? 'Loading...' : 'Load Results'}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Content */}
      {selectedExam ? (
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <Space>
                <BarChartOutlined />
                Overview
              </Space>
            }
            key="overview"
          >
            {renderOverview()}
          </TabPane>
          
          <TabPane
            tab={
              <Space>
                <TrophyOutlined />
                Top Performers
              </Space>
            }
            key="topPerformers"
          >
            {renderTopPerformers()}
          </TabPane>
          
          <TabPane
            tab={
              <Space>
                <BookOutlined />
                Subject Analysis
              </Space>
            }
            key="subjectAnalysis"
          >
            {renderSubjectAnalysis()}
          </TabPane>
          
          <TabPane
            tab={
              <Space>
                <LineChartOutlined />
                Trends
              </Space>
            }
            key="trends"
          >
            {renderTrends()}
          </TabPane>
        </Tabs>
      ) : (
        <Card>
          <Empty
            description="Please select an exam to view analytics"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
};

export default ResultsAnalytics;
