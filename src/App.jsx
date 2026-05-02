import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, Bell, ChevronRight } from 'lucide-react';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import updateLocale from 'dayjs/plugin/updateLocale';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useAuth } from './AuthProvider';

// Keep Ant Design ConfigProvider/App for any remaining antd components
import { ConfigProvider, App as AntApp, Spin } from 'antd';
import { lightTheme } from '@/shared/ui/theme';

// Eager imports
import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from '@/features/auth';
import { PrivateRoute } from '@/features/auth';
import Sidebar from '@/shared/components/layout/Sidebar';
import { UnauthorizedPage } from '@/features/auth';
import { routeAccess } from './routeAccess';
import { AcademicYearProvider } from '@/features/analytics/context/AcademicYearContext';

dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(updateLocale);
dayjs.locale('en');
dayjs.updateLocale('en', { weekStart: 1 });

const customLocale = {
  ...enUS,
  DatePicker: { ...enUS.DatePicker, lang: { ...enUS.DatePicker?.lang, locale: 'en_US', weekStart: 1 } },
  Calendar:   { ...enUS.Calendar,   lang: { ...enUS.Calendar?.lang,   locale: 'en_US', weekStart: 1 } },
};

// Lazy imports
const Dashboard               = lazy(() => import('@/features/students/pages/Dashboard'));
const CBAdminDashboard        = lazy(() => import('@/features/school/pages/CBAdminDashboard'));
const AddSchools              = lazy(() => import('@/features/school/pages/AddSchools'));
const Assessments             = lazy(() => import('@/features/tests/pages/Assessments'));
const Attendance              = lazy(() => import('@/features/attendance/pages/Attendance'));
const Fees                    = lazy(() => import('@/features/fees/pages/Fees'));
const SetupSchool             = lazy(() => import('@/features/school/pages/SetupSchool'));
const AddSpecificClass        = lazy(() => import('@/features/school/components/AddSpecificClass'));
const AddSubjects             = lazy(() => import('@/features/school/components/AddSubjects'));
const UsersHub                = lazy(() => import('@/features/users/pages/UsersHub'));
const Analytics               = lazy(() => import('@/features/analytics/pages/Analytics'));
const Timetable               = lazy(() => import('@/features/timetable/pages/Timetable'));
const Calendar                = lazy(() => import('@/features/calendar/pages/Calendar'));
const SyllabusPage            = lazy(() => import('@/features/syllabus/pages/Syllabus'));
const LearningResources       = lazy(() => import('@/features/learning-resources/pages/LearningResources'));
const UnifiedTestManagement   = lazy(() => import('@/features/tests/pages/UnifiedTestManagement'));
const Gradebook               = lazy(() => import('@/features/tests/pages/Gradebook'));
const TaskManagement          = lazy(() => import('@/features/tasks/pages/TaskManagement'));
const TestTaking              = lazy(() => import('@/features/tests/pages/TestTaking'));
const StudentTimetable        = lazy(() => import('@/features/timetable/pages/StudentTimetable'));
const StudentSyllabus         = lazy(() => import('@/features/syllabus/pages/StudentSyllabus'));
const StudentResults          = lazy(() => import('@/features/students/pages/StudentResults'));
const StudentLearningResources= lazy(() => import('@/features/learning-resources/pages/StudentLearningResources'));
const StudentCalendar         = lazy(() => import('@/features/calendar/pages/StudentCalendar'));
const StudentAttendance       = lazy(() => import('@/features/students/pages/StudentAttendance'));
const StudentSelfAnalytics    = lazy(() => import('@/features/analytics/pages/StudentSelfAnalytics'));
const HrHub                   = lazy(() => import('@/features/hr/pages/HrHub'));
const Announcements           = lazy(() => import('@/features/communications/pages/Announcements'));
const CommunicationHub        = lazy(() => import('@/features/communications/pages/CommunicationHub'));
const ReportComments          = lazy(() => import('@/features/communications/pages/ReportComments'));
const StaffDirectory          = lazy(() => import('@/features/hr/pages/StaffDirectory'));
const StaffDetail             = lazy(() => import('@/features/hr/pages/StaffDetail'));
const Payroll                 = lazy(() => import('@/features/hr/pages/Payroll'));
const LeavesApprovals         = lazy(() => import('@/features/hr/pages/LeavesApprovals'));
const StaffAttendance         = lazy(() => import('@/features/hr/pages/StaffAttendance'));
const MyHr                    = lazy(() => import('@/features/hr/pages/MyHr'));
const SalaryComponents        = lazy(() => import('@/features/hr/pages/SalaryComponents'));
const MyTaxDeclaration        = lazy(() => import('@/features/hr/pages/MyTaxDeclaration'));
const TaxDeclarationsHr       = lazy(() => import('@/features/hr/pages/TaxDeclarationsHr'));
const Form16Generation        = lazy(() => import('@/features/hr/pages/Form16Generation'));
const Form24Q                 = lazy(() => import('@/features/hr/pages/Form24Q'));
const Form15GH                = lazy(() => import('@/features/hr/pages/Form15GH'));
const TaxSettings             = lazy(() => import('@/features/hr/pages/TaxSettings'));
const MarkStaffAttendance     = lazy(() => import('@/features/hr/pages/MarkStaffAttendance'));
const AdmissionsPipeline      = lazy(() => import('@/features/admissions/pages/AdmissionsPipeline'));
const Inventory               = lazy(() => import('@/features/inventory/pages/Inventory'));
const Chatbot                 = lazy(() => import('@/features/chatbot/pages/Chatbot'));
const FinanceHub              = lazy(() => import('@/features/finance/pages/FinanceHub'));
const FinanceTransactions     = lazy(() => import('@/features/finance/pages/Transactions'));
const FinanceAccounts         = lazy(() => import('@/features/finance/pages/AccountsCategories'));
const FinanceReports          = lazy(() => import('@/features/finance/pages/Reports'));
const FinanceInconsistencies  = lazy(() => import('@/features/finance/pages/Inconsistencies'));

