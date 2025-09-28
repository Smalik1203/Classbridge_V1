import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card, Tabs, Alert, DatePicker, Table, Typography, Space, Segmented, Statistic, Row, Col, Tag, Button, Skeleton, Empty
} from 'antd';
import { supabase } from '../../config/supabaseClient';
import { getStudentCode } from '../../utils/metadata';
import { Page, EmptyState } from '../../ui';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';

dayjs.extend(weekOfYear);

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

// Import the centralized color system
import { 
  getAttendanceColor, 
  getAttendanceTagColor, 
  getAttendanceDisplayText,
  getAttendanceChartColors 
} from '../../utils/attendanceColors';
import { AttendanceTag } from '../../components/AttendanceStatusIndicator';
import { CalendarOutlined } from '@ant-design/icons';

// Consistent colors for charts and tags
const STATUS_COLORS = getAttendanceChartColors();

const StudentAttendance = () => {
  const [user, setUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true); // Single loading state for initial student fetch
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('view');

  // --- View Attendance State ---
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week' | 'month'
  const [viewDate, setViewDate] = useState(null);
  const [viewData, setViewData] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);



  // --- Initial Data Fetching ---
  useEffect(() => {
    const fetchUserAndStudent = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        setAlert({ type: 'error', message: 'You must be logged in to view this page.' });
        setLoading(false);
        return;
      }

      const studentCode = getStudentCode(user);
      const query = supabase.from('student').select('id, full_name, class_instance_id, school_code, student_code, email');
      const { data, error } = await (studentCode ? query.eq('student_code', studentCode) : query.eq('email', user.email)).single();

      if (error) {
        setAlert({ type: 'error', message: 'Could not find your student profile. Please contact support.' });
      } else {
        setStudent(data);
      }
      setLoading(false);
    };
    fetchUserAndStudent();
  }, []);

  // --- Data Fetching Callbacks ---
  const fetchViewData = useCallback(async () => {
    if (!viewDate || !student) return;
    setViewLoading(true);

    const from = viewDate.startOf(viewMode).format('YYYY-MM-DD');
    const to = viewDate.endOf(viewMode).format('YYYY-MM-DD');

    const { data, error } = await supabase
      .from('attendance')
      .select('id, date, status')
      .eq('student_id', student.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    if (error) setAlert({ type: 'error', message: error.message });
    
    // Create a map of existing attendance data
    const attendanceMap = new Map();
    (data || []).forEach(record => {
      attendanceMap.set(record.date, record);
    });

    // Generate all dates in the range and fill with attendance data or "No data"
    const allDates = [];
    let currentDate = dayjs(from);
    const endDate = dayjs(to);

    while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      const existingRecord = attendanceMap.get(dateStr);
      
      if (existingRecord) {
        allDates.push(existingRecord);
      } else {
        // Add a placeholder record for dates without data
        allDates.push({
          id: `no-data-${dateStr}`,
          date: dateStr,
          status: 'no-data',
          isPlaceholder: true
        });
      }
      
      currentDate = currentDate.add(1, 'day');
    }

    setViewData(allDates);
    setViewLoading(false);
  }, [student, viewDate, viewMode]);




  // Remove automatic fetching - now user must click "View Attendance" button
  // useEffect(() => {
  //   if (student) fetchViewData();
  // }, [student, fetchViewData]);


  // --- Memoized Calculations for Performance ---
  const calculateTotals = (data) => {
    // Filter out "no-data" records for statistics
    const validRecords = data.filter(r => r.status !== 'no-data');
    const total = validRecords.length;
    const present = validRecords.filter(r => r.status === 'present').length;
    const absent = validRecords.filter(r => r.status === 'absent').length;
    const late = validRecords.filter(r => r.status === 'late').length;
    const rate = total ? Math.round(((present + late) / total) * 100) : 0;
    
    // Count total days including no-data days
    const totalDays = data.length;
    const noDataDays = data.filter(r => r.status === 'no-data').length;
    
    return { total, present, absent, late, rate, totalDays, noDataDays };
  };

  const viewTotals = useMemo(() => calculateTotals(viewData), [viewData]);

  const barChartData = useMemo(() => {
    if (viewMode === 'day' || !viewDate) return [];
    
    const start = viewDate.startOf(viewMode);
    const end = viewDate.endOf(viewMode);
    const days = [];
    let current = start;

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      days.push({
        key: current.format('YYYY-MM-DD'),
        label: viewMode === 'week' ? current.format('ddd') : current.format('D'),
        present: 0,
        absent: 0,
        late: 0,
        noData: 0,
      });
      current = current.add(1, 'day');
    }

    const dayIndexMap = new Map(days.map((d, i) => [d.key, i]));
    for (const record of viewData) {
      const key = dayjs(record.date).format('YYYY-MM-DD');
      if (dayIndexMap.has(key)) {
        const index = dayIndexMap.get(key);
        if (record.status in days[index]) {
            days[index][record.status] += 1;
        }
      }
    }
    return days;
  }, [viewData, viewDate, viewMode]);




  // --- UI Helpers & Event Handlers ---
  const statusTag = (s) => <AttendanceTag status={s} />;
  
  const buildCsv = (rows, filename) => {
    const header = ['Date', 'Status'];
    const lines = rows.map(r => [dayjs(r.date).format('YYYY-MM-DD'), r.status]);
    const csvContent = [header, ...lines]
      .map(e => e.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportViewCsv = () => {
    if (!viewDate) return;
    
    const label =
      viewMode === 'day' ? viewDate.format('YYYY-MM-DD')
      : viewMode === 'week' ? `week_${viewDate.week()}_${viewDate.year()}`
      : viewDate.format('YYYY-MM');
    buildCsv(viewData, `attendance_${viewMode}_${label}.csv`);
  };
  


  const attendanceColumns = [
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      render: (d) => dayjs(d).format('DD MMM YYYY') 
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status', 
      render: (s, record) => {
        if (s === 'no-data') {
          return <Tag color="default">No data available</Tag>;
        }
        return statusTag(s);
      }
    }
  ];

  if (loading) {
      return (
          <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
            <Card style={{ maxWidth: 1000, margin: '0 auto', borderRadius: 12 }}>
                <Skeleton active />
            </Card>
          </div>
      )
  }

  // --- Render ---
  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <Card style={{ maxWidth: 1000, margin: '0 auto', borderRadius: 12 }}>
        <Title level={3} style={{ color: '#1e293b' }}>
          My Attendance {student ? `- ${student.full_name}` : ''}
        </Title>
        
        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            showIcon
            closable
            onClose={() => setAlert(null)}
            style={{ marginBottom: 16 }}
          />
        )}
        
        {!student && !loading && (
            <Text type="secondary">Student information could not be loaded.</Text>
        )}

        {student && (
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
            {/* ====== VIEW ATTENDANCE TAB ====== */}
            <TabPane tab="Daily View" key="view">
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Space wrap>
                  <Text strong>View By:</Text>
                  <Segmented
                    options={['Month', 'Week', 'Day']}
                    value={viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
                    onChange={(value) => setViewMode(value.toLowerCase())}
                  />
                  <DatePicker
                    picker={viewMode === 'day' ? 'date' : viewMode}
                    value={viewDate}
                    onChange={(d) => setViewDate(d)}
                    placeholder="Select date"
                    allowClear={true}
                  />
                  <Button 
                    type="primary" 
                    onClick={() => fetchViewData()}
                    disabled={!viewDate}
                    loading={viewLoading}
                  >
                    {viewLoading ? 'Loading...' : 'View Attendance'}
                  </Button>
                  <Button onClick={exportViewCsv} disabled={viewData.length === 0}>Export CSV</Button>
                </Space>

                {!viewDate ? (
                  <EmptyState
                    icon={<CalendarOutlined />}
                    title="Select Date"
                    description="Choose a date to view your attendance data"
                  />
                ) : viewData.length === 0 && !viewLoading ? (
                  <EmptyState
                    icon={<CalendarOutlined />}
                    title="No Attendance Data"
                    description="No attendance records found for the selected date"
                  />
                ) : (
                  <>
                    {viewMode !== 'day' && (
                      <Skeleton loading={viewLoading} active paragraph={{ rows: 2 }}>
                        <Card size="small" style={{ borderRadius: 10 }}>
                          <Row gutter={[16, 16]}>
                            <Col xs={12} md={4}><Statistic title="Total Days" value={viewTotals.totalDays} /></Col>
                            <Col xs={12} md={4}><Statistic title="Present" value={viewTotals.present} /></Col>
                            <Col xs={12} md={4}><Statistic title="Absent" value={viewTotals.absent} /></Col>
                            <Col xs={12} md={4}><Statistic title="Late" value={viewTotals.late} /></Col>
                            <Col xs={12} md={4}><Statistic title="Attendance Rate" value={viewTotals.rate} suffix="%" /></Col>
                          </Row>
                        </Card>
                      </Skeleton>
                    )}

                    {viewMode !== 'day' && (
                       <Skeleton loading={viewLoading} active paragraph={{ rows: 6 }}>
                        <Card size="small" style={{ borderRadius: 10 }}>
                          <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                              <BarChart data={barChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="present" stackId="a" name="Present" fill={STATUS_COLORS.present} />
                                <Bar dataKey="absent"  stackId="a" name="Absent"  fill={STATUS_COLORS.absent} />
                                <Bar dataKey="late"    stackId="a" name="Late"    fill={STATUS_COLORS.late} />
                                <Bar dataKey="noData"  stackId="a" name="No Data" fill={STATUS_COLORS.noData} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                       </Skeleton>
                    )}

                    <Table
                      loading={viewLoading}
                      dataSource={viewData.map(r => ({ ...r, key: r.id }))}
                      columns={attendanceColumns}
                      bordered
                      pagination={{ pageSize: 10, hideOnSinglePage: true }}
                    />
                  </>
                )}
              </Space>
            </TabPane>


          </Tabs>
        )}
      </Card>
    </div>
  );
};

export default StudentAttendance;