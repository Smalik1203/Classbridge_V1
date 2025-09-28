import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useAuth } from './AuthProvider';
import Login from './pages/Login';
import SignUpUser from './components/SignUpUser';
import Dashboard from './pages/Dashboard';
import CBAdminDashboard from './pages/CBAdminDashboard';
import PrivateRoute from './components/PrivateRoute';
import AddSchools from './pages/AddSchools';
import Assessments from './insidepages/Assessments';
import Attendance from './pages/Attendance';
import Fees from './insidepages/Fees';
import SetupSchool from './pages/SetupSchool';
import AddAdmin from './components/AddAdmin';
import AddStudent from './components/AddStudent';
import AppSidebar from './components/Sidebar';
import AddSpecificClass from './components/AddSpecificClass';
import AddSuperAdmin from './components/AddSuperAdmin';
import AddSubjects from './components/AddSubjects';
import Analytics from './pages/Analytics';
import Timetable from './pages/Timetable';
import SyllabusPage from './pages/Syllabus';
import LearningResources from './pages/LearningResources';
import UnifiedTestManagement from './pages/UnifiedTestManagement';
import TestTaking from './pages/TestTaking';
import Unauthorized from './pages/Unauthorized';
import DailyTrendsAnalytics from './pages/superadmin/DailyTrendsAnalytics';
import StudentPerformanceAnalytics from './pages/superadmin/StudentPerformanceAnalytics';
import ClassComparisonAnalytics from './pages/superadmin/ClassComparisonAnalytics';
import StatusDistributionAnalytics from './pages/superadmin/StatusDistributionAnalytics';
import SuperAdminCounter from './components/SuperAdminCounter';
import { routeAccess } from './routeAccess';



const { Content } = Layout;

// Global layout with sidebar
function AppLayout({ children }) {
  const { theme: antdTheme } = useTheme();
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
      background: antdTheme.token.colorBgLayout
    }}>
      <AppSidebar 
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
  const { theme } = useTheme();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: theme.token.colorBgLayout
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <ConfigProvider theme={theme}>
      <Router>
        {user && (
          <AppLayout>
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
              <Route path="/signup" element={<SignUpUser />} />

              {/* Feature Routes */}
              <Route path="/attendance" element={<PrivateRoute allowedRoles={routeAccess.attendance}><Attendance /></PrivateRoute>} />
              <Route path="/fees" element={<PrivateRoute allowedRoles={routeAccess.fees}><Fees /></PrivateRoute>} />
              <Route path="/analytics" element={<PrivateRoute allowedRoles={routeAccess.analytics}><Analytics /></PrivateRoute>} />
              <Route path="/analytics/daily-trends" element={<PrivateRoute allowedRoles={routeAccess.analytics}><DailyTrendsAnalytics /></PrivateRoute>} />
              <Route path="/analytics/student-performance" element={<PrivateRoute allowedRoles={routeAccess.analytics}><StudentPerformanceAnalytics /></PrivateRoute>} />
              <Route path="/analytics/class-comparison" element={<PrivateRoute allowedRoles={routeAccess.analytics}><ClassComparisonAnalytics /></PrivateRoute>} />
              <Route path="/analytics/status-distribution" element={<PrivateRoute allowedRoles={routeAccess.analytics}><StatusDistributionAnalytics /></PrivateRoute>} />
              <Route path="/timetable" element={<PrivateRoute allowedRoles={routeAccess.timetable}><Timetable /></PrivateRoute>} />
              <Route path="/syllabus" element={<PrivateRoute allowedRoles={routeAccess.syllabus}><SyllabusPage /></PrivateRoute>} />
              <Route path="/learning-resources" element={<PrivateRoute allowedRoles={routeAccess.learningResources}><LearningResources /></PrivateRoute>} />
              <Route path="/test-management" element={<PrivateRoute allowedRoles={routeAccess.testManagement}><UnifiedTestManagement /></PrivateRoute>} />
              <Route path="/take-tests" element={<PrivateRoute allowedRoles={['student']}><TestTaking /></PrivateRoute>} />
              <Route path="/assessments" element={<PrivateRoute allowedRoles={routeAccess.assessments}><Assessments /></PrivateRoute>} />


              {/* Error Routes */}
              <Route path="/unauthorized" element={<Unauthorized />} />
              
              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </AppLayout>
        )}

        {!user && (
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUpUser />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        )}
      </Router>
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
