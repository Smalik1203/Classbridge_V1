// src/pages/analytics/AnalyticsHub.jsx
// Unified analytics hub with percentage-first design

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Row, Col, Typography, Alert } from 'antd';
import { useAuth } from '../../AuthProvider';
import { getUserRole, getSchoolCode } from '../../utils/metadata';
import { supabase } from '../../config/supabaseClient';
import { useTheme } from '../../contexts/ThemeContext';
import AnalyticsCard from '../../ui/AnalyticsCard';
import CompactFilterBar from '../../ui/CompactFilterBar';
import { 
  useAttendanceAnalytics,
  useFeesAnalytics,
  useExamsAnalytics,
  useLearningAnalytics
} from '../../hooks';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import '../../styles/analytics-responsive.css';

// Configure dayjs for IST timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;
const IST_TIMEZONE = 'Asia/Kolkata';

const AnalyticsHub = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isDarkMode, theme } = useTheme();
  const userRole = getUserRole(user);
  const schoolCode = getSchoolCode(user);

  // URL state management with IST timezone
  const [dateRange, setDateRange] = useState(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && to) {
      return [
        dayjs(from).tz(IST_TIMEZONE),
        dayjs(to).tz(IST_TIMEZONE)
      ];
    }
    return [
      dayjs().tz(IST_TIMEZONE).subtract(30, 'days'),
      dayjs().tz(IST_TIMEZONE)
    ];
  });
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('class_id') || 'all');

  // Classes state
  const [classes, setClasses] = useState([]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateRange[0]) params.set('from', dateRange[0].format('YYYY-MM-DD'));
    if (dateRange[1]) params.set('to', dateRange[1].format('YYYY-MM-DD'));
    if (selectedClassId) params.set('class_id', selectedClassId);
    setSearchParams(params);
  }, [dateRange, selectedClassId, setSearchParams]);

  // Load classes
  useEffect(() => {
    const loadClasses = async () => {
      try {
        let query = supabase
          .from('class_instances')
          .select('id, grade, section')
          .eq('school_code', schoolCode)
          .order('grade', { ascending: true })
          .order('section', { ascending: true });

        if (userRole === 'admin') {
          query = query.eq('class_teacher_id', user.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        const transformedData = (data || []).map(cls => ({
          ...cls,
          class_name: `${cls.grade}-${cls.section}`
        }));
        
        // Add "All Classes" option at the beginning
        const classesWithAll = [
          { id: 'all', class_name: 'All Classes', grade: 'All', section: 'Classes' },
          ...transformedData
        ];
        
        setClasses(classesWithAll);
      } catch (error) {
        console.error('Error loading classes:', error);
      }
    };

    if (schoolCode) {
      loadClasses();
    }
  }, [userRole, schoolCode, user?.id]);

  // Use analytics hooks
  const attendanceAnalytics = useAttendanceAnalytics({
    startDate: dateRange[0],
    endDate: dateRange[1],
    classId: selectedClassId
  });

  const feesAnalytics = useFeesAnalytics({
    startDate: dateRange[0],
    endDate: dateRange[1],
    classId: selectedClassId
  });

  const examsAnalytics = useExamsAnalytics({
    startDate: dateRange[0],
    endDate: dateRange[1],
    classId: selectedClassId
  });

  const learningAnalytics = useLearningAnalytics({
    startDate: dateRange[0],
    endDate: dateRange[1],
    classId: selectedClassId
  });

  // Filter handlers
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
  };

  const handleRefresh = () => {
    // Data will reload automatically due to hook dependencies
    window.location.reload();
  };

  // Role-based visibility
  const canViewAttendance = ['superadmin', 'admin', 'student'].includes(userRole);
  const canViewFees = ['superadmin', 'admin'].includes(userRole);
  const canViewExams = ['superadmin', 'admin', 'student'].includes(userRole);
  const canViewLearning = ['superadmin', 'admin', 'student'].includes(userRole);

  // Check if any analytics are loading
  const anyLoading = attendanceAnalytics.loading || feesAnalytics.loading || 
                    examsAnalytics.loading || learningAnalytics.loading;

  return (
    <div 
      className="analytics-hub-container"
      style={{ 
        padding: '16px 20px', 
        background: isDarkMode ? theme.token.colorBgLayout : '#fafafa', 
        minHeight: '100vh',
        maxWidth: '100%',
        overflowX: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          flexWrap: 'wrap', 
          gap: 16 
        }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <Title level={2} style={{ 
              margin: 0, 
              fontSize: window.innerWidth < 768 ? 20 : 28, 
              fontWeight: 600, 
              color: theme.token.colorTextHeading, 
              marginBottom: 8,
              lineHeight: 1.2
            }}>
              📊 Analytics Hub
            </Title>
            <Text type="secondary" style={{ 
              fontSize: window.innerWidth < 768 ? 13 : 16, 
              color: theme.token.colorTextSecondary,
              lineHeight: 1.4
            }}>
              Unified percentage-based analytics across all modules
            </Text>
          </div>
        </div>
      </div>

      {/* Compact Filter Bar */}
      <CompactFilterBar
        dateRange={dateRange}
        selectedClassId={selectedClassId}
        classes={classes}
        onDateRangeChange={handleDateRangeChange}
        onClassChange={handleClassChange}
        onRefresh={handleRefresh}
        loading={anyLoading}
      />

      {/* Analytics Grid - 2x2 on desktop, 1x4 on mobile */}
      <Row gutter={[20, 20]}>
        {/* Attendance Analytics */}
        {canViewAttendance && (
          <Col xs={24} sm={24} md={12} lg={12} xl={12}>
            <AnalyticsCard
              title="Attendance"
              primaryPercent={attendanceAnalytics.data?.primaryPercent || 0}
              primaryLabel={attendanceAnalytics.data?.primaryLabel || 'Present'}
              secondaryPercent={attendanceAnalytics.data?.secondaryPercent || 0}
              secondaryLabel={attendanceAnalytics.data?.secondaryLabel || 'Absent'}
              supporting={attendanceAnalytics.data?.supporting || []}
              onViewDetails={() => navigate('/analytics/attendance/overview')}
              loading={attendanceAnalytics.loading}
              error={attendanceAnalytics.error}
            />
          </Col>
        )}

        {/* Fees Analytics */}
        {canViewFees && (
          <Col xs={24} sm={24} md={12} lg={12} xl={12}>
            <AnalyticsCard
              title="Fees"
              primaryPercent={feesAnalytics.data?.primaryPercent || 0}
              primaryLabel={feesAnalytics.data?.primaryLabel || 'Collected'}
              secondaryPercent={feesAnalytics.data?.secondaryPercent || 0}
              secondaryLabel={feesAnalytics.data?.secondaryLabel || 'Outstanding'}
              supporting={feesAnalytics.data?.supporting || []}
              onViewDetails={() => navigate('/fees')}
              loading={feesAnalytics.loading}
              error={feesAnalytics.error}
            />
          </Col>
        )}

        {/* Exams Analytics */}
        {canViewExams && (
          <Col xs={24} sm={24} md={12} lg={12} xl={12}>
            <AnalyticsCard
              title="Exams"
              primaryPercent={examsAnalytics.data?.primaryPercent || 0}
              primaryLabel={examsAnalytics.data?.primaryLabel || 'Pass'}
              secondaryPercent={examsAnalytics.data?.secondaryPercent || 0}
              secondaryLabel={examsAnalytics.data?.secondaryLabel || 'Fail'}
              supporting={examsAnalytics.data?.supporting || []}
              onViewDetails={() => navigate('/test-management')}
              loading={examsAnalytics.loading}
              error={examsAnalytics.error}
            />
          </Col>
        )}

        {/* Learning Analytics */}
        {canViewLearning && (
          <Col xs={24} sm={24} md={12} lg={12} xl={12}>
            <AnalyticsCard
              title="Learning"
              primaryPercent={learningAnalytics.data?.primaryPercent || 0}
              primaryLabel={learningAnalytics.data?.primaryLabel || 'Completed'}
              secondaryPercent={learningAnalytics.data?.secondaryPercent || 0}
              secondaryLabel={learningAnalytics.data?.secondaryLabel || 'Pending'}
              supporting={learningAnalytics.data?.supporting || []}
              onViewDetails={() => navigate('/learning-resources')}
              loading={learningAnalytics.loading}
              error={learningAnalytics.error}
            />
          </Col>
        )}
      </Row>

      {/* Date Range Summary */}
      {dateRange[0] && dateRange[1] && (
        <div style={{ 
          marginTop: 24,
          textAlign: 'center',
          padding: '16px',
          background: theme.token.colorBgContainer,
          borderRadius: 12,
          border: `1px solid ${theme.token.colorBorder}`
        }}>
          <Text type="secondary" style={{ 
            fontSize: '14px',
            color: theme.token.colorTextSecondary
          }}>
            📅 Showing data from {dateRange[0].format('DD MMM YYYY')} to {dateRange[1].format('DD MMM YYYY')}
            {selectedClassId !== 'all' && (
              <span> • {classes.find(c => c.id === selectedClassId)?.class_name || 'Selected Class'}</span>
            )}
          </Text>
        </div>
      )}
    </div>
  );
};

export default AnalyticsHub;
