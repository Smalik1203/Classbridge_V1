import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthProvider';
import { supabase } from '../../config/supabaseClient';

const ModernTimetable = () => {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('day'); // 'day', 'week', 'month'

  const userRole = user?.app_metadata?.role;
  const isStudent = userRole === 'student';
  const canEdit = userRole === 'superadmin' || userRole === 'admin';

  useEffect(() => {
    loadInitialData();
  }, [user]);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      loadTimetable();
    }
  }, [selectedClass, selectedDate, view]);

  const loadInitialData = async () => {
    try {
      const schoolCode = user?.user_metadata?.school_code;
      if (!schoolCode) return;

      const [classesRes, subjectsRes] = await Promise.all([
        supabase.from('class_instances').select('id, grade, section').eq('school_code', schoolCode),
        supabase.from('subjects').select('id, subject_name').eq('school_code', schoolCode)
      ]);

      setClasses(classesRes.data || []);
      setSubjects(subjectsRes.data || []);
      
      if (classesRes.data?.length > 0 && !selectedClass) {
        setSelectedClass(classesRes.data[0].id);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadTimetable = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('timetable_slots')
        .select(`
          *,
          subjects(subject_name),
          admin(full_name)
        `)
        .eq('class_instance_id', selectedClass)
        .eq('class_date', selectedDate)
        .order('start_time');

      if (error) throw error;
      setTimetable(data || []);
    } catch (error) {
      console.error('Error loading timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getSubjectColor = (subjectName) => {
    const colors = {
      'mathematics': 'math',
      'science': 'science',
      'english': 'english',
      'history': 'history',
      'geography': 'geography',
      'computer': 'computer'
    };
    const key = subjectName?.toLowerCase() || '';
    return colors[key] || 'neutral';
  };

  const TimeSlot = ({ slot }) => {
    const isBreak = slot.slot_type === 'break';
    
    return (
      <div className={`cb-card ${isBreak ? '' : 'cb-card-interactive'}`} style={{
        background: isBreak 
          ? 'linear-gradient(135deg, var(--color-warning-50), var(--color-warning-100))'
          : 'var(--color-surface)',
        border: isBreak 
          ? '1px solid var(--color-warning-200)'
          : '1px solid var(--color-border-subtle)'
      }}>
        <div className="cb-card-body cb-card-body-sm">
          <div className="cb-flex cb-justify-between cb-items-start cb-mb-3">
            <div className="cb-flex cb-items-center cb-gap-3">
              <div className="cb-stat-icon" style={{ 
                width: '32px', 
                height: '32px',
                fontSize: 'var(--text-base)',
                background: isBreak 
                  ? 'var(--color-warning-200)' 
                  : `var(--color-${getSubjectColor(slot.subjects?.subject_name)}-100)`,
                color: isBreak 
                  ? 'var(--color-warning-700)' 
                  : `var(--color-${getSubjectColor(slot.subjects?.subject_name)}-600)`
              }}>
                {isBreak ? '☕' : '📚'}
              </div>
              <div>
                <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>
                  {isBreak ? (slot.name || 'Break') : slot.subjects?.subject_name || 'Unassigned'}
                </div>
                <div className="cb-text-caption-sm">
                  Period {slot.period_number}
                </div>
              </div>
            </div>
            
            {canEdit && !isBreak && (
              <button className="cb-button cb-button-xs cb-button-ghost">
                ✏️
              </button>
            )}
          </div>

          <div className="cb-flex cb-justify-between cb-items-center">
            <div className="cb-flex cb-items-center cb-gap-2">
              <span className="cb-text-caption-sm">🕐</span>
              <span className="cb-text-caption-sm" style={{ fontWeight: 'var(--font-medium)' }}>
                {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
              </span>
            </div>
            
            {!isBreak && slot.admin?.full_name && (
              <div className="cb-flex cb-items-center cb-gap-2">
                <span className="cb-text-caption-sm">👨‍🏫</span>
                <span className="cb-text-caption-sm">
                  {slot.admin.full_name}
                </span>
              </div>
            )}
          </div>

          {!isBreak && slot.plan_text && (
            <div className="cb-mt-3 cb-p-3" style={{
              background: 'var(--color-gray-50)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-subtle)'
            }}>
              <p className="cb-text-caption-sm">
                📝 {slot.plan_text}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const WeekView = () => {
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return (
      <div className="cb-grid cb-grid-6">
        {weekDays.map(day => (
          <div key={day} className="cb-card">
            <div className="cb-card-header">
              <h4 className="cb-heading-6">{day}</h4>
            </div>
            <div className="cb-card-body cb-card-body-sm">
              <div className="cb-flex cb-flex-col cb-gap-2">
                {/* Mock periods for week view */}
                {[1, 2, 3, 4].map(period => (
                  <div key={period} className="cb-flex cb-justify-between cb-items-center cb-p-2" style={{
                    background: 'var(--color-gray-50)',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <span className="cb-text-caption-sm">P{period}</span>
                    <span className="cb-badge cb-badge-math cb-badge-sm">Math</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="cb-container cb-section">
      {/* Header */}
      <div className="cb-dashboard-header">
        <div className="cb-flex cb-justify-between cb-items-start">
          <div>
            <h1 className="cb-heading-2 cb-mb-2">
              📅 {isStudent ? 'My Timetable' : 'Timetable Management'}
            </h1>
            <p className="cb-text-caption">
              {isStudent ? 'View your daily class schedule and upcoming sessions' : 'Manage class schedules and period assignments'}
            </p>
          </div>
          
          {canEdit && (
            <div className="cb-dashboard-actions">
              <button className="cb-button cb-button-secondary">
                <span>📋</span>
                <span>Copy Schedule</span>
              </button>
              <button className="cb-button cb-button-primary">
                <span>➕</span>
                <span>Add Period</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="cb-card cb-mb-6">
        <div className="cb-card-body">
          <div className="cb-flex cb-justify-between cb-items-center">
            <div className="cb-flex cb-gap-4 cb-items-center">
              {/* View Toggle */}
              <div className="cb-filter-chips">
                {[
                  { key: 'day', label: 'Day', icon: '📅' },
                  { key: 'week', label: 'Week', icon: '📆' },
                  { key: 'month', label: 'Month', icon: '🗓️' }
                ].map(viewType => (
                  <button
                    key={viewType.key}
                    className={`cb-chip ${view === viewType.key ? 'active' : ''}`}
                    onClick={() => setView(viewType.key)}
                  >
                    <span>{viewType.icon}</span>
                    <span>{viewType.label}</span>
                  </button>
                ))}
              </div>

              {!isStudent && (
                <div className="cb-form-group" style={{ margin: 0 }}>
                  <select
                    className="cb-input"
                    style={{ width: '200px' }}
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
            </div>

            <div className="cb-flex cb-gap-3 cb-items-center">
              <input
                type="date"
                className="cb-input"
                style={{ width: '160px' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button className="cb-button cb-button-ghost cb-button-sm">
                📊 Analytics
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Timetable Content */}
      {loading ? (
        <div className="cb-grid cb-grid-auto">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="cb-skeleton" style={{ 
              height: '140px',
              borderRadius: 'var(--radius-2xl)' 
            }}></div>
          ))}
        </div>
      ) : view === 'week' ? (
        <WeekView />
      ) : timetable.length === 0 ? (
        <div className="cb-empty-state">
          <div className="cb-empty-icon">📅</div>
          <h3 className="cb-empty-title">No schedule for this date</h3>
          <p className="cb-empty-description">
            {canEdit 
              ? 'Start building the timetable by adding periods and assigning subjects.'
              : 'No classes are scheduled for this date. Check with your teachers for updates.'
            }
          </p>
          {canEdit && (
            <button className="cb-button cb-button-primary cb-button-lg">
              <span>➕</span>
              <span>Add First Period</span>
            </button>
          )}
        </div>
      ) : (
        <div className="cb-grid cb-grid-auto">
          {timetable.map(slot => (
            <TimeSlot key={slot.id} slot={slot} />
          ))}
        </div>
      )}

      {/* Today's Summary (for students) */}
      {isStudent && timetable.length > 0 && (
        <div className="cb-card cb-mt-8">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">Today's Summary</h3>
          </div>
          <div className="cb-card-body">
            <div className="cb-grid cb-grid-3">
              <div className="cb-stat-card">
                <div className="cb-stat-value">{timetable.filter(s => s.slot_type === 'period').length}</div>
                <div className="cb-stat-label">Total Periods</div>
              </div>
              <div className="cb-stat-card">
                <div className="cb-stat-value">
                  {new Set(timetable.filter(s => s.subjects?.subject_name).map(s => s.subjects.subject_name)).size}
                </div>
                <div className="cb-stat-label">Subjects</div>
              </div>
              <div className="cb-stat-card">
                <div className="cb-stat-value">
                  {timetable.filter(s => s.slot_type === 'break').length}
                </div>
                <div className="cb-stat-label">Breaks</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernTimetable;