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
    fees: 0,
    trends: {
      students: 12,
      classes: 5,
      attendance: 3,
      resources: 18
    }
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
        const [studentsRes, classesRes, resourcesRes, testsRes] = await Promise.all([
          supabase.from('student').select('id', { count: 'exact' }).eq('school_code', schoolCode),
          supabase.from('class_instances').select('id', { count: 'exact' }).eq('school_code', schoolCode),
          supabase.from('learning_resources').select('id', { count: 'exact' }).eq('school_code', schoolCode),
          supabase.from('tests').select('id', { count: 'exact' }).eq('school_code', schoolCode)
        ]);

        setStats(prev => ({
          ...prev,
          students: studentsRes.count || 0,
          classes: classesRes.count || 0,
          resources: resourcesRes.count || 0,
          tests: testsRes.count || 0,
          attendance: 92
        }));
      } else if (role === 'student') {
        setStats(prev => ({
          ...prev,
          attendance: 94,
          tests: 12,
          resources: 45,
          grades: 'A-'
        }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    const activities = [
      { 
        id: 1, 
        type: 'attendance', 
        title: 'Attendance Marked',
        message: 'Grade 10-A attendance completed', 
        time: '2 hours ago', 
        icon: '📅',
        color: 'success'
      },
      { 
        id: 2, 
        type: 'resource', 
        title: 'New Resource Added',
        message: 'Physics Chapter 5 video uploaded', 
        time: '4 hours ago', 
        icon: '🎥',
        color: 'primary'
      },
      { 
        id: 3, 
        type: 'test', 
        title: 'Results Published',
        message: 'Math Quiz results are now available', 
        time: '1 day ago', 
        icon: '📝',
        color: 'warning'
      },
      { 
        id: 4, 
        type: 'fee', 
        title: 'Payment Received',
        message: 'Fee payment from John Doe processed', 
        time: '2 days ago', 
        icon: '💰',
        color: 'success'
      }
    ];
    setRecentActivity(activities);
  };

  const getRoleBasedStats = () => {
    if (role === 'superadmin' || role === 'admin') {
      return [
        { 
          label: 'Total Students', 
          value: stats.students, 
          icon: '👥', 
          color: 'primary',
          trend: `+${stats.trends.students}%`,
          trendType: 'positive'
        },
        { 
          label: 'Active Classes', 
          value: stats.classes, 
          icon: '🏫', 
          color: 'success',
          trend: `+${stats.trends.classes}%`,
          trendType: 'positive'
        },
        { 
          label: 'Attendance Rate', 
          value: `${stats.attendance}%`, 
          icon: '📊', 
          color: 'warning',
          trend: `+${stats.trends.attendance}%`,
          trendType: 'positive'
        },
        { 
          label: 'Learning Resources', 
          value: stats.resources, 
          icon: '📚', 
          color: 'info',
          trend: `+${stats.trends.resources}%`,
          trendType: 'positive'
        }
      ];
    } else if (role === 'student') {
      return [
        { 
          label: 'My Attendance', 
          value: `${stats.attendance}%`, 
          icon: '📅', 
          color: 'success',
          trend: '+3%',
          trendType: 'positive'
        },
        { 
          label: 'Completed Tests', 
          value: stats.tests, 
          icon: '✅', 
          color: 'primary',
          trend: '+2',
          trendType: 'positive'
        },
        { 
          label: 'Resources Accessed', 
          value: stats.resources, 
          icon: '📖', 
          color: 'info',
          trend: '+8',
          trendType: 'positive'
        },
        { 
          label: 'Current Grade', 
          value: stats.grades, 
          icon: '🏆', 
          color: 'warning',
          trend: 'Stable',
          trendType: 'neutral'
        }
      ];
    }
    return [];
  };

  const getQuickActions = () => {
    if (role === 'superadmin') {
      return [
        { label: 'Add Student', icon: '👤', path: '/add-student', color: 'primary' },
        { label: 'Create Class', icon: '🏫', path: '/add-specific-class', color: 'success' },
        { label: 'Upload Resource', icon: '📤', path: '/learning-resources', color: 'info' },
        { label: 'View Analytics', icon: '📊', path: '/analytics', color: 'warning' },
        { label: 'Manage Fees', icon: '💰', path: '/fees', color: 'error' },
        { label: 'School Setup', icon: '⚙️', path: '/school-setup', color: 'neutral' }
      ];
    } else if (role === 'admin') {
      return [
        { label: 'Mark Attendance', icon: '✓', path: '/attendance', color: 'primary' },
        { label: 'Create Test', icon: '📝', path: '/test-management', color: 'success' },
        { label: 'Upload Resource', icon: '📤', path: '/learning-resources', color: 'info' },
        { label: 'View Results', icon: '🏆', path: '/results', color: 'warning' },
        { label: 'Manage Students', icon: '👥', path: '/add-student', color: 'error' },
        { label: 'Timetable', icon: '📅', path: '/timetable', color: 'neutral' }
      ];
    } else if (role === 'student') {
      return [
        { label: 'Take Test', icon: '📝', path: '/take-tests', color: 'primary' },
        { label: 'View Resources', icon: '📚', path: '/learning-resources', color: 'success' },
        { label: 'Check Attendance', icon: '📅', path: '/attendance', color: 'info' },
        { label: 'View Grades', icon: '🏆', path: '/results', color: 'warning' },
        { label: 'My Timetable', icon: '🗓️', path: '/timetable', color: 'error' },
        { label: 'Fee Status', icon: '💳', path: '/fees', color: 'neutral' }
      ];
    }
    return [];
  };

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    if (hour >= 17) greeting = 'Good evening';

    const roleMessages = {
      'superadmin': 'Ready to manage your school system?',
      'admin': 'Let\'s check on your classes today.',
      'student': 'Ready to continue your learning journey?'
    };

    return {
      greeting,
      message: roleMessages[role] || 'Welcome to ClassBridge!'
    };
  };

  const welcomeMsg = getWelcomeMessage();

  if (loading) {
    return (
      <div className="cb-container cb-section">
        <div className="cb-kpi-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="cb-skeleton" style={{ height: '140px', borderRadius: 'var(--radius-2xl)' }}></div>
          ))}
        </div>
        <div className="cb-grid cb-grid-2" style={{ gap: 'var(--space-8)' }}>
          <div className="cb-skeleton" style={{ height: '300px', borderRadius: 'var(--radius-2xl)' }}></div>
          <div className="cb-skeleton" style={{ height: '300px', borderRadius: 'var(--radius-2xl)' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="cb-container cb-section">
      {/* Modern Welcome Header */}
      <div className="cb-dashboard-header">
        <div className="cb-flex cb-justify-between cb-items-start">
          <div>
            <div className="cb-dashboard-welcome">
              {welcomeMsg.greeting}, {userName}! 👋
            </div>
            <div className="cb-dashboard-subtitle">
              {welcomeMsg.message}
            </div>
            {schoolName && (
              <div className="cb-badge cb-badge-primary cb-badge-lg">
                🏫 {schoolName}
              </div>
            )}
          </div>
          
          <div className="cb-dashboard-actions">
            <button className="cb-button cb-button-ghost">
              <span>🔔</span>
              <span className="cb-hidden-mobile">Notifications</span>
            </button>
            <button className="cb-button cb-button-ghost">
              <span>⚙️</span>
              <span className="cb-hidden-mobile">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern KPI Cards */}
      <div className="cb-kpi-grid">
        {getRoleBasedStats().map((stat, index) => (
          <div key={index} className="cb-kpi-card">
            <div className="cb-stat-header">
              <div className="cb-stat-icon">
                {stat.icon}
              </div>
              <div className={`cb-stat-change ${stat.trendType}`}>
                {stat.trendType === 'positive' && '↗️'}
                {stat.trendType === 'negative' && '↘️'}
                {stat.trendType === 'neutral' && '➡️'}
                {stat.trend}
              </div>
            </div>
            <div className="cb-stat-value">{stat.value}</div>
            <div className="cb-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="cb-grid cb-grid-2" style={{ gap: 'var(--space-8)' }}>
        {/* Quick Actions */}
        <div className="cb-card">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">Quick Actions</h3>
            <p className="cb-text-caption">Common tasks for your role</p>
          </div>
          <div className="cb-card-body">
            <div className="cb-quick-actions">
              {getQuickActions().map((action, index) => (
                <a
                  key={index}
                  href={action.path}
                  className="cb-quick-action"
                  onClick={(e) => {
                    e.preventDefault();
                    // Navigation would be handled by router
                    console.log(`Navigate to ${action.path}`);
                  }}
                >
                  <span className="cb-quick-action-icon">{action.icon}</span>
                  <span className="cb-quick-action-label">{action.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="cb-card">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">Recent Activity</h3>
            <p className="cb-text-caption">Latest updates and actions</p>
          </div>
          <div className="cb-card-body">
            <div className="cb-list">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="cb-list-item">
                  <div 
                    className="cb-stat-icon"
                    style={{ 
                      width: '40px', 
                      height: '40px',
                      fontSize: 'var(--text-lg)',
                      background: `var(--color-${activity.color}-100)`,
                      color: `var(--color-${activity.color}-600)`
                    }}
                  >
                    {activity.icon}
                  </div>
                  <div className="cb-list-item-content">
                    <div className="cb-list-item-title">{activity.title}</div>
                    <div className="cb-list-item-subtitle">{activity.message}</div>
                  </div>
                  <div className="cb-text-caption-sm">{activity.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Role-specific sections */}
      {(role === 'superadmin' || role === 'admin') && (
        <div className="cb-mt-8">
          <h3 className="cb-heading-3 cb-mb-6">Today's Overview</h3>
          <div className="cb-grid cb-grid-3">
            {/* Attendance Summary */}
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-5 cb-mb-4">Attendance Summary</h4>
                <div className="cb-progress cb-mb-3">
                  <div 
                    className="cb-progress-bar" 
                    style={{ width: `${stats.attendance}%` }}
                  ></div>
                </div>
                <div className="cb-flex cb-justify-between cb-items-center">
                  <span className="cb-text-caption">{stats.attendance}% present today</span>
                  <span className="cb-badge cb-badge-success cb-badge-sm">
                    ↗️ +3%
                  </span>
                </div>
              </div>
            </div>
            
            {/* Pending Tasks */}
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-5 cb-mb-4">Pending Tasks</h4>
                <div className="cb-flex cb-flex-col cb-gap-3">
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-body-sm">Tests to grade</span>
                    <span className="cb-badge cb-badge-warning cb-badge-sm">3</span>
                  </div>
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-body-sm">Attendance to mark</span>
                    <span className="cb-badge cb-badge-error cb-badge-sm">2</span>
                  </div>
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-body-sm">Resources to review</span>
                    <span className="cb-badge cb-badge-primary cb-badge-sm">5</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* This Week */}
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-5 cb-mb-4">This Week</h4>
                <div className="cb-flex cb-flex-col cb-gap-3">
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-body-sm">Tests scheduled</span>
                    <span className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>5</span>
                  </div>
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-body-sm">Resources added</span>
                    <span className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>12</span>
                  </div>
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-body-sm">Classes conducted</span>
                    <span className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>28</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {role === 'student' && (
        <div className="cb-mt-8">
          <h3 className="cb-heading-3 cb-mb-6">Your Progress</h3>
          <div className="cb-grid cb-grid-2">
            {/* This Week's Schedule */}
            <div className="cb-card">
              <div className="cb-card-header">
                <h4 className="cb-heading-5">This Week's Schedule</h4>
              </div>
              <div className="cb-card-body">
                <div className="cb-list">
                  <div className="cb-list-item">
                    <div className="cb-badge cb-badge-math">Math</div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">Mathematics</div>
                      <div className="cb-list-item-subtitle">Today, 10:00 AM</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-primary">Join</button>
                  </div>
                  <div className="cb-list-item">
                    <div className="cb-badge cb-badge-science">Science</div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">Science Lab</div>
                      <div className="cb-list-item-subtitle">Tomorrow, 2:00 PM</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-secondary">View</button>
                  </div>
                  <div className="cb-list-item">
                    <div className="cb-badge cb-badge-english">English</div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">English Literature</div>
                      <div className="cb-list-item-subtitle">Wednesday, 11:00 AM</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-ghost">Upcoming</button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Upcoming Tests */}
            <div className="cb-card">
              <div className="cb-card-header">
                <h4 className="cb-heading-5">Upcoming Tests</h4>
              </div>
              <div className="cb-card-body">
                <div className="cb-list">
                  <div className="cb-list-item">
                    <div className="cb-stat-icon" style={{ 
                      width: '32px', 
                      height: '32px',
                      fontSize: 'var(--text-base)',
                      background: 'var(--color-warning-100)',
                      color: 'var(--color-warning-600)'
                    }}>
                      📝
                    </div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">Physics Unit Test</div>
                      <div className="cb-list-item-subtitle">Due in 3 days</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-primary">
                      Take Test
                    </button>
                  </div>
                  <div className="cb-list-item">
                    <div className="cb-stat-icon" style={{ 
                      width: '32px', 
                      height: '32px',
                      fontSize: 'var(--text-base)',
                      background: 'var(--color-primary-100)',
                      color: 'var(--color-primary-600)'
                    }}>
                      📋
                    </div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">Math Assignment</div>
                      <div className="cb-list-item-subtitle">Due in 1 week</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-secondary">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Insights (for admins) */}
      {(role === 'superadmin' || role === 'admin') && (
        <div className="cb-mt-8">
          <h3 className="cb-heading-3 cb-mb-6">Performance Insights</h3>
          <div className="cb-card">
            <div className="cb-card-body">
              <div className="cb-grid cb-grid-4">
                <div className="cb-text-center">
                  <div className="cb-progress-circle" style={{ margin: '0 auto var(--space-4)' }}>
                    <span className="cb-progress-circle-text">92%</span>
                  </div>
                  <div className="cb-text-caption">Overall Attendance</div>
                </div>
                <div className="cb-text-center">
                  <div className="cb-progress-circle" style={{ margin: '0 auto var(--space-4)' }}>
                    <span className="cb-progress-circle-text">87%</span>
                  </div>
                  <div className="cb-text-caption">Test Completion</div>
                </div>
                <div className="cb-text-center">
                  <div className="cb-progress-circle" style={{ margin: '0 auto var(--space-4)' }}>
                    <span className="cb-progress-circle-text">94%</span>
                  </div>
                  <div className="cb-text-caption">Resource Usage</div>
                </div>
                <div className="cb-text-center">
                  <div className="cb-progress-circle" style={{ margin: '0 auto var(--space-4)' }}>
                    <span className="cb-progress-circle-text">78%</span>
                  </div>
                  <div className="cb-text-caption">Fee Collection</div>
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