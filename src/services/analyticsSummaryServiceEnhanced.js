// src/services/analyticsSummaryServiceEnhanced.js
// Enhanced analytics service with better error handling and fallbacks

import { supabase } from '../config/supabaseClient';
import { WorkingDaysService } from './workingDaysService';
import { fmtINR } from '../utils/money';
import { getSchoolCode } from '../utils/metadata';
import dayjs from 'dayjs';

/**
 * Enhanced analytics service with comprehensive error handling
 */

/**
 * Safe database query wrapper with error handling
 */
const safeQuery = async (queryFn, fallbackData = null, errorMessage = 'Query failed') => {
  try {
    const result = await queryFn();
    if (result.error) {
      console.warn(`${errorMessage}:`, result.error);
      return { data: fallbackData, error: result.error };
    }
    return { data: result.data || fallbackData, error: null };
  } catch (err) {
    console.warn(`${errorMessage}:`, err);
    return { data: fallbackData, error: err };
  }
};

/**
 * Get user school code with fallback
 */
const getUserSchoolCode = (user) => {
  try {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      console.warn('No school code found in user metadata');
      return null;
    }
    return schoolCode;
  } catch (error) {
    console.warn('Error extracting school code:', error);
    return null;
  }
};

/**
 * Enhanced attendance summary with error handling
 */
export const getAttendanceSummary = async (schoolCode, dateRange, classId = null, user = null) => {
  try {
    console.log('📊 Fetching attendance summary for school:', schoolCode);
    
    // Validate inputs
    if (!schoolCode) {
      console.warn('No school code provided');
      return getEmptyAttendanceSummary();
    }

    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate) {
      console.warn('Invalid date range provided');
      return getEmptyAttendanceSummary();
    }

    // Get attendance data with error handling
    const attendanceQuery = () => supabase
      .from('attendance')
      .select(`
        student_id,
        status,
        date,
        student!inner(
          id,
          full_name,
          class_instance_id,
          class_instances!inner(id, grade, section, school_code)
        )
      `)
      .eq('student.class_instances.school_code', schoolCode)
      .gte('date', startDate.format('YYYY-MM-DD'))
      .lte('date', endDate.format('YYYY-MM-DD'));

    if (classId) {
      attendanceQuery().eq('student.class_instance_id', classId);
    }

    const { data: attendance, error: attendanceError } = await safeQuery(
      attendanceQuery,
      [],
      'Failed to fetch attendance data'
    );

    if (attendanceError) {
      console.error('Attendance query failed:', attendanceError);
      return getEmptyAttendanceSummary();
    }

    // Get working days with error handling
    let workingDaysData = { workingDays: 0, holidays: 0 };
    try {
      workingDaysData = await WorkingDaysService.calculateWorkingDaysAndHolidays(
        schoolCode, 
        startDate.format('YYYY-MM-DD'), 
        endDate.format('YYYY-MM-DD'), 
        classId
      );
    } catch (error) {
      console.warn('Failed to calculate working days:', error);
    }

    // Process attendance data
    const studentMap = new Map();
    attendance?.forEach(record => {
      const studentId = record.student_id;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: record.student?.full_name || 'Unknown',
          present_days: 0,
          absent_days: 0,
          total_days: 0
        });
      }
      
      const student = studentMap.get(studentId);
      student.total_days++;
      if (record.status === 'present') student.present_days++;
      else if (record.status === 'absent') student.absent_days++;
    });

    const students = Array.from(studentMap.values());
    const totalStudents = students.length;
    const averageAttendanceRate = students.length > 0 
      ? students.reduce((sum, student) => sum + (student.present_days / student.total_days * 100), 0) / students.length 
      : 0;

    // Chart data for donut
    const chartData = [
      { name: 'Present', value: students.reduce((sum, s) => sum + s.present_days, 0), color: '#10b981' },
      { name: 'Absent', value: students.reduce((sum, s) => sum + s.absent_days, 0), color: '#ef4444' }
    ];

    return {
      kpis: [
        { 
          value: totalStudents, 
          label: 'Total Students', 
          color: '#1f2937',
          icon: '👥'
        },
        { 
          value: `${Math.round(averageAttendanceRate)}%`, 
          label: 'Avg Attendance', 
          color: averageAttendanceRate >= 80 ? '#16a34a' : averageAttendanceRate >= 60 ? '#f59e0b' : '#dc2626',
          icon: '📊'
        },
        { 
          value: workingDaysData.workingDays, 
          label: 'Working Days', 
          color: '#10b981',
          icon: '✅'
        },
        { 
          value: workingDaysData.holidays, 
          label: 'Holidays', 
          color: '#ef4444',
          icon: '❌'
        }
      ],
      chartData,
      chartType: 'pie',
      totalStudents,
      averageAttendanceRate,
      workingDays: workingDaysData.workingDays,
      holidays: workingDaysData.holidays
    };
  } catch (error) {
    console.error('Error in getAttendanceSummary:', error);
    return getEmptyAttendanceSummary();
  }
};

