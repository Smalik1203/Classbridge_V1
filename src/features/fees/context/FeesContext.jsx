import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';

// Action types
const FEES_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_FEE_COMPONENTS: 'SET_FEE_COMPONENTS',
  SET_STUDENTS: 'SET_STUDENTS',
  SET_STUDENT_PLANS: 'SET_STUDENT_PLANS',
  SET_PAYMENTS: 'SET_PAYMENTS',
  SET_CLASSES: 'SET_CLASSES',
  SET_ACADEMIC_YEAR: 'SET_ACADEMIC_YEAR',
  REFRESH_DATA: 'REFRESH_DATA',
  UPDATE_PAYMENT: 'UPDATE_PAYMENT',
  UPDATE_PLAN: 'UPDATE_PLAN',
  UPDATE_COMPONENT: 'UPDATE_COMPONENT'
};

// Initial state
const initialState = {
  loading: false,
  error: null,
  feeComponents: [],
  students: [], // Array of students for current class
  studentPlans: new Map(), // Map<studentId, planData>
  payments: new Map(), // Map<studentId, paymentData[]>
  classes: [],
  academicYear: null,
  lastUpdated: null
};

// Reducer
function feesReducer(state, action) {
  switch (action.type) {
    case FEES_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case FEES_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case FEES_ACTIONS.SET_FEE_COMPONENTS:
      return { 
        ...state, 
        feeComponents: action.payload,
        lastUpdated: new Date().toISOString()
      };
    
    case FEES_ACTIONS.SET_STUDENTS:
      return { 
        ...state, 
        students: action.payload,
        lastUpdated: new Date().toISOString()
      };
    
    case FEES_ACTIONS.SET_STUDENT_PLANS:
      return { 
        ...state, 
        studentPlans: new Map(action.payload),
        lastUpdated: new Date().toISOString()
      };
    
    case FEES_ACTIONS.SET_PAYMENTS:
      return { 
        ...state, 
        payments: new Map(action.payload),
        lastUpdated: new Date().toISOString()
      };
    
    case FEES_ACTIONS.SET_CLASSES:
      return { ...state, classes: action.payload };
    
    case FEES_ACTIONS.SET_ACADEMIC_YEAR:
      return { ...state, academicYear: action.payload };
    
    case FEES_ACTIONS.REFRESH_DATA:
      return { ...state, lastUpdated: new Date().toISOString() };
    
    case FEES_ACTIONS.UPDATE_PAYMENT:
      const newPayments = new Map(state.payments);
      const studentId = action.payload.studentId;
      const existingPayments = newPayments.get(studentId) || [];
      newPayments.set(studentId, [...existingPayments, action.payload.payment]);
      return { 
        ...state, 
        payments: newPayments,
        lastUpdated: new Date().toISOString()
      };
    
    case FEES_ACTIONS.UPDATE_PLAN:
      const newPlans = new Map(state.studentPlans);
      newPlans.set(action.payload.studentId, action.payload.plan);
      return { 
        ...state, 
        studentPlans: newPlans,
        lastUpdated: new Date().toISOString()
      };
    
    case FEES_ACTIONS.UPDATE_COMPONENT:
      return { 
        ...state, 
        feeComponents: state.feeComponents.map(comp => 
          comp.id === action.payload.id ? { ...comp, ...action.payload.updates } : comp
        ),
        lastUpdated: new Date().toISOString()
      };
    
    default:
      return state;
  }
}

// Context
const FeesContext = createContext();