const CRUMBS = {
  '/':                            ['Dashboard'],
  '/dashboard':                   ['Dashboard'],
  '/cb-admin-dashboard':          ['Platform', 'Overview'],
  '/add-schools':                 ['Platform', 'Schools'],
  '/users':                       ['Admin', 'Users'],
  '/attendance':                  ['Academic', 'Attendance'],
  '/student/attendance':          ['Academic', 'Attendance'],
  '/timetable':                   ['Academic', 'Timetable'],
  '/student/timetable':           ['Academic', 'Timetable'],
  '/calendar':                    ['Main', 'Calendar'],
  '/student/calendar':            ['Main', 'Calendar'],
  '/syllabus':                    ['Learning', 'Syllabus'],
  '/student/syllabus':            ['Learning', 'Syllabus'],
  '/learning-resources':          ['Learning', 'Resources'],
  '/student/resources':           ['Learning', 'Resources'],
  '/test-management':             ['Academic', 'Assessments'],
  '/gradebook':                   ['Academic', 'Gradebook'],
  '/take-tests':                  ['Academic', 'Assessments'],
  '/student/results':             ['Academic', 'My Results'],
  '/analytics':                   ['Academic', 'Analytics'],
  '/student/analytics':           ['Academic', 'My Analytics'],
  '/task-management':             ['Academic', 'Tasks'],
  '/fees':                        ['Finance', 'Fees'],
  '/finance':                     ['Finance', 'Hub'],
  '/finance/transactions':        ['Finance', 'Transactions'],
  '/finance/accounts':            ['Finance', 'Accounts'],
  '/finance/reports':             ['Finance', 'Reports'],
  '/finance/inconsistencies':     ['Finance', 'Inconsistencies'],
  '/hr':                          ['HR', 'Dashboard'],
  '/hr/staff':                    ['HR', 'Staff'],
  '/hr/payroll':                  ['HR', 'Payroll'],
  '/hr/leaves':                   ['HR', 'Leaves'],
  '/hr/attendance':               ['HR', 'Staff Attendance'],
  '/hr/attendance/mark':          ['HR', 'Mark Attendance'],
  '/hr/salary-components':        ['HR', 'Salary Components'],
  '/hr/my':                       ['HR', 'My HR'],
  '/hr/my/tax':                   ['HR', 'My HR', 'Tax Declaration'],
  '/hr/tax':                      ['HR', 'Tax Declarations'],
  '/hr/tax/form-16':              ['HR', 'Form 16'],
  '/hr/tax/form-24q':             ['HR', 'Form 24Q'],
  '/hr/tax/form-15gh':            ['HR', 'Form 15G / 15H'],
  '/hr/tax/settings':             ['HR', 'Tax Settings'],
  '/school-setup':                ['Admin', 'School Setup'],
  '/add-specific-class':          ['Admin', 'Classes'],
  '/add-subjects':                ['Admin', 'Subjects'],
  '/manage/admissions':           ['Operations', 'Admissions'],
  '/manage/inventory':            ['Operations', 'Inventory'],
  '/chatbot':                     ['Main', 'Ask Sage'],
  '/academics/announcements':     ['Main', 'Announcements'],
  '/academics/communication-hub': ['Main', 'Feedback'],
  '/academics/report-comments':   ['Admin', 'Report Comments'],
};

