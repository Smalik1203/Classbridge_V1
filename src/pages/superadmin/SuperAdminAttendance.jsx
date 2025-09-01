import React, { useEffect, useState } from 'react';
import {
  Card, Tabs, Select, DatePicker, Button, Typography, Table, Space, message, Row, Col, Tag, Empty
} from 'antd';
import { BookOutlined, CalendarOutlined } from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { Page, EmptyState } from '../../ui';
import dayjs from 'dayjs';
import { 
  getAttendanceColor, 
  getAttendanceTagColor, 
  getAttendanceDisplayText,
  getAttendanceCellStyle 
} from '../../utils/attendanceColors';
import { AttendanceTag } from '../../components/AttendanceStatusIndicator';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const SuperAdminAttendance = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [activeTab, setActiveTab] = useState('mark');

  const [classInstances, setClassInstances] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  const [loading, setLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        setUser(u);
        setRole(u.user_metadata?.role || '');
        setSchoolCode(u.user_metadata?.school_code || '');
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    if (!user || !schoolCode) return;
    async function fetchClasses() {
      const { data } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .eq('school_code', schoolCode);
      setClassInstances(data || []);
    }
    fetchClasses();
  }, [user, schoolCode]);

  useEffect(() => {
    if (!selectedClassId || !schoolCode) return;
    async function fetchStudents() {
      const { data } = await supabase
        .from('student')
        .select('id, full_name')
        .eq('class_instance_id', selectedClassId)
        .eq('school_code', schoolCode);
      setStudents(data || []);
      const defaultStatus = {};
      (data || []).forEach(s => { defaultStatus[s.id] = 'present'; });
      setAttendance(defaultStatus);
    }
    fetchStudents();
  }, [selectedClassId, schoolCode]);

  const markAll = (status) => {
    const updated = {};
    students.forEach((s) => { updated[s.id] = status; });
    setAttendance(updated);
  };


  const handleSubmit = async () => {
    if (!schoolCode || !selectedClassId || students.length === 0) return;
    setLoading(true);
    const marked_by = user?.id;
    const marked_by_role_code = user.user_metadata?.super_admin_code || '';
    const records = students.map(s => ({
      student_id: s.id,
      class_instance_id: selectedClassId,
      date,
      status: attendance[s.id],
      marked_by,
      marked_by_role_code,
      school_code: schoolCode
    }));

    const { error } = await supabase.from('attendance').insert(records);
    if (error) {
      message.error(error.message);
    } else {
      message.success('Attendance submitted!');
    }
    setLoading(false);
  };
  const userName = user?.user_metadata?.full_name;
  const fetchAttendanceHistory = async () => {
    if (!historyDate || !selectedClassId) return;
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select('id, date, student_id, status, marked_by, marked_by_role_code')
        .eq('school_code', schoolCode);
      if (selectedClassId) query = query.eq('class_instance_id', selectedClassId);
      if (historyDate) query = query.eq('date', historyDate.format('YYYY-MM-DD'));
      const { data } = await query.order('date', { ascending: false });
      setAttendanceHistory(data || []);
    } catch (error) {
      message.error('Failed to fetch attendance history');
    } finally {
      setHistoryLoading(false);
    }
  };





  const historyColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    {
      title: 'Student',
      dataIndex: 'student_id',
      key: 'student_id',
      render: (id) => {
        const student = students.find(s => s.id === id);
        return student ? student.full_name : id;
      }
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => <AttendanceTag status={status} />
    },
    { title: 'Marked by', dataIndex: 'marked_by_role_code', key: 'marked_by_role_code' },
  ];

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <Space align="center" style={{ marginBottom: 20 }}>
          <BookOutlined style={{ fontSize: 24 }} />
          <Title level={3} style={{ margin: 0 }}>School Attendance</Title>
        </Space>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="Mark Attendance" key="mark">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <label>Class</label>
                <Select
                  placeholder="Select Class"
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  style={{ width: '100%' }}
                >
                  {classInstances.map(cls => (
                    <Option key={cls.id} value={cls.id}>
                      Grade {cls.grade} - Section {cls.section}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={8}>
                <label>Date</label>
                <DatePicker
                  value={date ? dayjs(date) : null}
                  onChange={d => setDate(d.format('YYYY-MM-DD'))}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={8}>
                <label>Quick Actions</label>
                <Space>
                  <Button 
                    onClick={() => markAll('present')}
                    style={{
                      backgroundColor: getAttendanceColor('present').light,
                      borderColor: getAttendanceColor('present').border,
                      color: getAttendanceColor('present').text,
                      fontWeight: '500'
                    }}
                  >
                    All Present
                  </Button>
                  <Button 
                    onClick={() => markAll('absent')}
                    style={{
                      backgroundColor: getAttendanceColor('absent').light,
                      borderColor: getAttendanceColor('absent').border,
                      color: getAttendanceColor('absent').text,
                      fontWeight: '500'
                    }}
                  >
                    All Absent
                  </Button>
                  <Button 
                    onClick={() => markAll('late')}
                    style={{
                      backgroundColor: getAttendanceColor('late').light,
                      borderColor: getAttendanceColor('late').border,
                      color: getAttendanceColor('late').text,
                      fontWeight: '500'
                    }}
                  >
                    All Late
                  </Button>
                </Space>
              </Col>
            </Row>
            <Table
              dataSource={students.map(s => ({
                key: s.id,
                name: s.full_name,
                status: (
                  <Select
                    value={attendance[s.id] || 'present'}
                    onChange={(val) => setAttendance(a => ({ ...a, [s.id]: val }))}
                    style={{ 
                      width: 120,
                      backgroundColor: getAttendanceColor(attendance[s.id] || 'present').light,
                      borderColor: getAttendanceColor(attendance[s.id] || 'present').border
                    }}
                    dropdownStyle={{ zIndex: 1000 }}
                  >
                    <Option value="present" style={{ color: getAttendanceColor('present').primary, fontWeight: '500' }}>
                      Present
                    </Option>
                    <Option value="absent" style={{ color: getAttendanceColor('absent').primary, fontWeight: '500' }}>
                      Absent
                    </Option>
                    <Option value="late" style={{ color: getAttendanceColor('late').primary, fontWeight: '500' }}>
                      Late
                    </Option>
                  </Select>
                )
              }))}
              columns={[{ title: 'Student', dataIndex: 'name' }, { title: 'Status', dataIndex: 'status' }]}
              pagination={false}
              style={{ marginTop: 16 }}
            />
            <Button type="primary" loading={loading} onClick={handleSubmit} style={{ marginTop: 16 }}>
              Submit Attendance
            </Button>
          </Tabs.TabPane>

          <Tabs.TabPane tab="View History" key="view">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <label>Date</label>
                <DatePicker
                  value={historyDate}
                  onChange={setHistoryDate}
                  style={{ width: '100%' }}
                  placeholder="Select date"
                  allowClear={true}
                />
              </Col>
              <Col span={8}>
                <label>Class</label>
                <Select
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  style={{ width: '100%' }}
                  placeholder="Select Class"
                  allowClear={true}
                >
                  {classInstances.map(cls => (
                    <Option key={cls.id} value={cls.id}>
                      Grade {cls.grade} - Section {cls.section}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={8}>
                <label>&nbsp;</label>
                <Button 
                  type="primary" 
                  onClick={fetchAttendanceHistory} 
                  style={{ width: '100%' }}
                  disabled={!historyDate || !selectedClassId}
                  loading={historyLoading}
                >
                  {historyLoading ? 'Loading...' : 'Fetch History'}
                </Button>
              </Col>
            </Row>
            {!historyDate || !selectedClassId ? (
              <EmptyState
                icon={<CalendarOutlined />}
                title="Select Date and Class"
                description="Choose a date and class to view attendance history"
              />
            ) : attendanceHistory.length === 0 && !historyLoading ? (
              <EmptyState
                icon={<CalendarOutlined />}
                title="No Attendance History"
                description="No attendance records found for the selected date and class"
              />
            ) : (
              <Table
                columns={historyColumns}
                dataSource={attendanceHistory.map((r, i) => ({ key: i, ...r }))}
                style={{ marginTop: 16 }}
              />
            )}
          </Tabs.TabPane>



          <Tabs.TabPane tab="Analytics" key="analytics">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <h3>Analytics Dashboard</h3>
              <p>For comprehensive attendance analytics and insights, please visit the dedicated Analytics page.</p>
              <Button type="primary" onClick={() => window.location.href = '/analytics'}>
                Go to Analytics
              </Button>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default SuperAdminAttendance;
