import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthProvider';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabaseClient';

const ModernSidebar = ({ collapsed, onCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

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

  const getNavigationGroups = () => {
    const allGroups = [
      // Overview
      {
        title: 'Overview',
        items: [
          { key: '/', label: 'Dashboard', icon: '🏠', roles: ['cb_admin', 'superadmin', 'admin', 'student'] }
        ]
      },
      
      // Platform Management (CB Admin only)
      {
        title: 'Platform',
        items: [
          { key: '/add-schools', label: 'Schools', icon: '🏢', roles: ['cb_admin'] },
          { key: '/add-super-admin', label: 'Super Admins', icon: '👑', roles: ['cb_admin'] }
        ]
      },
      
      // School Setup (Super Admin)
      {
        title: 'School Setup',
        items: [
          { key: '/school-setup', label: 'Setup Guide', icon: '🚀', roles: ['superadmin'] },
          { key: '/add-admin', label: 'Admins', icon: '👨‍💼', roles: ['superadmin'] },
          { key: '/add-student', label: 'Students', icon: '👨‍🎓', roles: ['superadmin', 'admin'] },
          { key: '/add-specific-class', label: 'Classes', icon: '🏫', roles: ['superadmin'] },
          { key: '/add-subjects', label: 'Subjects', icon: '📚', roles: ['superadmin', 'admin'] }
        ]
      },
      
      // Academics
      {
        title: 'Academics',
        items: [
          { key: '/timetable', label: 'Timetable', icon: '📅', roles: ['superadmin', 'admin', 'student'] },
          { key: '/syllabus', label: 'Syllabus', icon: '📖', roles: ['superadmin', 'admin', 'student'] },
          { key: '/learning-resources', label: 'Resources', icon: '🎥', roles: ['superadmin', 'admin', 'student'] },
          { key: '/attendance', label: 'Attendance', icon: '✅', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      
      // Assessment
      {
        title: 'Assessment',
        items: [
          { key: '/test-management', label: 'Manage Tests', icon: '📝', roles: ['superadmin', 'admin'] },
          { key: '/take-tests', label: 'Take Tests', icon: '✏️', roles: ['student'] },
          { key: '/results', label: 'Results', icon: '🏆', roles: ['superadmin', 'admin', 'student'] },
          { key: '/assessments', label: 'Assessments', icon: '📊', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      
      // Finance
      {
        title: 'Finance',
        items: [
          { key: '/fees', label: 'Fees', icon: '💰', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      
      // Analytics & Reports
      {
        title: 'Analytics',
        items: [
          { key: '/analytics', label: 'Analytics', icon: '📈', roles: ['superadmin', 'admin'] }
        ]
      }
    ];

    return allGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => item.roles.includes(userRole))
      }))
      .filter(group => group.items.length > 0);
  };

  const navigationGroups = getNavigationGroups();

  return (
    <div className={`cb-sidebar ${collapsed ? 'cb-sidebar-collapsed' : ''}`}>
      {/* Header */}
      <div className="cb-sidebar-header">
        {!collapsed ? (
          <div className="cb-sidebar-brand">
            <span style={{ fontSize: 'var(--text-2xl)' }}>🎓</span>
            <div>
              <div style={{ 
                fontSize: 'var(--text-xl)', 
                fontWeight: 'var(--font-bold)',
                color: 'var(--color-text-brand)',
                lineHeight: 'var(--leading-tight)'
              }}>
                ClassBridge
              </div>
              {schoolName && (
                <div style={{ 
                  fontSize: 'var(--text-xs)', 
                  color: 'var(--color-text-tertiary)',
                  fontWeight: 'var(--font-medium)',
                  marginTop: 'var(--space-1)'
                }}>
                  {schoolName}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="cb-sidebar-brand">
            <span style={{ fontSize: 'var(--text-xl)' }}>🎓</span>
          </div>
        )}
        
        <button 
          className="cb-button cb-button-ghost cb-button-sm"
          onClick={() => onCollapse(!collapsed)}
          style={{ 
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-lg)'
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-xl)',
              background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-white)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              boxShadow: 'var(--shadow-md)'
            }}>
              {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {userName}
              </div>
              <div className={`cb-role-indicator cb-role-${userRole}`}>
                {userRole.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="cb-sidebar-nav">
        {navigationGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="cb-nav-group">
            {!collapsed && (
              <div className="cb-nav-group-title">
                {group.title}
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
                <span className="cb-nav-icon">
                  {item.icon}
                </span>
                {!collapsed && (
                  <span>{item.label}</span>
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
          marginBottom: 'var(--space-3)',
          padding: 'var(--space-2)',
          background: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-lg)'
        }}>
          {!collapsed && (
            <span style={{ 
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              fontWeight: 'var(--font-medium)'
            }}>
              {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </span>
          )}
          <button
            className="cb-button cb-button-ghost cb-button-sm"
            onClick={toggleTheme}
            title={collapsed ? (isDarkMode ? 'Switch to Light' : 'Switch to Dark') : undefined}
            style={{ 
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)'
            }}
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
            color: 'var(--color-error-500)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-lg)'
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