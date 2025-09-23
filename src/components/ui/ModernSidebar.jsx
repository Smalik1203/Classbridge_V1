import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthProvider';
import { supabase } from '../../config/supabaseClient';

const ModernSidebar = ({ collapsed, onCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const userName = user?.user_metadata?.full_name || 'User';
  const userRole = user?.app_metadata?.role || 'user';
  const schoolName = user?.user_metadata?.school_name || '';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'light' : 'dark');
  };

  const getNavigationItems = () => {
    const allItems = [
      // Core
      { 
        group: 'Overview',
        items: [
          { key: '/', label: 'Dashboard', icon: '🏠', roles: ['cb_admin', 'superadmin', 'admin', 'student'] }
        ]
      },
      
      // Platform Management (CB Admin only)
      {
        group: 'Platform',
        items: [
          { key: '/add-schools', label: 'Schools', icon: '🏢', roles: ['cb_admin'] },
          { key: '/add-super-admin', label: 'Super Admins', icon: '👑', roles: ['cb_admin'] }
        ]
      },
      
      // School Setup (Super Admin)
      {
        group: 'School Setup',
        items: [
          { key: '/school-setup', label: 'Setup', icon: '⚙️', roles: ['superadmin'] },
          { key: '/add-admin', label: 'Admins', icon: '👨‍💼', roles: ['superadmin'] },
          { key: '/add-student', label: 'Students', icon: '👨‍🎓', roles: ['superadmin', 'admin'] },
          { key: '/add-specific-class', label: 'Classes', icon: '🏫', roles: ['superadmin'] },
          { key: '/add-subjects', label: 'Subjects', icon: '📚', roles: ['superadmin', 'admin'] }
        ]
      },
      
      // Academics
      {
        group: 'Academics',
        items: [
          { key: '/timetable', label: 'Timetable', icon: '📅', roles: ['superadmin', 'admin', 'student'] },
          { key: '/syllabus', label: 'Syllabus', icon: '📖', roles: ['superadmin', 'admin', 'student'] },
          { key: '/learning-resources', label: 'Resources', icon: '🎥', roles: ['superadmin', 'admin', 'student'] },
          { key: '/attendance', label: 'Attendance', icon: '✅', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      
      // Assessment
      {
        group: 'Assessment',
        items: [
          { key: '/test-management', label: 'Manage Tests', icon: '📝', roles: ['superadmin', 'admin'] },
          { key: '/take-tests', label: 'Take Tests', icon: '✏️', roles: ['student'] },
          { key: '/results', label: 'Results', icon: '🏆', roles: ['superadmin', 'admin', 'student'] },
          { key: '/assessments', label: 'Assessments', icon: '📊', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      
      // Finance
      {
        group: 'Finance',
        items: [
          { key: '/fees', label: 'Fees', icon: '💰', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      
      // Analytics
      {
        group: 'Analytics',
        items: [
          { key: '/analytics', label: 'Analytics', icon: '📈', roles: ['superadmin', 'admin'] }
        ]
      }
    ];

    return allItems
      .map(group => ({
        ...group,
        items: group.items.filter(item => item.roles.includes(userRole))
      }))
      .filter(group => group.items.length > 0);
  };

  const navigationGroups = getNavigationItems();

  return (
    <div className={`cb-sidebar ${collapsed ? 'cb-sidebar-collapsed' : ''}`}>
      {/* Header */}
      <div className="cb-sidebar-header">
        {!collapsed ? (
          <div>
            <div style={{ 
              fontSize: 'var(--text-xl)', 
              fontWeight: 'var(--font-bold)',
              color: 'var(--color-primary-600)',
              marginBottom: 'var(--space-1)'
            }}>
              ClassBridge
            </div>
            {schoolName && (
              <div style={{ 
                fontSize: 'var(--text-xs)', 
                color: 'var(--color-text-tertiary)',
                fontWeight: 'var(--font-medium)'
              }}>
                {schoolName}
              </div>
            )}
          </div>
        ) : (
          <div style={{ 
            fontSize: 'var(--text-lg)', 
            fontWeight: 'var(--font-bold)',
            color: 'var(--color-primary-600)'
          }}>
            CB
          </div>
        )}
        
        <button 
          className="cb-button cb-button-ghost cb-button-sm"
          onClick={() => onCollapse(!collapsed)}
          style={{ padding: 'var(--space-2)' }}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* User Profile */}
      {!collapsed && (
        <div style={{ 
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border-subtle)'
        }}>
          <div className="cb-flex cb-items-center cb-gap-3">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-white)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)'
            }}>
              {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {userName}
              </div>
              <div style={{ 
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'capitalize'
              }}>
                {userRole.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="cb-sidebar-nav">
        {navigationGroups.map((group, groupIndex) => (
          <div key={groupIndex} style={{ marginBottom: 'var(--space-6)' }}>
            {!collapsed && (
              <div style={{ 
                padding: '0 var(--space-6)',
                marginBottom: 'var(--space-2)'
              }}>
                <div style={{ 
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {group.group}
                </div>
              </div>
            )}
            
            {group.items.map((item) => (
              <a
                key={item.key}
                href={item.key}
                className={`cb-nav-item ${location.pathname === item.key ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.key);
                }}
                title={collapsed ? item.label : undefined}
              >
                <span className="cb-nav-icon" style={{ fontSize: 'var(--text-lg)' }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span style={{ 
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)'
                  }}>
                    {item.label}
                  </span>
                )}
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="cb-sidebar-footer">
        {/* Theme Toggle */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: collapsed ? 'center' : 'space-between',
          marginBottom: 'var(--space-3)'
        }}>
          {!collapsed && (
            <span style={{ 
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-medium)'
            }}>
              {isDarkMode ? '🌙 Dark' : '☀️ Light'}
            </span>
          )}
          <button
            className="cb-button cb-button-ghost cb-button-sm"
            onClick={toggleTheme}
            title={collapsed ? (isDarkMode ? 'Switch to Light' : 'Switch to Dark') : undefined}
            style={{ padding: 'var(--space-2)' }}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Logout */}
        <button
          className="cb-button cb-button-ghost"
          onClick={handleLogout}
          style={{ 
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--color-error-500)'
          }}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <span>🚪</span>
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
};

export default ModernSidebar;