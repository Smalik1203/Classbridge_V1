import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import { AuthProvider } from './AuthProvider';
import { ThemeProvider } from './contexts/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddStudent from './components/AddStudent';
import AddAdmin from './components/AddAdmin';
import AddSubjects from './components/AddSubjects';
import AddSpecificClass from './components/AddSpecificClass';
import Syllabus from './components/Syllabus';
import Timetable from './pages/Timetable';
import UnifiedAttendance from './pages/UnifiedAttendance';
import LearningResources from './pages/LearningResources';
import UnifiedTestManagement from './pages/UnifiedTestManagement';
import Assessments from './insidepages/Assessments';
import Results from './insidepages/results';
import Fees from './insidepages/Fees';
import Analytics from './pages/Analytics';
import SetupSchool from './pages/SetupSchool';
import AddSchools from './pages/AddSchools';
import Unauthorized from './pages/Unauthorized';

const { Content } = Layout;

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Layout style={{ minHeight: '100vh' }}>
                    <Sidebar />
                    <Layout>
                      <Content style={{ margin: 0, overflow: 'initial' }}>
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/add-student" element={<AddStudent />} />
                          <Route path="/add-admin" element={<AddAdmin />} />
                          <Route path="/add-subjects" element={<AddSubjects />} />
                          <Route path="/add-class" element={<AddSpecificClass />} />
                          <Route path="/syllabus" element={<Syllabus />} />
                          <Route path="/timetable" element={<Timetable />} />
                          <Route path="/attendance" element={<UnifiedAttendance />} />
                          <Route path="/resources" element={<LearningResources />} />
                          <Route path="/tests" element={<UnifiedTestManagement />} />
                          <Route path="/assessments" element={<Assessments />} />
                          <Route path="/results" element={<Results />} />
                          <Route path="/fees" element={<Fees />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/setup-school" element={<SetupSchool />} />
                          <Route path="/add-schools" element={<AddSchools />} />
                        </Routes>
                      </Content>
                    </Layout>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;