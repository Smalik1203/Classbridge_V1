import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout, ConfigProvider, App as AntApp, Spin, Tooltip, Typography } from 'antd';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  HomeOutlined, RobotOutlined, NotificationOutlined, CalendarOutlined,
  ClockCircleOutlined, MessageOutlined, FileTextOutlined, BookOutlined,
  EditOutlined, BarChartOutlined, DollarOutlined, DashboardOutlined,
  BankOutlined, WarningOutlined, TeamOutlined, UserOutlined,
  SettingOutlined, AppstoreOutlined, ExperimentOutlined, InboxOutlined,
  UsergroupAddOutlined, CommentOutlined, ThunderboltOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { Sparkles } from 'lucide-react';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import updateLocale from 'dayjs/plugin/updateLocale';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useAuth } from './AuthProvider';

// Configure dayjs globally to start week on Monday
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(updateLocale);
dayjs.locale('en');
dayjs.updateLocale('en', {
  weekStart: 1,
});

// Configure Ant Design locale to start week on Monday
const customLocale = {
  ...enUS,
  DatePicker: {
    ...enUS.DatePicker,
    lang: {
      ...enUS.DatePicker.lang,
      locale: 'en_US',
      weekStart: 1,
    },
  },
  Calendar: {
    ...enUS.Calendar,
    lang: {
      ...enUS.Calendar.lang,
      locale: 'en_US',
      weekStart: 1,
    },
  },
};
// Eager imports (small, always needed)
import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from '@/features/auth';
import { PrivateRoute } from '@/features/auth';
import { Sidebar } from '@/shared/components';
import { UnauthorizedPage } from '@/features/auth';
import { routeAccess } from './routeAccess';

// Lazy imports (large components, loaded on demand)
const Dashboard = lazy(() => import('@/features/students/pages/Dashboard'));
const CBAdminDashboard = lazy(() => import('@/features/school/pages/CBAdminDashboard'));
const AddSchools = lazy(() => import('@/features/school/pages/AddSchools'));
const Assessments = lazy(() => import('@/features/tests/pages/Assessments'));
const Attendance = lazy(() => import('@/features/attendance/pages/Attendance'));
const Fees = lazy(() => import('@/features/fees/pages/Fees'));
const SetupSchool = lazy(() => import('@/features/school/pages/SetupSchool'));
const AddSpecificClass = lazy(() => import('@/features/school/components/AddSpecificClass'));
const AddSubjects = lazy(() => import('@/features/school/components/AddSubjects'));

// Single user-management page — replaces AddAdmin / AddSuperAdmin / AddStudent
// / SuperAdminCounter / SignUpUser scattered pages.
const UsersHub = lazy(() => import('@/features/users/pages/UsersHub'));
const Analytics = lazy(() => import('@/features/analytics/pages/Analytics'));
const Timetable = lazy(() => import('@/features/timetable/pages/Timetable'));
const Calendar = lazy(() => import('@/features/calendar/pages/Calendar'));
const SyllabusPage = lazy(() => import('@/features/syllabus/pages/Syllabus'));
const LearningResources = lazy(() => import('@/features/learning-resources/pages/LearningResources'));
const UnifiedTestManagement = lazy(() => import('@/features/tests/pages/UnifiedTestManagement'));
const TaskManagement = lazy(() => import('@/features/tasks/pages/TaskManagement'));
const TestTaking = lazy(() => import('@/features/tests/pages/TestTaking'));
const StudentTimetable = lazy(() => import('@/features/timetable/pages/StudentTimetable'));
const StudentSyllabus = lazy(() => import('@/features/syllabus/pages/StudentSyllabus'));
const StudentResults = lazy(() => import('@/features/students/pages/StudentResults'));
const StudentLearningResources = lazy(() => import('@/features/learning-resources/pages/StudentLearningResources'));
const StudentCalendar = lazy(() => import('@/features/calendar/pages/StudentCalendar'));
const StudentAttendance = lazy(() => import('@/features/students/pages/StudentAttendance'));
const StudentSelfAnalytics = lazy(() => import('@/features/analytics/pages/StudentSelfAnalytics'));

// HRMS
const HrHub = lazy(() => import('@/features/hr/pages/HrHub'));

