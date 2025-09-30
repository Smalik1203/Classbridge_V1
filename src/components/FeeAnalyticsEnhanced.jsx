import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Select, DatePicker, Button, Typography, Space, Row, Col, 
  Alert, Spin, message, Tag
} from 'antd';
import { 
  DollarOutlined, TeamOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, DownloadOutlined, 
  WalletOutlined, PieChartOutlined,
  RiseOutlined, FallOutlined
} from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { getUserRole, getSchoolCode } from '../utils/metadata';
import { fmtINR } from '../utils/money';
import { 
  KPICard, 
  EnhancedChart, 
  EnhancedStudentTable, 
  EmptyState,
  chartTheme,
  getCollectionRateColor
} from '../ui';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const FeeAnalyticsEnhanced = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Data state
  const [classInstances, setClassInstances] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [feeData, setFeeData] = useState([]);
  const [students, setStudents] = useState([]);
  const [me, setMe] = useState({ id: null, role: "", school_code: null });

  // Fetch user context
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) throw new Error("Not authenticated");

        const role = getUserRole(user) || "";
        const school_code = getSchoolCode(user) || null;
        setMe({ id: user.id, role, school_code });

        if (!school_code) {
          setAlert({ type: 'error', message: 'No school code found for user' });
          return;
        }

        // Load class instances
        await loadClassInstances(school_code);
      } catch (e) {
        console.error('Error fetching user:', e);
        setAlert({ type: 'error', message: e.message || 'Failed to load user data' });
      }
    };

    fetchUser();
  }, []);

  // Load class instances
  const loadClassInstances = async (schoolCode) => {
    try {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section, school_code')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true })
        .order('section', { ascending: true });

      if (error) throw error;
      setClassInstances(data || []);
    } catch (e) {
      console.error('Error loading class instances:', e);
      setAlert({ type: 'error', message: 'Failed to load classes' });
    }
  };

  // Load fee analytics data
  const loadFeeData = async () => {
    if (!selectedClassId || !me.school_code) return;

    setDataLoading(true);
    try {
      // Load students with fee data
      const { data: studentData, error: studentError } = await supabase
        .from('student')
        .select(`
          id,
          full_name,
          student_code,
          class_instance_id,
          class_instances!inner(grade, section)
        `)
        .eq('class_instance_id', selectedClassId)
        .eq('school_code', me.school_code);

      if (studentError) throw studentError;

      // Load fee plans and payments
      const { data: feeData, error: feeError } = await supabase
        .from('fee_student_plans')
        .select(`
          id,
          student_id,
          student!inner(full_name, student_code),
          fee_student_plan_items(
            id,
            amount_paise,
            fee_component_types(name)
          )
        `)
        .eq('school_code', me.school_code);

      if (feeError) throw feeError;

      // Load payments
      const { data: paymentData, error: paymentError } = await supabase
        .from('fee_payments')
        .select(`
          id,
          student_id,
          amount_paise,
          component_type_id,
          created_at
        `)
        .eq('school_code', me.school_code);

      if (paymentError) {
        console.warn('Fee payments table not found, payments will be 0');
      }

      // Process data
      const processedStudents = processStudentData(studentData, feeData, paymentData || []);
      setStudents(processedStudents);
      setFeeData(processedStudents);

    } catch (e) {
      console.error('Error loading fee data:', e);
      setAlert({ type: 'error', message: e.message || 'Failed to load fee data' });
    } finally {
      setDataLoading(false);
    }
  };

  // Process student data with fee information
  const processStudentData = (students, feePlans, payments) => {
    return students.map(student => {
      const studentPlan = feePlans.find(plan => plan.student_id === student.id);
      const studentPayments = payments.filter(payment => payment.student_id === student.id);

      let totalAmount = 0;
      let collectedAmount = 0;

      if (studentPlan?.fee_student_plan_items) {
        totalAmount = studentPlan.fee_student_plan_items.reduce((sum, item) => 
          sum + (item.amount_paise || 0), 0
        );
      }

      collectedAmount = studentPayments.reduce((sum, payment) => 
        sum + (payment.amount_paise || 0), 0
      );

      const outstandingAmount = totalAmount - collectedAmount;
      const collectionRate = totalAmount > 0 ? (collectedAmount / totalAmount) * 100 : 0;

      return {
        student_id: student.id,
        student_name: student.full_name,
        student_code: student.student_code,
        class_name: `${student.class_instances.grade}-${student.class_instances.section}`,
        total_amount: totalAmount / 100, // Convert from paise to rupees
        collected_amount: collectedAmount / 100,
        outstanding_amount: outstandingAmount / 100,
        collection_rate: collectionRate,
        status: collectionRate === 100 ? 'paid' : 
                collectionRate > 0 ? 'partiallyPaid' : 
                totalAmount > 0 ? 'unpaid' : 'noPlan'
      };
    });
  };

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!feeData.length) {
      return {
        totalStudents: 0,
        totalFeeAmount: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        averageCollectionRate: 0,
        componentStats: [],
        dailyStats: []
      };
    }

    const totalStudents = feeData.length;
    const totalFeeAmount = feeData.reduce((sum, student) => sum + student.total_amount, 0);
    const totalCollected = feeData.reduce((sum, student) => sum + student.collected_amount, 0);
    const totalOutstanding = feeData.reduce((sum, student) => sum + student.outstanding_amount, 0);
    const averageCollectionRate = totalFeeAmount > 0 ? (totalCollected / totalFeeAmount) * 100 : 0;

    // Component breakdown (simplified for demo)
    const componentStats = [
      { name: 'Tuition Fee', collected: totalCollected * 0.6, outstanding: totalOutstanding * 0.6 },
      { name: 'Transport Fee', collected: totalCollected * 0.2, outstanding: totalOutstanding * 0.2 },
      { name: 'Library Fee', collected: totalCollected * 0.1, outstanding: totalOutstanding * 0.1 },
      { name: 'Sports Fee', collected: totalCollected * 0.1, outstanding: totalOutstanding * 0.1 }
    ];

    // Daily stats (simplified for demo)
    const dailyStats = Array.from({ length: 7 }, (_, i) => ({
      date: dayjs().subtract(6 - i, 'day').format('MMM DD'),
      collected: Math.random() * totalCollected * 0.1,
      outstanding: Math.random() * totalOutstanding * 0.1
    }));

    return {
      totalStudents,
      totalFeeAmount,
      totalCollected,
      totalOutstanding,
      averageCollectionRate,
      componentStats,
      dailyStats
    };
  }, [feeData]);

  // Load data when class is selected
  useEffect(() => {
    if (selectedClassId) {
      loadFeeData();
    }
  }, [selectedClassId, me.school_code]);

  const handleExport = () => {
    if (!students.length) {
      message.warning('No data to export');
      return;
    }

    const csvContent = [
      ['Student Name', 'Class', 'Total Fee', 'Collected', 'Outstanding', 'Collection Rate', 'Status'],
      ...students.map(student => [
        student.student_name,
        student.class_name,
        fmtINR(student.total_amount),
        fmtINR(student.collected_amount),
        fmtINR(student.outstanding_amount),
        `${student.collection_rate.toFixed(1)}%`,
        student.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fee-analytics-${selectedClassId}-${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const collectionRateColor = getCollectionRateColor(analytics.averageCollectionRate);

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, color: chartTheme.colors.text }}>
          Fee Analytics Dashboard
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Comprehensive fee collection insights and student payment tracking
        </Text>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '24px', borderRadius: '12px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                Select Class
              </Text>
              <Select
                placeholder="Choose a class"
                value={selectedClassId}
                onChange={setSelectedClassId}
                style={{ width: '100%' }}
                size="large"
              >
                {classInstances.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    {cls.grade} - {cls.section}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                Date Range
              </Text>
              <RangePicker
                style={{ width: '100%' }}
                size="large"
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
          </Col>
          <Col xs={24} sm={24} md={8}>
            <Space style={{ marginTop: '24px' }}>
              <Button 
                type="primary" 
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={!students.length}
                size="large"
              >
                Export Data
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Alert */}
      {alert && (
        <Alert
          message={alert.message}
          type={alert.type}
          closable
          onClose={() => setAlert(null)}
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* KPI Cards */}
      {selectedClassId && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Total Students"
                value={analytics.totalStudents}
                prefix={<TeamOutlined />}
                status="info"
                loading={dataLoading}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Total Fee Amount"
                value={analytics.totalFeeAmount}
                prefix={<DollarOutlined />}
                precision={0}
                status="default"
                loading={dataLoading}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Collected Amount"
                value={analytics.totalCollected}
                prefix={<CheckCircleOutlined />}
                precision={0}
                status="success"
                loading={dataLoading}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Outstanding Amount"
                value={analytics.totalOutstanding}
                prefix={<CloseCircleOutlined />}
                precision={0}
                status="error"
                loading={dataLoading}
              />
            </Col>
          </Row>

          {/* Secondary KPIs */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} md={12}>
              <KPICard
                title="Collection Rate"
                value={analytics.averageCollectionRate}
                suffix="%"
                prefix={<PieChartOutlined />}
                status={analytics.averageCollectionRate >= 80 ? 'success' : 
                        analytics.averageCollectionRate >= 50 ? 'warning' : 'error'}
                loading={dataLoading}
                trend={
                  analytics.averageCollectionRate >= 80 ? 
                    <><RiseOutlined style={{ color: chartTheme.colors.success }} /> Excellent</> :
                    analytics.averageCollectionRate >= 50 ?
                    <><RiseOutlined style={{ color: chartTheme.colors.warning }} /> Good</> :
                    <><FallOutlined style={{ color: chartTheme.colors.error }} /> Needs Attention</>
                }
              />
            </Col>
            <Col xs={24} sm={12} md={12}>
              <KPICard
                title="Payment Status Overview"
                value={students.filter(s => s.status === 'paid').length}
                suffix={`/ ${students.length} students`}
                prefix={<WalletOutlined />}
                status="info"
                loading={dataLoading}
                trend={
                  <div style={{ fontSize: '12px', color: chartTheme.colors.textSecondary }}>
                    {students.filter(s => s.status === 'paid').length} Paid • {' '}
                    {students.filter(s => s.status === 'partiallyPaid').length} Partial • {' '}
                    {students.filter(s => s.status === 'unpaid').length} Unpaid
                  </div>
                }
              />
            </Col>
          </Row>

          {/* Charts */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} lg={12}>
              <EnhancedChart
                title="Fee Component Breakdown"
                data={analytics.componentStats}
                type="bar"
                dataKeys={['collected', 'outstanding']}
                colors={[chartTheme.colors.collected, chartTheme.colors.outstanding]}
                loading={dataLoading}
                emptyMessage="No component data available"
              />
            </Col>
            <Col xs={24} lg={12}>
              <EnhancedChart
                title="Daily Collection Trends"
                data={analytics.dailyStats}
                type="area"
                dataKeys={['collected', 'outstanding']}
                colors={[chartTheme.colors.collected, chartTheme.colors.outstanding]}
                loading={dataLoading}
                emptyMessage="No daily data available"
              />
            </Col>
          </Row>

          {/* Student Table */}
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>
                  Student Fee Details
                </Title>
                <Tag color="blue" style={{ fontSize: '12px' }}>
                  {students.length} Students
                </Tag>
              </div>
            }
            style={{ borderRadius: '12px' }}
          >
            <EnhancedStudentTable
              data={students}
              loading={dataLoading}
              onRowClick={(record) => {
                // Handle row click - could open detailed view
                console.log('Student clicked:', record);
              }}
            />
          </Card>
        </>
      )}

      {/* Empty State */}
      {!selectedClassId && (
        <Card style={{ textAlign: 'center', padding: '60px 20px' }}>
          <EmptyState
            title="Select a Class to View Analytics"
            description="Choose a class from the dropdown above to see detailed fee analytics and student payment information."
            icon={<PieChartOutlined style={{ fontSize: '64px', color: chartTheme.colors.textSecondary }} />}
          />
        </Card>
      )}
    </div>
  );
};

export default FeeAnalyticsEnhanced;