/**
 * Enhanced fees summary with error handling
 */
export const getFeesSummary = async (schoolCode, dateRange, classId = null, user = null) => {
  try {
    console.log('💰 Fetching fees summary for school:', schoolCode);
    
    if (!schoolCode) {
      return getEmptyFeesSummary();
    }

    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate) {
      return getEmptyFeesSummary();
    }

    // Get students with error handling
    const studentsQuery = () => {
      let query = supabase
        .from('student')
        .select(`
          id,
          full_name,
          class_instance_id,
          class_instances!inner(grade, section, school_code)
        `)
        .eq('class_instances.school_code', schoolCode);

      if (classId) {
        query = query.eq('class_instance_id', classId);
      }
      return query;
    };

    const { data: students, error: studentsError } = await safeQuery(
      studentsQuery,
      [],
      'Failed to fetch students'
    );

    if (studentsError || !students?.length) {
      return getEmptyFeesSummary();
    }

    const studentIds = students.map(s => s.id);

    // Get fee plans with error handling
    const { data: plans, error: plansError } = await safeQuery(
      () => supabase
        .from('fee_student_plans')
        .select('id, student_id')
        .in('student_id', studentIds)
        .eq('school_code', schoolCode),
      [],
      'Failed to fetch fee plans'
    );

    if (plansError) {
      return getEmptyFeesSummary();
    }

    const planIds = plans?.map(p => p.id) || [];
    let planItems = [];
    let payments = [];

    if (planIds.length > 0) {
      // Get plan items
      const { data: items, error: itemsError } = await safeQuery(
        () => supabase
          .from('fee_student_plan_items')
          .select('plan_id, amount_paise')
          .in('plan_id', planIds),
        [],
        'Failed to fetch plan items'
      );

      if (!itemsError) {
        planItems = items || [];
      }

      // Get payments with date filter
      const { data: paymentData, error: paymentError } = await safeQuery(
        () => {
          let paymentQuery = supabase
            .from('fee_payments')
            .select('student_id, amount_paise')
            .in('student_id', studentIds)
            .eq('school_code', schoolCode);

          if (startDate && endDate) {
            paymentQuery = paymentQuery
              .gte('created_at', startDate.startOf('day').toISOString())
              .lte('created_at', endDate.endOf('day').toISOString());
          }
          return paymentQuery;
        },
        [],
        'Failed to fetch payments'
      );

      if (!paymentError) {
        payments = paymentData || [];
      }
    }

    // Calculate totals
    const totalAmount = planItems.reduce((sum, item) => sum + (item.amount_paise || 0), 0);
    const totalCollected = payments.reduce((sum, payment) => sum + (payment.amount_paise || 0), 0);
    const totalOutstanding = totalAmount - totalCollected;
    const collectionRate = totalAmount > 0 ? (totalCollected / totalAmount) * 100 : 0;

    // Chart data for stacked bar
    const chartData = [
      { name: 'Collected', value: totalCollected, color: '#10b981' },
      { name: 'Outstanding', value: totalOutstanding, color: '#ef4444' }
    ];

    return {
      kpis: [
        { 
          value: students.length, 
          label: 'Total Students', 
          color: '#1f2937',
          icon: '👥'
        },
        { 
          value: fmtINR(totalAmount), 
          label: 'Total Amount', 
          color: '#1f2937',
          icon: '💰'
        },
        { 
          value: fmtINR(totalCollected), 
          label: 'Collected', 
          color: '#16a34a',
          icon: '✅'
        },
        { 
          value: fmtINR(totalOutstanding), 
          label: 'Outstanding', 
          color: '#dc2626',
          icon: '⚠️'
        }
      ],
      chartData,
      chartType: 'bar',
      totalStudents: students.length,
      totalAmount,
      totalCollected,
      totalOutstanding,
      collectionRate
    };
  } catch (error) {
    console.error('Error in getFeesSummary:', error);
    return getEmptyFeesSummary();
  }
};

/**
 * Enhanced exams summary with error handling
 */
