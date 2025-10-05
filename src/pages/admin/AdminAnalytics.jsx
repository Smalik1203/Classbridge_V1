import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Tabs, Select, DatePicker, Button, Typography, Space, Row, Col, Statistic, 
  Alert, Spin, Table, Progress, Divider, Empty, Skeleton, message
} from 'antd';
import EmptyState from '../../ui/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { 
  CalendarOutlined, TeamOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, ClockCircleOutlined, RiseOutlined,
  DownloadOutlined, FilterOutlined, EyeOutlined, ReloadOutlined
} from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { AttendanceTag } from '../../components/AttendanceStatusIndicator';
import { getAttendanceChartColors } from '../../utils/attendanceColors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

const AdminAnalytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Data state
  const [classInstances, setClassInstances] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [students, setStudents] = useState([]);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('class_instances')
          .select('id, grade, section')
          .eq('class_teacher_id', user.id);
        
        if (error) throw error;
        
        setClassInstances(data || []);
      } catch (err) {
        setAlert({ type: 'error', message: 'Failed to load classes. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, [user]);

  // Fetch students for selected class
  const fetchStudents = async () => {
    if (!selectedClassId) return;
    
    setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', selectedClassId)
        .order('full_name');
      
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to load students. Please try again.' });
    } finally {
      setDataLoading(false);
    }
  };

  // Fetch attendance data
  const fetchAttendanceData = async () => {
    if (!selectedClassId || !dateRange) return;
    
    setDataLoading(true);
    try {
      const [startDate, endDate] = dateRange;
      const { data, error } = await supabase
        .from('attendance')
        .select('id, student_id, date, status')
        .eq('class_instance_id', selectedClassId)
        .gte('date', startDate.format('YYYY-MM-DD'))
        .lte('date', endDate.format('YYYY-MM-DD'))
        .order('date', { ascending: true });

      if (error) throw error;
      setAttendanceData(data || []);
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to load attendance data. Please try again.' });
    } finally {
      setDataLoading(false);
    }
  };

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!attendanceData.length || !students.length) {
      return {
        totalRecords: 0,
        totalStudents: students.length,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        attendanceRate: 0,
        averageAttendanceRate: 0,
        dailyStats: [],
        studentStats: [],
        statusDistribution: []
      };
    }

    const totalRecords = attendanceData.length;
    const totalStudents = students.length;
    const presentCount = attendanceData.filter(r => r.status === 'present').length;
    const absentCount = attendanceData.filter(r => r.status === 'absent').length;
    const lateCount = attendanceData.filter(r => r.status === 'late').length;
    const attendanceRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 100) : 0;

    // Daily statistics
    const dailyStats = [];
    const dateMap = new Map();
    
    attendanceData.forEach(record => {
      const date = record.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { present: 0, absent: 0, late: 0 });
      }
      const stats = dateMap.get(date);
      stats[record.status]++;
    });

    dateMap.forEach((stats, date) => {
      const total = stats.present + stats.absent + stats.late;
      dailyStats.push({
        date: dayjs(date).format('MMM DD'),
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        total,
        rate: total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : 0
      });
    });

    // Sort daily stats by date
    dailyStats.sort((a, b) => dayjs(a.date, 'MMM DD').diff(dayjs(b.date, 'MMM DD')));

    // Student statistics
    const studentStats = students.map(student => {
      const studentRecords = attendanceData.filter(r => r.student_id === student.id);
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

    // Status distribution
    const statusDistribution = [
      { name: 'Present', value: presentCount, color: '#52c41a' },
      { name: 'Absent', value: absentCount, color: '#ff4d4f' },
      { name: 'Late', value: lateCount, color: '#faad14' }
    ].filter(item => item.value > 0);

    // Calculate average attendance rate
    const totalStudentDays = students.length * dailyStats.length;
    const averageAttendanceRate = totalStudentDays > 0 ? 
      Math.round(((presentCount + lateCount) / totalStudentDays) * 100) : 0;

    return {
      totalRecords,
      totalStudents,
      presentCount,
      absentCount,
      lateCount,
      attendanceRate,
      averageAttendanceRate,
      dailyStats,
      studentStats,
      statusDistribution
    };
  }, [attendanceData, students]);

  // Export functions
  const exportData = (type) => {
    const [startDate, endDate] = dateRange;
    const filename = `attendance_analytics_${type}_${startDate.format('YYYYMMDD')}_${endDate.format('YYYYMMDD')}.csv`;
    
    let csvContent = '';
    
    if (type === 'daily') {
      csvContent = 'Date,Present,Absent,Late,Total,Attendance Rate\n';
      analytics.dailyStats.forEach(day => {
        csvContent += `${day.date},${day.present},${day.absent},${day.late},${day.total},${day.rate}%\n`;
      });
    } else if (type === 'students') {
      csvContent = 'Student Name,Student Code,Total Days,Present,Absent,Late,Attendance Rate\n';
      analytics.studentStats.forEach(student => {
        csvContent += `${student.name},${student.code},${student.total},${student.present},${student.absent},${student.late},${student.rate}%\n`;
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

  const studentColumns = [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: '500' }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.code}</Text>
        </div>
      )
    },
    {
      title: 'Total Days',
      dataIndex: 'total',
      key: 'total',
      sorter: (a, b) => a.total - b.total,
      render: (value) => <Text strong>{value}</Text>
    },
    {
      title: 'Present',
      dataIndex: 'present',
      key: 'present',
      render: (value) => <Text style={{ color: '#52c41a', fontWeight: '500' }}>{value}</Text>
    },
    {
      title: 'Absent',
      dataIndex: 'absent',
      key: 'absent',
      render: (value) => <Text style={{ color: '#ff4d4f', fontWeight: '500' }}>{value}</Text>
    },
    {
      title: 'Late',
      dataIndex: 'late',
      key: 'late',
      render: (value) => <Text style={{ color: '#faad14', fontWeight: '500' }}>{value}</Text>
    },
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
      ),
      sorter: (a, b) => a.rate - b.rate
    }
  ];

  const STATUS_COLORS = getAttendanceChartColors();

  const renderSkeleton = () => (
    <div style={{ padding: '20px' }}>
      <Skeleton active paragraph={{ rows: 4 }} />
      <Skeleton active paragraph={{ rows: 3 }} />
    </div>
  );

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
            Attendance Analytics
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Monitor and analyze class attendance patterns
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

        {/* Filter Bar */}
        <Card 
          style={{ 
            marginBottom: 24, 
            borderRadius: 8,
            background: '#fafafa',
            border: '1px solid #e5e7eb',
            boxShadow: 'none'
          }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={10} md={7}>
              <div>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 6 }}>
                  Class
                </Text>
                <Select
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  style={{ width: '100%' }}
                  placeholder="Choose class..."
                  loading={loading}
                  size="middle"
                >
                  {classInstances.map(cls => (
                    <Option key={cls.id} value={cls.id}>
                      Grade {cls.grade} - Section {cls.section}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col xs={24} sm={10} md={10}>
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
            <Col xs={24} sm={4} md={7} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8 }}>
              <Button 
                onClick={() => {
                  if (selectedClassId && dateRange && dateRange[0] && dateRange[1]) {
                    fetchStudents();
                    fetchAttendanceData();
                  } else {
                    message.warning('Please select both class and date range');
                  }
                }}
                disabled={!selectedClassId || !dateRange || !dateRange[0] || !dateRange[1]}
                loading={dataLoading}
                size="middle"
                style={{ marginTop: 18, minWidth: 80 }}
              >
                Refresh
              </Button>
              <Button 
                icon={<DownloadOutlined />} 
                onClick={() => exportData('daily')}
                disabled={!analytics.dailyStats.length}
                size="middle"
                style={{ marginTop: 18 }}
                title="Export Daily"
              />
              <Button 
                icon={<DownloadOutlined />} 
                onClick={() => exportData('students')}
                disabled={!analytics.studentStats.length}
                size="middle"
                style={{ marginTop: 18 }}
                title="Export Students"
              />
            </Col>
          </Row>
        </Card>

        {/* Overview Statistics */}
        {attendanceData.length === 0 && !dataLoading ? (
          <Card style={{ marginBottom: '32px' }}>
            <EmptyState
              type="analytics"
              title="No attendance data yet"
              description="Load attendance data to see analytics and insights for your school."
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
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Total Records</Text>}
                value={analytics.totalRecords}
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
          <Col xs={24} md={12}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Overall Attendance Rate</Text>}
                value={analytics.attendanceRate}
                suffix="%"
                prefix={<RiseOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Statistic
                title={<Text style={{ fontSize: '14px', color: '#666' }}>Average Student Attendance</Text>}
                value={analytics.averageAttendanceRate}
                suffix="%"
                prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
        </>
        )}

        {/* Analytics Tabs */}
        <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
            <TabPane tab="Daily Trends" key="daily">
              <Spin spinning={dataLoading} indicator={renderSkeleton()}>
                {analytics.dailyStats.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                      <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                        Daily Attendance Trends
                      </Title>
                      <div style={{ height: 300 }}>
                        <ResponsiveContainer>
                          <AreaChart data={analytics.dailyStats}>
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
                        Daily Attendance Rate
                      </Title>
                      <div style={{ height: 200 }}>
                        <ResponsiveContainer>
                          <LineChart data={analytics.dailyStats}>
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
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </Space>
                ) : (
                  <EmptyState
                    title="No attendance data"
                    description="No attendance data is available for the selected period. Try selecting a different date range or ensure attendance has been marked."
                    icon="📅"
                  />
                )}
              </Spin>
            </TabPane>

            <TabPane tab="Student Performance" key="students">
              <Spin spinning={dataLoading} indicator={renderSkeleton()}>
                {analytics.studentStats.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                      <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                        Student Attendance Distribution (Top 10)
                      </Title>
                      <div style={{ height: 300 }}>
                        <ResponsiveContainer>
                          <BarChart data={analytics.studentStats.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} stroke="#6b7280" />
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
                        Student Attendance Details
                      </Title>
                      <Table
                        dataSource={analytics.studentStats}
                        columns={studentColumns}
                        pagination={{ 
                          pageSize: 10,
                          showSizeChanger: true,
                          showQuickJumper: true,
                          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`
                        }}
                        size="small"
                        scroll={{ x: 800 }}
                      />
                    </Card>
                  </Space>
                ) : (
                  <EmptyState
                    title="No student data"
                    description="No student attendance data is available. Make sure students are enrolled and attendance has been marked."
                    icon="👥"
                    actionText="Go to Students"
                    onAction={() => {
                      window.location.href = '/students';
                    }}
                  />
                )}
              </Spin>
            </TabPane>

            <TabPane tab="Status Distribution" key="distribution">
              <Spin spinning={dataLoading} indicator={renderSkeleton()}>
                {analytics.statusDistribution.length > 0 ? (
                  <Row gutter={[24, 24]}>
                    <Col xs={24} md={12}>
                      <Card style={{ borderRadius: 8, border: 'none', backgroundColor: '#fafafa' }}>
                        <Title level={4} style={{ marginBottom: 24, color: '#1f2937' }}>
                          Attendance Status Distribution
                        </Title>
                        <div style={{ height: 300 }}>
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
                          Status Summary
                        </Title>
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                          {analytics.statusDistribution.map((status, index) => (
                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Space>
                                <div style={{ 
                                  width: 12, 
                                  height: 12, 
                                  borderRadius: '50%', 
                                  backgroundColor: status.color 
                                }} />
                                <Text style={{ fontWeight: '500', fontSize: '16px' }}>{status.name}</Text>
                              </Space>
                              <Text strong style={{ fontSize: '18px' }}>{status.value}</Text>
                            </div>
                          ))}
                          <Divider />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: '18px' }}>Total</Text>
                            <Text strong style={{ fontSize: '18px' }}>{analytics.totalRecords}</Text>
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                ) : (
                  <EmptyState
                    title="No distribution data"
                    description="No attendance distribution data is available. Load attendance data to see status distribution charts."
                    icon="📊"
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

export default AdminAnalytics;
