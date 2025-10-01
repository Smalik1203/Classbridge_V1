import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Tabs, Select, DatePicker, Button, Typography, Space, Row, Col, Statistic, 
  Alert, Spin, Table, Progress, Divider, Empty, Skeleton, message
} from 'antd';
import EmptyState from '../ui/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { 
  DollarOutlined, TeamOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, RiseOutlined, DownloadOutlined, 
  FilterOutlined, WalletOutlined, PieChartOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { getUserRole, getSchoolCode } from '../utils/metadata';
import { fmtINR } from '../utils/money';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

const FeeAnalytics = () => {
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
      } catch (e) {
        console.error("Error fetching user:", e);
        setAlert({ type: 'error', message: 'Failed to load user data' });
      }
    };
    fetchUser();
  }, []);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      if (!me.school_code) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('class_instances')
          .select('id, grade, section')
          .eq('school_code', me.school_code)
          .order('grade', { ascending: true });
        
        if (error) throw error;
        
        setClassInstances(data || []);
      } catch (err) {
        console.error('Error fetching classes:', err);
        setAlert({ type: 'error', message: 'Failed to load classes. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, [me.school_code]);

  // Fetch students for selected class
  const fetchStudents = async () => {
    if (!selectedClassId || !me.school_code) return;
    
    setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', selectedClassId)
        .eq('school_code', me.school_code)
        .order('full_name');
      
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
      setAlert({ type: 'error', message: 'Failed to load students. Please try again.' });
    } finally {
      setDataLoading(false);
    }
  };

  // Fetch fee data
  const fetchFeeData = async () => {
    if (!selectedClassId || !dateRange || !me.school_code) return;
    
    setDataLoading(true);
      try {
        const [startDate, endDate] = dateRange;
        
        // Get students with their fee plans and items
        const { data: students, error: studentsErr } = await supabase
          .from("student")
          .select(`
            id,
            full_name,
            student_code,
            class_instances!inner(grade, section)
          `)
          .eq("class_instance_id", selectedClassId)
          .eq("school_code", me.school_code)
          .order("full_name");

        if (studentsErr) throw studentsErr;

        // Get fee plans for these students
        const studentIds = students.map(s => s.id);
        const { data: plans, error: plansErr } = await supabase
          .from("fee_student_plans")
          .select("id, student_id")
          .in("student_id", studentIds)
          .eq("class_instance_id", selectedClassId)
          .eq("school_code", me.school_code);

        if (plansErr) throw plansErr;

        const planByStudent = new Map((plans || []).map(p => [p.student_id, p.id]));
        const planIds = plans?.map(p => p.id) || [];

        // Get fee plan items
        let planItems = [];
        if (planIds.length > 0) {
          const { data: items, error: itemsErr } = await supabase
            .from("fee_student_plan_items")
            .select(`
              plan_id,
              amount_paise,
              fee_component_types!inner(id, name)
            `)
            .in("plan_id", planIds);

          if (itemsErr) throw itemsErr;
          planItems = items || [];
        }

        // Get existing payments
        let payments = [];
        try {
          let q = supabase
            .from("fee_payments")
            .select(`
              student_id,
              component_type_id,
              amount_paise,
              payment_date,
              plan_id,
              payment_method
            `)
            .in("student_id", studentIds)
            .eq("school_code", me.school_code);
          if (planIds.length > 0) {
            q = q.in("plan_id", planIds);
          }
          if (dateRange && Array.isArray(dateRange) && dateRange[0] && dateRange[1]) {
            q = q.gte("payment_date", startDate.format("YYYY-MM-DD")).lte("payment_date", endDate.format("YYYY-MM-DD"));
          }
          const { data: paymentData, error: paymentErr } = await q;

          if (!paymentErr) {
            payments = paymentData || [];
          }
        } catch (e) {
        }

        // Build fee data
        const feeData = students.map(student => {
          const planId = planByStudent.get(student.id);
          const studentPlanItems = planItems.filter(item => item.plan_id === planId);
          
          // Calculate totals
          const totalPlanAmount = studentPlanItems.reduce((sum, item) => sum + (item.amount_paise || 0), 0);
          
          // Calculate collected amount from payments
          const studentPayments = payments.filter(p => p.student_id === student.id);
          const totalCollected = studentPayments.reduce((sum, payment) => sum + (payment.amount_paise || 0), 0);
          
          const outstanding = totalPlanAmount - totalCollected;
          const collectionPercentage = totalPlanAmount > 0 ? Math.round((totalCollected / totalPlanAmount) * 100) : 0;

          return {
            id: student.id,
            student_id: student.id,
            student_name: student.full_name,
            student_code: student.student_code,
            grade: student.class_instances.grade,
            section: student.class_instances.section,
            class_instance_id: selectedClassId,
            plan_id: planId,
            total_plan_amount_paise: totalPlanAmount,
            total_collected_paise: totalCollected,
            total_outstanding_paise: outstanding,
            collection_percentage: collectionPercentage,
            plan_items: studentPlanItems,
            payments: studentPayments
          };
        });

        setFeeData(feeData);
      } catch (err) {
        console.error('Error fetching fee data:', err);
        setAlert({ type: 'error', message: 'Failed to load fee data. Please try again.' });
      } finally {
        setDataLoading(false);
      }
    };

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!feeData.length || !students.length) {
      return {
        totalStudents: students.length,
        totalPlanAmount: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        overallCollectionRate: 0,
        averageCollectionRate: 0,
        dailyStats: [],
        studentStats: [],
        componentStats: []
      };
    }

    const totalStudents = students.length;
    const totalPlanAmount = feeData.reduce((sum, row) => sum + row.total_plan_amount_paise, 0);
    const totalCollected = feeData.reduce((sum, row) => sum + row.total_collected_paise, 0);
    const totalOutstanding = totalPlanAmount - totalCollected;
    const overallCollectionRate = totalPlanAmount > 0 ? Math.round((totalCollected / totalPlanAmount) * 100) : 0;

    // Daily statistics
    const dailyStats = [];
    const dateMap = new Map();
    
    feeData.forEach(student => {
      student.payments.forEach(payment => {
        const date = payment.payment_date;
        if (!dateMap.has(date)) {
          dateMap.set(date, { amount: 0, count: 0 });
        }
        const stats = dateMap.get(date);
        stats.amount += payment.amount_paise;
        stats.count++;
      });
    });

    dateMap.forEach((stats, date) => {
      dailyStats.push({
        date: dayjs(date).format('MMM DD'),
        amount: stats.amount,
        count: stats.count,
        amountInr: stats.amount / 100
      });
    });

    // Sort daily stats by date
    dailyStats.sort((a, b) => dayjs(a.date, 'MMM DD').diff(dayjs(b.date, 'MMM DD')));

    // Student statistics
    const studentStats = feeData.map(student => ({
      id: student.id,
      name: student.student_name,
      code: student.student_code,
      planAmount: student.total_plan_amount_paise,
      collected: student.total_collected_paise,
      outstanding: student.total_outstanding_paise,
      rate: student.collection_percentage
    }));

    // Component statistics
    const componentMap = new Map();
    feeData.forEach(student => {
      student.plan_items.forEach(item => {
        const componentName = item.fee_component_types.name;
        if (!componentMap.has(componentName)) {
          componentMap.set(componentName, { planAmount: 0, collected: 0 });
        }
        const stats = componentMap.get(componentName);
        stats.planAmount += item.amount_paise;
      });
      
      student.payments.forEach(payment => {
        const componentName = student.plan_items.find(item => 
          item.fee_component_types.id === payment.component_type_id
        )?.fee_component_types.name;
        if (componentName && componentMap.has(componentName)) {
          const stats = componentMap.get(componentName);
          stats.collected += payment.amount_paise;
        }
      });
    });

    const componentStats = Array.from(componentMap.entries()).map(([name, stats]) => ({
      name,
      planAmount: stats.planAmount,
      collected: stats.collected,
      outstanding: stats.planAmount - stats.collected,
      rate: stats.planAmount > 0 ? Math.round((stats.collected / stats.planAmount) * 100) : 0
    }));

    // Calculate average collection rate
    const averageCollectionRate = feeData.length > 0 ? 
      Math.round(feeData.reduce((sum, student) => sum + student.collection_percentage, 0) / feeData.length) : 0;

    return {
      totalStudents,
      totalPlanAmount,
      totalCollected,
      totalOutstanding,
      overallCollectionRate,
      averageCollectionRate,
      dailyStats,
      studentStats,
      componentStats
    };
  }, [feeData, students]);

  const studentColumns = [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: '500' }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.code}</Text>
        </div>
      )
    },
    {
      title: 'Plan Amount',
      dataIndex: 'planAmount',
      key: 'planAmount',
      render: (value) => <Text strong>{fmtINR(value)}</Text>
    },
    {
      title: 'Collected',
      dataIndex: 'collected',
      key: 'collected',
      render: (value) => <Text style={{ color: '#52c41a', fontWeight: '500' }}>{fmtINR(value)}</Text>
    },
    {
      title: 'Outstanding',
      dataIndex: 'outstanding',
      key: 'outstanding',
      render: (value) => <Text style={{ color: '#ff4d4f', fontWeight: '500' }}>{fmtINR(value)}</Text>
    },
    {
      title: 'Collection Rate',
      dataIndex: 'rate',
      key: 'rate',
      render: (value) => (
        <div>
          <Progress 
            percent={value} 
            size="small" 
            strokeColor={value >= 90 ? '#52c41a' : value >= 75 ? '#faad14' : '#ff4d4f'}
            showInfo={false}
          />
          <Text type="secondary" style={{ fontSize: '12px' }}>{value}%</Text>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
        <Card style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
            Fee Analytics
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
            Monitor fee collection and track outstanding payments
          </p>
        </div>

        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            showIcon
            closable
            onClose={() => setAlert(null)}
            style={{ marginBottom: 24, borderRadius: 8 }}
          />
        )}

        {/* Filters */}
        <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} bodyStyle={{ padding: '20px' }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#475569' }}>Class</Text>
                <Select
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  style={{ width: '100%' }}
                  placeholder="Select Class"
                  loading={loading}
                  size="large"
                >
                  {classInstances.map(cls => (
                    <Option key={cls.id} value={cls.id}>
                      Grade {cls.grade} - Section {cls.section}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#475569' }}>Date Range</Text>
                <RangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  style={{ width: '100%' }}
                  size="large"
                />
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
                <Button
                  type="primary"
                  onClick={() => {
                    if (selectedClassId && dateRange && dateRange[0] && dateRange[1]) {
                      fetchStudents();
                      fetchFeeData();
                    } else {
                      message.warning('Please select both class and date range');
                    }
                  }}
                  disabled={!selectedClassId || !dateRange || !dateRange[0] || !dateRange[1]}
                  loading={dataLoading}
                  size="large"
                  style={{ flex: 1 }}
                >
                  {dataLoading ? 'Loading...' : 'Load Data'}
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  disabled={!feeData.length}
                  size="large"
                >
                  Export
                </Button>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Key Metrics - Simplified */}
        {feeData.length > 0 && (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} md={6}>
                <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', background: '#fff' }} bodyStyle={{ padding: '20px 16px' }}>
                  <div style={{ fontSize: '36px', fontWeight: 700, color: '#0ea5e9', marginBottom: 4 }}>
                    {analytics.totalStudents}
                  </div>
                  <Text style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Total Students</Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', background: '#fff' }} bodyStyle={{ padding: '20px 16px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                    {fmtINR(analytics.totalCollected)}
                  </div>
                  <Text style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Collected</Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', background: '#fff' }} bodyStyle={{ padding: '20px 16px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
                    {fmtINR(analytics.totalOutstanding)}
                  </div>
                  <Text style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Outstanding</Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card style={{ borderRadius: 12, textAlign: 'center', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', background: '#fff' }} bodyStyle={{ padding: '20px 16px' }}>
                  <div style={{ fontSize: '36px', fontWeight: 700, color: '#0ea5e9', marginBottom: 4 }}>
                    {analytics.overallCollectionRate}%
                  </div>
                  <Text style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Collection Rate</Text>
                </Card>
              </Col>
            </Row>
          </>
        )}

        {/* Analytics Tabs */}
        {feeData.length > 0 && (
          <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} bodyStyle={{ padding: '24px' }}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
            <TabPane tab="Daily Trends" key="daily">
              <Spin spinning={dataLoading}>
                {analytics.dailyStats.length > 0 ? (
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <AreaChart data={analytics.dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" stroke="#6b7280" />
                        <YAxis stroke="#6b7280" />
                        <Tooltip />
                        <Area 
                          type="monotone" 
                          dataKey="amountInr" 
                          stroke="#52c41a" 
                          fill="#52c41a" 
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    title="No fee collection data"
                    description="No fee collection data is available for the selected period. Try selecting a different date range or ensure fees have been collected."
                    icon="💰"
                  />
                )}
              </Spin>
            </TabPane>

            <TabPane tab="Student Performance" key="students">
              <Spin spinning={dataLoading}>
                {analytics.studentStats.length > 0 ? (
                  <Table
                    dataSource={analytics.studentStats}
                    columns={studentColumns}
                    pagination={{ 
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`
                    }}
                    size="small"
                    scroll={{ x: 800 }}
                  />
                ) : (
                  <EmptyState
                    title="No student data"
                    description="No student fee data is available. Make sure students are enrolled and fee plans have been created."
                    icon="👥"
                    actionText="Go to Students"
                    onAction={() => {
                      window.location.href = '/students';
                    }}
                  />
                )}
              </Spin>
            </TabPane>

            <TabPane tab="Component Analysis" key="components">
              <Spin spinning={dataLoading}>
                {analytics.componentStats.length > 0 ? (
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart data={analytics.componentStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} stroke="#6b7280" />
                        <YAxis stroke="#6b7280" />
                        <Tooltip />
                        <Bar dataKey="collected" fill="#52c41a" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outstanding" fill="#ff4d4f" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    title="No component data"
                    description="No fee component data is available. Create fee components to see analytics and insights."
                    icon="📊"
                    actionText="Go to Fee Components"
                    onAction={() => {
                      window.location.href = '/fees';
                    }}
                  />
                )}
              </Spin>
            </TabPane>
          </Tabs>
        </Card>
        )}

        {/* Empty State */}
        {!feeData.length && !dataLoading && (
          <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} bodyStyle={{ padding: '48px 24px' }}>
            <EmptyState
              title="No fee data loaded"
              description="Select a class and date range, then click 'Load Data' to view fee analytics and insights."
              icon="💰"
            />
          </Card>
        )}
      </div>
    </div>
  );
};

export default FeeAnalytics;