function getCrumbs(pathname) {
  if (CRUMBS[pathname]) return ['ClassBridge', ...CRUMBS[pathname]];
  const candidate = Object.keys(CRUMBS)
    .filter(p => p !== '/' && pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  if (candidate) return ['ClassBridge', ...CRUMBS[candidate]];
  return ['ClassBridge'];
}

function Topbar({ expanded }) {
  const { pathname } = useLocation();
  const crumbs = getCrumbs(pathname);

  return (
    <div className="cb-topbar">
      <div className="cb-crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <ChevronRight size={13} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />}
            <span className={i === crumbs.length - 1 ? 'current' : ''}>{c}</span>
          </span>
        ))}
      </div>

      <div className="cb-searchbox">
        <Search size={14} className="cb-search-ico" />
        <input placeholder="Search anything…" readOnly />
        <kbd>⌘K</kbd>
      </div>

      <button className="cb-icon-btn" aria-label="Notifications" style={{ position: 'relative' }}>
        <Bell size={15} />
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--accent)',
        }} />
      </button>
    </div>
  );
}

function PageLoading() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '60vh', color: 'var(--fg-subtle)',
    }}>
      <div className="cb-skel" style={{ width: 200, height: 16, borderRadius: 8 }} />
    </div>
  );
}

