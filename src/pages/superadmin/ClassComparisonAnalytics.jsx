import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Typography, Space, Row, Col, Statistic, 
  Alert, Spin, Progress, message, DatePicker, Select, Table
} from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  CalendarOutlined, TeamOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, ClockCircleOutlined, RiseOutlined,
  BankOutlined, UserOutlined, ExclamationCircleOutlined,
  ArrowLeftOutlined, DownloadOutlined, TrophyOutlined
} from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { getSchoolCode } from '../../utils/metadata';
import { getAttendanceChartColors } from '../../utils/attendanceColors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ClassComparisonAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);

  // Get school code from user
  useEffect(() => {
    if (user) {
      // Comprehensive user data extraction (checking all possible locations)
      setSchoolCode(getSchoolCode(user) || '');
    }
  }, [user]);

  // Fetch data when school code changes
  useEffect(() => {
    if (schoolCode) {
      fetchData();
    }
  }, [schoolCode, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [startDate, endDate] = dateRange;
      
      // Fetch attendance data
      const { data: attendanceResult, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_code', schoolCode)
        .gte('date', startDate.format('YYYY-MM-DD'))
        .lte('date', endDate.format('YYYY-MM-DD'))
        .order('date', { ascending: true });

      if (attendanceError) throw attendanceError;
      setAttendanceData(attendanceResult || []);

      // Fetch students
      const { data: studentsResult, error: studentsError } = await supabase
        .from('student')
        .select('*')
        .eq('school_code', schoolCode);

      if (studentsError) throw studentsError;
      setStudents(studentsResult || []);

      // Fetch classes
      const { data: classesResult, error: classesError } = await supabase
        .from('class_instances')
        .select('*')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true });

      if (classesError) throw classesError;
      setClasses(classesResult || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      setAlert({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const STATUS_COLORS = getAttendanceChartColors();

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!attendanceData.length || !students.length || !classes.length) return {};

    // Class performance data
    const classPerformance = classes.map(cls => {
      const classStudents = students.filter(s => s.class_instance_id === cls.id);
      const classAttendance = attendanceData.filter(r => r.class_instance_id === cls.id);
      
      const totalRecords = classAttendance.length;
      const present = classAttendance.filter(r => r.status === 'present').length;
      const absent = classAttendance.filter(r => r.status === 'absent').length;
      const late = classAttendance.filter(r => r.status === 'late').length;
      const rate = totalRecords > 0 ? Math.round(((present + late) / totalRecords) * 100) : 0;

      // Calculate daily trends for this class
      const dailyTrends = [];
      const dateMap = new Map();
      
      classAttendance.forEach(record => {
        const date = record.date;
        if (!dateMap.has(date)) {
          dateMap.set(date, { present: 0, absent: 0, late: 0, total: 0 });
        }
        const stats = dateMap.get(date);
        stats[record.status]++;
        stats.total++;
      });

      dateMap.forEach((stats, date) => {
        const dayRate = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;
        dailyTrends.push({
          date: dayjs(date).format('MMM DD'),
          rate: dayRate
        });
      });

      // Sort by date
      dailyTrends.sort((a, b) => dayjs(a.date, 'MMM DD').diff(dayjs(b.date, 'MMM DD')));

      // Student performance within class
      const studentPerformance = classStudents.map(student => {
        const studentRecords = classAttendance.filter(r => r.student_id === student.id);
        const total = studentRecords.length;
        const present = studentRecords.filter(r => r.status === 'present').length;
        const absent = studentRecords.filter(r => r.status === 'absent').length;
        const late = studentRecords.filter(r => r.status === 'late').length;
        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        return {
          id: student.id,
          name: student.full_name,
          code: student.student_code,
          total,
          present,
          absent,
          late,
          rate
        };
      });

      const avgStudentRate = studentPerformance.length > 0 ? 
        Math.round(studentPerformance.reduce((sum, s) => sum + s.rate, 0) / studentPerformance.length) : 0;

      return {
        id: cls.id,
        name: `Grade ${cls.grade ?? ''}${cls.section ? '-' + cls.section : ''}`,
        grade: cls.grade,
        studentCount: classStudents.length,
        totalRecords,
        present,
        absent,
        late,
        rate,
        avgStudentRate,
        dailyTrends,
        studentPerformance
      };
    });

    // Sort by grade
    classPerformance.sort((a, b) => a.grade - b.grade);

    // Overall statistics
    const totalClasses = classPerformance.length;
    const avgClassRate = totalClasses > 0 ? 
      Math.round(classPerformance.reduce((sum, c) => sum + c.rate, 0) / totalClasses) : 0;
    const bestClass = classPerformance.reduce((best, cls) => cls.rate > best.rate ? cls : best, { rate: 0 });
    const worstClass = classPerformance.reduce((worst, cls) => cls.rate < worst.rate ? cls : worst, { rate: 100 });

    // Class ranking
    const classRanking = [...classPerformance].sort((a, b) => b.rate - a.rate);

    return {
      classPerformance,
      classRanking,
      totalClasses,
      avgClassRate,
      bestClass,
      worstClass
    };
  }, [attendanceData, students, classes]);

  const handleExport = () => {
    message.info('Export functionality coming soon');
  };

  // Table columns for class performance
  const columns = [
    {
      title: 'Class',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.studentCount} students</div>
        </div>
      ),
    },
    {
      title: 'Attendance Rate',
      dataIndex: 'rate',
      key: 'rate',
      render: (rate) => (
        <div>
          <div style={{ fontWeight: 500 }}>{rate}%</div>
          <Progress 
            percent={rate} 
            size="small" 
            strokeColor={
              rate >= 90 ? '#52c41a' : 
              rate >= 75 ? '#1890ff' : 
              rate >= 60 ? '#faad14' : '#ff4d4f'
            }
            showInfo={false}
          />
        </div>
      ),
      sorter: (a, b) => a.rate - b.rate,
    },
    {
      title: 'Avg Student Rate',
      dataIndex: 'avgStudentRate',
      key: 'avgStudentRate',
      render: (rate) => (
        <div>
          <div style={{ fontWeight: 500 }}>{rate}%</div>
          <Progress 
            percent={rate} 
            size="small" 
            strokeColor={
              rate >= 90 ? '#52c41a' : 
              rate >= 75 ? '#1890ff' : 
              rate >= 60 ? '#faad14' : '#ff4d4f'
            }
            showInfo={false}
          />
        </div>
      ),
    },
    {
      title: 'Present',
      dataIndex: 'present',
      key: 'present',
      render: (value) => <Text style={{ color: '#52c41a' }}>{value}</Text>,
    },
    {
      title: 'Absent',
      dataIndex: 'absent',
      key: 'absent',
      render: (value) => <Text style={{ color: '#ff4d4f' }}>{value}</Text>,
    },
    {
      title: 'Late',
      dataIndex: 'late',
      key: 'late',
      render: (value) => <Text style={{ color: '#faad14' }}>{value}</Text>,
    },
    {
      title: 'Total Records',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
      render: (value) => <Text>{value}</Text>,
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/analytics')}
            >
              Back to Analytics
            </Button>
            <Title level={2} style={{ margin: 0 }}>Class Comparison Analytics</Title>
          </Space>
          <Space>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={handleExport}
            >
              Export Data
            </Button>
          </Space>
        </div>
        
        <Text type="secondary">
          Compare attendance performance across different classes
        </Text>
      </Card>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          showIcon
          closable
          onClose={() => setAlert(null)}
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Text strong>Date Range:</Text>
              <RangePicker 
                value={dateRange}
                onChange={setDateRange}
                style={{ width: 250 }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {/* Key Metrics */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Classes"
                value={analyticsData.totalClasses || 0}
                prefix={<BankOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Average Class Rate"
                value={analyticsData.avgClassRate || 0}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Best Performing Class"
                value={analyticsData.bestClass?.rate || 0}
                suffix="%"
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
              <Text type="secondary">{analyticsData.bestClass?.name}</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Needs Improvement"
                value={analyticsData.worstClass?.rate || 0}
                suffix="%"
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
              <Text type="secondary">{analyticsData.worstClass?.name}</Text>
            </Card>
          </Col>
        </Row>

        {/* Class Comparison Charts */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card>
              <Title level={4}>Class Attendance Comparison</Title>
              <div style={{ height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={analyticsData.classPerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Attendance Rate']} />
                    <Legend />
                    <Bar dataKey="rate" fill="#1890ff" name="Class Rate" />
                    <Bar dataKey="avgStudentRate" fill="#52c41a" name="Avg Student Rate" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card>
              <Title level={4}>Class Ranking</Title>
              <div style={{ height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={analyticsData.classRanking || []} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Attendance Rate']} />
                    <Bar dataKey="rate" fill="#722ed1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Daily Trends for All Classes */}
        <Card style={{ marginBottom: '24px' }}>
          <Title level={4}>Daily Trends Comparison</Title>
          <div style={{ height: 400 }}>
            <ResponsiveContainer>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, 'Attendance Rate']} />
                <Legend />
                {(analyticsData.classPerformance || []).map((cls, index) => (
                  <Line 
                    key={cls.id}
                    type="monotone" 
                    dataKey="rate" 
                    data={cls.dailyTrends}
                    stroke={['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'][index % 5]}
                    strokeWidth={2}
                    dot={{ fill: ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'][index % 5], strokeWidth: 1, r: 3 }}
                    name={cls.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Class Performance Table */}
        <Card>
          <Title level={4}>Class Performance Details</Title>
          <Table
            columns={columns}
            dataSource={analyticsData.classPerformance || []}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} classes`,
            }}
            scroll={{ x: 800 }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default ClassComparisonAnalytics;
