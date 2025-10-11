import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Select, DatePicker, Button, Typography, Alert, Spin, message, Tag
} from 'antd';
import { 
  DollarOutlined, TeamOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, DownloadOutlined, 
  WalletOutlined, PieChartOutlined,
  RiseOutlined, FallOutlined
} from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { getUserRole, getSchoolCode, isStudent, isSuperAdmin } from '../utils/metadata';
import { fmtINR } from '../utils/money';
import { formatINRCompact, formatPct, formatISTDate } from '../utils/formatting';
import { adaptComponentBreakdown, adaptDailyTrends, adaptClasswise } from '../utils/feeAdapters';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  KPICard, 
  EnhancedChart, 
  EnhancedStudentTable, 
  EmptyState,
  chartTheme,
  getCollectionRateColor
} from '../ui';
import { useTheme } from '../contexts/ThemeContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const FeeAnalyticsEnhanced = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('daily');

  // Data state
  const [classInstances, setClassInstances] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [feeData, setFeeData] = useState([]);
  const [students, setStudents] = useState([]);
  const [me, setMe] = useState({ id: null, role: "", school_code: null, user: null });
  const [chartView, setChartView] = useState('component'); // 'component', 'daily', 'class'
  const [componentStats, setComponentStats] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [classStats, setClassStats] = useState([]);

  // Fetch user context
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) throw new Error("Not authenticated");

        const role = getUserRole(user) || "";
        const school_code = getSchoolCode(user) || null;
        setMe({ id: user.id, role, school_code, user }); // Store user object for helper functions

        if (!school_code) {
          setAlert({ type: 'error', message: 'No school code found for user' });
          return;
        }

        // Load class instances
        await loadClassInstances(school_code);
      } catch (e) {
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

      // Load payments with date filter
      let paymentQuery = supabase
        .from('fee_payments')
        .select(`
          id,
          student_id,
          amount_paise,
          component_type_id,
          created_at
        `)
        .eq('school_code', me.school_code);

      // Apply date range filter if selected
      if (dateRange && dateRange[0] && dateRange[1]) {
        const startDate = dateRange[0].startOf('day').toISOString();
        const endDate = dateRange[1].endOf('day').toISOString();
        paymentQuery = paymentQuery
          .gte('created_at', startDate)
          .lte('created_at', endDate);
      }

      const { data: paymentData, error: paymentError } = await paymentQuery;

      if (paymentError) {
      }

      // Process data
      const processedStudents = processStudentData(studentData, feeData, paymentData || []);
      setStudents(processedStudents);
      setFeeData(processedStudents);

      // Load component stats, daily stats, and class stats
      await loadComponentStats();
      await loadDailyStats();
      await loadClassStats();

    } catch (e) {
      setAlert({ type: 'error', message: e.message || 'Failed to load fee data' });
    } finally {
      setDataLoading(false);
    }
  };

  // Load component statistics from database
  const loadComponentStats = async () => {
    if (!selectedClassId || !me.school_code) return;

    try {
      // Build date filter for payments
      let paymentDateFilter = supabase
        .from('fee_payments')
        .select(`
          amount_paise,
          component_type_id
        `)
        .eq('school_code', me.school_code);

      // Apply date range filter if selected
      if (dateRange && dateRange[0] && dateRange[1]) {
        const startDate = dateRange[0].startOf('day').toISOString();
        const endDate = dateRange[1].endOf('day').toISOString();
        paymentDateFilter = paymentDateFilter
          .gte('created_at', startDate)
          .lte('created_at', endDate);
      }

      const { data: payments, error: paymentError } = await paymentDateFilter;

      if (paymentError) throw paymentError;

      // Get fee component types
      const { data: componentData, error } = await supabase
        .from('fee_component_types')
        .select(`
          id,
          name
        `)
        .eq('school_code', me.school_code);

      if (error) throw error;

      // Get fee plans to calculate total planned amounts
      const { data: feePlans, error: planError } = await supabase
        .from('fee_student_plans')
        .select(`
          fee_student_plan_items(
            amount_paise,
            fee_component_types!inner(id)
          )
        `)
        .eq('school_code', me.school_code);

      if (planError) throw planError;

      // Process component stats
      const componentStats = componentData.map(component => {
        const componentPayments = (payments || []).filter(payment => 
          payment.component_type_id === component.id
        );
        const totalCollected = componentPayments.reduce((sum, payment) => 
          sum + (payment.amount_paise || 0), 0
        );

        // Calculate total planned amount for this component
        const componentPlanItems = (feePlans || []).flatMap(plan => 
          plan.fee_student_plan_items || []
        ).filter(item => item.fee_component_types?.id === component.id);
        
        const totalPlanned = componentPlanItems.reduce((sum, item) => 
          sum + (item.amount_paise || 0), 0
        );
        
        const totalOutstanding = Math.max(0, totalPlanned - totalCollected);

        return {
          name: component.name,
          collected: totalCollected,
          outstanding: totalOutstanding
        };
      });

      setComponentStats(componentStats);
    } catch (e) {
      setAlert({ type: 'error', message: 'Failed to load component statistics' });
    }
  };

  // Load daily statistics from database
  const loadDailyStats = async () => {
    if (!selectedClassId || !me.school_code) return;

    try {
      // If no date range selected, show empty state
      if (!dateRange || !dateRange[0] || !dateRange[1]) {
        setDailyStats([]);
        return;
      }

      // Get payments within the selected date range
      const startDate = dateRange[0].startOf('day').toISOString();
      const endDate = dateRange[1].endOf('day').toISOString();

      const { data: dailyData, error } = await supabase
        .from('fee_payments')
        .select(`
          amount_paise,
          created_at
        `)
        .eq('school_code', me.school_code)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date and calculate totals - only show dates with actual payments
      const dailyStats = [];
      
      // Group payments by date
      const paymentsByDate = {};
      (dailyData || []).forEach(payment => {
        const paymentDate = dayjs(payment.created_at).format('MMM DD');
        if (!paymentsByDate[paymentDate]) {
          paymentsByDate[paymentDate] = 0;
        }
        paymentsByDate[paymentDate] += payment.amount_paise || 0;
      });

      // Convert to array and sort by date
      Object.entries(paymentsByDate).forEach(([date, collected]) => {
        dailyStats.push({
          date: date,
          collected: collected,
          outstanding: 0
        });
      });

      // Sort by date
      dailyStats.sort((a, b) => {
        const dateA = dayjs(a.date, 'MMM DD');
        const dateB = dayjs(b.date, 'MMM DD');
        return dateA.diff(dateB);
      });

      setDailyStats(dailyStats);
    } catch (e) {
      setAlert({ type: 'error', message: 'Failed to load daily statistics' });
    }
  };

  // Load class-wise statistics from database
  const loadClassStats = async () => {
    if (!me.school_code) return;

    try {
      // If no date range selected, show empty state
      if (!dateRange || !dateRange[0] || !dateRange[1]) {
        setClassStats([]);
        return;
      }

      // Get all class instances (show ALL classes, even if no fee plans)
      const { data: classes, error: classError } = await supabase
        .from('class_instances')
        .select(`
          id, 
          grade, 
          section,
          student(
            id,
            fee_student_plans(
              student_id,
              fee_student_plan_items(
                amount_paise
              )
            )
          )
        `)
        .eq('school_code', me.school_code);

      if (classError) throw classError;

      // Get payments within date range
      const startDate = dateRange[0].startOf('day').toISOString();
      const endDate = dateRange[1].endOf('day').toISOString();

      const { data: payments, error: paymentError } = await supabase
        .from('fee_payments')
        .select(`
          amount_paise,
          student_id
        `)
        .eq('school_code', me.school_code)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (paymentError) throw paymentError;

      // Process class stats - show ALL classes
      const classStats = classes.map(cls => {
        const students = cls.student || [];
        const studentIds = students.map(s => s.id);

        // Calculate total planned amount for this class
        const totalPlanned = students.reduce((classSum, student) => {
          const feePlans = student.fee_student_plans || [];
          return classSum + feePlans.reduce((planSum, plan) => {
            const planItems = plan.fee_student_plan_items || [];
            return planSum + planItems.reduce((itemSum, item) => 
              itemSum + (item.amount_paise || 0), 0
            );
          }, 0);
        }, 0);

        // Get payments for students in this class
        const classPayments = payments.filter(payment => 
          studentIds.includes(payment.student_id)
        );

        // Calculate total collected amount for this class
        const totalCollected = classPayments.reduce((sum, payment) => 
          sum + (payment.amount_paise || 0), 0
        );

        const totalOutstanding = Math.max(0, totalPlanned - totalCollected);

        return {
          className: `${cls.grade} - ${cls.section}`,
          collected: totalCollected / 100, // Convert paise to rupees
          outstanding: totalOutstanding / 100, // Convert paise to rupees
          hasData: totalPlanned > 0 || totalCollected > 0 // Flag to indicate if class has any fee data
        };
      });

      setClassStats(classStats);
    } catch (e) {
      setAlert({ type: 'error', message: 'Failed to load class statistics' });
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
        total_amount: totalAmount, // Keep in paise for fmtINR
        collected_amount: collectedAmount,
        outstanding_amount: outstandingAmount,
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

    return {
      totalStudents,
      totalFeeAmount,
      totalCollected,
      totalOutstanding,
      averageCollectionRate,
      componentStats,
      dailyStats,
      classStats
    };
  }, [feeData, componentStats, dailyStats, classStats]);

  // Removed auto-loading - data only loads when user clicks "Load Data" button

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

  // Debounced fetch function (250ms delay)
  // Removed debounced auto-fetch - data only loads when user clicks "Load Data" button

  // Removed cleanup timer - no longer using debounced fetching

  // Unified chart renderer
  const renderUnifiedChart = () => {
    switch (chartView) {
      case 'component':
        return renderComponentChart();
      case 'daily':
        return renderDailyChart();
      case 'class':
        return renderClassChart();
      default:
        return renderComponentChart();
    }
  };

  const renderComponentChart = () => {
    // Show message if no date range is selected
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
  return (
        <div style={{
          height: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          backgroundColor: '#f8fafc',
          borderRadius: 8,
          border: '2px dashed #e2e8f0'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#475569' }}>Ready to analyze?</div>
          <div style={{ fontSize: 14, opacity: 0.7, textAlign: 'center', maxWidth: 280, marginBottom: 16 }}>
            Select a class and date range above, then click "Load Data" to see fee analytics
          </div>
          <div style={{ 
            padding: '8px 16px', 
            backgroundColor: '#6A4BFF', 
            color: 'white', 
            borderRadius: 6, 
            fontSize: 12, 
            fontWeight: 500 
          }}>
            ↑ Use filters above
          </div>
        </div>
      );
    }

    if (!analytics.componentStats || analytics.componentStats.length === 0) {
      return (
        <div style={{
          height: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#475569' }}>No fee components found</div>
          <div style={{ fontSize: 14, opacity: 0.7, textAlign: 'center', maxWidth: 280 }}>
            Try selecting a different class or date range to see component breakdown
          </div>
        </div>
      );
    }

    // Process component data for chart
    const processedData = analytics.componentStats.map(item => {
      const collected = Number(item.collected || 0);
      const outstanding = Number(item.outstanding || 0);
      const total = collected + outstanding;
      
      // Calculate percentages
      const collectedPct = total > 0 ? (collected / total) * 100 : 0;
      const outstandingPct = total > 0 ? (outstanding / total) * 100 : 0;
      
      return {
        component: item.name || 'Unknown',
        collectedPct: collectedPct,
        outstandingPct: outstandingPct,
        collected: collected,
        outstanding: outstanding
      };
    });

    return (
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={processedData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            barCategoryGap="20%"
            barGap={8}
          >
            {/* For vertical bars: X-axis shows categories, Y-axis shows values */}
            <XAxis 
              dataKey="component" 
              tick={{ fontSize: 12 }}
              height={60}
              interval={0}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              allowDecimals={false}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12 }}
              width={60}
            />
            <Tooltip
              formatter={(val, key) =>
                typeof val === 'number' ? [`${val.toFixed(1)}%`, key] : [val, key]
              }
            />
            <Legend />
            <Bar 
              dataKey="collectedPct" 
              barSize={40} 
              fill="#10b981" 
              name="Collected %" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="outstandingPct" 
              barSize={40} 
              fill="#ef4444" 
              name="Outstanding %" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderDailyChart = () => {
    if (!analytics.dailyStats || analytics.dailyStats.length === 0) {
      return (
        <div style={{
          height: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📈</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No payments in selected range</div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>Try selecting a different date range</div>
        </div>
      );
    }

    // Process daily data directly (don't use adapter to avoid Date object conversion)
    const processedData = analytics.dailyStats.map(item => ({
      date: item.date, // Keep as string format (MMM DD)
      collected: (item.collected || 0) / 100, // Convert paise to rupees
      outstanding: (item.outstanding || 0) / 100 // Convert paise to rupees
    }));

    return (
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={processedData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              height={60}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatINRCompact(value)}
              width={80}
            />
            <Tooltip 
              formatter={(value, name) => [formatINRCompact(value), name]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Bar 
              dataKey="collected" 
              fill="#10b981" 
              name="Collected" 
              barSize={40}
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="outstanding" 
              fill="#ef4444" 
              name="Outstanding" 
              barSize={40}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderClassChart = () => {
    // Show message if no date range is selected
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      return (
        <div style={{
          height: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Select a date range</div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>Choose start and end dates to view class-wise analytics</div>
        </div>
      );
    }

    if (!analytics.classStats || analytics.classStats.length === 0) {
      return (
        <div style={{
          height: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🎓</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No classes found</div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>No classes are available in your school</div>
        </div>
      );
    }

    // Process class data for chart with proper numerical sorting
    const processedData = analytics.classStats
      .map(item => ({
        className: item.className,
        collected: item.collected,
        outstanding: item.outstanding,
        // Extract grade number for sorting
        gradeNumber: parseInt(item.className.split(' - ')[0]) || 0
      }))
      .sort((a, b) => a.gradeNumber - b.gradeNumber)
      .map(item => ({
        className: item.className,
        collected: item.collected,
        outstanding: item.outstanding
      }));

    if (processedData.length === 0) {
      return (
        <div style={{
          height: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🎓</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No class data available</div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>Try selecting a different date range</div>
        </div>
      );
    }

    return (
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={processedData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            barCategoryGap="20%"
            barGap={8}
          >
            <XAxis 
              dataKey="className" 
              tick={{ fontSize: 12 }}
              height={60}
              interval={0}
            />
            <YAxis 
              type="number"
              domain={[0, 'dataMax + 10%']}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatINRCompact(value)}
              width={80}
            />
            <Tooltip 
              formatter={(value, name) => [formatINRCompact(value), name]}
            />
            <Legend />
            <Bar 
              dataKey="collected" 
              fill="#10b981" 
              name="Collected" 
              barSize={40}
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="outstanding" 
              fill="#ef4444" 
              name="Outstanding" 
              barSize={40}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div style={{ padding: 24, backgroundColor: theme.token.colorBgLayout, minHeight: '100vh' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0, fontSize: 24, fontWeight: 700, color: theme.token.colorTextHeading, marginBottom: 4 }}>
          Fee Analytics
        </Title>
        <Text type="secondary" style={{ fontSize: 14, color: theme.token.colorTextSecondary }}>
          {isStudent(me.user) ? 'View your fee details' : 'Fee collection insights & payment tracking'}
        </Text>
      </div>

      {/* Compact Filter Bar */}
      <div style={{ 
        marginBottom: 16, 
        padding: '12px 16px', 
        backgroundColor: theme.token.colorBgContainer, 
          borderRadius: 8,
        border: `1px solid ${theme.token.colorBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Class</span>
              <Select
            placeholder="Select class"
                value={selectedClassId}
            onChange={(value) => {
              setSelectedClassId(value);
            }}
            style={{ width: 160 }}
            size="small"
            showSearch={true}
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
              >
                {classInstances.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    {cls.grade} - {cls.section}
                  </Option>
                ))}
              </Select>
            </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Date Range</span>
              <RangePicker
            style={{ width: 240 }}
            size="small"
                value={dateRange}
            onChange={(dates) => {
              setDateRange(dates);
            }}
                disabledDate={(current) => current && current > dayjs().endOf('day')}
                maxDate={dayjs()}
            placeholder={['Start', 'End']}
            format="DD MMM"
            showTime={false}
            allowClear={true}
              />
            </div>
        
        <Button
          onClick={() => {
            if (selectedClassId && dateRange && dateRange[0] && dateRange[1]) {
              loadFeeData();
            } else {
              message.warning('Please select both a class and date range first');
            }
          }}
          disabled={!selectedClassId || !dateRange || !dateRange[0] || !dateRange[1]}
          size="small"
          type="primary"
          style={{
            backgroundColor: '#6A4BFF',
            borderColor: '#6A4BFF',
            fontWeight: 500
          }}
        >
          Load Data
        </Button>
        
            {!isStudent(me.user) && (
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={!students.length}
                size="small"
                style={{ 
                  marginLeft: 'auto',
                  fontWeight: 500
                }}
              >
                Export
              </Button>
            )}
      </div>

      {alert && (
        <Alert
          message={alert.message}
          type={alert.type}
          closable
          onClose={() => setAlert(null)}
          style={{ marginBottom: 12, fontSize: 13 }}
          banner
        />
      )}

      {selectedClassId && (
        <>
          {/* KPI Strip - Clean, aligned design */}
          <div style={{
            marginBottom: 16,
            padding: '16px 20px',
            backgroundColor: '#fff',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 24
          }}>
            {/* Students */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 8, 
                backgroundColor: '#f0f9ff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <TeamOutlined style={{ color: '#0ea5e9', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 700, 
                  color: '#1e293b',
                  lineHeight: 1.2
                }}>
                  {dataLoading ? <Spin size="small" /> : analytics.totalStudents}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Students</div>
              </div>
            </div>
            
            <div style={{ width: '1px', height: 40, backgroundColor: '#e2e8f0' }} />
            
            {/* Total Fees */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 8, 
                backgroundColor: '#f0fdf4', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <DollarOutlined style={{ color: '#22c55e', fontSize: 18 }} />
                  </div>
              <div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 700, 
                  color: '#1e293b',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap'
                }}>
                  {dataLoading ? <Spin size="small" /> : (() => {
                    const amount = analytics.totalFeeAmount / 100; // Convert paise to rupees
                    if (amount >= 10000000) return `₹${(amount/10000000).toFixed(1)} Cr`;
                    if (amount >= 100000) return `₹${(amount/100000).toFixed(1)} L`;
                    if (amount >= 1000) return `₹${(amount/1000).toFixed(1)} K`;
                    return `₹${amount.toLocaleString('en-IN')}`;
                  })()}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Total Fees</div>
              </div>
            </div>
            
            <div style={{ width: '1px', height: 40, backgroundColor: '#e2e8f0' }} />
            
            {/* Collected */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 8, 
                backgroundColor: '#f0fdf4', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 700, 
                  color: '#22c55e',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap'
                }}>
                  {dataLoading ? <Spin size="small" /> : (() => {
                    const amount = analytics.totalCollected / 100; // Convert paise to rupees
                    if (amount >= 10000000) return `₹${(amount/10000000).toFixed(1)} Cr`;
                    if (amount >= 100000) return `₹${(amount/100000).toFixed(1)} L`;
                    if (amount >= 1000) return `₹${(amount/1000).toFixed(1)} K`;
                    return `₹${amount.toLocaleString('en-IN')}`;
                  })()}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Collected</div>
              </div>
            </div>
            
            <div style={{ width: '1px', height: 40, backgroundColor: '#e2e8f0' }} />
            
            {/* Outstanding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 8, 
                backgroundColor: '#fef2f2', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 700, 
                  color: '#ef4444',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap'
                }}>
                  {dataLoading ? <Spin size="small" /> : (() => {
                    const amount = analytics.totalOutstanding / 100; // Convert paise to rupees
                    if (amount >= 10000000) return `₹${(amount/10000000).toFixed(1)} Cr`;
                    if (amount >= 100000) return `₹${(amount/100000).toFixed(1)} L`;
                    if (amount >= 1000) return `₹${(amount/1000).toFixed(1)} K`;
                    return `₹${amount.toLocaleString('en-IN')}`;
                  })()}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Outstanding</div>
              </div>
            </div>
            
            <div style={{ width: '1px', height: 40, backgroundColor: '#e2e8f0' }} />
            
            {/* Collection Rate */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 8, 
                backgroundColor: analytics.averageCollectionRate >= 80 ? '#f0fdf4' : 
                               analytics.averageCollectionRate >= 50 ? '#fffbeb' : '#fef2f2', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <PieChartOutlined style={{ 
                  color: analytics.averageCollectionRate >= 80 ? '#22c55e' : 
                         analytics.averageCollectionRate >= 50 ? '#f59e0b' : '#ef4444', 
                  fontSize: 18 
                }} />
              </div>
              <div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 700, 
                  color: analytics.averageCollectionRate >= 80 ? '#22c55e' : 
                         analytics.averageCollectionRate >= 50 ? '#f59e0b' : '#ef4444',
                  lineHeight: 1.2
                }}>
                  {dataLoading ? <Spin size="small" /> : `${analytics.averageCollectionRate.toFixed(1)}%`}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Collection Rate</div>
              </div>
            </div>
                  </div>

          {/* Unified Chart Section */}
          {!isStudent(me.user) && (
            <div style={{
              backgroundColor: '#fff',
              borderRadius: 8,
              padding: 16,
              border: '1px solid #e2e8f0',
              marginBottom: 16
            }}>
              <div style={{
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: 18, 
                  fontWeight: 600, 
                  color: '#1e293b' 
                }}>
                  Analytics Overview
                </h3>
                
                {/* Chart Type Filter */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { key: 'component', label: 'Component Breakdown', icon: '📊' },
                    { key: 'daily', label: 'Daily Trends', icon: '📈' },
                    { key: 'class', label: 'Class-wise', icon: '🎓' }
                  ].map(option => (
                    <button
                      key={option.key}
                      onClick={() => setChartView(option.key)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: chartView === option.key ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        backgroundColor: chartView === option.key ? '#eff6ff' : '#fff',
                        color: chartView === option.key ? '#1e40af' : '#64748b',
                        fontSize: 14,
                        fontWeight: chartView === option.key ? 600 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>{option.icon}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{ height: 320 }}>
                {renderUnifiedChart()}
              </div>
            </div>
          )}

          {/* Student Fee Table - Clean, aligned design */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: 24
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid #f1f5f9'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: 18, 
                fontWeight: 600, 
                color: '#1e293b' 
              }}>
                  {isStudent(me.user) ? 'My Fee Details' : 'Student Fee Details'}
              </h3>
              <div style={{
                backgroundColor: '#f1f5f9',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                fontWeight: 500,
                color: '#475569'
              }}>
                  {students.length} {isStudent(me.user) ? 'Items' : 'Students'}
              </div>
            </div>
            <EnhancedStudentTable
              data={students}
              loading={dataLoading}
              onRowClick={(record) => {
                // Handle row click - could open detailed view
              }}
            />
          </div>
        </>
      )}

      {!selectedClassId && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 48,
          textAlign: 'center'
        }}>
          <EmptyState
            title="Select a Class"
            description="Choose a class to view fee analytics and payment information."
            icon={<PieChartOutlined style={{ fontSize: 48, color: chartTheme.colors.textSecondary }} />}
          />
        </div>
      )}
    </div>
  );
};

export default FeeAnalyticsEnhanced;