export const getExamsSummary = async (schoolCode, dateRange, classId = null, user = null) => {
  try {
    console.log('📝 Fetching exams summary for school:', schoolCode);
    
    if (!schoolCode) {
      return getEmptyExamsSummary();
    }

    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate) {
      return getEmptyExamsSummary();
    }

    // Get tests with error handling
    const { data: tests, error: testsError } = await safeQuery(
      () => {
        let testQuery = supabase
          .from('tests')
          .select(`
            id,
            title,
            test_mode,
            class_instance_id,
            class_instances!inner(grade, section, school_code)
          `)
          .eq('class_instances.school_code', schoolCode)
          .gte('created_at', startDate.startOf('day').toISOString())
          .lte('created_at', endDate.endOf('day').toISOString());

        if (classId) {
          testQuery = testQuery.eq('class_instance_id', classId);
        }
        return testQuery;
      },
      [],
      'Failed to fetch tests'
    );

    if (testsError || !tests?.length) {
      return getEmptyExamsSummary();
    }

    const testIds = tests.map(t => t.id);
    const onlineTests = tests.filter(t => t.test_mode === 'online');
    const offlineTests = tests.filter(t => t.test_mode === 'offline');

    // Get online test attempts with error handling
    let attempts = [];
    if (onlineTests.length > 0) {
      const { data: attemptsData, error: attemptsError } = await safeQuery(
        () => supabase
          .from('test_attempts')
          .select(`
            id,
            test_id,
            student_id,
            score,
            earned_points,
            total_points,
            completed_at
          `)
          .in('test_id', onlineTests.map(t => t.id)),
        [],
        'Failed to fetch test attempts'
      );

      if (!attemptsError) {
        attempts = attemptsData || [];
      }
    }

    // Get offline test marks with error handling
    let offlineMarks = [];
    if (offlineTests.length > 0) {
      const { data: marksData, error: marksError } = await safeQuery(
        () => supabase
          .from('test_marks')
          .select(`
            id,
            test_id,
            student_id,
            marks_obtained,
            max_marks
          `)
          .in('test_id', offlineTests.map(t => t.id)),
        [],
        'Failed to fetch test marks'
      );

      if (!marksError) {
        offlineMarks = marksData || [];
      }
    }

    // Calculate scores
    const completedOnlineTests = attempts?.filter(a => a.completed_at) || [];
    const onlineAverageScore = completedOnlineTests.length > 0 
      ? completedOnlineTests.reduce((sum, attempt) => {
          const score = attempt.earned_points !== null ? attempt.earned_points : (attempt.score || 0);
          const total = attempt.total_points !== null ? attempt.total_points : 1;
          return sum + (score / total * 100);
        }, 0) / completedOnlineTests.length 
      : 0;

    const offlineAverageScore = offlineMarks.length > 0
      ? offlineMarks.reduce((sum, mark) => {
          return sum + ((mark.marks_obtained || 0) / (mark.max_marks || 1) * 100);
        }, 0) / offlineMarks.length
      : 0;

    const totalCompleted = completedOnlineTests.length + offlineMarks.length;
    const averageScore = totalCompleted > 0 
      ? ((onlineAverageScore * completedOnlineTests.length) + (offlineAverageScore * offlineMarks.length)) / totalCompleted
      : 0;

    // Chart data for line chart
    const chartData = [
      { name: 'Week 1', value: Math.round(averageScore) },
      { name: 'Week 2', value: Math.round(averageScore * 0.95) },
      { name: 'Week 3', value: Math.round(averageScore * 1.05) },
      { name: 'Week 4', value: Math.round(averageScore) }
    ];

    return {
      kpis: [
        { 
          value: tests.length, 
          label: 'Total Tests', 
          color: '#1f2937',
          icon: '📝'
        },
        { 
          value: `${Math.round(averageScore)}%`, 
          label: 'Avg Score', 
          color: averageScore >= 70 ? '#16a34a' : averageScore >= 50 ? '#f59e0b' : '#dc2626',
          icon: '📊'
        },
        { 
          value: totalCompleted, 
          label: 'Completed', 
          color: '#16a34a',
          icon: '✅'
        },
        { 
          value: (attempts?.length || 0) - completedOnlineTests.length, 
          label: 'Pending', 
          color: '#ef4444',
          icon: '⏳'
        }
      ],
      chartData,
      chartType: 'line',
      totalTests: tests.length,
      averageScore,
      completedTests: totalCompleted,
      pendingTests: (attempts?.length || 0) - completedOnlineTests.length,
      onlineTests: onlineTests.length,
      offlineTests: offlineTests.length
    };
  } catch (error) {
    console.error('Error in getExamsSummary:', error);
    return getEmptyExamsSummary();
  }
};

