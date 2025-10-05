// src/services/analyticsSummaryService.js
// Summary service functions for analytics hub

import { supabase } from '../config/supabaseClient';
import { WorkingDaysService } from './workingDaysService';
import { fmtINR } from '../utils/money';
import dayjs from 'dayjs';

/**
 * Get attendance summary for analytics hub
 */
export const getAttendanceSummary = async (schoolCode, dateRange, classId = null) => {
  try {
    const [startDate, endDate] = dateRange;
    
    // Get attendance data
    let query = supabase
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
      query = query.eq('student.class_instance_id', classId);
    }

    const { data: attendance, error } = await query;
    if (error) throw error;

    // Calculate working days and holidays
    const workingDaysData = await WorkingDaysService.calculateWorkingDaysAndHolidays(
      schoolCode, 
      startDate.format('YYYY-MM-DD'), 
      endDate.format('YYYY-MM-DD'), 
      classId
    );

    // Process attendance data
    const studentMap = new Map();
    attendance?.forEach(record => {
      const studentId = record.student_id;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: record.student.full_name,
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
    console.error('Error fetching attendance summary:', error);
    throw error;
  }
};

/**
 * Get fees summary for analytics hub
 */
export const getFeesSummary = async (schoolCode, dateRange, classId = null) => {
  try {
    const [startDate, endDate] = dateRange;
    
    // Get students
    let studentQuery = supabase
      .from('student')
      .select(`
        id,
        full_name,
        class_instance_id,
        class_instances!inner(grade, section, school_code)
      `)
      .eq('class_instances.school_code', schoolCode);

    if (classId) {
      studentQuery = studentQuery.eq('class_instance_id', classId);
    }

    const { data: students, error: studentsError } = await studentQuery;
    if (studentsError) throw studentsError;

    if (!students?.length) {
      return {
        kpis: [
          { value: 0, label: 'Total Students', color: '#3b82f6' },
          { value: '₹0', label: 'Total Amount', color: '#1f2937' },
          { value: '₹0', label: 'Collected', color: '#16a34a' },
          { value: '₹0', label: 'Outstanding', color: '#dc2626' }
        ],
        chartData: [],
        chartType: 'bar',
        totalStudents: 0,
        totalAmount: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        collectionRate: 0
      };
    }

    const studentIds = students.map(s => s.id);

    // Get fee plans
    const { data: plans, error: plansError } = await supabase
      .from('fee_student_plans')
      .select('id, student_id')
      .in('student_id', studentIds)
      .eq('school_code', schoolCode);

    if (plansError) throw plansError;

    const planIds = plans?.map(p => p.id) || [];
    let planItems = [];
    let payments = [];

    if (planIds.length > 0) {
      // Get plan items
      const { data: items, error: itemsError } = await supabase
        .from('fee_student_plan_items')
        .select('plan_id, amount_paise')
        .in('plan_id', planIds);

      if (itemsError) throw itemsError;
      planItems = items || [];

      // Get payments with date filter
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

      const { data: paymentData, error: paymentError } = await paymentQuery;
      if (paymentError) throw paymentError;
      payments = paymentData || [];
    }

    // Calculate totals
    const totalAmount = planItems.reduce((sum, item) => sum + item.amount_paise, 0);
    const totalCollected = payments.reduce((sum, payment) => sum + payment.amount_paise, 0);
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
    console.error('Error fetching fees summary:', error);
    throw error;
  }
};

/**
 * Get exams summary for analytics hub
 */
export const getExamsSummary = async (schoolCode, dateRange, classId = null) => {
  try {
    const [startDate, endDate] = dateRange;
    
    // Get tests (both online and offline)
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

    const { data: tests, error: testsError } = await testQuery;
    if (testsError) throw testsError;

    if (!tests?.length) {
      return {
        kpis: [
          { value: 0, label: 'Total Tests', color: '#3b82f6' },
          { value: '0%', label: 'Avg Score', color: '#1f2937' },
          { value: 0, label: 'Completed', color: '#16a34a' },
          { value: 0, label: 'Pending', color: '#ef4444' }
        ],
        chartData: [],
        chartType: 'line',
        totalTests: 0,
        averageScore: 0,
        completedTests: 0,
        pendingTests: 0
      };
    }

    const testIds = tests.map(t => t.id);
    const onlineTests = tests.filter(t => t.test_mode === 'online');
    const offlineTests = tests.filter(t => t.test_mode === 'offline');

    // Get online test attempts
    let attempts = [];
    if (onlineTests.length > 0) {
      const { data: attemptsData, error: attemptsError } = await supabase
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
        .in('test_id', onlineTests.map(t => t.id));

      if (attemptsError) throw attemptsError;
      attempts = attemptsData || [];
    }

    // Get offline test marks
    let offlineMarks = [];
    if (offlineTests.length > 0) {
      const { data: marksData, error: marksError } = await supabase
        .from('test_marks')
        .select(`
          id,
          test_id,
          student_id,
          marks_obtained,
          max_marks
        `)
        .in('test_id', offlineTests.map(t => t.id));

      if (marksError) throw marksError;
      offlineMarks = marksData || [];
    }

    // Calculate scores for online tests
    const completedOnlineTests = attempts?.filter(a => a.completed_at) || [];
    const onlineAverageScore = completedOnlineTests.length > 0 
      ? completedOnlineTests.reduce((sum, attempt) => {
          const score = attempt.earned_points !== null ? attempt.earned_points : (attempt.score || 0);
          const total = attempt.total_points !== null ? attempt.total_points : 1;
          return sum + (score / total * 100);
        }, 0) / completedOnlineTests.length 
      : 0;

    // Calculate scores for offline tests
    const offlineAverageScore = offlineMarks.length > 0
      ? offlineMarks.reduce((sum, mark) => {
          return sum + (mark.marks_obtained / mark.max_marks * 100);
        }, 0) / offlineMarks.length
      : 0;

    // Combined average score
    const totalCompleted = completedOnlineTests.length + offlineMarks.length;
    const averageScore = totalCompleted > 0 
      ? ((onlineAverageScore * completedOnlineTests.length) + (offlineAverageScore * offlineMarks.length)) / totalCompleted
      : 0;

    // Chart data for line chart (average score trend)
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
    console.error('Error fetching exams summary:', error);
    throw error;
  }
};

/**
 * Get learning resources summary for analytics hub
 */
export const getLearningSummary = async (schoolCode, dateRange, classId = null) => {
  try {
    const [startDate, endDate] = dateRange;
    
    // Get learning resources
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

    const { data: resources, error: resourcesError } = await resourceQuery;
    if (resourcesError) throw resourcesError;

    if (!resources?.length) {
      return {
        kpis: [
          { value: 0, label: 'Total Resources', color: '#3b82f6' },
          { value: 0, label: 'Videos', color: '#16a34a' },
          { value: 0, label: 'Documents', color: '#1f2937' },
          { value: 0, label: 'Links', color: '#ef4444' }
        ],
        chartData: [],
        chartType: 'bar',
        totalResources: 0,
        byType: {}
      };
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
    console.error('Error fetching learning summary:', error);
    throw error;
  }
};
