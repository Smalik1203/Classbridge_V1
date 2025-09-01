import React from 'react';
import { useAuth } from '../../AuthProvider';
import { BookOpen, Calendar, Trophy, TrendingUp, Settings, Clock, Users, School, GraduationCap } from 'lucide-react';

/**
 * ADMIN DASHBOARD COMPONENT - Administrator Overview Interface
 * 
 * CHANGES MADE:
 * - Converted from basic HTML to professional React component with Lucide icons
 * - Added comprehensive statistics display with visual indicators
 * - Implemented responsive grid layout with consistent styling
 * - Added recent activity timeline with professional styling
 * - Integrated quick actions section with hover effects
 * - Added proper user context display with school information
 * 
 * BACKEND INTEGRATION NEEDED:
 * - Replace hardcoded statistics with real-time data from Supabase
 * - Implement role-based data filtering for admin permissions
 * - Add real-time activity feed with live updates
 * - Include performance metrics and analytics
 * - Add notification system for important updates
 * 
 * SUPABASE INTEGRATION POINTS:
 * - Admin Statistics: SELECT COUNT(*) FROM classes, students, attendance WHERE admin_id = user.id
 * - Recent Activity: SELECT * FROM activity_logs WHERE user_id = user.id ORDER BY created_at DESC LIMIT 10
 * - Performance Metrics: Complex queries for attendance rates, grade averages, etc.
 * - Real-time Subscriptions: supabase.channel().on('postgres_changes', callback)
 */