// Communications
const Announcements = lazy(() => import('@/features/communications/pages/Announcements'));
const CommunicationHub = lazy(() => import('@/features/communications/pages/CommunicationHub'));
const ReportComments = lazy(() => import('@/features/communications/pages/ReportComments'));
const StaffDirectory = lazy(() => import('@/features/hr/pages/StaffDirectory'));
const StaffDetail = lazy(() => import('@/features/hr/pages/StaffDetail'));
const Payroll = lazy(() => import('@/features/hr/pages/Payroll'));
const LeavesApprovals = lazy(() => import('@/features/hr/pages/LeavesApprovals'));
const StaffAttendance = lazy(() => import('@/features/hr/pages/StaffAttendance'));
const MyHr = lazy(() => import('@/features/hr/pages/MyHr'));
const SalaryComponents = lazy(() => import('@/features/hr/pages/SalaryComponents'));

// Admissions
const AdmissionsPipeline = lazy(() => import('@/features/admissions/pages/AdmissionsPipeline'));

// Inventory
const Inventory = lazy(() => import('@/features/inventory/pages/Inventory'));

// Sage Chatbot
const Chatbot = lazy(() => import('@/features/chatbot/pages/Chatbot'));

// Finance (school GL)
const FinanceHub          = lazy(() => import('@/features/finance/pages/FinanceHub'));
const FinanceTransactions = lazy(() => import('@/features/finance/pages/Transactions'));
const FinanceAccounts     = lazy(() => import('@/features/finance/pages/AccountsCategories'));
const FinanceReports      = lazy(() => import('@/features/finance/pages/Reports'));
const FinanceInconsistencies = lazy(() => import('@/features/finance/pages/Inconsistencies'));



const { Content } = Layout;
const { Title } = Typography;

// Sidebar widths — keep in sync with Sidebar.jsx.
const RAIL_WIDTH = 64;
const EXPANDED_WIDTH = 240;
const SIDEBAR_OFFSET = 12;        // gap from viewport to sidebar (all 4 sides)
const CONTENT_SIDEBAR_GAP = 12;   // gap from sidebar right edge to content (matches SIDEBAR_OFFSET)

// Page header meta — icon + label per route, mirrors the sidebar nav.
// Dashboard ('/' and '/dashboard') is intentionally excluded.
const PAGE_META = {
  '/cb-admin-dashboard':         { icon: <BankOutlined />,           label: 'CB Admin Dashboard' },
  '/add-schools':                { icon: <TeamOutlined />,           label: 'Manage Schools' },
  '/users':                      { icon: <TeamOutlined />,           label: 'Users' },
  '/chatbot':                    { icon: <Sparkles size={26} />,     label: 'Ask Sage' },
  '/academics/announcements':    { icon: <NotificationOutlined />,   label: 'Announcements' },
  '/calendar':                   { icon: <CalendarOutlined />,       label: 'Calendar' },
  '/student/calendar':           { icon: <CalendarOutlined />,       label: 'Calendar' },
  '/timetable':                  { icon: <ClockCircleOutlined />,    label: 'Timetable' },
  '/student/timetable':          { icon: <ClockCircleOutlined />,    label: 'Timetable' },
  '/learning-resources':         { icon: <FileTextOutlined />,       label: 'Resources' },
  '/student/resources':          { icon: <FileTextOutlined />,       label: 'Resources' },
  '/syllabus':                   { icon: <BookOutlined />,           label: 'Syllabus' },
  '/student/syllabus':           { icon: <BookOutlined />,           label: 'Syllabus' },
  '/attendance':                 { icon: <CalendarOutlined />,       label: 'Attendance' },
  '/student/attendance':         { icon: <CalendarOutlined />,       label: 'Attendance' },
  '/test-management':            { icon: <EditOutlined />,           label: 'Assessments' },
  '/take-tests':                 { icon: <EditOutlined />,           label: 'Assessments' },
  '/student/results':            { icon: <TrophyOutlined />,         label: 'My Results' },
  '/analytics':                  { icon: <BarChartOutlined />,       label: 'Analytics' },
  '/student/analytics':          { icon: <BarChartOutlined />,       label: 'My Analytics' },
  '/task-management':            { icon: <BookOutlined />,           label: 'Tasks' },
  '/fees':                       { icon: <DollarOutlined />,         label: 'Fees' },
  '/finance':                    { icon: <DashboardOutlined />,      label: 'Finance Hub' },
  '/finance/transactions':       { icon: <FileTextOutlined />,       label: 'Transactions' },
  '/finance/accounts':           { icon: <BankOutlined />,           label: 'Accounts & Categories' },
  '/finance/reports':            { icon: <BarChartOutlined />,       label: 'Reports' },
  '/finance/inconsistencies':    { icon: <WarningOutlined />,        label: 'Inconsistencies' },
  '/hr':                         { icon: <DashboardOutlined />,      label: 'HR Dashboard' },
  '/hr/staff':                   { icon: <TeamOutlined />,           label: 'Staff' },
  '/hr/payroll':                 { icon: <DollarOutlined />,         label: 'Payroll' },
  '/hr/leaves':                  { icon: <CalendarOutlined />,       label: 'Leaves' },
  '/hr/attendance':              { icon: <CalendarOutlined />,       label: 'Staff Attendance' },
  '/hr/salary-components':       { icon: <DollarOutlined />,         label: 'Salary Components' },
  '/hr/my':                      { icon: <UserOutlined />,           label: 'My HR' },
  '/school-setup':               { icon: <SettingOutlined />,        label: 'School Setup' },
  '/add-specific-class':         { icon: <AppstoreOutlined />,       label: 'Classes' },
  '/add-subjects':               { icon: <ExperimentOutlined />,     label: 'Subjects' },
  '/manage/admissions':          { icon: <UsergroupAddOutlined />,   label: 'Admissions' },
  '/ai-test-generator':          { icon: <ThunderboltOutlined />,    label: 'AI Test Generator' },
};

function PageHeader() {
  const { pathname } = useLocation();
  if (pathname === '/' || pathname === '/dashboard') return null;
  // Match exact path; falls back to longest path-prefix match for dynamic segments.
  let meta = PAGE_META[pathname];
  if (!meta) {
    const candidate = Object.keys(PAGE_META)
      .filter((p) => pathname.startsWith(p + '/'))
      .sort((a, b) => b.length - a.length)[0];
    if (candidate) meta = PAGE_META[candidate];
  }
  if (!meta) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: 28, color: '#3a8fcf', display: 'inline-flex' }}>{meta.icon}</span>
      <Title level={3} style={{ margin: 0 }}>{meta.label}</Title>
    </div>
  );
}

function AppLayout({ children }) {
  const { isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarExpanded', JSON.stringify(expanded));
  }, [expanded]);

  const pagePaddingX = 12;
  const pageMaxWidth = 1400;
  const pagePaddingTop = 64;
  const contentLeftOffset =
    SIDEBAR_OFFSET + (expanded ? EXPANDED_WIDTH : RAIL_WIDTH) + CONTENT_SIDEBAR_GAP;

  return (
    <Layout style={{
      minHeight: '100vh',
      background: isDarkMode
        ? '#000000'
        : '#f8fafc',
    }}>
      <Sidebar
        expanded={expanded}
        railWidth={RAIL_WIDTH}
        expandedWidth={EXPANDED_WIDTH}
      />
      <Tooltip title={expanded ? 'Collapse sidebar' : 'Expand sidebar'} placement="right">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{
            position: 'fixed',
            top: 22,
            left: contentLeftOffset,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.10)',
            boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
            color: '#475569',
            cursor: 'pointer',
            zIndex: 101,
            transition: 'left 0.2s ease, background 0.15s ease, color 0.15s ease',
          }}
        >
          {expanded ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </button>
      </Tooltip>
      <Layout style={{
        marginLeft: contentLeftOffset,
        background: 'transparent',
        transition: 'margin-left 0.2s ease',
      }}>
        <Content style={{
          paddingTop: pagePaddingTop,
          paddingBottom: 24,
          paddingLeft: pagePaddingX,
          paddingRight: pagePaddingX,
          minHeight: '100vh',
          background: 'transparent',
          maxWidth: pageMaxWidth,
          margin: 0,
          width: '100%',
        }}>
          <PageHeader />
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { theme, isDarkMode } = useTheme();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 100%)'
          : 'linear-gradient(135deg, rgb(245, 247, 250) 0%, rgb(195, 207, 226) 100%)',
        color: isDarkMode ? '#ffffff' : '#000000'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <ConfigProvider theme={theme} locale={customLocale}>
      <AntApp>
        <Router>
        {user && (
          <AppLayout>
            <Suspense fallback={
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '80vh' 
              }}>
                <Spin size="large" tip="Loading..." />
              </div>
            }>
              <Routes>
              {/* Logged-in routes */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cb-admin-dashboard" element={<CBAdminDashboard />} />
              
              {/* School Management Routes */}
              <Route path="/add-schools" element={<PrivateRoute allowedRoles={routeAccess.addSchools}><AddSchools /></PrivateRoute>} />
              <Route path="/school-setup" element={<PrivateRoute allowedRoles={routeAccess.schoolSetup}><SetupSchool /></PrivateRoute>} />
              <Route path="/add-specific-class" element={<PrivateRoute allowedRoles={routeAccess.addSpecificClass}><AddSpecificClass /></PrivateRoute>} />
              <Route path="/add-subjects" element={<PrivateRoute allowedRoles={routeAccess.addSubjects}><AddSubjects /></PrivateRoute>} />

              {/* User Management — single page that lists everyone using the app */}
              <Route path="/users" element={<PrivateRoute allowedRoles={routeAccess.users}><UsersHub /></PrivateRoute>} />

              {/* Backwards-compat redirects for scattered legacy routes */}
              <Route path="/add-admin" element={<Navigate to="/users" replace />} />
              <Route path="/add-super-admin" element={<Navigate to="/users" replace />} />
              <Route path="/add-student" element={<Navigate to="/users" replace />} />
              <Route path="/super-admin-count" element={<Navigate to="/users" replace />} />
              <Route path="/signup-user" element={<Navigate to="/users" replace />} />

              {/* Feature Routes */}
              <Route path="/attendance" element={<PrivateRoute allowedRoles={routeAccess.attendance}><Attendance /></PrivateRoute>} />
              <Route path="/fees" element={<PrivateRoute allowedRoles={routeAccess.fees}><Fees /></PrivateRoute>} />
              {/* Unified Analytics — handles /analytics, /analytics/student/:id, /analytics/class/:id,
                  legacy tab redirects (/daily-trends, /weak-areas, /topic-heatmap, etc.) */}
              <Route path="/analytics/*" element={<PrivateRoute allowedRoles={routeAccess.analytics}><Analytics /></PrivateRoute>} />
              <Route path="/timetable" element={<PrivateRoute allowedRoles={routeAccess.timetable}><Timetable /></PrivateRoute>} />
              <Route path="/calendar" element={<PrivateRoute allowedRoles={routeAccess.timetable}><Calendar /></PrivateRoute>} />
              <Route path="/syllabus" element={<PrivateRoute allowedRoles={routeAccess.syllabus}><SyllabusPage /></PrivateRoute>} />
              <Route path="/learning-resources" element={<PrivateRoute allowedRoles={routeAccess.learningResources}><LearningResources /></PrivateRoute>} />
              <Route path="/test-management" element={<PrivateRoute allowedRoles={routeAccess.testManagement}><UnifiedTestManagement /></PrivateRoute>} />
              <Route path="/task-management" element={<PrivateRoute allowedRoles={routeAccess.taskManagement}><TaskManagement /></PrivateRoute>} />
              <Route path="/take-tests" element={<PrivateRoute allowedRoles={['student']}><TestTaking /></PrivateRoute>} />
              <Route path="/assessments" element={<PrivateRoute allowedRoles={routeAccess.assessments}><Assessments /></PrivateRoute>} />

              {/* Student Routes */}
              <Route path="/student/timetable" element={<PrivateRoute allowedRoles={['student']}><StudentTimetable /></PrivateRoute>} />
              <Route path="/student/syllabus" element={<PrivateRoute allowedRoles={['student']}><StudentSyllabus /></PrivateRoute>} />
              <Route path="/student/results" element={<PrivateRoute allowedRoles={['student']}><StudentResults /></PrivateRoute>} />
              <Route path="/student/resources" element={<PrivateRoute allowedRoles={['student']}><StudentLearningResources /></PrivateRoute>} />
              <Route path="/student/calendar" element={<PrivateRoute allowedRoles={['student']}><StudentCalendar /></PrivateRoute>} />
              <Route path="/student/attendance" element={<PrivateRoute allowedRoles={['student']}><StudentAttendance /></PrivateRoute>} />
              <Route path="/student/analytics" element={<PrivateRoute allowedRoles={['student']}><StudentSelfAnalytics /></PrivateRoute>} />

              {/* HRMS — mirrors /hr/* on mobile */}
              <Route path="/hr" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><HrHub /></PrivateRoute>} />
              <Route path="/hr/staff" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><StaffDirectory /></PrivateRoute>} />
              <Route path="/hr/staff/:id" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><StaffDetail /></PrivateRoute>} />
              <Route path="/hr/payroll" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><Payroll /></PrivateRoute>} />
              <Route path="/hr/leaves" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><LeavesApprovals /></PrivateRoute>} />
              <Route path="/hr/attendance" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><StaffAttendance /></PrivateRoute>} />
              <Route path="/hr/my" element={<PrivateRoute allowedRoles={['superadmin', 'admin', 'student']}><MyHr /></PrivateRoute>} />
              <Route path="/hr/salary-components" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><SalaryComponents /></PrivateRoute>} />

              {/* Management — mirrors /manage/* on mobile */}
              <Route path="/manage/admissions" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><AdmissionsPipeline /></PrivateRoute>} />
              <Route path="/manage/inventory" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><Inventory /></PrivateRoute>} />

              {/* Finance (school GL) — mirrors /finance on mobile (super-admin only) */}
              <Route path="/finance"                  element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><FinanceHub /></PrivateRoute>} />
              <Route path="/finance/transactions"     element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><FinanceTransactions /></PrivateRoute>} />
              <Route path="/finance/accounts"         element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><FinanceAccounts /></PrivateRoute>} />
              <Route path="/finance/reports"          element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><FinanceReports /></PrivateRoute>} />
              <Route path="/finance/inconsistencies"  element={<PrivateRoute allowedRoles={['superadmin']}><FinanceInconsistencies /></PrivateRoute>} />

              {/* AI tools — mirrors mobile */}
              <Route path="/chatbot" element={<PrivateRoute allowedRoles={['superadmin', 'admin', 'student']}><Chatbot /></PrivateRoute>} />
              {/* AI Test Generator — redirects into the unified Test Management hub */}
              <Route path="/ai-test-generator" element={<Navigate to="/test-management?mode=ai" replace />} />

              {/* Advanced analytics (/analytics/weak-areas, /topic-heatmap, /misconception-report)
                  are now handled by the unified Analytics router as legacy → ?tab= redirects */}

              {/* Academics — mirrors /academics/* on mobile (extras not yet built on web) */}
              <Route path="/academics/announcements" element={<PrivateRoute allowedRoles={['superadmin', 'admin', 'student']}><Announcements /></PrivateRoute>} />
              <Route path="/academics/communication-hub" element={<PrivateRoute allowedRoles={['superadmin', 'admin', 'student']}><CommunicationHub /></PrivateRoute>} />
              <Route path="/academics/report-comments" element={<PrivateRoute allowedRoles={['superadmin', 'admin']}><ReportComments /></PrivateRoute>} />

              {/* Test detail screens — mirrors /test/[testId]/* on mobile.
                  Web folds these into the unified Test Management hub. */}
              <Route path="/test/create" element={<Navigate to="/test-management" replace />} />
              <Route path="/test/:testId/questions" element={<Navigate to="/test-management" replace />} />
              <Route path="/test/:testId/results" element={<Navigate to="/test-management" replace />} />
              <Route path="/test/:testId/marks" element={<Navigate to="/test-management" replace />} />

              {/* Error Routes */}
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              
              {/* Password reset route - accessible when logged in (Supabase auto-logs in on reset link) */}
              {/* ResetPasswordPage uses AuthLayout internally, so it will render full-page without sidebar */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
            </Suspense>
          </AppLayout>
        )}

        {!user && (
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        )}
        </Router>
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
