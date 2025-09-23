import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthProvider';
import { supabase } from '../../config/supabaseClient';

const ModernDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    students: 0,
    classes: 0,
    attendance: 0,
    resources: 0,
    tests: 0,
    fees: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  const role = user?.app_metadata?.role || 'student';
  const userName = user?.user_metadata?.full_name || 'User';
  const schoolName = user?.user_metadata?.school_name || '';

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch role-specific statistics
      await fetchStats();
      await fetchRecentActivity();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const schoolCode = user?.user_metadata?.school_code;
    if (!schoolCode) return;

    try {
      if (role === 'superadmin' || role === 'admin') {
        // Admin stats
        const [studentsRes, classesRes, resourcesRes, testsRes] = await Promise.all([
          supabase.from('student').select('id', { count: 'exact' }).eq('school_code', schoolCode),
          supabase.from('class_instances').select('id', { count: 'exact' }).eq('school_code', schoolCode),
          supabase.from('learning_resources').select('id', { count: 'exact' }).eq('school_code', schoolCode),
          supabase.from('tests').select('id', { count: 'exact' }).eq('school_code', schoolCode)
        ]);

        setStats({
          students: studentsRes.count || 0,
          classes: classesRes.count || 0,
          resources: resourcesRes.count || 0,
          tests: testsRes.count || 0,
          attendance: 92, // Mock data
          fees: 85 // Mock data
        });
      } else if (role === 'student') {
        // Student stats
        setStats({
          attendance: 94,
          tests: 12,
          resources: 45,
          grades: 'A-'
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    // Mock recent activity data
    const activities = [
      { id: 1, type: 'attendance', message: 'Attendance marked for Grade 10-A', time: '2 hours ago', icon: '📅' },
      { id: 2, type: 'resource', message: 'New video uploaded: Physics Chapter 5', time: '4 hours ago', icon: '🎥' },
      { id: 3, type: 'test', message: 'Math Quiz results published', time: '1 day ago', icon: '📝' },
      { id: 4, type: 'fee', message: 'Fee payment received from John Doe', time: '2 days ago', icon: '💰' }
    ];
    setRecentActivity(activities);
  };

  const getRoleBasedStats = () => {
    if (role === 'superadmin' || role === 'admin') {
      return [
        { label: 'Total Students', value: stats.students, icon: '👥', color: 'primary', trend: '+12%' },
        { label: 'Active Classes', value: stats.classes, icon: '🏫', color: 'success', trend: '+5%' },
        { label: 'Attendance Rate', value: `${stats.attendance}%`, icon: '📊', color: 'warning', trend: '+2%' },
        { label: 'Learning Resources', value: stats.resources, icon: '📚', color: 'info', trend: '+18%' }
      ];
    } else if (role === 'student') {
      return [
        { label: 'My Attendance', value: `${stats.attendance}%`, icon: '📅', color: 'success', trend: '+3%' },
        { label: 'Completed Tests', value: stats.tests, icon: '✅', color: 'primary', trend: '+2' },
        { label: 'Resources Accessed', value: stats.resources, icon: '📖', color: 'info', trend: '+8' },
        { label: 'Current Grade', value: stats.grades, icon: '🏆', color: 'warning', trend: 'Stable' }
      ];
    }
    return [];
  };

  const getQuickActions = () => {
    if (role === 'superadmin') {
      return [
        { label: 'Add Student', icon: '👤', action: () => {}, color: 'primary' },
        { label: 'Create Class', icon: '🏫', action: () => {}, color: 'success' },
        { label: 'Upload Resource', icon: '📤', action: () => {}, color: 'info' },
        { label: 'View Analytics', icon: '📊', action: () => {}, color: 'warning' }
      ];
    } else if (role === 'admin') {
      return [
        { label: 'Mark Attendance', icon: '✓', action: () => {}, color: 'primary' },
        { label: 'Create Test', icon: '📝', action: () => {}, color: 'success' },
        { label: 'Upload Resource', icon: '📤', action: () => {}, color: 'info' },
        { label: 'View Results', icon: '🏆', action: () => {}, color: 'warning' }
      ];
    } else if (role === 'student') {
      return [
        { label: 'Take Test', icon: '📝', action: () => {}, color: 'primary' },
        { label: 'View Resources', icon: '📚', action: () => {}, color: 'success' },
        { label: 'Check Attendance', icon: '📅', action: () => {}, color: 'info' },
        { label: 'View Grades', icon: '🏆', action: () => {}, color: 'warning' }
      ];
    }
    return [];
  };

  if (loading) {
    return (
      <div className="cb-container cb-section">
        <div className="cb-grid cb-grid-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="cb-skeleton" style={{ height: '120px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="cb-container cb-section">
      {/* Welcome Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="cb-flex cb-justify-between cb-items-center">
          <div>
            <h1 className="cb-heading-1" style={{ marginBottom: 'var(--space-2)' }}>
              Welcome back, {userName}!
            </h1>
            <p className="cb-text-secondary">
              {role === 'superadmin' && 'Manage your school system and monitor performance'}
              {role === 'admin' && 'Track your classes and student progress'}
              {role === 'student' && 'Stay on top of your academic journey'}
            </p>
            {schoolName && (
              <div className="cb-badge cb-badge-primary" style={{ marginTop: 'var(--space-2)' }}>
                {schoolName}
              </div>
            )}
          </div>
          <div className="cb-flex cb-gap-3">
            <button className="cb-button cb-button-ghost">
              <span>🔔</span>
            </button>
            <button className="cb-button cb-button-ghost">
              <span>⚙️</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="cb-grid cb-grid-4" style={{ marginBottom: 'var(--space-8)' }}>
        {getRoleBasedStats().map((stat, index) => (
          <div key={index} className="cb-stat-card">
            <div className="cb-flex cb-justify-between cb-items-center" style={{ marginBottom: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-2xl)' }}>{stat.icon}</span>
              <div className={`cb-stat-change ${stat.trend.includes('+') ? 'positive' : stat.trend.includes('-') ? 'negative' : ''}`}>
                {stat.trend}
              </div>
            </div>
            <div className="cb-stat-value">{stat.value}</div>
            <div className="cb-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="cb-grid cb-grid-2" style={{ gap: 'var(--space-8)' }}>
        {/* Quick Actions */}
        <div className="cb-card">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">Quick Actions</h3>
          </div>
          <div className="cb-card-body">
            <div className="cb-grid cb-grid-2" style={{ gap: 'var(--space-4)' }}>
              {getQuickActions().map((action, index) => (
                <button
                  key={index}
                  className="cb-button cb-button-secondary cb-flex-col"
                  style={{ 
                    height: '80px',
                    padding: 'var(--space-4)',
                    gap: 'var(--space-2)'
                  }}
                  onClick={action.action}
                >
                  <span style={{ fontSize: 'var(--text-xl)' }}>{action.icon}</span>
                  <span style={{ fontSize: 'var(--text-xs)' }}>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="cb-card">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">Recent Activity</h3>
          </div>
          <div className="cb-card-body">
            <div className="cb-flex cb-flex-col cb-gap-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="cb-flex cb-gap-3 cb-items-center">
                  <div style={{ 
                    width: '32px', 
                    height: '32px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-gray-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--text-sm)'
                  }}>
                    {activity.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="cb-text-body" style={{ marginBottom: 'var(--space-1)' }}>
                      {activity.message}
                    </p>
                    <p className="cb-text-caption">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Role-specific sections */}
      {(role === 'superadmin' || role === 'admin') && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h3 className="cb-heading-3" style={{ marginBottom: 'var(--space-6)' }}>
            Today's Overview
          </h3>
          <div className="cb-grid cb-grid-3">
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-4">Attendance Summary</h4>
                <div className="cb-progress" style={{ marginBottom: 'var(--space-3)' }}>
                  <div 
                    className="cb-progress-bar cb-progress-success" 
                    style={{ width: `${stats.attendance}%` }}
                  ></div>
                </div>
                <p className="cb-text-secondary">{stats.attendance}% present today</p>
              </div>
            </div>
            
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-4">Pending Tasks</h4>
                <div className="cb-flex cb-flex-col cb-gap-2">
                  <div className="cb-flex cb-justify-between">
                    <span className="cb-text-secondary">Tests to grade</span>
                    <span className="cb-badge cb-badge-warning">3</span>
                  </div>
                  <div className="cb-flex cb-justify-between">
                    <span className="cb-text-secondary">Attendance to mark</span>
                    <span className="cb-badge cb-badge-error">2</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-4">This Week</h4>
                <div className="cb-flex cb-flex-col cb-gap-2">
                  <div className="cb-flex cb-justify-between">
                    <span className="cb-text-secondary">Tests scheduled</span>
                    <span className="cb-text-body">5</span>
                  </div>
                  <div className="cb-flex cb-justify-between">
                    <span className="cb-text-secondary">Resources added</span>
                    <span className="cb-text-body">12</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {role === 'student' && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h3 className="cb-heading-3" style={{ marginBottom: 'var(--space-6)' }}>
            Your Progress
          </h3>
          <div className="cb-grid cb-grid-2">
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-4">This Week's Schedule</h4>
                <div className="cb-flex cb-flex-col cb-gap-3">
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <div>
                      <p className="cb-text-body">Mathematics</p>
                      <p className="cb-text-caption">Today, 10:00 AM</p>
                    </div>
                    <div className="cb-badge cb-badge-math">Math</div>
                  </div>
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <div>
                      <p className="cb-text-body">Science Lab</p>
                      <p className="cb-text-caption">Tomorrow, 2:00 PM</p>
                    </div>
                    <div className="cb-badge cb-badge-science">Science</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-4">Upcoming Tests</h4>
                <div className="cb-flex cb-flex-col cb-gap-3">
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <div>
                      <p className="cb-text-body">Physics Unit Test</p>
                      <p className="cb-text-caption">Due in 3 days</p>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-primary">
                      Take Test
                    </button>
                  </div>
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <div>
                      <p className="cb-text-body">Math Assignment</p>
                      <p className="cb-text-caption">Due in 1 week</p>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-secondary">
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernDashboard;