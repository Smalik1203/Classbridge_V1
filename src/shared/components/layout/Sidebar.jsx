import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/config/supabaseClient';
import { Menu, Avatar, Typography, Button, Switch, Tooltip, Tag } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  TrophyOutlined,
  DollarOutlined,
  SettingOutlined,
  LogoutOutlined,
  BankOutlined,
  BarChartOutlined,
  BulbOutlined,
  BulbFilled,
  PushpinOutlined,
  PushpinFilled,
  BookOutlined,
  FileTextOutlined,
  UserOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  EditOutlined,
  BookOutlined as TaskBookOutlined,
  InboxOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  NotificationOutlined,
  MessageOutlined,
  CommentOutlined,
  UsergroupAddOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * Hover-expand sidebar.
 *
 * Two states control width:
 *   - `expanded` is true while the cursor is over the sidebar OR the user has pinned it.
 *   - `pinned` (toggled via the pin button) makes `expanded` permanently true and tells
 *     the parent layout to reflow content margin so nothing sits under the sidebar.
 *
 * When not pinned, the sidebar overlays content during hover — content does NOT reflow.
 *
 * After the user clicks a menu item, we collapse back to the rail (unless pinned), so
 * the sidebar gets out of the way of the new page.
 */
const AppSidebar = ({
  expanded,
  pinned,
  onPinChange,
  onHoverChange,
  railWidth = 64,
  expandedWidth = 240,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode, toggleTheme, theme: antdTheme } = useTheme();

  const userName = user?.user_metadata?.full_name || 'User';
  // Check for cb_admin_code in user_metadata to determine if user is cb_admin
  const isCbAdmin = user?.user_metadata?.cb_admin_code || user?.app_metadata?.role === 'cb_admin';
  const userRole = user?.app_metadata?.role || (isCbAdmin ? 'cb_admin' : user?.user_metadata?.role) || 'user';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
    }
  };

  const getMenuItems = () => {
    // Mirrors the mobile app drawer (Classbridge_V1/../classbridge/src/components/layout/drawer.config.ts)
    // — same section order (Main → Learning → Academic → Finance → Transport → HR → Admin),
    // same labels, same items where the web has a route.
    //
    // Web extras that don't exist on mobile are slotted into their nearest mobile section
    // (e.g. School Setup, Salary Components, AI Test Generator, Finance sub-pages).
    //
    // Mobile-only items currently SKIPPED on web because there's no route yet:
    //   • My Bus, My Class                     (Main)
    //   • Grade Book                           (Academic)
    //   • Buses, Drivers, Assignments, Live,   (entire Transport section)
    //     Routes, Trip Simulator
    // When those web pages ship, add them back to the matching section below.
    const allItems = [
      // ─────────────────────────────────────────────────────────────────────
      // CB Admin — separate audience, kept flat (mobile drawer has no equivalent)
      // ─────────────────────────────────────────────────────────────────────
      {
        key: '/cb-admin-dashboard',
        icon: <BankOutlined />,
        label: 'CB Admin Dashboard',
        roles: ['cb_admin'],
      },
      {
        key: '/add-schools',
        icon: <TeamOutlined />,
        label: 'Manage Schools',
        roles: ['cb_admin'],
      },
      {
        key: '/users',
        icon: <TeamOutlined />,
        label: 'Users',
        roles: ['cb_admin'],
      },

      // ─────────────────────────────────────────────────────────────────────
      // MAIN  (mobile section 1)
      // ─────────────────────────────────────────────────────────────────────
      {
        key: '/',
        icon: <HomeOutlined />,
        label: 'Dashboard',
        roles: ['cb_admin', 'superadmin', 'admin', 'student'],
      },
      {
        key: '/chatbot',
        icon: <RobotOutlined />,
        label: 'Ask Sage',
        roles: ['superadmin', 'admin', 'student'],
      },
      {
        key: '/academics/announcements',
        icon: <NotificationOutlined />,
        label: 'Announcements',
        roles: ['superadmin', 'admin', 'student'],
      },
      {
        key: '/calendar',
        icon: <CalendarOutlined />,
        label: 'Calendar',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/calendar',
        icon: <CalendarOutlined />,
        label: 'Calendar',
        roles: ['student'],
      },
      {
        key: '/timetable',
        icon: <ClockCircleOutlined />,
        label: 'Timetable',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/timetable',
        icon: <ClockCircleOutlined />,
        label: 'Timetable',
        roles: ['student'],
      },
      {
        key: '/academics/communication-hub',
        icon: <MessageOutlined />,
        label: 'Feedback',
        roles: ['superadmin', 'admin', 'student'],
      },

      // ─────────────────────────────────────────────────────────────────────
      // LEARNING  (mobile section 2)
      // ─────────────────────────────────────────────────────────────────────
      {
        key: '/learning-resources',
        icon: <FileTextOutlined />,
        label: 'Resources',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/resources',
        icon: <FileTextOutlined />,
        label: 'Resources',
        roles: ['student'],
      },
      {
        key: '/syllabus',
        icon: <BookOutlined />,
        label: 'Syllabus',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/syllabus',
        icon: <BookOutlined />,
        label: 'Syllabus',
        roles: ['student'],
      },

      // ─────────────────────────────────────────────────────────────────────
      // ACADEMIC  (mobile section 3)
      // ─────────────────────────────────────────────────────────────────────
      {
        key: '/attendance',
        icon: <CalendarOutlined />,
        label: 'Attendance',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/attendance',
        icon: <CalendarOutlined />,
        label: 'Attendance',
        roles: ['student'],
      },
      {
        key: '/test-management',
        icon: <EditOutlined />,
        label: 'Assessments',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/take-tests',
        icon: <EditOutlined />,
        label: 'Assessments',
        roles: ['student'],
      },
      // Mobile "Grade Book" — no web route yet. Add when /gradebook ships.
      {
        key: '/student/results',
        icon: <TrophyOutlined />,
        label: 'My Results',
        roles: ['student'],
      },
      {
        key: '/analytics',
        icon: <BarChartOutlined />,
        label: 'Analytics',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/analytics',
        icon: <BarChartOutlined />,
        label: 'My Analytics',
        roles: ['student'],
      },
      {
        key: '/task-management',
        icon: <TaskBookOutlined />,
        label: 'Tasks',
        roles: ['superadmin', 'admin', 'student'],
      },

      // ─────────────────────────────────────────────────────────────────────
      // FINANCE  (mobile section 4)
      // ─────────────────────────────────────────────────────────────────────
      {
        key: '/fees',
        icon: <DollarOutlined />,
        label: 'Fees',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/fees',
        icon: <DollarOutlined />,
        label: 'My Fees',
        roles: ['student'],
      },
      {
        key: '/finance',
        icon: <DashboardOutlined />,
        label: 'Finance Hub',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/finance/transactions',
        icon: <FileTextOutlined />,
        label: 'Transactions',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/finance/accounts',
        icon: <BankOutlined />,
        label: 'Accounts & Categories',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/finance/reports',
        icon: <BarChartOutlined />,
        label: 'Reports',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/finance/inconsistencies',
        icon: <WarningOutlined />,
        label: 'Inconsistencies',
        roles: ['superadmin'],
      },

      // ─────────────────────────────────────────────────────────────────────
      // TRANSPORT  (mobile section 5)
      // No web routes for any transport pages yet — entire section omitted.
      // When transport ships on web, add Buses/Drivers/Assignments/Live/Routes/Simulator here.
      // ─────────────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────────────
      // HR  (mobile section 6)
      // ─────────────────────────────────────────────────────────────────────
      {
        key: '/hr',
        icon: <DashboardOutlined />,
        label: 'HR Dashboard',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/staff',
        icon: <TeamOutlined />,
        label: 'Staff',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/payroll',
        icon: <DollarOutlined />,
        label: 'Payroll',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/leaves',
        icon: <CalendarOutlined />,
        label: 'Leaves',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/attendance',
        icon: <CalendarOutlined />,
        label: 'Staff Attendance',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/salary-components',
        icon: <DollarOutlined />,
        label: 'Salary Components',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/my',
        icon: <UserOutlined />,
        label: 'My HR',
        roles: ['superadmin', 'admin', 'student'],
      },

      // ─────────────────────────────────────────────────────────────────────
      // ADMIN  (mobile section 7)
      // ─────────────────────────────────────────────────────────────────────
      {
        key: '/school-setup',
        icon: <SettingOutlined />,
        label: 'School Setup',
        roles: ['superadmin'],
      },
      {
        key: '/users',
        icon: <TeamOutlined />,
        label: 'Users',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/add-specific-class',
        icon: <AppstoreOutlined />,
        label: 'Classes',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/add-subjects',
        icon: <ExperimentOutlined />,
        label: 'Subjects',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/manage/inventory',
        icon: <InboxOutlined />,
        label: 'Inventory',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/manage/admissions',
        icon: <UsergroupAddOutlined />,
        label: 'Admissions',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/academics/report-comments',
        icon: <CommentOutlined />,
        label: 'Report Comments',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/ai-test-generator',
        icon: <ThunderboltOutlined />,
        label: 'AI Test Generator',
        roles: ['superadmin', 'admin'],
      },
    ];

    const visible = allItems.filter((item) => item.roles.includes(userRole));

    // Mobile drawer uses lightweight section headers (Main / Learning / Academic / etc.).
    // We tag each menu item with the section it belongs to using its index in `allItems`,
    // then group consecutive items under their section header. AntD's `type: 'group'`
    // renders a non-clickable section label — exactly the mobile drawer's pattern.
    //
    // Section boundaries are defined by the start `key` of each section. The CB Admin
    // role bypasses section headers (it only sees its 3 dedicated items, no need to label).
    const SECTIONS = [
      { name: null,           startKey: '/cb-admin-dashboard' }, // CB Admin: no header
      { name: 'Main',         startKey: '/' },
      { name: 'Learning',     startKey: '/learning-resources' },
      { name: 'Academic',     startKey: '/attendance' },
      { name: 'Finance',      startKey: '/fees' },
      { name: 'HR',           startKey: '/hr' },
      { name: 'Admin',        startKey: '/school-setup' },
    ];

    const out = [];
    let currentSectionIdx = -1;
    let currentGroupChildren = null;

    const flushGroup = () => {
      if (currentGroupChildren && currentGroupChildren.length > 0) {
        const section = SECTIONS[currentSectionIdx];
        if (section.name) {
          out.push({
            type: 'group',
            key: `section-${section.name}`,
            label: section.name,
            children: currentGroupChildren,
          });
        } else {
          // Untitled section (CB Admin) — push children directly
          out.push(...currentGroupChildren);
        }
      }
      currentGroupChildren = [];
    };

    for (const item of visible) {
      const matchedIdx = SECTIONS.findIndex((s) => s.startKey === item.key);
      if (matchedIdx !== -1) {
        flushGroup();
        currentSectionIdx = matchedIdx;
      }
      if (currentSectionIdx === -1) continue; // item before any section header
      currentGroupChildren.push({
        key: item.key,
        icon: item.icon,
        label: item.label,
        onClick: () => {
          navigate(item.key);
          // Collapse the sidebar back to the rail after navigating, unless
          // the user has pinned it. Parent owns hovered state.
          onHoverChange?.(false);
        },
      });
    }
    flushGroup();

    // Drop empty section groups (some sections may have zero items for a given role).
    return out.filter((g) => g.type !== 'group' || (g.children && g.children.length > 0));
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: 'Profile'
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleLogout
    }
  ];

  // Avatar/role badge are duplicated in expanded vs rail mode — extracted to keep the JSX readable.
  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase();
  const roleLabel = userRole === 'superadmin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : userRole;
  const roleTagStyle = {
    textTransform: 'capitalize',
    fontWeight: 500,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    margin: 0,
    background: '#e0f2fe',
    color: '#0369a1',
    border: '1px solid #bae6fd',
  };
  const avatarBg = 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';
  const avatarFontStyle = {
    background: avatarBg,
    fontWeight: 700,
    fontFamily: 'Geist Sans, sans-serif',
    textShadow: '0 1px 2px rgba(0,0,0,0.2)',
    letterSpacing: '0.5px',
  };

  return (
    <div
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        height: '100vh',
        width: expanded ? expandedWidth : railWidth,
        background: antdTheme.token.colorBgContainer,
        borderRight: `1px solid ${antdTheme.token.colorBorder}`,
        boxShadow: expanded && !pinned ? antdTheme.token.boxShadowSecondary : 'none',
        overflow: 'hidden',
        // Above content. Pinned doesn't strictly need this (content reflows), but
        // we keep one z-index for both states so behavior stays consistent.
        zIndex: 100,
        transition: 'width 0.18s ease, box-shadow 0.18s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header (avatar + name + pin) */}
      <div style={{
        padding: expanded ? antdTheme.token.paddingLG : '12px 8px',
        borderBottom: `1px solid ${antdTheme.token.colorBorder}`,
        height: expanded ? 80 : 60,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: expanded ? 'space-between' : 'center',
        background: antdTheme.token.colorBgContainer,
      }}>
        {expanded ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <Avatar size={40} style={{ ...avatarFontStyle, fontSize: 15 }}>{initials}</Avatar>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <Text strong style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: antdTheme.token.colorText,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {userName}
                </Text>
                <Tag color="blue" style={roleTagStyle}>{roleLabel}</Tag>
              </div>
            </div>
            <Tooltip title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'} placement="right">
              <Button
                type="text"
                size="small"
                icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
                onClick={() => onPinChange?.(!pinned)}
                style={{ color: pinned ? antdTheme.token.colorPrimary : antdTheme.token.colorTextSecondary }}
              />
            </Tooltip>
          </>
        ) : (
          <Tooltip
            title={
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>{userName}</div>
                <Tag color="blue" style={roleTagStyle}>{roleLabel}</Tag>
              </div>
            }
            placement="right"
          >
            <Avatar size={32} style={{ ...avatarFontStyle, fontSize: 12 }}>{initials}</Avatar>
          </Tooltip>
        )}
      </div>

      {/* Navigation menu — Menu's `inlineCollapsed` trims to icons-only in rail mode and
          shows tooltips on hover. */}
      <div style={{
        flex: '1 1 auto',
        minHeight: 0,
        background: antdTheme.token.colorBgContainer,
        padding: '8px 0',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        <Menu
          mode="inline"
          inlineCollapsed={!expanded}
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          style={{ border: 'none', background: antdTheme.token.colorBgContainer }}
          theme={isDarkMode ? 'dark' : 'light'}
        />
      </div>

      {/* Theme toggle */}
      <div style={{
        padding: expanded ? antdTheme.token.padding : '8px',
        borderTop: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: expanded ? 'space-between' : 'center',
      }}>
        {expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: antdTheme.token.marginXS }}>
            {isDarkMode
              ? <BulbFilled style={{ color: '#fbbf24', fontSize: 14 }} />
              : <BulbOutlined style={{ color: antdTheme.token.colorTextSecondary, fontSize: 14 }} />}
            <Text style={{ fontSize: antdTheme.token.fontSizeSM, color: antdTheme.token.colorTextSecondary, fontWeight: 500 }}>
              {isDarkMode ? 'Dark' : 'Light'} Mode
            </Text>
          </div>
        )}
        <Tooltip title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} mode`} placement="right">
          <Switch checked={isDarkMode} onChange={toggleTheme} size="small" />
        </Tooltip>
      </div>

      {/* Sign out */}
      <div style={{
        padding: expanded ? antdTheme.token.padding : '8px',
        borderTop: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer,
        flexShrink: 0,
      }}>
        <Tooltip title="Sign Out" placement="right">
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{
              width: '100%',
              height: expanded ? 36 : 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              color: antdTheme.token.colorError,
              fontWeight: 500,
              background: 'transparent',
              border: 'none',
            }}
          >
            {expanded && 'Sign Out'}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default AppSidebar;