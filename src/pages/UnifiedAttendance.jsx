import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Tabs, Alert, Select, DatePicker, Table, Typography, Space, Button, Row, Col, Skeleton, Empty, Tag, Progress, message, Switch, Modal
} from 'antd';
import dayjs from 'dayjs';
import { supabase } from '../config/supabaseClient';
import { getUserRole, getSchoolCode, getStudentCode } from '../utils/metadata';
import { AttendanceTag } from '../components/AttendanceStatusIndicator';
import { 
  getAttendanceColor
} from '../utils/attendanceColors';
import EmptyState from '../ui/EmptyState';

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_OPTIONS = ['present', 'absent'];

const StatusPillToggle = ({ studentId, value, onChange, disabled }) => {
  const isPresent = value === 'present';
  const isAbsent = value === 'absent';
  const isUnmarked = !value;
  
  return (
    <div
      onClick={() => {
        if (disabled) return;
        if (isUnmarked) {
          onChange('present');
        } else if (isPresent) {
          onChange('absent');
        } else {
          onChange(null); // Unmark
        }
      }}
      style={{
        padding: '4px 8px',
        borderRadius: '6px',
        backgroundColor: isPresent ? '#dcfce7' : isAbsent ? '#fef2f2' : '#f8fafc',
        border: `1px solid ${isPresent ? '#22c55e' : isAbsent ? '#ef4444' : '#e2e8f0'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '60px',
        userSelect: 'none'
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.target.style.transform = 'scale(1.02)';
          e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = 'none';
        }
      }}
    >
      <Text style={{ 
        fontSize: '10px', 
        color: isPresent ? '#22c55e' : isAbsent ? '#ef4444' : '#64748b',
        fontWeight: '500',
        margin: 0
      }}>
        {isPresent ? '🟢 Present' : isAbsent ? '🔴 Absent' : '⚪ Unmarked'}
      </Text>
    </div>
  );
};

const UnifiedAttendance = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(''); // superadmin | admin | student
  const [schoolCode, setSchoolCode] = useState('');

  const [activeTab, setActiveTab] = useState('mark');

  const [classInstances, setClassInstances] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);

  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(() => dayjs());

  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // saving | saved | error

  const [historyDate, setHistoryDate] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [studentProfile, setStudentProfile] = useState(null);
  const [hasExistingAttendance, setHasExistingAttendance] = useState(false);
  const [showResubmitConfirm, setShowResubmitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const isStudent = role === 'student';
  const canMark = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        setUser(u);
        // Use comprehensive metadata extraction
        const r = getUserRole(u) || '';
        setRole(r);
        setSchoolCode(getSchoolCode(u) || '');
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setClassesLoading(true);
      try {
        if (isStudent) {
          // Fetch student profile to determine class
          const studentCode = getStudentCode(user);
          const query = supabase.from('student').select('id, full_name, class_instance_id, school_code, email');
          const { data: student, error } = await (studentCode ? query.eq('student_code', studentCode) : query.eq('email', user.email)).single();
          if (error) throw error;
          setStudentProfile(student);
          setSelectedClassId(student.class_instance_id);
          setSchoolCode(student.school_code || schoolCode);
        } else if (role === 'admin') {
          const { data, error } = await supabase
            .from('class_instances')
            .select('id, grade, section')
            .eq('class_teacher_id', user.id);
          if (error) throw error;
          setClassInstances(data || []);
        } else if (role === 'superadmin') {
          const { data, error } = await supabase
            .from('class_instances')
            .select('id, grade, section')
            .eq('school_code', schoolCode);
          if (error) throw error;
          setClassInstances(data || []);
        }
      } catch (err) {
        setAlert({ type: 'error', message: 'Failed to load classes. Please try again.' });
      } finally {
        setClassesLoading(false);
      }
    };
    load();
  }, [user, role, schoolCode, isStudent]);

  useEffect(() => {
    if (!selectedClassId) return;
    const fetchStudents = async () => {
      setStudentsLoading(true);
      setAlert(null);
      try {
        const { data, error } = await supabase
          .from('student')
          .select('id, full_name')
          .eq('class_instance_id', selectedClassId);
        if (error) throw error;
        setStudents(data || []);
        // Do not preselect any status; require explicit marking
        setAttendance({});
      } catch (err) {
        setAlert({ type: 'error', message: 'Failed to load students. Please try again.' });
      } finally {
        setStudentsLoading(false);
      }
    };
    fetchStudents();
  }, [selectedClassId]);

  // Fetch existing attendance when date or class changes
  useEffect(() => {
    if (!selectedClassId || !date || students.length === 0) return;
    
    const fetchExistingAttendance = async () => {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('student_id, status')
          .eq('class_instance_id', selectedClassId)
          .eq('date', date.format('YYYY-MM-DD'));
        
        if (error) throw error;
        
        // Create attendance object with existing data
        const existingAttendance = {};
        let hasExisting = false;
        if (data && data.length > 0) {
          hasExisting = true;
          data.forEach(record => {
            existingAttendance[record.student_id] = record.status;
          });
        }
        
        setAttendance(existingAttendance);
        setHasExistingAttendance(hasExisting);
        setSaveStatus(null);
        setAlert(hasExisting ? { 
          type: 'info', 
          message: 'Attendance already marked for this date. You can modify and resubmit.' 
        } : null);
      } catch (err) {
        // If fetch fails, start with empty attendance
        setAttendance({});
        console.error('Failed to fetch existing attendance:', err);
      }
    };
    
    fetchExistingAttendance();
  }, [selectedClassId, date, students]);

  const markAll = (status) => {
    const updated = {};
    students.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
  };

  const resetAttendance = () => {
    setAttendance({});
    setAlert(null);
    setSaveStatus(null);
    setShowResubmitConfirm(false);
  };

  const handleSubmit = async () => {
    if (!canMark) return;
    if (!selectedClassId || students.length === 0) {
      setAlert({ type: 'warning', message: 'Select a class with students before saving.' });
      return;
    }

    if (progressStats.unmarked > 0) {
      setAlert({ type: 'warning', message: `Please mark all students before saving. (${progressStats.unmarked} unmarked)` });
      return;
    }

    // Show confirmation modal with attendance summary
    setShowSubmitConfirm(true);
    return;
  };

  const confirmSubmit = async () => {
    setShowSubmitConfirm(false);

    // If attendance already exists, show resubmit confirmation dialog
    if (hasExistingAttendance && !showResubmitConfirm) {
      setShowResubmitConfirm(true);
      return;
    }

    setSaving(true);
    setSaveStatus('saving');
    setAlert(null);
    try {
      const marked_by = user?.id;
      const roleCode = user?.user_metadata?.admin_code || user?.user_metadata?.super_admin_code || '';
      const dateStr = date.format('YYYY-MM-DD');
      
      // First, delete existing records for this class and date
      await supabase
        .from('attendance')
        .delete()
        .eq('class_instance_id', selectedClassId)
        .eq('date', dateStr);
      
      // Then insert new records
      const records = students.map(s => ({
        student_id: s.id,
        class_instance_id: selectedClassId,
        date: dateStr,
        status: attendance[s.id],
        marked_by,
        marked_by_role_code: roleCode,
        school_code: schoolCode,
      }));

      const { error } = await supabase.from('attendance').insert(records);
      if (error) throw error;
      
      // Show success toast with class and date details
      const selectedClass = classInstances.find(c => c.id === selectedClassId);
      const classLabel = selectedClass ? `Grade ${selectedClass.grade} - Section ${selectedClass.section}` : 'Selected Class';
      const dateLabel = date.format('DD/MM/YYYY');
      
      message.success(`Attendance saved for ${classLabel} (${dateLabel})`, 4);
      setAlert({ type: 'success', message: 'Attendance saved successfully ✅' });
      setSaveStatus('saved');
      setShowResubmitConfirm(false);
      setHasExistingAttendance(true);
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      setAlert({ type: 'error', message: err?.message || 'Failed to save attendance.' });
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Render students in a compact grid layout
  const renderStudentGrid = () => {
    if (studentsLoading) {
      return (
        <div style={{ padding: '20px 0' }}>
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      );
    }
    
    if (students.length === 0) {
      return (
        <EmptyState
          title="No students found"
          description="No students are enrolled in this class. Add students to start marking attendance."
          icon="👥"
          actionText="+ Add Students"
          onAction={() => {
            // Navigate to students page or open add student modal
            window.location.href = '/students';
          }}
        />
      );
    }

    return (
      <div className="student-grid">
        {students.map((student) => (
          <div key={student.id} className="student-item">
            <span style={{ fontWeight: '500', color: '#1e293b' }}>{student.full_name}</span>
            <StatusPillToggle
              studentId={student.id}
              value={attendance[student.id]}
              disabled={!canMark}
              onChange={(val) => setAttendance(a => ({ ...a, [student.id]: val }))}
            />
          </div>
        ))}
      </div>
    );
  };

  const progressStats = useMemo(() => {
    if (!students || students.length === 0) return { unmarked: 0, marked: 0, total: 0, percentage: 0 };
    
    let unmarked = 0;
    for (const s of students) {
      if (!attendance[s.id]) unmarked++;
    }
    
    const marked = students.length - unmarked;
    const percentage = students.length > 0 ? Math.round((marked / students.length) * 100) : 0;
    
    return {
      unmarked,
      marked,
      total: students.length,
      percentage
    };
  }, [students, attendance]);

  const historyColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { 
      title: 'Student', dataIndex: 'student', key: 'student'
    },
    { 
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status) => {
        if (AttendanceTag) return <AttendanceTag status={status} />;
        const color = status === 'present' ? 'green' : 'red';
        const text = status === 'present' ? 'Present' : 'Absent';
        return <Tag color={color}>{text}</Tag>;
      }
    }
  ];

  const fetchHistory = async () => {
    if (!historyDate || !selectedClassId) return;
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select('id, student_id, date, status')
        .eq('class_instance_id', selectedClassId)
        .eq('date', historyDate.format('YYYY-MM-DD'));
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      const rows = (data || []).map(r => ({
        key: r.id,
        date: r.date,
        student: students.find(s => s.id === r.student_id)?.full_name || r.student_id,
        status: r.status
      }));
      setHistoryData(rows);
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to fetch attendance history.' });
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <style>
        {`
          .attendance-row-even { 
            background-color: #f8fafc !important; 
          }
          .attendance-row-odd { 
            background-color: #ffffff !important; 
          }
          .attendance-row-even:hover { 
            background-color: #f1f5f9 !important; 
          }
          .attendance-row-odd:hover { 
            background-color: #f8fafc !important; 
          }
          .ant-table-tbody > tr > td {
            padding: 6px 12px !important;
            font-size: 14px !important;
            line-height: 1.3 !important;
          }
          .ant-table-thead > tr > th {
            padding: 8px 12px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
          }
          .compact-table .ant-table-tbody > tr {
            height: 36px !important;
          }
          .student-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 8px 0;
          }
          .student-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-radius: 6px;
            background: #fff;
            border: 1px solid #e2e8f0;
            font-size: 13px;
            transition: all 0.2s ease;
          }
          .student-item:nth-child(odd) {
            background: #f8fafc;
          }
          .student-item:hover {
            background: #f1f5f9;
            border-color: #cbd5e1;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
        `}
      </style>
      <Card style={{ maxWidth: 1000, margin: '0 auto', borderRadius: 12 }}>
        <Title level={3} style={{ color: '#1e293b' }}>Attendance</Title>

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

        <Tabs activeKey={isStudent ? 'view' : activeTab} onChange={setActiveTab} size="large">
          {!isStudent && (
            <Tabs.TabPane tab="Mark Attendance" key="mark">
              <Card 
                size="small"
                style={{ marginBottom: 16, border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}
              >
                <Row gutter={16} align="middle">
                  <Col span={12}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ color: '#475569' }}>Class</Text>
                    </div>
                    {classesLoading ? (
                      <Skeleton.Input active style={{ width: '100%', height: 40 }} />
                    ) : (
                      <Select
                        placeholder="Select Class"
                        value={selectedClassId}
                        onChange={setSelectedClassId}
                        style={{ width: '100%' }}
                        size="large"
                        allowClear
                        notFoundContent="No classes available"
                      >
                        {classInstances.map(c => (
                          <Option key={c.id} value={c.id}>Grade {c.grade} - Section {c.section}</Option>
                        ))}
                      </Select>
                    )}
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ color: '#475569' }}>Date</Text>
                    </div>
                    <DatePicker 
                      value={date}
                      onChange={setDate}
                      style={{ width: '100%' }}
                      size="large"
                      format="DD/MM/YYYY"
                    />
                  </Col>
                </Row>
              </Card>


              {selectedClassId && (
                <Card size="small" style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 12 }}>
                    <Row justify="space-between" align="middle">
                      <Col flex="auto">
                        <Row align="middle" gutter={16}>
                          <Col>
                            <Text strong style={{ color: '#475569', fontSize: '15px' }}>
                              Students ({progressStats.total})
                            </Text>
                            {progressStats.total > 0 && (
                              <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
                                {progressStats.unmarked > 0 
                                  ? `${progressStats.marked} marked · ${progressStats.unmarked} unmarked`
                                  : '✅ All marked'
                                }
                              </Text>
                            )}
                          </Col>
                          <Col>
                            <Space size="small">
                              <Button 
                                onClick={() => markAll('present')}
                                size="small"
                                style={{
                                  backgroundColor: '#22c55e',
                                  borderColor: '#22c55e',
                                  color: '#fff',
                                  fontWeight: '500',
                                  borderRadius: 4,
                                  height: 28,
                                  fontSize: '12px',
                                  padding: '0 8px'
                                }}
                              >
                                🟢 All Present
                              </Button>
                              <Button 
                                onClick={() => markAll('absent')}
                                size="small"
                                style={{
                                  backgroundColor: '#ef4444',
                                  borderColor: '#ef4444',
                                  color: '#fff',
                                  fontWeight: '500',
                                  borderRadius: 4,
                                  height: 28,
                                  fontSize: '12px',
                                  padding: '0 8px'
                                }}
                              >
                                🔴 All Absent
                              </Button>
                              <Button 
                                onClick={resetAttendance}
                                size="small"
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  borderColor: '#e2e8f0',
                                  color: '#64748b',
                                  fontWeight: '500',
                                  borderRadius: 4,
                                  height: 28,
                                  fontSize: '12px',
                                  padding: '0 8px'
                                }}
                              >
                                🔄 Reset
                              </Button>
                            </Space>
                          </Col>
                        </Row>
                        {progressStats.total > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Progress 
                              percent={progressStats.percentage} 
                              size="small" 
                              strokeColor={progressStats.percentage === 100 ? '#22c55e' : '#1890ff'}
                              showInfo={false}
                              style={{ width: '200px' }}
                            />
                          </div>
                        )}
                      </Col>
                    </Row>
                  </div>
                  {renderStudentGrid()}
                </Card>
              )}

              {selectedClassId && students.length > 0 && (
                <div style={{ 
                  position: 'sticky', 
                  bottom: 0, 
                  backgroundColor: '#fff', 
                  padding: '12px 0', 
                  borderTop: '1px solid #e2e8f0', 
                  marginTop: 16 
                }}>
                  <Row justify="center">
                    <Col>
                      <Button
                        type="primary"
                        onClick={handleSubmit}
                        loading={saving}
                        disabled={!canMark || progressStats.unmarked > 0}
                        style={{ 
                          borderRadius: 6, 
                          minWidth: 160, 
                          height: 36, 
                          fontSize: '14px', 
                          fontWeight: '600' 
                        }}
                      >
                        {saveStatus === 'saving' && 'Saving...'}
                        {saveStatus === 'saved' && '✅ Saved'}
                        {saveStatus === 'error' && '❌ Failed'}
                        {!saveStatus && (hasExistingAttendance ? 'Resubmit Attendance' : 'Save Attendance')}
                      </Button>
                    </Col>
                  </Row>
                  {progressStats.unmarked > 0 && (
                    <div style={{ textAlign: 'center', marginTop: 6 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {progressStats.unmarked} students unmarked
                      </Text>
                    </div>
                  )}
                  {showResubmitConfirm && (
                    <div style={{ 
                      textAlign: 'center', 
                      marginTop: 8, 
                      padding: '8px 12px', 
                      backgroundColor: '#fff7ed', 
                      border: '1px solid #fed7aa', 
                      borderRadius: 6 
                    }}>
                      <Text style={{ fontSize: '12px', color: '#ea580c' }}>
                        Attendance already exists for this date. Are you sure you want to resubmit?
                      </Text>
                      <div style={{ marginTop: 6 }}>
                        <Space size="small">
                          <Button 
                            size="small" 
                            type="primary" 
                            onClick={handleSubmit}
                            style={{ fontSize: '11px', height: 24 }}
                          >
                            Yes, Resubmit
                          </Button>
                          <Button 
                            size="small" 
                            onClick={() => setShowResubmitConfirm(false)}
                            style={{ fontSize: '11px', height: 24 }}
                          >
                            Cancel
                          </Button>
                        </Space>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Tabs.TabPane>
          )}

          <Tabs.TabPane tab="View History" key="view">
            <Row gutter={[16, 16]} align="bottom">
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ color: '#475569' }}>Date</Text>
                </div>
                <DatePicker 
                  value={historyDate} 
                  onChange={setHistoryDate} 
                  style={{ width: '100%' }} 
                  size="large"
                  placeholder="Select date"
                />
              </Col>
              {!isStudent && (
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ color: '#475569' }}>Class</Text>
                  </div>
                  <Select
                    placeholder="Select Class"
                    value={selectedClassId}
                    onChange={setSelectedClassId}
                    style={{ width: '100%' }}
                    size="large"
                    allowClear
                    notFoundContent="No classes available"
                  >
                    {classInstances.map(c => (
                      <Option key={c.id} value={c.id}>Grade {c.grade} - Section {c.section}</Option>
                    ))}
                  </Select>
                </Col>
              )}
            </Row>
            <div style={{ marginTop: 12 }}>
              <Button type="primary" onClick={fetchHistory} disabled={!historyDate || !selectedClassId} loading={historyLoading}>
                {historyLoading ? 'Loading...' : 'Fetch History'}
              </Button>
            </div>

            {!historyDate || !selectedClassId ? (
              <EmptyState
                title="Select date and class"
                description="Choose a date and class to view attendance history and track student patterns."
                icon="📅"
                style={{ marginTop: 24 }}
              />
            ) : historyData.length === 0 && !historyLoading ? (
              <EmptyState
                title="No attendance records"
                description="No attendance has been marked for the selected date and class yet."
                icon="📊"
                style={{ marginTop: 24 }}
              />
            ) : (
              <Table columns={historyColumns} dataSource={historyData} style={{ marginTop: 16 }} />
            )}
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* Submit Confirmation Modal */}
      <Modal
        title="Confirm Attendance Submission"
        open={showSubmitConfirm}
        onOk={confirmSubmit}
        onCancel={() => setShowSubmitConfirm(false)}
        okText="Submit Attendance"
        cancelText="Cancel"
        okButtonProps={{ type: 'primary' }}
      >
        <div style={{ padding: '16px 0' }}>
          <Text strong style={{ fontSize: '16px', marginBottom: '16px', display: 'block' }}>
            Please review the attendance summary:
          </Text>
          
          <div style={{ 
            background: '#f8fafc', 
            padding: '16px', 
            borderRadius: '8px', 
            marginBottom: '16px' 
          }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#22c55e',
                    marginBottom: '4px'
                  }}>
                    {progressStats.marked - (Object.values(attendance).filter(status => status === 'absent').length)}
                  </div>
                  <Text style={{ color: '#22c55e', fontWeight: '500' }}>🟢 Present</Text>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#ef4444',
                    marginBottom: '4px'
                  }}>
                    {Object.values(attendance).filter(status => status === 'absent').length}
                  </div>
                  <Text style={{ color: '#ef4444', fontWeight: '500' }}>🔴 Absent</Text>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#64748b',
                    marginBottom: '4px'
                  }}>
                    {progressStats.total}
                  </div>
                  <Text style={{ color: '#64748b', fontWeight: '500' }}>👥 Total</Text>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Text strong>Class:</Text> {classInstances.find(c => c.id === selectedClassId)?.grade} - {classInstances.find(c => c.id === selectedClassId)?.section}
          </div>
          <div>
            <Text strong>Date:</Text> {date.format('MMMM DD, YYYY')}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UnifiedAttendance;


