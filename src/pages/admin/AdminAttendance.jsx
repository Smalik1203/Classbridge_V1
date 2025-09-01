import React, { useEffect, useState } from 'react';
import {
  Card, Tabs, Alert, Select, DatePicker, Table, Typography, Space, Button, message, Spin, Tag
} from 'antd';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import dayjs from 'dayjs';
import { 
  getAttendanceColor, 
  getAttendanceTagColor, 
  getAttendanceDisplayText,
  getAttendanceCellStyle 
} from '../../utils/attendanceColors';
import { AttendanceTag } from '../../components/AttendanceStatusIndicator';

const { Title } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

const AdminAttendance = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('');
  const [activeTab, setActiveTab] = useState('mark');

  const [classInstances, setClassInstances] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(() => dayjs());
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const [historyDate, setHistoryDate] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);



  useEffect(() => {
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        setRole(data.user.user_metadata?.role);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .eq('class_teacher_id', user.id);
      setClassInstances(data || []);
    };
    fetchClasses();
  }, [user]);

  useEffect(() => {
    if (!selectedClassId) return;
    const fetchStudents = async () => {
      const { data } = await supabase
        .from('student')
        .select('id, full_name')
        .eq('class_instance_id', selectedClassId);
      setStudents(data || []);
      const defaultAttendance = {};
      (data || []).forEach(s => defaultAttendance[s.id] = 'present');
      setAttendance(defaultAttendance);
    };
    fetchStudents();
  }, [selectedClassId]);

  const markAll = (status) => {
    const updated = {};
    students.forEach(s => updated[s.id] = status);
    setAttendance(updated);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setAlert(null);
    const marked_by = user?.id;
    const school_code = user?.user_metadata?.school_code;
    const roleCode = user?.user_metadata?.admin_code || user?.user_metadata?.super_admin_code || '';

    const records = students.map(student => ({
      student_id: student.id,
      class_instance_id: selectedClassId,
      date: date.format('YYYY-MM-DD'),
      status: attendance[student.id],
      marked_by,
      marked_by_role_code: roleCode,
      school_code,
    }));

    const { error } = await supabase.from('attendance').insert(records);
    if (error) {
      setAlert({ type: 'error', message: error.message });
    } else {
      setAlert({ type: 'success', message: 'Attendance submitted successfully' });
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    if (!historyDate) return;
    setHistoryLoading(true);
    let query = supabase
      .from('attendance')
      .select('id, student_id, date, status')
      .eq('class_instance_id', selectedClassId)
      .eq('date', historyDate.format('YYYY-MM-DD'));
    const { data } = await query.order('date', { ascending: false });
    setHistoryData(data || []);
    setHistoryLoading(false);
  };



  const attendanceColumns = [
    {
      title: 'Student Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (_, record) => record.full_name,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (_, record) => {
        const currentStatus = attendance[record.id] || 'present';
        const colors = getAttendanceColor(currentStatus);
        
        return (
          <Select
            value={currentStatus}
            onChange={val => setAttendance(a => ({ ...a, [record.id]: val }))}
            style={{ 
              width: 120,
              backgroundColor: colors.light,
              borderColor: colors.border
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
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <Card style={{ maxWidth: 1000, margin: '0 auto', borderRadius: 12 }}>
        <Title level={3} style={{ color: '#1e293b' }}>Attendance Management</Title>
        <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
          <TabPane tab="Mark Attendance" key="mark">
            {alert && (
              <Alert type={alert.type} message={alert.message} showIcon style={{ marginBottom: 16 }} />
            )}
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="Select Class"
                value={selectedClassId}
                onChange={val => setSelectedClassId(val)}
                style={{ width: '100%' }}
              >
                {classInstances.map(c => (
                  <Option key={c.id} value={c.id}>
                    Grade {c.grade} - Section {c.section}
                  </Option>
                ))}
              </Select>
              <DatePicker value={date} onChange={setDate} style={{ width: '100%' }} />
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
              <Table
                dataSource={students.map(s => ({ ...s, key: s.id }))}
                columns={attendanceColumns}
                pagination={false}
                bordered
              />
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={loading}
                style={{ borderRadius: 8 }}
              >
                Submit Attendance
              </Button>
            </Space>
          </TabPane>

          <TabPane tab="View History" key="view">
            <Space direction="vertical" style={{ width: '100%' }}>
              <DatePicker
                value={historyDate}
                onChange={setHistoryDate}
                style={{ width: '100%' }}
              />
              <Button type="primary" onClick={fetchHistory}>Fetch History</Button>
              {historyLoading ? <Spin /> : (
                <Table
                  dataSource={historyData.map(r => ({
                    ...r,
                    key: r.id,
                    student: students.find(s => s.id === r.student_id)?.full_name || r.student_id,
                  }))}
                  columns={[
                    { title: 'Date', dataIndex: 'date' },
                    { title: 'Student', dataIndex: 'student' },
                    { 
                      title: 'Status', 
                      dataIndex: 'status',
                      render: (status) => <AttendanceTag status={status} />
                    }
                  ]}
                  bordered
                />
              )}
            </Space>
          </TabPane>




          <TabPane tab="Analytics" key="analytics">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <h3>Analytics Dashboard</h3>
              <p>For comprehensive attendance analytics and insights, please visit the dedicated Analytics page.</p>
              <Button type="primary" onClick={() => window.location.href = '/analytics'}>
                Go to Analytics
              </Button>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default AdminAttendance;
