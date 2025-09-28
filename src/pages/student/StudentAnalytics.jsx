import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Tabs, DatePicker, Button, Typography, Space, Row, Col, Statistic, 
  Alert, Spin, Table, Progress, Divider, Empty, Skeleton, Badge, message
} from 'antd';
import EmptyState from '../../ui/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { 
  CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, 
  ClockCircleOutlined, RiseOutlined, DownloadOutlined,
  UserOutlined, TrophyOutlined, FireOutlined, 
  EyeOutlined
} from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { getStudentCode } from '../../utils/metadata';
import { AttendanceTag } from '../../components/AttendanceStatusIndicator';
import { getAttendanceChartColors } from '../../utils/attendanceColors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

const StudentAnalytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Data state
  const [student, setStudent] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);

  // Fetch student data
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const studentCode = getStudentCode(user);
        const query = supabase.from('student').select('id, full_name, student_code, class_instance_id, school_code');
        const { data, error } = await (studentCode ? 
          query.eq('student_code', studentCode) : 
          query.eq('email', user.email)
        ).single();

        if (error) throw error;
        setStudent(data);
      } catch (err) {
        console.error('Error fetching student:', err);
        setAlert({ type: 'error', message: 'Could not fetch student data. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [user]);

  // Fetch attendance data
  const fetchAttendanceData = async () => {
    if (!student || !dateRange) return;
    
    setDataLoading(true);
    try {
      const [startDate, endDate] = dateRange;
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, status')
        .eq('student_id', student.id)
        .gte('date', startDate.format('YYYY-MM-DD'))
        .lte('date', endDate.format('YYYY-MM-DD'))
        .order('date', { ascending: true });

      if (error) throw error;
      setAttendanceData(data || []);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setAlert({ type: 'error', message: 'Failed to load attendance data. Please try again.' });
    } finally {
      setDataLoading(false);
    }
  };

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!attendanceData.length) {
      return {
        totalDays: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        attendanceRate: 0,
        streakDays: 0,
        bestStreak: 0,
        dailyStats: [],
        weeklyStats: [],
        monthlyStats: [],
        statusDistribution: [],
        trends: []
      };
    }

    const totalDays = attendanceData.length;
    const presentCount = attendanceData.filter(r => r.status === 'present').length;
    const absentCount = attendanceData.filter(r => r.status === 'absent').length;
    const lateCount = attendanceData.filter(r => r.status === 'late').length;
    const attendanceRate = totalDays > 0 ? Math.round(((presentCount + lateCount) / totalDays) * 100) : 0;

    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    attendanceData.forEach(record => {
      if (record.status === 'present' || record.status === 'late') {
        tempStreak++;
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    });

    // Current streak (from most recent)
    for (let i = attendanceData.length - 1; i >= 0; i--) {
      if (attendanceData[i].status === 'present' || attendanceData[i].status === 'late') {
        currentStreak++;
      } else {
        break;
      }
    }

    // Daily statistics
    const dailyStats = attendanceData.map(record => ({
      date: dayjs(record.date).format('MMM DD'),
      status: record.status,
      isPresent: record.status === 'present' || record.status === 'late'
    }));

    // Weekly statistics
    const weeklyStats = [];
    const weekMap = new Map();
    
    attendanceData.forEach(record => {
      const weekStart = dayjs(record.date).startOf('week');
      const weekKey = weekStart.format('YYYY-MM-DD');
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { present: 0, absent: 0, late: 0, total: 0 });
      }
      
      const stats = weekMap.get(weekKey);
      stats[record.status]++;
      stats.total++;
    });

    weekMap.forEach((stats, weekKey) => {
      weeklyStats.push({
        week: dayjs(weekKey).format('MMM DD'),
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        total: stats.total,
        rate: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0
      });
    });

    // Monthly statistics
    const monthlyStats = [];
    const monthMap = new Map();
    
    attendanceData.forEach(record => {
      const monthKey = dayjs(record.date).format('YYYY-MM');
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { present: 0, absent: 0, late: 0, total: 0 });
      }
      
      const stats = monthMap.get(monthKey);
      stats[record.status]++;
      stats.total++;
    });

    monthMap.forEach((stats, monthKey) => {
      monthlyStats.push({
        month: dayjs(monthKey).format('MMM YYYY'),
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        total: stats.total,
        rate: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0
      });
    });

    // Status distribution
    const statusDistribution = [
      { name: 'Present', value: presentCount, color: '#52c41a' },
      { name: 'Absent', value: absentCount, color: '#ff4d4f' },
      { name: 'Late', value: lateCount, color: '#faad14' }
    ].filter(item => item.value > 0);

    // Trends (last 7 days)
    const trends = dailyStats.slice(-7).map(day => ({
      date: day.date,
      rate: day.isPresent ? 100 : 0
    }));

    return {
      totalDays,
      presentCount,
      absentCount,
      lateCount,
      attendanceRate,
      streakDays: currentStreak,
      bestStreak,
      dailyStats,
      weeklyStats,
      monthlyStats,
      statusDistribution,
      trends
    };
  }, [attendanceData]);

  // Export functions
  const exportData = (type) => {
    const [startDate, endDate] = dateRange;
    const filename = `my_attendance_analytics_${type}_${startDate.format('YYYYMMDD')}_${endDate.format('YYYYMMDD')}.csv`;
    
    let csvContent = '';
    
    if (type === 'daily') {
      csvContent = 'Date,Status,Present\n';
      analytics.dailyStats.forEach(day => {
        csvContent += `${day.date},${day.status},${day.isPresent ? 'Yes' : 'No'}\n`;
      });
    } else if (type === 'weekly') {
      csvContent = 'Week,Present,Absent,Late,Total,Attendance Rate\n';
      analytics.weeklyStats.forEach(week => {
        csvContent += `${week.week},${week.present},${week.absent},${week.late},${week.total},${week.rate}%\n`;
      });
    } else if (type === 'monthly') {
      csvContent = 'Month,Present,Absent,Late,Total,Attendance Rate\n';
      analytics.monthlyStats.forEach(month => {
        csvContent += `${month.month},${month.present},${month.absent},${month.late},${month.total},${month.rate}%\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const STATUS_COLORS = getAttendanceChartColors();

  const attendanceColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date) => (
        <Text strong>{dayjs(date).format('DD MMM YYYY')}</Text>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <AttendanceTag status={status} />
    }
  ];

  const renderSkeleton = () => (
    <div style={{ padding: '20px' }}>
      <Skeleton active paragraph={{ rows: 4 }} />
      <Skeleton active paragraph={{ rows: 3 }} />
    </div>
  );

  const getStreakBadge = (streak) => {
    if (streak >= 10) return { color: '#f5222d', text: '🔥 Amazing!' };
    if (streak >= 7) return { color: '#fa8c16', text: '⭐ Great!' };
    if (streak >= 5) return { color: '#52c41a', text: '👍 Good!' };
    return { color: '#1890ff', text: 'Keep going!' };
  };

  if (loading) {
    return (
      <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
        <Card style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0, color: '#1f2937', fontWeight: 600 }}>
            My Attendance Analytics
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            {student ? `Personalized insights for ${student.full_name}` : 'Loading...'}
          </Text>
        </div>

        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            showIcon
            closable
            onClose={() => setAlert(null)}
            style={{ marginBottom: 24, borderRadius: 8 }}
          />
        )}

        {/* Filters */}
        <Card style={{ marginBottom: 24, borderRadius: 12 }}>
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CalendarOutlined style={{ color: '#666' }} />
                <Text strong style={{ minWidth: 80 }}>Date Range:</Text>
                <RangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  style={{ flex: 1 }}
                />
              </div>
            </Col>
            <Col xs={24} md={12}>
              <Space>
                <Button 
                  type="primary"
                  onClick={() => {
                    if (dateRange && dateRange[0] && dateRange[1]) {
                      fetchAttendanceData();
                    } else {
                      message.warning('Please select a date range before loading data');
                    }
                  }}
                  disabled={!dateRange || !dateRange[0] || !dateRange[1]}
                  loading={dataLoading}
                >
                  {dataLoading ? 'Loading...' : 'Load Data'}
                </Button>
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={() => exportData('daily')}
                  disabled={!analytics.dailyStats.length}
                  type="primary"
                  ghost
                >
                  Export Daily
                </Button>
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={() => exportData('weekly')}
                  disabled={!analytics.weeklyStats.length}
                  type="primary"
                  ghost
                >
                  Export Weekly
                </Button>
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={() => exportData('monthly')}
                  disabled={!analytics.monthlyStats.length}
                  type="primary"
                  ghost
                >
                  Export Monthly
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Overview Statistics */}
        {attendanceData.length === 0 && !dataLoading ? (
          <Card style={{ marginBottom: '32px' }}>
            <EmptyState
              type="analytics"
              title="No attendance data yet"
              description="Load your attendance data to see your personal analytics and progress."
              icon="📊"
              actionText="Load Data"
              onAction={() => {
                // Trigger the load data action
                const loadButton = document.querySelector('[data-testid="load-data-button"]');
                if (loadButton) {
                  loadButton.click();
                }
              }}
            />
          </Card>
        ) : (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={12} md={6}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Total Days</Text>}
                value={analytics.totalDays}
                prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ fontSize: '28px', fontWeight: 600, color: '#1f2937' }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Present</Text>}
                value={analytics.presentCount}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ fontSize: '28px', fontWeight: 600, color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Absent</Text>}
                value={analytics.absentCount}
                prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ fontSize: '28px', fontWeight: 600, color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Late</Text>}
                value={analytics.lateCount}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ fontSize: '28px', fontWeight: 600, color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Attendance Rate</Text>}
                value={analytics.attendanceRate}
                suffix="%"
                prefix={<RiseOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', position: 'relative' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Current Streak</Text>}
                value={analytics.streakDays}
                suffix="days"
                prefix={<FireOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#fa8c16' }}
              />
              {analytics.streakDays > 0 && (
                <Badge 
                  count={getStreakBadge(analytics.streakDays).text}
                  style={{ 
                    backgroundColor: getStreakBadge(analytics.streakDays).color,
                    position: 'absolute',
                    top: -8,
                    right: -8
                  }}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Best Streak</Text>}
                value={analytics.bestStreak}
                suffix="days"
                prefix={<TrophyOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>
        </>
        )}

        {/* Analytics Tabs */}
        <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
            <TabPane tab="Overview" key="overview">
              <Spin spinning={dataLoading} indicator={renderSkeleton()}>
                {analytics.dailyStats.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Row gutter={[24, 24]}>
                      <Col xs={24} md={12}>
                        <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                          <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                            Attendance Status Distribution
                          </Title>
                          <div style={{ height: 250 }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Pie
                                  data={analytics.statusDistribution}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  dataKey="value"
                                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {analytics.statusDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: '#fff', 
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} md={12}>
                        <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                          <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                            Recent Trends (Last 7 Days)
                          </Title>
                          <div style={{ height: 250 }}>
                            <ResponsiveContainer>
                              <LineChart data={analytics.trends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="date" stroke="#6b7280" />
                                <YAxis stroke="#6b7280" />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: '#fff', 
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                  }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="rate" 
                                  stroke="#1890ff" 
                                  strokeWidth={3}
                                  dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
                                  name="Attendance Rate (%)"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                      <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                        Recent Attendance
                      </Title>
                      <Table
                        dataSource={attendanceData.slice(-10).map(r => ({ ...r, key: r.id }))}
                        columns={attendanceColumns}
                        pagination={false}
                        size="small"
                      />
                    </Card>
                  </Space>
                ) : (
                  <EmptyState
                    title="No attendance data"
                    description="No attendance data is available for the selected period. Try selecting a different date range."
                    icon="📅"
                  />
                )}
              </Spin>
            </TabPane>

            <TabPane tab="Weekly Analysis" key="weekly">
              <Spin spinning={dataLoading} indicator={renderSkeleton()}>
                {analytics.weeklyStats.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                      <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                        Weekly Attendance Trends
                      </Title>
                      <div style={{ height: 300 }}>
                        <ResponsiveContainer>
                          <AreaChart data={analytics.weeklyStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="week" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                              }}
                            />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="present" 
                              stackId="1" 
                              stroke={STATUS_COLORS.present} 
                              fill={STATUS_COLORS.present} 
                              fillOpacity={0.6}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="late" 
                              stackId="1" 
                              stroke={STATUS_COLORS.late} 
                              fill={STATUS_COLORS.late} 
                              fillOpacity={0.6}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="absent" 
                              stackId="1" 
                              stroke={STATUS_COLORS.absent} 
                              fill={STATUS_COLORS.absent} 
                              fillOpacity={0.6}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                      <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                        Weekly Attendance Rate
                      </Title>
                      <div style={{ height: 200 }}>
                        <ResponsiveContainer>
                          <LineChart data={analytics.weeklyStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="week" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="rate" 
                              stroke="#1890ff" 
                              strokeWidth={3}
                              dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
                              name="Attendance Rate (%)"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </Space>
                ) : (
                  <EmptyState
                    title="No weekly data"
                    description="No weekly attendance data is available. Make sure attendance has been marked for the selected period."
                    icon="📊"
                  />
                )}
              </Spin>
            </TabPane>

            <TabPane tab="Monthly Analysis" key="monthly">
              <Spin spinning={dataLoading} indicator={renderSkeleton()}>
                {analytics.monthlyStats.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                      <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                        Monthly Attendance Trends
                      </Title>
                      <div style={{ height: 300 }}>
                        <ResponsiveContainer>
                          <BarChart data={analytics.monthlyStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                              }}
                            />
                            <Legend />
                            <Bar dataKey="present" fill={STATUS_COLORS.present} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="late" fill={STATUS_COLORS.late} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="absent" fill={STATUS_COLORS.absent} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                      <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                        Monthly Summary
                      </Title>
                      <Table
                        dataSource={analytics.monthlyStats}
                        columns={[
                          { title: 'Month', dataIndex: 'month', key: 'month' },
                          { title: 'Present', dataIndex: 'present', key: 'present' },
                          { title: 'Absent', dataIndex: 'absent', key: 'absent' },
                          { title: 'Late', dataIndex: 'late', key: 'late' },
                          { title: 'Total', dataIndex: 'total', key: 'total' },
                          { 
                            title: 'Attendance Rate', 
                            dataIndex: 'rate', 
                            key: 'rate',
                            render: (value) => (
                              <div>
                                <Progress 
                                  percent={value} 
                                  size="small" 
                                  strokeColor={value >= 90 ? '#52c41a' : value >= 75 ? '#faad14' : '#ff4d4f'}
                                  showInfo={false}
                                />
                                <Text type="secondary" style={{ fontSize: '12px' }}>{value}%</Text>
                              </div>
                            )
                          }
                        ]}
                        pagination={false}
                        size="small"
                      />
                    </Card>
                  </Space>
                ) : (
                  <EmptyState
                    title="No monthly data"
                    description="No monthly attendance data is available. Make sure attendance has been marked for the selected period."
                    icon="📊"
                  />
                )}
              </Spin>
            </TabPane>

            <TabPane tab="Detailed Records" key="records">
              <Spin spinning={dataLoading} indicator={renderSkeleton()}>
                {attendanceData.length > 0 ? (
                  <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                    <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                      All Attendance Records
                    </Title>
                    <Table
                      dataSource={attendanceData.map(r => ({ ...r, key: r.id }))}
                      columns={attendanceColumns}
                      pagination={{ 
                        pageSize: 15,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`
                      }}
                      size="small"
                    />
                  </Card>
                ) : (
                  <EmptyState
                    title="No attendance records"
                    description="No attendance records are available. Make sure attendance has been marked for your class."
                    icon="📋"
                  />
                )}
              </Spin>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default StudentAnalytics;
