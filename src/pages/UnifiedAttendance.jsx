import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  DatePicker,
  Space,
  Typography,
  Tag,
  message,
  Row,
  Col,
  Statistic,
  Progress,
  Modal,
  Form,
  Radio,
  Empty
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text } = Typography;
const { Option } = Select;

const UnifiedAttendance = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedClass, setSelectedClass] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const userRole = user?.app_metadata?.role || 'student';
  const schoolCode = user?.user_metadata?.school_code;

  const canMarkAttendance = ['superadmin', 'admin'].includes(userRole);

  useEffect(() => {
    if (schoolCode) {
      fetchClasses();
    }
  }, [schoolCode]);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      fetchAttendanceData();
      fetchStudents();
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      message.error('Failed to fetch classes');
    }
  };

  const fetchStudents = async () => {
    if (!selectedClass) return;
    
    try {
      const { data, error } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', selectedClass)
        .eq('school_code', schoolCode)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      message.error('Failed to fetch students');
    }
  };

  const fetchAttendanceData = async () => {
    if (!selectedClass || !selectedDate) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          student_id,
          status,
          date,
          student:student(full_name, student_code)
        `)
        .eq('class_instance_id', selectedClass)
        .eq('date', selectedDate.format('YYYY-MM-DD'))
        .eq('school_code', schoolCode);

      if (error) throw error;
      setAttendanceData(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      message.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (studentId, status) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .upsert({
          student_id: studentId,
          class_instance_id: selectedClass,
          status: status,
          date: selectedDate.format('YYYY-MM-DD'),
          marked_by: user.id,
          marked_by_role_code: userRole,
          school_code: schoolCode
        }, {
          onConflict: 'student_id,date'
        });

      if (error) throw error;
      
      message.success('Attendance marked successfully');
      fetchAttendanceData();
    } catch (error) {
      console.error('Error marking attendance:', error);
      message.error('Failed to mark attendance');
    }
  };

  const getAttendanceStatus = (studentId) => {
    const record = attendanceData.find(a => a.student_id === studentId);
    return record?.status || 'not_marked';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'success';
      case 'absent':
        return 'error';
      case 'late':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return <CheckCircleOutlined />;
      case 'absent':
        return <CloseCircleOutlined />;
      case 'late':
        return <ClockCircleOutlined />;
      default:
        return <UserOutlined />;
    }
  };

  const calculateStats = () => {
    const total = students.length;
    const present = attendanceData.filter(a => a.status === 'present').length;
    const absent = attendanceData.filter(a => a.status === 'absent').length;
    const late = attendanceData.filter(a => a.status === 'late').length;
    const notMarked = total - (present + absent + late);

    return { total, present, absent, late, notMarked };
  };

  const stats = calculateStats();

  const columns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <div>
          <Text strong>{record.full_name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.student_code}
          </Text>
        </div>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const status = getAttendanceStatus(record.id);
        return (
          <Tag 
            color={getStatusColor(status)} 
            icon={getStatusIcon(status)}
          >
            {status === 'not_marked' ? 'Not Marked' : status.toUpperCase()}
          </Tag>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        canMarkAttendance ? (
          <Space>
            <Button
              size="small"
              type={getAttendanceStatus(record.id) === 'present' ? 'primary' : 'default'}
              onClick={() => handleMarkAttendance(record.id, 'present')}
            >
              Present
            </Button>
            <Button
              size="small"
              type={getAttendanceStatus(record.id) === 'absent' ? 'primary' : 'default'}
              danger={getAttendanceStatus(record.id) === 'absent'}
              onClick={() => handleMarkAttendance(record.id, 'absent')}
            >
              Absent
            </Button>
            <Button
              size="small"
              type={getAttendanceStatus(record.id) === 'late' ? 'primary' : 'default'}
              onClick={() => handleMarkAttendance(record.id, 'late')}
            >
              Late
            </Button>
          </Space>
        ) : (
          <Text type="secondary">View Only</Text>
        )
      )
    }
  ];

  return (
    <div style={{ padding: '24px', background: antdTheme.token.colorBgLayout, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, color: antdTheme.token.colorText }}>
          Attendance Management
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          {canMarkAttendance ? 'Mark and track student attendance' : 'View your attendance records'}
        </Text>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>Class: </Text>
          </Col>
          <Col>
            <Select
              style={{ width: 200 }}
              placeholder="Select Class"
              value={selectedClass}
              onChange={setSelectedClass}
            >
              {classes.map(cls => (
                <Option key={cls.id} value={cls.id}>
                  Grade {cls.grade} - {cls.section}
                </Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Text strong>Date: </Text>
          </Col>
          <Col>
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col>
            <Button
              type="primary"
              onClick={fetchAttendanceData}
              disabled={!selectedClass || !selectedDate}
            >
              Load Attendance
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Statistics */}
      {selectedClass && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Students"
                value={stats.total}
                prefix={<TeamOutlined />}
                valueStyle={{ color: antdTheme.token.colorPrimary }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Present"
                value={stats.present}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: antdTheme.token.colorSuccess }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Absent"
                value={stats.absent}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: antdTheme.token.colorError }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Attendance Rate"
                value={stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}
                suffix="%"
                prefix={<CalendarOutlined />}
                valueStyle={{ color: antdTheme.token.colorInfo }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Attendance Table */}
      <Card>
        {!selectedClass ? (
          <Empty
            description="Please select a class to view attendance"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={students}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} students`
            }}
            locale={{
              emptyText: (
                <Empty
                  description="No students found for this class"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default UnifiedAttendance;