import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Typography, Space, Row, Col, Statistic, 
  Alert, Spin, Progress, message, DatePicker, Select
} from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, ComposedChart
} from 'recharts';
import { 
  CalendarOutlined, TeamOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, ClockCircleOutlined, RiseOutlined,
  BankOutlined, UserOutlined, ExclamationCircleOutlined,
  ArrowLeftOutlined, DownloadOutlined, LineChartOutlined
} from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { getSchoolCode } from '../../utils/metadata';
import { getAttendanceChartColors } from '../../utils/attendanceColors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DailyTrendsAnalytics = () => {
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

    // Daily trends with better structure
    const dailyTrends = [];
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
      const rate = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;
      dailyTrends.push({
        date: dayjs(date).format('MMM DD'),
        fullDate: date,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        total: stats.total,
        rate,
        presentRate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
        absentRate: stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0,
        lateRate: stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0
      });
    });

    // Sort by date
    dailyTrends.sort((a, b) => dayjs(a.fullDate).diff(dayjs(b.fullDate)));

    // Weekly averages with better calculation
    const weeklyAverages = [];
    const weekMap = new Map();
    
    dailyTrends.forEach(day => {
      const date = dayjs(day.fullDate);
      const week = Math.ceil(date.date() / 7);
      const year = date.year();
      const weekKey = `${year}-${week}`;
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { rates: [], week: weekKey });
      }
      weekMap.get(weekKey).rates.push(day.rate);
    });

    weekMap.forEach((weekData, weekKey) => {
      const avgRate = weekData.rates.length > 0 ? 
        Math.round(weekData.rates.reduce((a, b) => a + b, 0) / weekData.rates.length) : 0;
      weeklyAverages.push({
        week: `Week ${weekKey.split('-')[1]}`,
        rate: avgRate
      });
    });

    // Monthly averages
    const monthlyAverages = [];
    const monthMap = new Map();
    
    dailyTrends.forEach(day => {
      const month = dayjs(day.fullDate).format('YYYY-MM');
      if (!monthMap.has(month)) {
        monthMap.set(month, { rates: [], month });
      }
      monthMap.get(month).rates.push(day.rate);
    });

    monthMap.forEach((monthData, monthKey) => {
      const avgRate = monthData.rates.length > 0 ? 
        Math.round(monthData.rates.reduce((a, b) => a + b, 0) / monthData.rates.length) : 0;
      monthlyAverages.push({
        month: dayjs(monthKey).format('MMM YYYY'),
        rate: avgRate
      });
    });

    // Overall statistics
    const totalDays = dailyTrends.length;
    const avgAttendanceRate = totalDays > 0 ? 
      Math.round(dailyTrends.reduce((sum, day) => sum + day.rate, 0) / totalDays) : 0;
    const bestDay = dailyTrends.reduce((best, day) => day.rate > best.rate ? day : best, { rate: 0 });
    const worstDay = dailyTrends.reduce((worst, day) => day.rate < worst.rate ? day : worst, { rate: 100 });

    return {
      dailyTrends,
      weeklyAverages,
      monthlyAverages,
      totalDays,
      avgAttendanceRate,
      bestDay,
      worstDay
    };
  }, [attendanceData]);

  const handleExport = () => {
    message.info('Export functionality coming soon');
  };

  const classOptions = classes.map(cls => ({
    label: `Grade ${cls.grade ?? ''}${cls.section ? '-' + cls.section : ''}`,
    value: cls.id
  }));

  // Custom tooltip for better UX
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ 
              margin: '4px 0', 
              color: entry.color,
              fontSize: '14px'
            }}>
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      <Card style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/analytics')}
              style={{ borderRadius: '8px' }}
            >
              Back to Analytics
            </Button>
            <div>
              <Title level={2} style={{ margin: 0, color: '#1f2937' }}>Daily Attendance Trends</Title>
              <Text type="secondary" style={{ fontSize: '16px' }}>
                Detailed analysis of attendance patterns over time
              </Text>
            </div>
          </Space>
          <Space>
            <Button 
              type="primary"
              icon={<DownloadOutlined />} 
              onClick={handleExport}
              style={{ borderRadius: '8px' }}
            >
              Export Data
            </Button>
          </Space>
        </div>
      </Card>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          showIcon
          closable
          onClose={() => setAlert(null)}
          style={{ marginBottom: '24px', borderRadius: '8px' }}
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
        {/* Key Metrics with better styling */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Total Days Analyzed</span>}
                value={analyticsData.totalDays || 0}
                prefix={<CalendarOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Average Attendance</span>}
                value={analyticsData.avgAttendanceRate || 0}
                suffix="%"
                prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Best Day</span>}
                value={analyticsData.bestDay?.rate || 0}
                suffix="%"
                prefix={<RiseOutlined style={{ color: '#10b981' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>{analyticsData.bestDay?.date}</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Lowest Day</span>}
                value={analyticsData.worstDay?.rate || 0}
                suffix="%"
                prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>{analyticsData.worstDay?.date}</Text>
            </Card>
          </Col>
        </Row>

        {/* Improved Daily Trends Chart */}
        <Card style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                            <LineChartOutlined style={{ fontSize: '20px', color: '#3b82f6', marginRight: '8px' }} />
            <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Daily Attendance Trends</Title>
          </div>
          <div style={{ height: 400 }}>
            <ResponsiveContainer>
              <ComposedChart data={analyticsData.dailyTrends || []}>
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fill="url(#attendanceGradient)"
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="Attendance Rate"
                />
                <Bar 
                  dataKey="presentRate" 
                  fill="#10b981" 
                  stackId="a"
                  name="Present"
                  opacity={0.8}
                />
                <Bar 
                  dataKey="lateRate" 
                  fill="#f59e0b" 
                  stackId="a"
                  name="Late"
                  opacity={0.8}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Improved Weekly and Monthly Averages */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <CalendarOutlined style={{ fontSize: '20px', color: '#06b6d4', marginRight: '8px' }} />
                <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Weekly Averages</Title>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={analyticsData.weeklyAverages || []}>
                    <defs>
                      <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="week" 
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value}%`, 'Average Rate']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="rate" fill="url(#weeklyGradient)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <CalendarOutlined style={{ fontSize: '20px', color: '#10b981', marginRight: '8px' }} />
                <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Monthly Averages</Title>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={analyticsData.monthlyAverages || []}>
                    <defs>
                      <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value}%`, 'Average Rate']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="rate" fill="url(#monthlyGradient)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default DailyTrendsAnalytics;
