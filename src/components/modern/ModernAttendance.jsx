import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthProvider';
import { supabase } from '../../config/supabaseClient';

const ModernAttendance = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('mark'); // 'mark' or 'view'

  const userRole = user?.app_metadata?.role;
  const isStudent = userRole === 'student';
  const canMark = userRole === 'superadmin' || userRole === 'admin';

  useEffect(() => {
    loadClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
      loadExistingAttendance();
    }
  }, [selectedClass, selectedDate]);

  const loadClasses = async () => {
    try {
      const schoolCode = user?.user_metadata?.school_code;
      if (!schoolCode) return;

      let query = supabase.from('class_instances').select('id, grade, section');
      
      if (userRole === 'admin') {
        query = query.eq('class_teacher_id', user.id);
      } else if (userRole === 'superadmin') {
        query = query.eq('school_code', schoolCode);
      } else if (isStudent) {
        // For students, get their class
        const studentCode = user.user_metadata?.student_code;
        const studentQuery = supabase.from('student').select('class_instance_id');
        const { data: studentData } = await (studentCode ? 
          studentQuery.eq('student_code', studentCode) : 
          studentQuery.eq('email', user.email)
        ).single();
        
        if (studentData?.class_instance_id) {
          query = query.eq('id', studentData.class_instance_id);
        }
      }

      const { data, error } = await query.order('grade').order('section');
      if (error) throw error;
      
      setClasses(data || []);
      if (data?.length > 0 && !selectedClass) {
        setSelectedClass(data[0].id);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', selectedClass)
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_instance_id', selectedClass)
        .eq('date', selectedDate);

      if (error) throw error;
      
      const attendanceMap = {};
      (data || []).forEach(record => {
        attendanceMap[record.student_id] = record.status;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const handleAttendanceChange = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const markAllPresent = () => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = 'present';
    });
    setAttendance(newAttendance);
  };

  const markAllAbsent = () => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = 'absent';
    });
    setAttendance(newAttendance);
  };

  const resetAttendance = () => {
    setAttendance({});
  };

  const saveAttendance = async () => {
    try {
      setSaving(true);
      
      // Delete existing records for this date and class
      await supabase
        .from('attendance')
        .delete()
        .eq('class_instance_id', selectedClass)
        .eq('date', selectedDate);

      // Insert new records
      const records = students.map(student => ({
        student_id: student.id,
        class_instance_id: selectedClass,
        date: selectedDate,
        status: attendance[student.id] || 'absent',
        marked_by: user.id,
        marked_by_role_code: user.user_metadata?.admin_code || user.user_metadata?.super_admin_code || '',
        school_code: user.user_metadata?.school_code
      }));

      const { error } = await supabase.from('attendance').insert(records);
      if (error) throw error;

      // Show success message
      console.log('Attendance saved successfully');
    } catch (error) {
      console.error('Error saving attendance:', error);
    } finally {
      setSaving(false);
    }
  };

  const getAttendanceStats = () => {
    const total = students.length;
    const marked = Object.keys(attendance).length;
    const present = Object.values(attendance).filter(status => status === 'present').length;
    const absent = Object.values(attendance).filter(status => status === 'absent').length;
    const late = Object.values(attendance).filter(status => status === 'late').length;
    
    return { total, marked, present, absent, late };
  };

  const stats = getAttendanceStats();
  const progressPercentage = stats.total > 0 ? Math.round((stats.marked / stats.total) * 100) : 0;

  return (
    <div className="cb-container cb-section">
      {/* Header */}
      <div className="cb-dashboard-header">
        <div className="cb-flex cb-justify-between cb-items-start">
          <div>
            <h1 className="cb-heading-2 cb-mb-2">
              ✅ Attendance Management
            </h1>
            <p className="cb-text-caption">
              {isStudent ? 'View your attendance record and patterns' : 'Mark and track student attendance'}
            </p>
          </div>
          
          {canMark && (
            <div className="cb-dashboard-actions">
              <button 
                className="cb-button cb-button-secondary"
                onClick={() => setView(view === 'mark' ? 'view' : 'mark')}
              >
                {view === 'mark' ? '👁️ View History' : '✏️ Mark Attendance'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="cb-card cb-mb-6">
        <div className="cb-card-body">
          <div className="cb-form-row">
            {!isStudent && (
              <div className="cb-form-group">
                <label className="cb-label">Class</label>
                <select
                  className="cb-input"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">Select Class</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      Grade {cls.grade} - Section {cls.section}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="cb-form-group">
              <label className="cb-label">Date</label>
              <input
                type="date"
                className="cb-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Marking Interface */}
      {view === 'mark' && canMark && selectedClass && (
        <>
          {/* Progress & Bulk Actions */}
          <div className="cb-card cb-mb-6">
            <div className="cb-card-body">
              <div className="cb-flex cb-justify-between cb-items-center cb-mb-4">
                <div>
                  <h4 className="cb-heading-5 cb-mb-2">
                    Attendance Progress
                  </h4>
                  <p className="cb-text-caption">
                    {stats.marked} of {stats.total} students marked ({progressPercentage}%)
                  </p>
                </div>
                
                <div className="cb-flex cb-gap-3">
                  <button 
                    className="cb-button cb-button-sm cb-button-success"
                    onClick={markAllPresent}
                  >
                    ✅ All Present
                  </button>
                  <button 
                    className="cb-button cb-button-sm cb-button-danger"
                    onClick={markAllAbsent}
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
              
              <div className="cb-progress">
                <div 
                  className="cb-progress-bar"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              
              {/* Quick Stats */}
              <div className="cb-flex cb-gap-6 cb-mt-4">
                <div className="cb-flex cb-items-center cb-gap-2">
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--color-success-500)' 
                  }}></div>
                  <span className="cb-text-caption">Present: {stats.present}</span>
                </div>
                <div className="cb-flex cb-items-center cb-gap-2">
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--color-error-500)' 
                  }}></div>
                  <span className="cb-text-caption">Absent: {stats.absent}</span>
                </div>
                <div className="cb-flex cb-items-center cb-gap-2">
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--color-warning-500)' 
                  }}></div>
                  <span className="cb-text-caption">Late: {stats.late}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Student Attendance Grid */}
          <div className="cb-card cb-mb-6">
            <div className="cb-card-body">
              {loading ? (
                <div className="cb-attendance-grid">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="cb-skeleton" style={{ height: '60px', borderRadius: 'var(--radius-xl)' }}></div>
                  ))}
                </div>
              ) : (
                <div className="cb-attendance-grid">
                  {students.map(student => (
                    <div key={student.id} className="cb-attendance-student">
                      <div>
                        <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-medium)' }}>
                          {student.full_name}
                        </div>
                        <div className="cb-text-caption-sm">
                          {student.student_code}
                        </div>
                      </div>
                      
                      <div className="cb-attendance-toggle">
                        <button
                          className={`cb-attendance-button cb-attendance-present ${
                            attendance[student.id] === 'present' ? 'active' : ''
                          }`}
                          onClick={() => handleAttendanceChange(student.id, 'present')}
                          title="Mark Present"
                        >
                          ✓
                        </button>
                        <button
                          className={`cb-attendance-button cb-attendance-absent ${
                            attendance[student.id] === 'absent' ? 'active' : ''
                          }`}
                          onClick={() => handleAttendanceChange(student.id, 'absent')}
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
          <div className="cb-card">
            <div className="cb-card-body">
              <div className="cb-flex cb-justify-center">
                <button
                  className="cb-button cb-button-primary cb-button-lg"
                  onClick={saveAttendance}
                  disabled={stats.marked === 0 || saving}
                  style={{ minWidth: '200px' }}
                >
                  {saving ? (
                    <>
                      <div className="cb-spinner"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Save Attendance</span>
                    </>
                  )}
                </button>
              </div>
              
              {stats.marked < stats.total && (
                <p className="cb-text-caption cb-text-center cb-mt-3">
                  Please mark all {stats.total} students before saving
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* View History */}
      {view === 'view' && (
        <div className="cb-card">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">Attendance History</h3>
            <p className="cb-text-caption">View past attendance records</p>
          </div>
          <div className="cb-card-body">
            <div className="cb-empty-state">
              <div className="cb-empty-icon">📊</div>
              <h3 className="cb-empty-title">Attendance Analytics</h3>
              <p className="cb-empty-description">
                View detailed attendance patterns, trends, and insights for better student monitoring.
              </p>
              <button className="cb-button cb-button-primary">
                <span>📈</span>
                <span>View Analytics</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student View */}
      {isStudent && (
        <div className="cb-card">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">My Attendance</h3>
            <p className="cb-text-caption">Your attendance record and statistics</p>
          </div>
          <div className="cb-card-body">
            <div className="cb-grid cb-grid-3 cb-mb-6">
              <div className="cb-stat-card">
                <div className="cb-stat-value">94%</div>
                <div className="cb-stat-label">Overall Rate</div>
                <div className="cb-stat-change positive">↗️ +2%</div>
              </div>
              <div className="cb-stat-card">
                <div className="cb-stat-value">23</div>
                <div className="cb-stat-label">Present Days</div>
                <div className="cb-stat-change positive">↗️ +1</div>
              </div>
              <div className="cb-stat-card">
                <div className="cb-stat-value">7</div>
                <div className="cb-stat-label">Current Streak</div>
                <div className="cb-stat-change positive">🔥 Hot!</div>
              </div>
            </div>
            
            <div className="cb-text-center">
              <button className="cb-button cb-button-primary">
                <span>📊</span>
                <span>View Detailed Analytics</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernAttendance;