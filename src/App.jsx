import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider, App as AntApp, Spin } from 'antd';
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

// Sidebar widths — keep in sync with Sidebar.jsx.
const RAIL_WIDTH = 64;
const EXPANDED_WIDTH = 240;

// Global layout with hover-expand sidebar.
//
// Default: a 64px rail is always visible (icons only). Hovering the rail
// expands it to 240px as an overlay — the page content stays put.
// Pinning (via the button in the sidebar header) keeps it expanded AND
// reflows the content margin so nothing is hidden under it. Preference
// is persisted in localStorage.
function AppLayout({ children }) {
  const { isDarkMode } = useTheme();
  const [pinned, setPinned] = useState(() => {
    const saved = localStorage.getItem('sidebarPinned');
    return saved ? JSON.parse(saved) : false;
  });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarPinned', JSON.stringify(pinned));
  }, [pinned]);

  const expanded = pinned || hovered;

  return (
    <Layout style={{
      minHeight: '100vh',
      background: isDarkMode
        ? '#000000'
        : 'linear-gradient(135deg, rgb(245, 247, 250) 0%, rgb(195, 207, 226) 100%)',
    }}>
      <Sidebar
        expanded={expanded}
        pinned={pinned}
        onPinChange={setPinned}
        onHoverChange={setHovered}
        railWidth={RAIL_WIDTH}
        expandedWidth={EXPANDED_WIDTH}
      />
      <Layout style={{
        // When pinned, content reflows to make room. When floating (hover),
        // content stays put under a 64px gutter and the expanded sidebar
        // overlays on top.
        marginLeft: pinned ? EXPANDED_WIDTH : RAIL_WIDTH,
        background: 'transparent',
        transition: 'margin-left 0.2s ease',
      }}>
        <Content style={{
          padding: '24px',
          minHeight: '100vh',
          background: 'transparent',
        }}>
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
