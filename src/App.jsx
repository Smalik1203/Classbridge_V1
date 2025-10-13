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
import { LoginPage } from '@/features/auth';
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
const AddAdmin = lazy(() => import('@/features/school/components/AddAdmin'));
const AddStudent = lazy(() => import('@/features/students/components/AddStudent'));
const AddSpecificClass = lazy(() => import('@/features/school/components/AddSpecificClass'));
const AddSuperAdmin = lazy(() => import('@/features/school/components/AddSuperAdmin'));
const AddSubjects = lazy(() => import('@/features/school/components/AddSubjects'));
const Analytics = lazy(() => import('@/features/analytics/pages/Analytics'));
const Timetable = lazy(() => import('@/features/timetable/pages/Timetable'));
const Calendar = lazy(() => import('@/features/calendar/pages/Calendar'));
const SyllabusPage = lazy(() => import('@/features/syllabus/pages/Syllabus'));
const LearningResources = lazy(() => import('@/features/learning-resources/pages/LearningResources'));
const UnifiedTestManagement = lazy(() => import('@/features/tests/pages/UnifiedTestManagement'));
const TaskManagement = lazy(() => import('@/features/tasks/pages/TaskManagement'));
const TestTaking = lazy(() => import('@/features/tests/pages/TestTaking'));
const DailyTrendsAnalytics = lazy(() => import('@/features/analytics/pages/DailyTrendsAnalytics'));
const StudentPerformanceAnalytics = lazy(() => import('@/features/analytics/pages/StudentPerformanceAnalytics'));
const ClassComparisonAnalytics = lazy(() => import('@/features/analytics/pages/ClassComparisonAnalytics'));
const StatusDistributionAnalytics = lazy(() => import('@/features/analytics/pages/StatusDistributionAnalytics'));
const SuperAdminCounter = lazy(() => import('@/features/school/components/SuperAdminCounter'));
const StudentTimetable = lazy(() => import('@/features/timetable/pages/StudentTimetable'));
const StudentSyllabus = lazy(() => import('@/features/syllabus/pages/StudentSyllabus'));
const StudentResults = lazy(() => import('@/features/students/pages/StudentResults'));
const StudentLearningResources = lazy(() => import('@/features/learning-resources/pages/StudentLearningResources'));
const StudentCalendar = lazy(() => import('@/features/calendar/pages/StudentCalendar'));
const StudentAttendance = lazy(() => import('@/features/students/pages/StudentAttendance'));
const StudentAnalytics = lazy(() => import('@/features/students/pages/StudentAnalytics'));



const { Content } = Layout;

// Global layout with sidebar
function AppLayout({ children }) {
  const { isDarkMode } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);
  
  return (
    <Layout style={{ 
      minHeight: '100vh',
      background: isDarkMode 
        ? '#000000'
        : 'linear-gradient(135deg, rgb(245, 247, 250) 0%, rgb(195, 207, 226) 100%)'
    }}>
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onCollapse={setSidebarCollapsed}
      />
      <Layout style={{ 
        marginLeft: sidebarCollapsed ? 48 : 280,
        background: 'transparent',
        transition: 'margin-left 0.2s ease'
      }}>
        <Content style={{
          padding: '24px',
          minHeight: '100vh',
          background: 'transparent'
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
              <Route path="/add-super-admin" element={<PrivateRoute allowedRoles={routeAccess.addSuperAdmin}><AddSuperAdmin /></PrivateRoute>} />
              <Route path="/school-setup" element={<PrivateRoute allowedRoles={routeAccess.schoolSetup}><SetupSchool /></PrivateRoute>} />
              <Route path="/add-admin" element={<PrivateRoute allowedRoles={routeAccess.addAdmin}><AddAdmin /></PrivateRoute>} />
              <Route path="/add-student" element={<PrivateRoute allowedRoles={routeAccess.addStudent}><AddStudent /></PrivateRoute>} />
              <Route path="/add-specific-class" element={<PrivateRoute allowedRoles={routeAccess.addSpecificClass}><AddSpecificClass /></PrivateRoute>} />
              <Route path="/add-subjects" element={<PrivateRoute allowedRoles={routeAccess.addSubjects}><AddSubjects /></PrivateRoute>} />
              <Route path="/super-admin-count" element={<SuperAdminCounter />} />

              {/* Feature Routes */}
              <Route path="/attendance" element={<PrivateRoute allowedRoles={routeAccess.attendance}><Attendance /></PrivateRoute>} />
              <Route path="/fees" element={<PrivateRoute allowedRoles={routeAccess.fees}><Fees /></PrivateRoute>} />
              <Route path="/analytics/*" element={<PrivateRoute allowedRoles={routeAccess.analytics}><Analytics /></PrivateRoute>} />
              <Route path="/analytics/daily-trends" element={<PrivateRoute allowedRoles={routeAccess.analytics}><Analytics /></PrivateRoute>} />
              <Route path="/analytics/student-performance" element={<PrivateRoute allowedRoles={routeAccess.analytics}><Analytics /></PrivateRoute>} />
              <Route path="/analytics/class-comparison" element={<PrivateRoute allowedRoles={routeAccess.analytics}><Analytics /></PrivateRoute>} />
              <Route path="/analytics/status-distribution" element={<PrivateRoute allowedRoles={routeAccess.analytics}><Analytics /></PrivateRoute>} />
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
              <Route path="/student/analytics" element={<PrivateRoute allowedRoles={['student']}><StudentAnalytics /></PrivateRoute>} />

              {/* Error Routes */}
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              
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
