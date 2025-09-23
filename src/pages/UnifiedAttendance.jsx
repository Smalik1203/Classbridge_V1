import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Tabs, Alert, Select, DatePicker, Table, Typography, Space, Button, Row, Col, Skeleton, Empty, Tag, Progress, message
} from 'antd';
import dayjs from 'dayjs';
import { supabase } from '../config/supabaseClient';
import { AttendanceTag } from '../components/AttendanceStatusIndicator';
import { 
  getAttendanceColor
} from '../utils/attendanceColors';

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_OPTIONS = ['present', 'absent'];

const StatusPillToggle = ({ studentId, value, onChange, disabled }) => {
  const presentActive = value === 'present';
  const absentActive = value === 'absent';
  
  return (
    <Space size={4}>
      <Button
        size="small"
        disabled={disabled}
        onClick={() => onChange('present')}
        style={{
          backgroundColor: presentActive ? '#22c55e' : '#f1f5f9',
          borderColor: presentActive ? '#22c55e' : '#e2e8f0',
          color: presentActive ? '#fff' : '#64748b',
          fontWeight: '500',
          width: 28,
          height: 24,
          borderRadius: 12,
          fontSize: '12px',
          padding: 0,
          border: '1px solid',
          minWidth: 'auto'
        }}
      >
        🟢
      </Button>
      <Button
        size="small"
        disabled={disabled}
        onClick={() => onChange('absent')}
        style={{
          backgroundColor: absentActive ? '#ef4444' : '#f1f5f9',
          borderColor: absentActive ? '#ef4444' : '#e2e8f0',
          color: absentActive ? '#fff' : '#64748b',
          fontWeight: '500',
          width: 28,
          height: 24,
          borderRadius: 12,
          fontSize: '12px',
          padding: 0,
          border: '1px solid',
          minWidth: 'auto'
        }}
      >
        🔴
      </Button>
    </Space>
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

  const isStudent = role === 'student';
  const canMark = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        setUser(u);
        const r = u.app_metadata?.role || u.user_metadata?.role || '';
        setRole(r);
        setSchoolCode(u.user_metadata?.school_code || '');
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
          const studentCode = user.user_metadata?.student_code;
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

    // If attendance already exists, show confirmation dialog
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
      return <Empty description="No students found for this class" style={{ padding: '40px 0' }} />;
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
    <div className="cb-container cb-section" style={{ minHeight: '100vh' }}>
      <style>
        {`
          .cb-attendance-student-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: var(--space-4);
          }
        `}
      </style>
      
      {/* Modern Header */}
      <div className="cb-dashboard-header">
        <div className="cb-text-center">
          <h1 className="cb-heading-2 cb-mb-2">
            ✅ Attendance Management
          </h1>
          <p className="cb-text-caption">
            {isStudent ? 'View your attendance record and patterns' : 'Mark and track student attendance'}
          </p>
        </div>
      </div>

      <div className="cb-card">
        <div className="cb-card-body">
        {alert && (
          <div className={`cb-alert cb-alert-${alert.type} cb-mb-6`}>
            <div className="cb-alert-icon">
              {alert.type === 'error' ? '⚠️' : alert.type === 'success' ? '✅' : 'ℹ️'}
            </div>
            <div className="cb-alert-content">
              <div>{alert.message}</div>
            </div>
          </div>
        )}

        <Tabs 
          activeKey={isStudent ? 'view' : activeTab} 
          onChange={setActiveTab} 
          size="large"
          className="cb-tabs"
        >
          {!isStudent && (
            <Tabs.TabPane tab="📝 Mark Attendance" key="mark">
              {/* Modern Controls */}
              <div className="cb-card cb-mb-6">
                <div className="cb-card-body">
                  <div className="cb-form-row">
                    <div className="cb-form-group">
                      <label className="cb-label">Class</label>
                      {classesLoading ? (
                        <div className="cb-skeleton" style={{ height: '48px', borderRadius: 'var(--radius-lg)' }}></div>
                      ) : (
                        <Select
                          placeholder="Select Class"
                          value={selectedClassId}
                          onChange={setSelectedClassId}
                          className="cb-input"
                          size="large"
                          allowClear
                        >
                          {classInstances.map(c => (
                            <Option key={c.id} value={c.id}>
                              Grade {c.grade} - Section {c.section}
                            </Option>
                          ))}
                        </Select>
                      )}
                    </div>
                    
                    <div className="cb-form-group">
                      <label className="cb-label">Date</label>
                      <DatePicker 
                        value={date}
                        onChange={setDate}
                        className="cb-input"
                        style={{ width: '100%' }}
                        size="large"
                        format="DD/MM/YYYY"
                      />
                    </div>
                  </div>
                </div>
              </div>


              {selectedClassId && (
                <>
                  {/* Progress & Bulk Actions */}
                  <div className="cb-card cb-mb-6">
                    <div className="cb-card-body">
                      <div className="cb-flex cb-justify-between cb-items-center cb-mb-4">
                        <div>
                          <h4 className="cb-heading-5 cb-mb-2">
                            Attendance Progress ({progressStats.total} students)
                          </h4>
                          <p className="cb-text-caption">
                            {progressStats.unmarked > 0 
                              ? `${progressStats.marked} marked • ${progressStats.unmarked} unmarked`
                              : '✅ All students marked'
                            }
                          </p>
                        </div>
                        
                        <div className="cb-flex cb-gap-3">
                          <button 
                            className="cb-button cb-button-sm cb-button-success"
                            onClick={() => markAll('present')}
                          >
                            ✅ All Present
                          </button>
                          <button 
                            className="cb-button cb-button-sm cb-button-danger"
                            onClick={() => markAll('absent')}
                          >
                            ❌ All Absent
                          </button>
                          <button 
                            className="cb-button cb-button-sm cb-button-ghost"
                            onClick={resetAttendance}
                          >
                            🔄 Reset
                          </button>
                        </div>
                      </div>
                      
                      <div className="cb-progress cb-mb-3">
                        <div 
                          className="cb-progress-bar"
                          style={{ width: `${progressStats.percentage}%` }}
                        ></div>
                      </div>
                      
                      <div className="cb-flex cb-gap-6">
                        <div className="cb-flex cb-items-center cb-gap-2">
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: 'var(--color-success-500)' 
                          }}></div>
                          <span className="cb-text-caption">Present: {progressStats.marked - (attendance ? Object.values(attendance).filter(s => s === 'absent').length : 0)}</span>
                        </div>
                        <div className="cb-flex cb-items-center cb-gap-2">
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: 'var(--color-error-500)' 
                          }}></div>
                          <span className="cb-text-caption">Absent: {attendance ? Object.values(attendance).filter(s => s === 'absent').length : 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Attendance Grid */}
                  <div className="cb-card cb-mb-6">
                    <div className="cb-card-body">
                      {studentsLoading ? (
                        <div className="cb-attendance-student-grid">
                          {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="cb-skeleton" style={{ height: '60px', borderRadius: 'var(--radius-xl)' }}></div>
                          ))}
                        </div>
                      ) : students.length === 0 ? (
                        <div className="cb-empty-state">
                          <div className="cb-empty-icon">👥</div>
                          <h3 className="cb-empty-title">No students found</h3>
                          <p className="cb-empty-description">
                            No students are assigned to this class.
                          </p>
                        </div>
                      ) : (
                        <div className="cb-attendance-grid">
                          {students.map((student) => (
                            <div key={student.id} className="cb-attendance-student">
                              <div>
                                <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-medium)' }}>
                                  {student.full_name}
                                </div>
                                <div className="cb-text-caption-sm">
                                  {student.student_code || student.id}
                                </div>
                              </div>
                              
                              <div className="cb-attendance-toggle">
                                <button
                                  className={`cb-attendance-button cb-attendance-present ${
                                    attendance[student.id] === 'present' ? 'active' : ''
                                  }`}
                                  onClick={() => setAttendance(a => ({ ...a, [student.id]: 'present' }))}
                                  disabled={!canMark}
                                  title="Mark Present"
                                >
                                  ✓
                                </button>
                                <button
                                  className={`cb-attendance-button cb-attendance-absent ${
                                    attendance[student.id] === 'absent' ? 'active' : ''
                                  }`}
                                  onClick={() => setAttendance(a => ({ ...a, [student.id]: 'absent' }))}
                                  disabled={!canMark}
                                  title="Mark Absent"
                                >
                                  ✗
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save Button */}
                  {selectedClassId && students.length > 0 && (
                    <div className="cb-card">
                      <div className="cb-card-body">
                        <div className="cb-flex cb-justify-center">
                          <button
                            className="cb-button cb-button-primary cb-button-lg"
                            onClick={handleSubmit}
                            disabled={!canMark || progressStats.unmarked > 0 || saving}
                            style={{ minWidth: '200px' }}
                          >
                            {saving ? (
                              <>
                                <div className="cb-spinner"></div>
                                <span>Saving...</span>
                              </>
                            ) : saveStatus === 'saved' ? (
                              <>
                                <span>✅</span>
                                <span>Saved</span>
                              </>
                            ) : saveStatus === 'error' ? (
                              <>
                                <span>❌</span>
                                <span>Failed</span>
                              </>
                            ) : (
                              <>
                                <span>💾</span>
                                <span>{hasExistingAttendance ? 'Resubmit Attendance' : 'Save Attendance'}</span>
                              </>
                            )}
                          </button>
                        </div>
                        
                        {progressStats.unmarked > 0 && (
                          <p className="cb-text-caption cb-text-center cb-mt-3">
                            Please mark all {progressStats.total} students before saving
                          </p>
                        )}
                        
                        {showResubmitConfirm && (
                          <div className="cb-alert cb-alert-warning cb-mt-4">
                            <div className="cb-alert-icon">⚠️</div>
                            <div className="cb-alert-content">
                              <div className="cb-alert-title">Confirm Resubmission</div>
                              <div>Attendance already exists for this date. Are you sure you want to resubmit?</div>
                              <div className="cb-flex cb-gap-2 cb-mt-3">
                                <button 
                                  className="cb-button cb-button-sm cb-button-primary"
                                  onClick={handleSubmit}
                                >
                                  Yes, Resubmit
                                </button>
                                <button 
                                  className="cb-button cb-button-sm cb-button-secondary"
                                  onClick={() => setShowResubmitConfirm(false)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Tabs.TabPane>
          )}

          <Tabs.TabPane tab="📊 View History" key="view">
            <div className="cb-card">
              <div className="cb-card-body">
                <div className="cb-form-row cb-mb-6">
                  <div className="cb-form-group">
                    <label className="cb-label">Date</label>
                    <DatePicker 
                      value={historyDate} 
                      onChange={setHistoryDate} 
                      className="cb-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  {!isStudent && (
                    <div className="cb-form-group">
                      <label className="cb-label">Class</label>
                      <Select
                        placeholder="Select Class"
                        value={selectedClassId}
                        onChange={setSelectedClassId}
                        className="cb-input"
                        style={{ width: '100%' }}
                        allowClear
                      >
                        {classInstances.map(c => (
                          <Option key={c.id} value={c.id}>
                            Grade {c.grade} - Section {c.section}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
                
                <div className="cb-flex cb-justify-center cb-mb-6">
                  <button 
                    className="cb-button cb-button-primary"
                    onClick={fetchHistory} 
                    disabled={!historyDate || !selectedClassId} 
                  >
                    {historyLoading ? (
                      <>
                        <div className="cb-spinner"></div>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>Fetch History</span>
                      </>
                    )}
                  </button>
                </div>

                {!historyDate || !selectedClassId ? (
                  <div className="cb-empty-state">
                    <div className="cb-empty-icon">📅</div>
                    <h3 className="cb-empty-title">Select Date and Class</h3>
                    <p className="cb-empty-description">
                      Choose a date and class to view attendance history
                    </p>
                  </div>
                ) : historyData.length === 0 && !historyLoading ? (
                  <div className="cb-empty-state">
                    <div className="cb-empty-icon">📊</div>
                    <h3 className="cb-empty-title">No Records Found</h3>
                    <p className="cb-empty-description">
                      No attendance records found for the selected date and class
                    </p>
                  </div>
                ) : (
                  <Table 
                    columns={historyColumns} 
                    dataSource={historyData} 
                    loading={historyLoading}
                    pagination={{ pageSize: 10, hideOnSinglePage: true }}
                    className="cb-table"
                  />
                )}
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
        </div>
      </div>
    </div>
  );
};

export default UnifiedAttendance;