function AppLayout({ children }) {
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarExpanded', JSON.stringify(expanded));
  }, [expanded]);

  return (
    <div className="cb-app" data-collapsed={!expanded}>
      <Sidebar expanded={expanded} onToggle={() => setExpanded(v => !v)} />
      <div className="cb-main">
        <Topbar expanded={expanded} />
        <div className="cb-scroll">
          <div className="cb-fade-in">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: 'var(--bg)',
      }}>
        <div className="cb-skel" style={{ width: 120, height: 14, borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <ConfigProvider theme={lightTheme} locale={customLocale}>
      <AntApp>
        <Router>
          {user && (
            <AcademicYearProvider>
            <AppLayout>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/"                      element={<Dashboard />} />
                  <Route path="/dashboard"             element={<Dashboard />} />
                  <Route path="/cb-admin-dashboard"    element={<CBAdminDashboard />} />
                  <Route path="/add-schools"           element={<PrivateRoute allowedRoles={routeAccess.addSchools}><AddSchools /></PrivateRoute>} />
                  <Route path="/school-setup"          element={<PrivateRoute allowedRoles={routeAccess.schoolSetup}><SetupSchool /></PrivateRoute>} />
                  <Route path="/add-specific-class"    element={<PrivateRoute allowedRoles={routeAccess.addSpecificClass}><AddSpecificClass /></PrivateRoute>} />
                  <Route path="/add-subjects"          element={<PrivateRoute allowedRoles={routeAccess.addSubjects}><AddSubjects /></PrivateRoute>} />
                  <Route path="/users"                 element={<PrivateRoute allowedRoles={routeAccess.users}><UsersHub /></PrivateRoute>} />

                  <Route path="/add-admin"             element={<Navigate to="/users" replace />} />
                  <Route path="/add-super-admin"       element={<Navigate to="/users" replace />} />
                  <Route path="/add-student"           element={<Navigate to="/users" replace />} />
                  <Route path="/super-admin-count"     element={<Navigate to="/users" replace />} />
                  <Route path="/signup-user"           element={<Navigate to="/users" replace />} />

                  <Route path="/attendance"            element={<PrivateRoute allowedRoles={routeAccess.attendance}><Attendance /></PrivateRoute>} />
                  <Route path="/fees"                  element={<PrivateRoute allowedRoles={routeAccess.fees}><Fees /></PrivateRoute>} />
                  <Route path="/analytics/*"           element={<PrivateRoute allowedRoles={routeAccess.analytics}><Analytics /></PrivateRoute>} />
                  <Route path="/timetable"             element={<PrivateRoute allowedRoles={routeAccess.timetable}><Timetable /></PrivateRoute>} />
                  <Route path="/calendar"              element={<PrivateRoute allowedRoles={routeAccess.timetable}><Calendar /></PrivateRoute>} />
                  <Route path="/syllabus"              element={<PrivateRoute allowedRoles={routeAccess.syllabus}><SyllabusPage /></PrivateRoute>} />
                  <Route path="/learning-resources"    element={<PrivateRoute allowedRoles={routeAccess.learningResources}><LearningResources /></PrivateRoute>} />
                  <Route path="/test-management"       element={<PrivateRoute allowedRoles={routeAccess.testManagement}><UnifiedTestManagement /></PrivateRoute>} />
                  <Route path="/gradebook"             element={<PrivateRoute allowedRoles={routeAccess.testManagement}><Gradebook /></PrivateRoute>} />
                  <Route path="/task-management"       element={<PrivateRoute allowedRoles={routeAccess.taskManagement}><TaskManagement /></PrivateRoute>} />
                  <Route path="/take-tests"            element={<PrivateRoute allowedRoles={['student']}><TestTaking /></PrivateRoute>} />
                  <Route path="/assessments"           element={<PrivateRoute allowedRoles={routeAccess.assessments}><Assessments /></PrivateRoute>} />

                  <Route path="/student/timetable"     element={<PrivateRoute allowedRoles={['student']}><StudentTimetable /></PrivateRoute>} />
                  <Route path="/student/syllabus"      element={<PrivateRoute allowedRoles={['student']}><StudentSyllabus /></PrivateRoute>} />
                  <Route path="/student/results"       element={<PrivateRoute allowedRoles={['student']}><StudentResults /></PrivateRoute>} />
                  <Route path="/student/resources"     element={<PrivateRoute allowedRoles={['student']}><StudentLearningResources /></PrivateRoute>} />
                  <Route path="/student/calendar"      element={<PrivateRoute allowedRoles={['student']}><StudentCalendar /></PrivateRoute>} />
                  <Route path="/student/attendance"    element={<PrivateRoute allowedRoles={['student']}><StudentAttendance /></PrivateRoute>} />
                  <Route path="/student/analytics"     element={<PrivateRoute allowedRoles={['student']}><StudentSelfAnalytics /></PrivateRoute>} />

                  <Route path="/hr"                    element={<PrivateRoute allowedRoles={['superadmin','admin']}><HrHub /></PrivateRoute>} />
                  <Route path="/hr/staff"              element={<PrivateRoute allowedRoles={['superadmin','admin']}><StaffDirectory /></PrivateRoute>} />
                  <Route path="/hr/staff/:id"          element={<PrivateRoute allowedRoles={['superadmin','admin']}><StaffDetail /></PrivateRoute>} />
                  <Route path="/hr/payroll"            element={<PrivateRoute allowedRoles={['superadmin','admin']}><Payroll /></PrivateRoute>} />
                  <Route path="/hr/leaves"             element={<PrivateRoute allowedRoles={['superadmin','admin']}><LeavesApprovals /></PrivateRoute>} />
                  <Route path="/hr/attendance"         element={<PrivateRoute allowedRoles={['superadmin','admin']}><StaffAttendance /></PrivateRoute>} />
                  <Route path="/hr/attendance/mark"    element={<PrivateRoute allowedRoles={['superadmin','admin']}><MarkStaffAttendance /></PrivateRoute>} />
                  <Route path="/hr/my"                 element={<PrivateRoute allowedRoles={['superadmin','admin','student']}><MyHr /></PrivateRoute>} />
                  <Route path="/hr/my/tax"             element={<PrivateRoute allowedRoles={['superadmin','admin','student']}><MyTaxDeclaration /></PrivateRoute>} />
                  <Route path="/hr/tax"                element={<PrivateRoute allowedRoles={['superadmin','admin']}><TaxDeclarationsHr /></PrivateRoute>} />
                  <Route path="/hr/tax/form-16"        element={<PrivateRoute allowedRoles={['superadmin','admin']}><Form16Generation /></PrivateRoute>} />
                  <Route path="/hr/tax/form-24q"       element={<PrivateRoute allowedRoles={['superadmin','admin']}><Form24Q /></PrivateRoute>} />
                  <Route path="/hr/tax/form-15gh"      element={<PrivateRoute allowedRoles={['superadmin','admin']}><Form15GH /></PrivateRoute>} />
                  <Route path="/hr/tax/settings"       element={<PrivateRoute allowedRoles={['superadmin','admin']}><TaxSettings /></PrivateRoute>} />
                  <Route path="/hr/salary-components"  element={<PrivateRoute allowedRoles={['superadmin','admin']}><SalaryComponents /></PrivateRoute>} />

                  <Route path="/manage/admissions"     element={<PrivateRoute allowedRoles={['superadmin','admin']}><AdmissionsPipeline /></PrivateRoute>} />
                  <Route path="/manage/inventory"      element={<PrivateRoute allowedRoles={['superadmin','admin']}><Inventory /></PrivateRoute>} />

                  <Route path="/finance"               element={<PrivateRoute allowedRoles={['superadmin','admin']}><FinanceHub /></PrivateRoute>} />
                  <Route path="/finance/transactions"  element={<PrivateRoute allowedRoles={['superadmin','admin']}><FinanceTransactions /></PrivateRoute>} />
                  <Route path="/finance/accounts"      element={<PrivateRoute allowedRoles={['superadmin','admin']}><FinanceAccounts /></PrivateRoute>} />
                  <Route path="/finance/reports"       element={<PrivateRoute allowedRoles={['superadmin','admin']}><FinanceReports /></PrivateRoute>} />
                  <Route path="/finance/inconsistencies" element={<PrivateRoute allowedRoles={['superadmin']}><FinanceInconsistencies /></PrivateRoute>} />

                  <Route path="/chatbot"               element={<PrivateRoute allowedRoles={['superadmin','admin','student']}><Chatbot /></PrivateRoute>} />
                  <Route path="/ai-test-generator"     element={<Navigate to="/test-management?mode=ai" replace />} />

                  <Route path="/academics/announcements"     element={<PrivateRoute allowedRoles={['superadmin','admin','student']}><Announcements /></PrivateRoute>} />
                  <Route path="/academics/communication-hub" element={<PrivateRoute allowedRoles={['superadmin','admin','student']}><CommunicationHub /></PrivateRoute>} />
                  <Route path="/academics/report-comments"   element={<PrivateRoute allowedRoles={['superadmin','admin']}><ReportComments /></PrivateRoute>} />

                  <Route path="/test/create"           element={<Navigate to="/test-management" replace />} />
                  <Route path="/test/:testId/questions" element={<Navigate to="/test-management" replace />} />
                  <Route path="/test/:testId/results"  element={<Navigate to="/test-management" replace />} />
                  <Route path="/test/:testId/marks"    element={<Navigate to="/test-management" replace />} />

                  <Route path="/unauthorized"          element={<UnauthorizedPage />} />
                  <Route path="/reset-password"        element={<ResetPasswordPage />} />
                  <Route path="*"                      element={<Navigate to="/dashboard" />} />
                </Routes>
              </Suspense>
            </AppLayout>
            </AcademicYearProvider>
          )}

          {!user && (
            <Routes>
              <Route path="/login"           element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password"  element={<ResetPasswordPage />} />
              <Route path="*"               element={<Navigate to="/login" />} />
            </Routes>
          )}
        </Router>
      </AntApp>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