const AdminDashboard = () => {
  const { user } = useAuth();
  
  // BACKEND INTEGRATION: Replace with actual user data from Supabase auth
  // Query: SELECT full_name, school_name FROM users WHERE id = user.id
  const userName = user?.user_metadata?.full_name || 'Admin';
  const schoolName = user?.user_metadata?.school_name;

  /**
   * STATISTICS DATA - Admin-specific metrics
   * 
   * BACKEND INTEGRATION NEEDED:
   * - Replace with real-time queries based on admin's assigned classes
   * - Add trend calculations and percentage changes
   * - Include comparative metrics (vs last month, vs school average)
   * - Add caching for frequently accessed statistics
   * 
   * EXAMPLE QUERIES:
   * - My Classes: SELECT COUNT(*) FROM class_instances WHERE class_teacher_id = user.id
   * - Students: SELECT COUNT(*) FROM students s JOIN class_instances ci ON s.class_instance_id = ci.id WHERE ci.class_teacher_id = user.id
   * - Attendance: SELECT AVG(attendance_percentage) FROM attendance_summary WHERE class_teacher_id = user.id AND date >= current_month
   * - [removed] Assignments related queries
   */
  const stats = [
    { label: 'My Classes', value: '6', icon: BookOpen, color: 'blue' },
    { label: 'Students', value: '180', icon: Users, color: 'green' },
    { label: 'Attendance', value: '92%', icon: Calendar, color: 'purple' },
    
  ];

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div className="mb-8">
        {/* 
          PROFESSIONAL HEADER SECTION:
          - Personalized welcome message with user context
          - Role-based description and guidance
          - School name display for context
          - Settings access and user controls
          
          BACKEND INTEGRATION NEEDED:
          - Add last login time and activity status
          - Include pending notifications count
          - Show role-specific announcements
          - Add quick access to frequently used features
        */}
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: 600, 
              marginBottom: '8px',
              color: '#1e293b'
            }}>
              Welcome back, {userName}!
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ 
              background: '#ddd6fe', 
              borderRadius: '12px', 
              padding: '8px 16px' 
            }}>
              <span style={{ 
                color: '#5b21b6', 
                fontSize: '14px', 
                fontWeight: 500 
              }}>
                Administrator
              </span>
            </div>
            <button style={{ 
              padding: '8px', 
              background: '#f1f5f9', 
              borderRadius: '12px', 
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}>
              <Settings style={{ width: '20px', height: '20px', color: '#64748b' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* 
          STATISTICS CARDS:
          - Professional card design with gradients and icons
          - Color-coded metrics for visual organization
          - Responsive grid layout
          - Hover effects and interactions
          
          BACKEND INTEGRATION NEEDED:
          - Real-time data updates with WebSocket connections
          - Trend indicators (up/down arrows with percentages)
          - Click-through functionality to detailed views
          - Comparative metrics and benchmarking
        */}
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
            green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
            purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
            orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400'
          };
          
          return (
            <div key={index} style={{ 
              background: '#ffffff', 
              borderRadius: '16px', 
              padding: '24px', 
              border: '1px solid #e2e8f0', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ 
                    color: '#64748b', 
                    fontSize: '14px', 
                    fontWeight: 500,
                    margin: 0
                  }}>
                    {stat.label}
                  </p>
                  <p style={{ 
                    fontSize: '24px', 
                    fontWeight: 600, 
                    color: '#1e293b', 
                    marginTop: '4px',
                    margin: 0
                  }}>
                    {stat.value}
                  </p>
                </div>
                <Icon style={{ width: '32px', height: '32px', color: stat.color === 'blue' ? '#6366f1' : stat.color === 'green' ? '#10b981' : stat.color === 'purple' ? '#8b5cf6' : '#f59e0b' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 
          RECENT ACTIVITY SECTION:
          - Timeline-style activity feed
          - Professional styling with icons and timestamps
          - Responsive layout
          
          BACKEND INTEGRATION NEEDED:
          - Real-time activity feed from database
          - Activity type categorization and filtering
          - User-specific activity based on permissions
          - Pagination and infinite scroll for large datasets
        */}
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          padding: '24px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: 600, 
            color: '#1e293b', 
            marginBottom: '16px'
          }}>
            Recent Activity
          </h3>
          <div className="space-y-3">
            {/* BACKEND INTEGRATION: Replace with real activity data
            activities.map((activity, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <activity.icon className={`w-5 h-5 ${activity.color}`} />
                <div>
                  <p className="text-white text-sm font-medium">{activity.title}</p>
                  <p className="text-slate-400 text-xs">{activity.description} • {activity.time}</p>
                </div>
              </div>
            ))
            */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px', 
              background: '#f8fafc', 
              borderRadius: '12px'
            }}>
              <Clock style={{ width: '20px', height: '20px', color: '#6366f1' }} />
              <div>
                <p style={{ 
                  color: '#1e293b', 
                  fontSize: '14px', 
                  fontWeight: 500,
                  margin: 0
                }}>
                  Attendance Marked
                </p>
                <p style={{ 
                  color: '#64748b', 
                  fontSize: '12px',
                  margin: 0
                }}>
                  Grade 10-A completed • 2 hours ago
                </p>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px', 
              background: '#f8fafc', 
              borderRadius: '12px'
            }}>
              <Clock style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <div>
                <p style={{ 
                  color: '#1e293b', 
                  fontSize: '14px', 
                  fontWeight: 500,
                  margin: 0
                }}>
                  Parent Meeting
                </p>
                <p style={{ 
                  color: '#64748b', 
                  fontSize: '12px',
                  margin: 0
                }}>
                  Scheduled for tomorrow • 1 day ago
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 
          QUICK ACTIONS SECTION:
          - Grid of common administrative tasks
          - Professional button styling with icons
          - Hover effects and interactions
          - Color-coded actions for visual organization
          
          BACKEND INTEGRATION NEEDED:
          - Dynamic action availability based on user permissions
          - Action counters (e.g., "Mark Attendance (3 pending)")
          - Recent usage tracking and personalization
          - Integration with actual functional pages
        */}
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          padding: '24px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: 600, 
            color: '#1e293b', 
            marginBottom: '16px'
          }}>
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* BACKEND INTEGRATION: Make actions dynamic and functional */}
            <button style={{ 
              padding: '16px', 
              background: '#ddd6fe', 
              borderRadius: '12px', 
              border: '1px solid #c4b5fd', 
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}>
              <Calendar style={{ width: '24px', height: '24px', color: '#6366f1', marginBottom: '8px' }} />
              <p style={{ 
                color: '#1e293b', 
                fontSize: '14px', 
                fontWeight: 500,
                margin: 0
              }}>
                Mark Attendance
              </p>
            </button>
            <button style={{ 
              padding: '16px', 
              background: '#dcfce7', 
              borderRadius: '12px', 
              border: '1px solid #bbf7d0', 
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}>
              <BookOpen style={{ width: '24px', height: '24px', color: '#10b981', marginBottom: '8px' }} />
              <p style={{ 
                color: '#1e293b', 
                fontSize: '14px', 
                fontWeight: 500,
                margin: 0
              }}>
                Grade Assignments
              </p>
            </button>
            <button style={{ 
              padding: '16px', 
              background: '#f3e8ff', 
              borderRadius: '12px', 
              border: '1px solid #e9d5ff', 
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}>
              <Users style={{ width: '24px', height: '24px', color: '#8b5cf6', marginBottom: '8px' }} />
              <p style={{ 
                color: '#1e293b', 
                fontSize: '14px', 
                fontWeight: 500,
                margin: 0
              }}>
                View Students
              </p>
            </button>
            <button style={{ 
              padding: '16px', 
              background: '#fef3c7', 
              borderRadius: '12px', 
              border: '1px solid #fde68a', 
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}>
              <Trophy style={{ width: '24px', height: '24px', color: '#f59e0b', marginBottom: '8px' }} />
              <p style={{ 
                color: '#1e293b', 
                fontSize: '14px', 
                fontWeight: 500,
                margin: 0
              }}>
                View Results
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;