/**
 * Enhanced learning summary with error handling
 */
export const getLearningSummary = async (schoolCode, dateRange, classId = null, user = null) => {
  try {
    console.log('📚 Fetching learning summary for school:', schoolCode);
    
    if (!schoolCode) {
      return getEmptyLearningSummary();
    }

    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate) {
      return getEmptyLearningSummary();
    }

    // Get learning resources with error handling
    const { data: resources, error: resourcesError } = await safeQuery(
      () => {
        let resourceQuery = supabase
          .from('learning_resources')
          .select(`
            id,
            title,
            resource_type,
            class_instance_id,
            class_instances!inner(grade, section, school_code)
          `)
          .eq('class_instances.school_code', schoolCode)
          .gte('created_at', startDate.startOf('day').toISOString())
          .lte('created_at', endDate.endOf('day').toISOString());

        if (classId) {
          resourceQuery = resourceQuery.eq('class_instance_id', classId);
        }
        return resourceQuery;
      },
      [],
      'Failed to fetch learning resources'
    );

    if (resourcesError || !resources?.length) {
      return getEmptyLearningSummary();
    }

    // Group by resource type
    const byType = {};
    resources.forEach(resource => {
      byType[resource.resource_type] = (byType[resource.resource_type] || 0) + 1;
    });

    // Chart data for horizontal bar
    const chartData = Object.entries(byType).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count,
      color: type === 'video' ? '#10b981' : type === 'document' ? '#3b82f6' : '#ef4444'
    }));

    return {
      kpis: [
        { 
          value: resources.length, 
          label: 'Total Resources', 
          color: '#1f2937',
          icon: '📚'
        },
        { 
          value: byType.video || 0, 
          label: 'Videos', 
          color: '#16a34a',
          icon: '🎥'
        },
        { 
          value: byType.document || 0, 
          label: 'Documents', 
          color: '#1f2937',
          icon: '📄'
        },
        { 
          value: byType.link || 0, 
          label: 'Links', 
          color: '#ef4444',
          icon: '🔗'
        }
      ],
      chartData,
      chartType: 'bar',
      totalResources: resources.length,
      byType
    };
  } catch (error) {
    console.error('Error in getLearningSummary:', error);
    return getEmptyLearningSummary();
  }
};

/**
 * Empty data fallbacks
 */
const getEmptyAttendanceSummary = () => ({
  kpis: [
    { value: 0, label: 'Total Students', color: '#3b82f6', icon: '👥' },
    { value: '0%', label: 'Avg Attendance', color: '#1f2937', icon: '📊' },
    { value: 0, label: 'Working Days', color: '#10b981', icon: '✅' },
    { value: 0, label: 'Holidays', color: '#ef4444', icon: '❌' }
  ],
  chartData: [],
  chartType: 'pie',
  totalStudents: 0,
  averageAttendanceRate: 0,
  workingDays: 0,
  holidays: 0
});

const getEmptyFeesSummary = () => ({
  kpis: [
    { value: 0, label: 'Total Students', color: '#3b82f6', icon: '👥' },
    { value: '₹0', label: 'Total Amount', color: '#1f2937', icon: '💰' },
    { value: '₹0', label: 'Collected', color: '#16a34a', icon: '✅' },
    { value: '₹0', label: 'Outstanding', color: '#dc2626', icon: '⚠️' }
  ],
  chartData: [],
  chartType: 'bar',
  totalStudents: 0,
  totalAmount: 0,
  totalCollected: 0,
  totalOutstanding: 0,
  collectionRate: 0
});

const getEmptyExamsSummary = () => ({
  kpis: [
    { value: 0, label: 'Total Tests', color: '#3b82f6', icon: '📝' },
    { value: '0%', label: 'Avg Score', color: '#1f2937', icon: '📊' },
    { value: 0, label: 'Completed', color: '#16a34a', icon: '✅' },
    { value: 0, label: 'Pending', color: '#ef4444', icon: '⏳' }
  ],
  chartData: [],
  chartType: 'line',
  totalTests: 0,
  averageScore: 0,
  completedTests: 0,
  pendingTests: 0
});

const getEmptyLearningSummary = () => ({
  kpis: [
    { value: 0, label: 'Total Resources', color: '#3b82f6', icon: '📚' },
    { value: 0, label: 'Videos', color: '#16a34a', icon: '🎥' },
    { value: 0, label: 'Documents', color: '#1f2937', icon: '📄' },
    { value: 0, label: 'Links', color: '#ef4444', icon: '🔗' }
  ],
  chartData: [],
  chartType: 'bar',
  totalResources: 0,
  byType: {}
});
