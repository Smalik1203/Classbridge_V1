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
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { getAttendanceChartColors } from '@/features/attendance/utils/attendanceColors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const StatusDistributionAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
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
  }, [schoolCode, selectedClass, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [startDate, endDate] = dateRange;
      
      // Fetch attendance data
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('school_code', schoolCode)
        .gte('date', startDate.format('YYYY-MM-DD'))
        .lte('date', endDate.format('YYYY-MM-DD'))
        .order('date', { ascending: true });

      if (selectedClass) {
        query = query.eq('class_instance_id', selectedClass);
      }

      const { data: attendanceResult, error: attendanceError } = await query;
      if (attendanceError) throw attendanceError;
      setAttendanceData(attendanceResult || []);

      // Fetch classes
      const { data: classesResult, error: classesError } = await supabase
        .from('class_instances')
        .select('*')
        .eq('school_code', schoolCode);

      if (classesError) throw classesError;
      setClasses(classesResult || []);

    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const STATUS_COLORS = getAttendanceChartColors();

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!attendanceData.length) return {};

    // Overall status distribution
    const totalRecords = attendanceData.length;
    const presentCount = attendanceData.filter(r => r.status === 'present').length;
    const absentCount = attendanceData.filter(r => r.status === 'absent').length;
    const lateCount = attendanceData.filter(r => r.status === 'late').length;

    const overallDistribution = [
      { name: 'Present', value: presentCount, color: STATUS_COLORS.present, percentage: Math.round((presentCount / totalRecords) * 100) },
      { name: 'Absent', value: absentCount, color: STATUS_COLORS.absent, percentage: Math.round((absentCount / totalRecords) * 100) },
      { name: 'Late', value: lateCount, color: STATUS_COLORS.late, percentage: Math.round((lateCount / totalRecords) * 100) }
    ];

    // Daily status distribution
    const dailyDistribution = [];
    const dateMap = new Map();
    
    attendanceData.forEach(record => {
      const date = record.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { present: 0, absent: 0, late: 0, total: 0 });
      }
      const stats = dateMap.get(date);
      stats[record.status]++;
      stats.total++;
    });

    dateMap.forEach((stats, date) => {
      dailyDistribution.push({
        date: dayjs(date).format('MMM DD'),
        fullDate: date,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        total: stats.total,
        presentRate: Math.round((stats.present / stats.total) * 100),
        absentRate: Math.round((stats.absent / stats.total) * 100),
        lateRate: Math.round((stats.late / stats.total) * 100)
      });
    });

    // Sort by date
    dailyDistribution.sort((a, b) => dayjs(a.fullDate).diff(dayjs(b.fullDate)));

    // Weekly status trends
    const weeklyTrends = [];
    const weekMap = new Map();
    
    dailyDistribution.forEach(day => {
      const date = dayjs(day.fullDate);
      const week = Math.ceil(date.date() / 7);
      const year = date.year();
      const weekKey = `${year}-${week}`;
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { present: 0, absent: 0, late: 0, total: 0, days: 0 });
      }
      const weekStats = weekMap.get(weekKey);
      weekStats.present += day.present;
      weekStats.absent += day.absent;
      weekStats.late += day.late;
      weekStats.total += day.total;
      weekStats.days++;
    });

    weekMap.forEach((weekStats, weekKey) => {
      const avgPresentRate = weekStats.total > 0 ? Math.round((weekStats.present / weekStats.total) * 100) : 0;
      const avgAbsentRate = weekStats.total > 0 ? Math.round((weekStats.absent / weekStats.total) * 100) : 0;
      const avgLateRate = weekStats.total > 0 ? Math.round((weekStats.late / weekStats.total) * 100) : 0;

      weeklyTrends.push({
        week: `Week ${weekKey.split('-')[1]}`,
        presentRate: avgPresentRate,
        absentRate: avgAbsentRate,
        lateRate: avgLateRate
      });
    });

    // Class-wise status distribution
    const classDistribution = classes.map(cls => {
      const classAttendance = attendanceData.filter(r => r.class_instance_id === cls.id);
      const total = classAttendance.length;
      const present = classAttendance.filter(r => r.status === 'present').length;
      const absent = classAttendance.filter(r => r.status === 'absent').length;
      const late = classAttendance.filter(r => r.status === 'late').length;

      return {
        id: cls.id,
        name: `Grade ${cls.grade ?? ''}${cls.section ? '-' + cls.section : ''}`,
        total,
        present,
        absent,
        late,
        presentRate: total > 0 ? Math.round((present / total) * 100) : 0,
        absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
        lateRate: total > 0 ? Math.round((late / total) * 100) : 0
      };
    });

    // Status trends over time
    const statusTrends = dailyDistribution.map(day => ({
      date: day.date,
      present: day.presentRate,
      absent: day.absentRate,
      late: day.lateRate
    }));

    return {
      overallDistribution,
      dailyDistribution,
      weeklyTrends,
      classDistribution,
      statusTrends,
      totalRecords,
      presentCount,
      absentCount,
      lateCount
    };
  }, [attendanceData, classes]);

  const handleExport = () => {
    message.info('Export functionality coming soon');
  };

  const classOptions = classes.map(cls => ({
    label: `Grade ${cls.grade ?? ''}${cls.section ? '-' + cls.section : ''}`,
    value: cls.id
  }));

  // Table columns for daily distribution
  const dailyColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Present',
      dataIndex: 'present',
      key: 'present',
      render: (value, record) => (
        <div>
          <Text style={{ color: '#52c41a' }}>{value}</Text>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.presentRate}%</div>
        </div>
      ),
    },
    {
      title: 'Absent',
      dataIndex: 'absent',
      key: 'absent',
      render: (value, record) => (
        <div>
          <Text style={{ color: '#ff4d4f' }}>{value}</Text>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.absentRate}%</div>
        </div>
      ),
    },
    {
      title: 'Late',
      dataIndex: 'late',
      key: 'late',
      render: (value, record) => (
        <div>
          <Text style={{ color: '#faad14' }}>{value}</Text>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.lateRate}%</div>
        </div>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
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
            <Title level={2} style={{ margin: 0 }}>Status Distribution Analytics</Title>
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
          Detailed analysis of attendance status distribution patterns
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

      {/* Filter Bar */}
      <Card 
        style={{ 
          marginBottom: '24px', 
          borderRadius: '8px',
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          boxShadow: 'none'
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={12}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 6 }}>
                Date Range
              </Text>
              <RangePicker 
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                size="middle"
                disabledDate={(current) => current && current > dayjs().endOf('day')}
                maxDate={dayjs()}
                placeholder={['Start date', 'End date']}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 6 }}>
                Class
              </Text>
              <Select
                placeholder="All classes..."
                value={selectedClass || undefined}
                onChange={setSelectedClass}
                allowClear
                style={{ width: '100%' }}
                size="middle"
                options={classOptions}
              />
            </div>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {/* Key Metrics */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Records"
                value={analyticsData.totalRecords || 0}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Present"
                value={analyticsData.presentCount || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
              <Text type="secondary">
                {analyticsData.totalRecords > 0 ? Math.round((analyticsData.presentCount / analyticsData.totalRecords) * 100) : 0}% of total
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Absent"
                value={analyticsData.absentCount || 0}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
              <Text type="secondary">
                {analyticsData.totalRecords > 0 ? Math.round((analyticsData.absentCount / analyticsData.totalRecords) * 100) : 0}% of total
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Late"
                value={analyticsData.lateCount || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
              <Text type="secondary">
                {analyticsData.totalRecords > 0 ? Math.round((analyticsData.lateCount / analyticsData.totalRecords) * 100) : 0}% of total
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Overall Distribution Chart */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card>
              <Title level={4}>Overall Status Distribution</Title>
              <div style={{ height: 400 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={analyticsData.overallDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(analyticsData.overallDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card>
              <Title level={4}>Status Trends Over Time</Title>
              <div style={{ height: 400 }}>
                <ResponsiveContainer>
                  <LineChart data={analyticsData.statusTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="present" 
                      stroke="#52c41a" 
                      strokeWidth={3}
                      dot={{ fill: '#52c41a', strokeWidth: 2, r: 4 }}
                      name="Present"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="absent" 
                      stroke="#ff4d4f" 
                      strokeWidth={3}
                      dot={{ fill: '#ff4d4f', strokeWidth: 2, r: 4 }}
                      name="Absent"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="late" 
                      stroke="#faad14" 
                      strokeWidth={3}
                      dot={{ fill: '#faad14', strokeWidth: 2, r: 4 }}
                      name="Late"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Weekly Trends and Class Distribution */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card>
              <Title level={4}>Weekly Status Trends</Title>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={analyticsData.weeklyTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    <Legend />
                    <Bar dataKey="presentRate" fill="#52c41a" name="Present" stackId="a" />
                    <Bar dataKey="lateRate" fill="#faad14" name="Late" stackId="a" />
                    <Bar dataKey="absentRate" fill="#ff4d4f" name="Absent" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card>
              <Title level={4}>Class-wise Status Distribution</Title>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={analyticsData.classDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    <Legend />
                    <Bar dataKey="presentRate" fill="#52c41a" name="Present" stackId="a" />
                    <Bar dataKey="lateRate" fill="#faad14" name="Late" stackId="a" />
                    <Bar dataKey="absentRate" fill="#ff4d4f" name="Absent" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Daily Distribution Table */}
        <Card>
          <Title level={4}>Daily Status Distribution</Title>
          <Table
            columns={dailyColumns}
            dataSource={analyticsData.dailyDistribution || []}
            rowKey="fullDate"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} days`,
            }}
            scroll={{ x: 600 }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default StatusDistributionAnalytics;
