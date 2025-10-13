import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Space, 
  Button, 
  message,
  Spin,
  Alert
} from 'antd';
import { 
  BookOutlined, 
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useAuth } from '@/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/config/supabaseClient';
import { TaskService } from '../services/taskService';
import { getSchoolCode, getUserRole, hasRole } from '@/shared/utils/metadata';
import TaskForm from '@/features/tasks/components/TaskForm';
import TaskList from '@/features/tasks/components/TaskList';
import StudentTaskView from '@/features/tasks/components/StudentTaskView';

const { Title, Text } = Typography;

export default function TaskManagement() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    overdue: 0,
    dueToday: 0,
    upcoming: 0,
    byPriority: {}
  });
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [academicYearId, setAcademicYearId] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // AbortController ref for cleanup
  const abortControllerRef = useRef(null);

  // Get user data
  const schoolCode = getSchoolCode(user);
  const userRole = getUserRole(user) || 'student';
  const canCreateTask = hasRole(user, ['admin', 'superadmin']);

  // Fetch initial data
  useEffect(() => {
    // Create new AbortController
    abortControllerRef.current = new AbortController();

    if (schoolCode) {
      fetchInitialData();
    } else {
      setLoading(false);
    }

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [schoolCode]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAcademicYear(),
        fetchClasses(),
        fetchSubjects()
      ]);
    } catch (error) {
      // Only show error if not aborted
      if (error.name !== 'AbortError') {
        console.error('Failed to load initial data:', error);
        message.error('Failed to load initial data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademicYear = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, year_start, year_end, is_active')
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .single();

      if (error) {
        // If no active academic year found, try to get any academic year
        const { data: anyYear, error: anyYearError } = await supabase
          .from('academic_years')
          .select('id, year_start, year_end, is_active')
          .eq('school_code', schoolCode)
          .order('year_start', { ascending: false })
          .limit(1)
          .single();

        if (!anyYearError && anyYear) {
          setAcademicYearId(anyYear.id);
        } else {
          console.warn('No academic year found');
        }
      } else {
        setAcademicYearId(data.id);
      }
    } catch (error) {
      console.error('Failed to fetch academic year:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true })
        .order('section', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch classes:', error);
      }
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, subject_name')
        .eq('school_code', schoolCode)
        .order('subject_name', { ascending: true });

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch subjects:', error);
      }
    }
  };

  const fetchStatistics = async () => {
    try {
      console.log('Fetching statistics for school:', schoolCode);
      const statistics = await TaskService.getTaskStatistics(schoolCode);
      console.log('Statistics result:', statistics);
      setStats(statistics);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch task statistics:', error);
      }
    }
  };

  // Fetch statistics after academic year is loaded
  useEffect(() => {
    if (academicYearId && schoolCode) {
      fetchStatistics();
    }
  }, [academicYearId, schoolCode]);

  const handleCreateTask = () => {
    if (!academicYearId) {
      message.warning('Please wait while academic year is loading, or contact your administrator if the issue persists.');
      return;
    }
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task) => {
    if (!academicYearId) {
      message.warning('Please wait while academic year is loading, or contact your administrator if the issue persists.');
      return;
    }
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTaskSaved = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
    setRefreshTrigger(prev => prev + 1);
    // Refresh stats after task is saved
    fetchStatistics();
  };

  const handleTaskModalCancel = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        flexDirection: 'column'
      }}>
        <Spin size="large" />
        <Text style={{ marginTop: 16 }}>Loading task management...</Text>
      </div>
    );
  }

  // Show student view for students
  if (userRole === 'student') {
    return (
      <div style={{ padding: 24 }}>
        <StudentTaskView />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <BookOutlined style={{ marginRight: 8 }} />
          Task Management
        </Title>
        <Text type="secondary">
          Manage homeworks, projects, and assignments for your classes
        </Text>
      </div>

      {/* Warning if no academic year */}
      {!academicYearId && (
        <Alert
          message="No Active Academic Year"
          description="No active academic year found. Some features may be limited. Please contact your administrator."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Tasks"
              value={stats.total}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Overdue"
              value={stats.overdue}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Due Today"
              value={stats.dueToday}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Upcoming"
              value={stats.upcoming}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Alerts */}
      {stats.overdue > 0 && (
        <Alert
          message={`${stats.overdue} task(s) are overdue`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {stats.dueToday > 0 && (
        <Alert
          message={`${stats.dueToday} task(s) are due today`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Task List */}
      <TaskList
        schoolCode={schoolCode}
        academicYearId={academicYearId}
        classes={classes}
        subjects={subjects}
        user={user}
        onEditTask={handleEditTask}
        onCreateTask={canCreateTask ? handleCreateTask : null}
        refreshTrigger={refreshTrigger}
      />

      {/* Task Form Modal - Only show if user has permission */}
      {canCreateTask && (
        <TaskForm
          open={isTaskModalOpen}
          task={selectedTask}
          schoolCode={schoolCode}
          academicYearId={academicYearId}
          classes={classes}
          subjects={subjects}
          user={user}
          onCancel={handleTaskModalCancel}
          onSuccess={handleTaskSaved}
        />
      )}
    </div>
  );
}
