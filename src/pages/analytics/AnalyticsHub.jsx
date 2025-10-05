// src/pages/analytics/AnalyticsHub.jsx
// Main analytics hub page with aggregated summaries

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Row, Col, Typography, Alert, Spin, Card } from 'antd';
import { 
  TeamOutlined, 
  DollarOutlined, 
  FileTextOutlined, 
  BookOutlined,
  BarChartOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useAuth } from '../../AuthProvider';
import { getUserRole, getSchoolCode } from '../../utils/metadata';
import { supabase } from '../../config/supabaseClient';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  AnalyticsSection, 
  AnalyticsFilterBar, 
  AnalyticsChart 
} from '../../ui';
import { 
  getAttendanceSummary, 
  getFeesSummary, 
  getExamsSummary, 
  getLearningSummary 
} from '../../services/analyticsSummaryServiceEnhanced';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AnalyticsHub = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isDarkMode, theme } = useTheme();
  const userRole = getUserRole(user);
  const schoolCode = getSchoolCode(user);

  // URL state management
  const [dateRange, setDateRange] = useState(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    return from && to ? [dayjs(from), dayjs(to)] : [dayjs().subtract(30, 'days'), dayjs()];
  });
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('class_id') || 'all');

  // Data state
  const [classes, setClasses] = useState([]);
  const [attendanceData, setAttendanceData] = useState(null);
  const [feesData, setFeesData] = useState(null);
  const [examsData, setExamsData] = useState(null);
  const [learningData, setLearningData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // Load all analytics data
  useEffect(() => {
    const loadAnalyticsData = async () => {
      if (!dateRange[0] || !dateRange[1]) return;

      setDataLoading(true);
      setError(null);

      try {
        const promises = [];

        // Convert 'all' to null for school-wide analytics
        const classFilter = selectedClassId === 'all' ? null : selectedClassId;

        // Load attendance summary
        promises.push(
          getAttendanceSummary(schoolCode, dateRange, classFilter, user)
            .then(setAttendanceData)
            .catch(err => {
              console.error('Attendance summary error:', err);
              setAttendanceData({ error: 'Failed to load attendance data' });
            })
        );

        // Load fees summary
        promises.push(
          getFeesSummary(schoolCode, dateRange, classFilter, user)
            .then(setFeesData)
            .catch(err => {
              console.error('Fees summary error:', err);
              setFeesData({ error: 'Failed to load fees data' });
            })
        );

        // Load exams summary
        promises.push(
          getExamsSummary(schoolCode, dateRange, classFilter, user)
            .then(setExamsData)
            .catch(err => {
              console.error('Exams summary error:', err);
              setExamsData({ error: 'Failed to load exams data' });
            })
        );

        // Load learning summary
        promises.push(
          getLearningSummary(schoolCode, dateRange, classFilter, user)
            .then(setLearningData)
            .catch(err => {
              console.error('Learning summary error:', err);
              setLearningData({ error: 'Failed to load learning data' });
            })
        );

        await Promise.all(promises);
      } catch (error) {
        setError('Failed to load analytics data');
        console.error('Analytics loading error:', error);
      } finally {
        setDataLoading(false);
      }
    };

    if (schoolCode && dateRange[0] && dateRange[1]) {
      loadAnalyticsData();
    }
  }, [schoolCode, dateRange, selectedClassId]);

  // Filter handlers
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
  };

  const handleRefresh = () => {
    // Data will reload automatically due to useEffect dependency
  };

  // Role-based visibility
  const canViewAttendance = ['superadmin', 'admin', 'student'].includes(userRole);
  const canViewFees = ['superadmin', 'admin'].includes(userRole);
  const canViewExams = ['superadmin', 'admin', 'student'].includes(userRole);
  const canViewLearning = ['superadmin', 'admin', 'student'].includes(userRole);

  return (
    <div style={{ 
      padding: '16px', 
      background: isDarkMode ? theme.token.colorBgLayout : '#fafafa', 
      minHeight: '100vh' 
    }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: 24, 
              fontWeight: 600, 
              color: theme.token.colorTextHeading, 
              marginBottom: 4 
            }}>
              📊 Analytics Hub
            </h1>
            <Text type="secondary" style={{ 
              fontSize: 14, 
              color: theme.token.colorTextSecondary 
            }}>
              Executive overview of all analytics modules
            </Text>
          </div>
        </div>
      </div>

      {/* Global Filters */}
      <AnalyticsFilterBar
        dateRange={dateRange}
        selectedClassId={selectedClassId}
        classes={classes}
        onDateRangeChange={handleDateRangeChange}
        onClassChange={handleClassChange}
        onRefresh={handleRefresh}
        loading={dataLoading}
        showClassFilter={true}
      />

      {/* Error Alert */}
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Analytics Grid */}
      <Row gutter={[16, 16]}>
        {/* Attendance Analytics */}
        {canViewAttendance && (
          <Col xs={24} lg={12}>
            <AnalyticsSection
              title="Attendance Analytics"
              description="Student attendance overview"
              icon={<TeamOutlined style={{ color: '#3b82f6', fontSize: 18 }} />}
              link="/analytics/attendance/overview"
              loading={dataLoading}
              error={attendanceData?.error}
              kpis={attendanceData?.kpis?.map(kpi => ({
                ...kpi,
                icon: kpi.icon || <TeamOutlined style={{ color: '#3b82f6' }} />
              }))}
              chart={
                attendanceData?.chartData && (
                  <AnalyticsChart
                    type={attendanceData.chartType}
                    data={attendanceData.chartData}
                    height={200}
                  />
                )
              }
            />
          </Col>
        )}

        {/* Fees Analytics */}
        {canViewFees && (
          <Col xs={24} lg={12}>
            <AnalyticsSection
              title="Fees Analytics"
              description="Fee collection overview"
              icon={<DollarOutlined style={{ color: '#16a34a', fontSize: 18 }} />}
              link="/fees"
              loading={dataLoading}
              error={feesData?.error}
              kpis={feesData?.kpis?.map(kpi => ({
                ...kpi,
                icon: kpi.icon || <DollarOutlined style={{ color: '#16a34a' }} />
              }))}
              chart={
                feesData?.chartData && (
                  <AnalyticsChart
                    type={feesData.chartType}
                    data={feesData.chartData}
                    height={200}
                  />
                )
              }
            />
          </Col>
        )}

        {/* Exams Analytics */}
        {canViewExams && (
          <Col xs={24} lg={12}>
            <AnalyticsSection
              title="Exams Analytics"
              description="Test performance overview"
              icon={<FileTextOutlined style={{ color: '#ef4444', fontSize: 18 }} />}
              link="/test-management"
              loading={dataLoading}
              error={examsData?.error}
              kpis={examsData?.kpis?.map(kpi => ({
                ...kpi,
                icon: kpi.icon || <FileTextOutlined style={{ color: '#ef4444' }} />
              }))}
              chart={
                examsData?.chartData && (
                  <AnalyticsChart
                    type={examsData.chartType}
                    data={examsData.chartData}
                    height={200}
                  />
                )
              }
            />
          </Col>
        )}

        {/* Learning Analytics */}
        {canViewLearning && (
          <Col xs={24} lg={12}>
            <AnalyticsSection
              title="Learning Analytics"
              description="Learning resources overview"
              icon={<BookOutlined style={{ color: '#8b5cf6', fontSize: 18 }} />}
              link="/learning-resources"
              loading={dataLoading}
              error={learningData?.error}
              kpis={learningData?.kpis?.map(kpi => ({
                ...kpi,
                icon: kpi.icon || <BookOutlined style={{ color: '#8b5cf6' }} />
              }))}
              chart={
                learningData?.chartData && (
                  <AnalyticsChart
                    type={learningData.chartType}
                    data={learningData.chartData}
                    height={200}
                  />
                )
              }
            />
          </Col>
        )}
      </Row>

      {/* Quick Stats Summary */}
      {!dataLoading && !error && (
        <Card 
          style={{ 
            marginTop: 24,
            borderRadius: 12, 
            border: `1px solid ${theme.token.colorBorder}`, 
            boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
            background: theme.token.colorBgContainer
          }}
          styles={{ body: { padding: '20px' } }}
        >
          <div style={{ textAlign: 'center' }}>
            <Title level={4} style={{ 
              margin: 0, 
              color: theme.token.colorTextHeading, 
              marginBottom: 8 
            }}>
              📈 Executive Summary
            </Title>
            <Text type="secondary" style={{ 
              fontSize: '14px',
              color: theme.token.colorTextSecondary
            }}>
              {dateRange[0]?.format('DD/MM/YYYY')} to {dateRange[1]?.format('DD/MM/YYYY')}
              {selectedClassId && ` • ${selectedClassId === 'all' ? 'All Classes' : classes.find(c => c.id === selectedClassId)?.class_name || 'Selected Class'}`}
            </Text>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsHub;