// Provider component
export function FeesProvider({ children }) {
  const [state, dispatch] = useReducer(feesReducer, initialState);
  const { user } = useAuth();
  
  const schoolCode = getSchoolCode(user);
  const userRole = getUserRole(user);

  // Load fee components
  const loadFeeComponents = useCallback(async () => {
    if (!schoolCode) return;
    
    try {
      dispatch({ type: FEES_ACTIONS.SET_LOADING, payload: true });
      
      const { data, error } = await supabase
        .from('fee_component_types')
        .select('*')
        .eq('school_code', schoolCode)
        .order('name');
      
      if (error) throw error;
      
      dispatch({ type: FEES_ACTIONS.SET_FEE_COMPONENTS, payload: data || [] });
    } catch (error) {
      dispatch({ type: FEES_ACTIONS.SET_ERROR, payload: error.message });
    } finally {
      dispatch({ type: FEES_ACTIONS.SET_LOADING, payload: false });
    }
  }, [schoolCode]);

  // Load classes
  const loadClasses = useCallback(async () => {
    if (!schoolCode) return;
    
    try {
      const { data, error } = await supabase
        .from('class_instances')
        .select(`
          id,
          grade,
          section,
          academic_years(year_start, year_end)
        `)
        .eq('school_code', schoolCode)
        .order('grade')
        .order('section');
      
      if (error) throw error;
      
      // Format classes as options for Select components
      const formattedClasses = (data || []).map(cls => ({
        value: cls.id,
        label: `Grade ${cls.grade ?? "-"}${cls.section ? `-${cls.section}` : ''} (${cls.academic_years?.year_start}-${cls.academic_years?.year_end})`
      }));
      
      dispatch({ type: FEES_ACTIONS.SET_CLASSES, payload: formattedClasses });
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  }, [schoolCode]);

  // Load academic year
  const loadAcademicYear = useCallback(async () => {
    if (!schoolCode) return;
    
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, year_start, year_end, is_active')
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .single();
      
      if (!error && data) {
        dispatch({ type: FEES_ACTIONS.SET_ACADEMIC_YEAR, payload: data });
      }
    } catch (error) {
      console.error('Failed to load academic year:', error);
    }
  }, [schoolCode]);

  // Load student plans for a specific class
  const loadStudentPlans = useCallback(async (classId) => {
    if (!schoolCode || !classId) return;
    
    try {
      dispatch({ type: FEES_ACTIONS.SET_LOADING, payload: true });
      
      // Get students in the class
      const { data: students, error: studentsError } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', classId)
        .eq('school_code', schoolCode);
      
      if (studentsError) throw studentsError;
      
      // Store students in state
      dispatch({ type: FEES_ACTIONS.SET_STUDENTS, payload: students || [] });
      
      // Get fee plans for these students
      const studentIds = students?.map(s => s.id) || [];
      if (studentIds.length === 0) {
        dispatch({ type: FEES_ACTIONS.SET_STUDENT_PLANS, payload: [] });
        return;
      }
      
      const { data: plans, error: plansError } = await supabase
        .from('fee_student_plans')
        .select(`
          id,
          student_id,
          class_instance_id,
          academic_year_id,
          status
        `)
        .in('student_id', studentIds)
        .eq('class_instance_id', classId)
        .eq('school_code', schoolCode);
      
      if (plansError) throw plansError;
      
      // Get plan items
      const planIds = plans?.map(p => p.id) || [];
      let planItems = [];
      if (planIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('fee_student_plan_items')
          .select(`
            plan_id,
            component_type_id,
            amount_paise,
            quantity,
            fee_component_types!inner(id, name, code)
          `)
          .in('plan_id', planIds);
        
        if (itemsError) throw itemsError;
        planItems = items || [];
      }
      
      // Group plan items by plan_id
      const itemsByPlan = new Map();
      planItems.forEach(item => {
        if (!itemsByPlan.has(item.plan_id)) {
          itemsByPlan.set(item.plan_id, []);
        }
        itemsByPlan.get(item.plan_id).push(item);
      });
      
      // Create plan data map
      const planDataMap = [];
      plans?.forEach(plan => {
        const items = itemsByPlan.get(plan.id) || [];
        const totalAmount = items.reduce((sum, item) => sum + (item.amount_paise || 0), 0);
        
        planDataMap.push([
          plan.student_id,
          {
            ...plan,
            items,
            totalAmount,
            student: students.find(s => s.id === plan.student_id)
          }
        ]);
      });
      
      dispatch({ type: FEES_ACTIONS.SET_STUDENT_PLANS, payload: planDataMap });
    } catch (error) {
      dispatch({ type: FEES_ACTIONS.SET_ERROR, payload: error.message });
    } finally {
      dispatch({ type: FEES_ACTIONS.SET_LOADING, payload: false });
    }
  }, [schoolCode]);

  // Load payments for a specific class
  const loadPayments = useCallback(async (classId) => {
    if (!schoolCode || !classId) return;
    
    try {
      // Get students in the class
      const { data: students, error: studentsError } = await supabase
        .from('student')
        .select('id')
        .eq('class_instance_id', classId)
        .eq('school_code', schoolCode);
      
      if (studentsError) throw studentsError;
      
      const studentIds = students?.map(s => s.id) || [];
      if (studentIds.length === 0) {
        dispatch({ type: FEES_ACTIONS.SET_PAYMENTS, payload: [] });
        return;
      }
      
      // Get payments for these students
      const { data: payments, error: paymentsError } = await supabase
        .from('fee_payments')
        .select(`
          id,
          student_id,
          plan_id,
          component_type_id,
          amount_paise,
          payment_date,
          payment_method,
          transaction_id,
          receipt_number,
          remarks,
          created_at,
          fee_component_types!inner(name)
        `)
        .in('student_id', studentIds)
        .eq('school_code', schoolCode)
        .order('payment_date', { ascending: false });
      
      if (paymentsError) throw paymentsError;
      
      // Group payments by student_id
      const paymentsByStudent = new Map();
      payments?.forEach(payment => {
        if (!paymentsByStudent.has(payment.student_id)) {
          paymentsByStudent.set(payment.student_id, []);
        }
        paymentsByStudent.get(payment.student_id).push(payment);
      });
      
      dispatch({ type: FEES_ACTIONS.SET_PAYMENTS, payload: Array.from(paymentsByStudent.entries()) });
    } catch (error) {
      console.error('Failed to load payments:', error);
    }
  }, [schoolCode]);

  // Add new payment
  const addPayment = useCallback(async (paymentData) => {
    try {
      const { data, error } = await supabase
        .from('fee_payments')
        .insert(paymentData)
        .select();
      
      if (error) throw error;
      
      // Update local state
      data.forEach(payment => {
        dispatch({
          type: FEES_ACTIONS.UPDATE_PAYMENT,
          payload: {
            studentId: payment.student_id,
            payment
          }
        });
      });
      
      return data;
    } catch (error) {
      dispatch({ type: FEES_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  }, []);

  // Update student plan
  const updateStudentPlan = useCallback(async (studentId, planData) => {
    try {
      const { data, error } = await supabase
        .from('fee_student_plans')
        .upsert(planData)
        .select();
      
      if (error) throw error;
      
      // Update local state
      dispatch({
        type: FEES_ACTIONS.UPDATE_PLAN,
        payload: {
          studentId,
          plan: data[0]
        }
      });
      
      return data[0];
    } catch (error) {
      dispatch({ type: FEES_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  }, []);

  // Update fee component
  const updateFeeComponent = useCallback(async (componentId, updates) => {
    try {
      const { data, error } = await supabase
        .from('fee_component_types')
        .update(updates)
        .eq('id', componentId)
        .select();
      
      if (error) throw error;
      
      // Update local state
      dispatch({
        type: FEES_ACTIONS.UPDATE_COMPONENT,
        payload: {
          id: componentId,
          updates: data[0]
        }
      });
      
      return data[0];
    } catch (error) {
      dispatch({ type: FEES_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  }, []);

  // Refresh all data
  const refreshData = useCallback(async (classId) => {
    dispatch({ type: FEES_ACTIONS.SET_LOADING, payload: true });
    
    try {
      await Promise.all([
        loadFeeComponents(),
        loadClasses(),
        loadAcademicYear(),
        classId ? loadStudentPlans(classId) : Promise.resolve(),
        classId ? loadPayments(classId) : Promise.resolve()
      ]);
      
      dispatch({ type: FEES_ACTIONS.REFRESH_DATA });
      dispatch({ type: FEES_ACTIONS.SET_LOADING, payload: false });
    } catch (error) {
      dispatch({ type: FEES_ACTIONS.SET_ERROR, payload: error.message });
    }
  }, []);

  // Initialize data when user changes
  useEffect(() => {
    if (user && schoolCode) {
      refreshData();
    }
  }, [user, schoolCode, refreshData]);

  // Helper functions for calculations
  const getStudentPlan = useCallback((studentId) => {
    return state.studentPlans.get(studentId) || null;
  }, [state.studentPlans]);

  const getStudentPayments = useCallback((studentId) => {
    return state.payments.get(studentId) || [];
  }, [state.payments]);

  const getStudentTotalPaid = useCallback((studentId) => {
    const payments = getStudentPayments(studentId);
    return payments.reduce((sum, payment) => sum + (payment.amount_paise || 0), 0);
  }, [getStudentPayments]);

  const getStudentOutstanding = useCallback((studentId) => {
    const plan = getStudentPlan(studentId);
    const totalPaid = getStudentTotalPaid(studentId);
    const totalAmount = plan?.totalAmount || 0;
    return totalAmount - totalPaid;
  }, [getStudentPlan, getStudentTotalPaid]);

  const getClassSummary = useCallback((classId) => {
    const classStudents = state.classes.find(c => c.id === classId);
    if (!classStudents) return null;
    
    let totalStudents = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    
    // This would need to be calculated based on students in the class
    // For now, return basic structure
    return {
      totalStudents,
      totalAmount,
      totalPaid,
      totalOutstanding,
      collectionPercentage: totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0
    };
  }, [state.classes]);

  const contextValue = {
    // State
    ...state,
    
    // Actions
    loadFeeComponents,
    loadClasses,
    loadAcademicYear,
    loadStudentPlans,
    loadPayments,
    addPayment,
    updateStudentPlan,
    updateFeeComponent,
    refreshData,
    
    // Helper functions
    getStudentPlan,
    getStudentPayments,
    getStudentTotalPaid,
    getStudentOutstanding,
    getClassSummary,
    
    // User context
    schoolCode,
    userRole
  };

  return (
    <FeesContext.Provider value={contextValue}>
      {children}
    </FeesContext.Provider>
  );
}

// Hook to use the fees context
export function useFees() {
  const context = useContext(FeesContext);
  if (!context) {
    throw new Error('useFees must be used within a FeesProvider');
  }
  return context;
}

export default FeesContext;
