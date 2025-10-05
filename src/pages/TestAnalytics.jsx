import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Select, 
  DatePicker, 
  Button, 
  Space, 
  Table, 
  Tag, 
  Progress, 
  Alert, 
  Spin,
  Tabs
} from 'antd';
import {
  TrophyOutlined,
  PlayCircleOutlined,
  FileExcelOutlined,
  BarChartOutlined,
  UserOutlined,
  BookOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { getSchoolCode } from '../utils/metadata';
import { getTests } from '../services/testService';
import { getExamsSummary } from '../services/analyticsSummaryService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const TestAnalytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data state
  const [tests, setTests] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [classInstances, setClassInstances] = useState([]);

  const schoolCode = getSchoolCode(user);

  useEffect(() => {
    if (schoolCode) {
      fetchData();
    }
  }, [schoolCode]);

  useEffect(() => {
    if (schoolCode) {
      fetchAnalytics();
    }
  }, [schoolCode, selectedClassId, dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [testsData, classesData] = await Promise.all([
        getTests(schoolCode),
        getClassInstances(schoolCode)
      ]);
      
      setTests(testsData || []);
      setClassInstances(classesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setDataLoading(true);
      const [from, to] = dateRange;
      const summary = await getExamsSummary({
        schoolCode,
        classId: selectedClassId === 'all' ? null : selectedClassId,
        from: from.format('YYYY-MM-DD'),
        to: to.format('YYYY-MM-DD')
      });
      
      setAnalyticsData(summary);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to fetch analytics data');
    } finally {
      setDataLoading(false);
    }
  };

  const getClassInstances = async (schoolCode) => {
    const { supabase } = await import('../config/supabaseClient');
    const { data, error } = await supabase
      .from('class_instances')
      .select('id, grade, section')
      .eq('school_code', schoolCode)
      .order('grade', { ascending: true });
    
    if (error) throw error;
    return data || [];
  };

  const getFilteredTests = () => {
    if (selectedClassId === 'all') return tests;
    return tests.filter(test => test.class_instance_id === selectedClassId);
  };

  const getTestPerformanceData = () => {
    const filteredTests = getFilteredTests();
    return filteredTests.map(test => ({
      name: test.title,
      online: test.test_mode === 'online' ? 1 : 0,
      offline: test.test_mode === 'offline' ? 1 : 0,
      questions: test.question_count || 0,
      marks: test.marks_uploaded || 0,
      students: test.total_students || 0
    }));
  };

  const columns = [
    {
      title: 'Test Name',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: '500' }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description}
          </Text>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'test_mode',
      key: 'test_mode',
      render: (mode) => (
        <Tag color={mode === 'online' ? 'blue' : 'orange'}>
          {mode === 'online' ? 'Online' : 'Offline'}
        </Tag>
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subject_name',
      key: 'subject',
      render: (text) => (
        <Tag color="blue" icon={<BookOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Class',
      dataIndex: 'class_name',
      key: 'class',
      render: (text) => (
        <Tag color="green" icon={<UserOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Performance',
      key: 'performance',
      render: (_, record) => {
        if (record.test_mode === 'online') {
          return (
            <Space>
              <Text>{record.question_count || 0} questions</Text>
            </Space>
          );
        } else {
          const marksUploaded = record.marks_uploaded || 0;
          const totalStudents = record.total_students || 0;
          const percentage = totalStudents > 0 ? (marksUploaded / totalStudents) * 100 : 0;
          return (
            <div>
              <Text>{marksUploaded}/{totalStudents} marks</Text>
              <Progress 
                percent={Math.round(percentage)} 
                size="small" 
                style={{ marginTop: '4px' }}
              />
            </div>
          );
        }
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div>
          {/* KPIs */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Tests"
                  value={analyticsData?.totalTests || 0}
                  prefix={<TrophyOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Online Tests"
                  value={analyticsData?.onlineTests || 0}
                  prefix={<PlayCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Offline Tests"
                  value={analyticsData?.offlineTests || 0}
                  prefix={<FileExcelOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Avg Score"
                  value={analyticsData?.averageScore || 0}
                  suffix="%"
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Test Distribution Chart */}
          <Card title="Test Distribution" style={{ marginBottom: '24px' }}>
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary">Chart visualization would go here</Text>
            </div>
          </Card>
        </div>
      )
    },
    {
      key: 'tests',
      label: 'All Tests',
      children: (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              Test Performance ({getFilteredTests().length} tests)
            </Title>
            <Space>
              <Select
                value={selectedClassId}
                onChange={setSelectedClassId}
                style={{ width: 200 }}
                placeholder="Filter by class"
              >
                <Option value="all">All Classes</Option>
                {classInstances.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    Grade {cls.grade} {cls.section}
                  </Option>
                ))}
              </Select>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
              />
              <Button onClick={fetchAnalytics} loading={dataLoading}>
                Refresh
              </Button>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={getFilteredTests()}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} tests`
            }}
            scroll={{ x: 1000 }}
          />
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading test analytics...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          Test Analytics
        </Title>
        <Text type="secondary">
          Performance insights for online and offline tests
        </Text>
      </div>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      <Card>
        <Tabs
          defaultActiveKey="overview"
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
};

export default TestAnalytics;
