import React, { useState, useEffect } from 'react';
import {
  Card, Table, Space, Typography, Alert, Spin, Tag, Progress, 
  Row, Col, Statistic, Descriptions, Divider, Empty, Skeleton
} from 'antd';
import {
  WalletOutlined, FileTextOutlined, CheckCircleOutlined, 
  ClockCircleOutlined, DollarOutlined, EyeOutlined
} from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { getStudentCode, getSchoolCode } from '../utils/metadata';
import { fmtINR } from '../utils/money';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const StudentFees = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [student, setStudent] = useState(null);
  const [feeData, setFeeData] = useState(null);

  // Fetch student data
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const studentCode = getStudentCode(user);
        const query = supabase.from('student').select(`
          id, 
          full_name, 
          student_code, 
          class_instance_id, 
          school_code,
          class_instances!inner(grade, section)
        `);
        
        const schoolCode = getSchoolCode(user);
        if (!schoolCode) {
          throw new Error("School information not found");
        }

        const { data, error } = await (studentCode ? 
          query.eq('student_code', studentCode).eq('school_code', schoolCode) : 
          query.eq('email', user.email).eq('school_code', schoolCode)
        ).single();

        if (error) throw error;
        setStudent(data);
      } catch (err) {
        setAlert({ type: 'error', message: 'Could not fetch student data. Please try again.' });
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [user]);

  // Fetch fee data for the student
  useEffect(() => {
    const fetchFeeData = async () => {
      if (!student) return;
      
      try {
        // Get student's fee plan
        const { data: plans, error: plansError } = await supabase
          .from('fee_student_plans')
          .select('id')
          .eq('student_id', student.id)
          .eq('class_instance_id', student.class_instance_id)
          .eq('school_code', student.school_code)
          .single();

        if (plansError && plansError.code !== 'PGRST116') {
          throw plansError;
        }

        if (!plans) {
          setFeeData({ hasPlan: false });
          return;
        }

        // Get fee plan items
        const { data: planItems, error: itemsError } = await supabase
          .from('fee_student_plan_items')
          .select(`
            amount_paise,
            fee_component_types!inner(id, name, code)
          `)
          .eq('plan_id', plans.id)
          .eq('school_code', student.school_code);

        if (itemsError) throw itemsError;

        // Get payments made
        const { data: payments, error: paymentsError } = await supabase
          .from('fee_payments')
          .select(`
            amount_paise,
            payment_date,
            payment_method,
            component_type_id,
            fee_component_types!inner(name)
          `)
          .eq('student_id', student.id)
          .eq('school_code', student.school_code);

        if (paymentsError && paymentsError.code !== 'PGRST116') {
          throw paymentsError;
        }

        // Calculate totals and outstanding amounts
        const totalPlanAmount = (planItems || []).reduce((sum, item) => sum + (item.amount_paise || 0), 0);
        const totalPaid = (payments || []).reduce((sum, payment) => sum + (payment.amount_paise || 0), 0);
        const outstanding = totalPlanAmount - totalPaid;
        const paymentPercentage = totalPlanAmount > 0 ? Math.round((totalPaid / totalPlanAmount) * 100) : 0;

        // Group payments by component
        const paymentsByComponent = {};
        (payments || []).forEach(payment => {
          const componentId = payment.component_type_id;
          if (!paymentsByComponent[componentId]) {
            paymentsByComponent[componentId] = 0;
          }
          paymentsByComponent[componentId] += payment.amount_paise || 0;
        });

        // Prepare fee breakdown
        const feeBreakdown = (planItems || []).map(item => {
          const componentId = item.fee_component_types.id;
          const paidAmount = paymentsByComponent[componentId] || 0;
          const outstandingAmount = (item.amount_paise || 0) - paidAmount;
          const componentPercentage = item.amount_paise > 0 ? 
            Math.round((paidAmount / item.amount_paise) * 100) : 0;

          return {
            id: componentId,
            name: item.fee_component_types.name,
            code: item.fee_component_types.code,
            planAmount: item.amount_paise,
            paidAmount,
            outstandingAmount,
            percentage: componentPercentage,
            status: outstandingAmount <= 0 ? 'paid' : outstandingAmount < item.amount_paise ? 'partial' : 'unpaid'
          };
        });

        setFeeData({
          hasPlan: true,
          totalPlanAmount,
          totalPaid,
          outstanding,
          paymentPercentage,
          feeBreakdown,
          payments: payments || [],
          planItems: planItems || []
        });

      } catch (err) {
        setAlert({ type: 'error', message: 'Failed to load fee information. Please try again.' });
      }
    };

    fetchFeeData();
  }, [student]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'unpaid': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'partial': return 'Partial';
      case 'unpaid': return 'Unpaid';
      default: return 'Unknown';
    }
  };

  const feeBreakdownColumns = [
    {
      title: 'Fee Component',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.code}
          </Text>
        </div>
      )
    },
    {
      title: 'Total Amount',
      dataIndex: 'planAmount',
      key: 'planAmount',
      align: 'right',
      render: (amount) => (
        <Text strong>{fmtINR(amount)}</Text>
      )
    },
    {
      title: 'Paid Amount',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      align: 'right',
      render: (amount) => (
        <Text style={{ color: amount > 0 ? '#52c41a' : '#8c8c8c' }}>
          {fmtINR(amount)}
        </Text>
      )
    },
    {
      title: 'Outstanding',
      dataIndex: 'outstandingAmount',
      key: 'outstandingAmount',
      align: 'right',
      render: (amount) => (
        <Text style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a' }}>
          {amount > 0 ? `+${fmtINR(amount)}` : fmtINR(amount)}
        </Text>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: 'Progress',
      key: 'progress',
      align: 'center',
      render: (_, record) => (
        <Progress
          percent={record.percentage}
          size="small"
          strokeColor={
            record.percentage >= 100 ? '#52c41a' :
            record.percentage >= 50 ? '#faad14' :
            '#ff4d4f'
          }
        />
      )
    }
  ];

  const paymentHistoryColumns = [
    {
      title: 'Date',
      dataIndex: 'payment_date',
      key: 'payment_date',
      render: (date) => dayjs(date).format('DD MMM YYYY')
    },
    {
      title: 'Component',
      dataIndex: 'fee_component_types',
      key: 'component',
      render: (component) => component?.name || 'Unknown'
    },
    {
      title: 'Amount',
      dataIndex: 'amount_paise',
      key: 'amount',
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#52c41a' }}>
          {fmtINR(amount)}
        </Text>
      )
    },
    {
      title: 'Method',
      dataIndex: 'payment_method',
      key: 'method',
      render: (method) => (
        <Tag color="blue">
          {method ? method.charAt(0).toUpperCase() + method.slice(1) : 'Not specified'}
        </Tag>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
        <Card style={{ maxWidth: 1200, margin: '0 auto', borderRadius: 12 }}>
          <Skeleton active />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <Card style={{ maxWidth: 1200, margin: '0 auto', borderRadius: 12 }}>
        <Title level={3} style={{ color: '#1e293b', marginBottom: 24 }}>
          My Fee Information {student ? `- ${student.full_name}` : ''}
        </Title>
        
        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            showIcon
            closable
            onClose={() => setAlert(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        {!student && !loading && (
          <Empty description="Student information could not be loaded." />
        )}

        {student && feeData && (
          <div>
            {/* Summary Statistics */}
            {feeData.hasPlan ? (
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                                 <Col xs={24} sm={12} md={6}>
                   <Card>
                     <Statistic
                       title="Total Fee Amount"
                       value={feeData.totalPlanAmount / 100}
                       precision={2}
                       valueStyle={{ color: '#1890ff' }}
                       prefix={<><WalletOutlined /> ₹</>}
                     />
                   </Card>
                 </Col>
                 <Col xs={24} sm={12} md={6}>
                   <Card>
                     <Statistic
                       title="Amount Paid"
                       value={feeData.totalPaid / 100}
                       precision={2}
                       valueStyle={{ color: '#52c41a' }}
                       prefix={<><CheckCircleOutlined /> ₹</>}
                     />
                   </Card>
                 </Col>
                 <Col xs={24} sm={12} md={6}>
                   <Card>
                     <Statistic
                       title="Outstanding Amount"
                       value={feeData.outstanding / 100}
                       precision={2}
                       valueStyle={{ color: feeData.outstanding > 0 ? '#ff4d4f' : '#52c41a' }}
                       prefix={<><ClockCircleOutlined /> ₹</>}
                     />
                   </Card>
                 </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Payment Progress"
                      value={feeData.paymentPercentage}
                      precision={1}
                      valueStyle={{ color: '#722ed1' }}
                      prefix={<DollarOutlined />}
                      suffix="%"
                    />
                  </Card>
                </Col>
              </Row>
            ) : (
              <Alert
                message="No Fee Plan Found"
                description="You don't have a fee plan assigned yet. Please contact your school administration."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            {/* Overall Progress */}
            {feeData.hasPlan && (
              <Card title="Payment Progress" style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>Overall Payment Progress</Text>
                    <Text strong>{feeData.paymentPercentage}%</Text>
                  </div>
                  <Progress
                    percent={feeData.paymentPercentage}
                    strokeColor={
                      feeData.paymentPercentage >= 100 ? '#52c41a' :
                      feeData.paymentPercentage >= 75 ? '#1890ff' :
                      feeData.paymentPercentage >= 50 ? '#faad14' :
                      '#ff4d4f'
                    }
                    size="large"
                  />
                </div>
                <Row gutter={16}>
                  <Col span={8}>
                    <Text type="secondary">Total Fee: </Text>
                    <Text strong>{fmtINR(feeData.totalPlanAmount)}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">Paid: </Text>
                    <Text strong style={{ color: '#52c41a' }}>
                      {fmtINR(feeData.totalPaid)}
                    </Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">Outstanding: </Text>
                    <Text strong style={{ color: feeData.outstanding > 0 ? '#ff4d4f' : '#52c41a' }}>
                      {fmtINR(feeData.outstanding)}
                    </Text>
                  </Col>
                </Row>
              </Card>
            )}

            {/* Fee Breakdown */}
            {feeData.hasPlan && (
              <Card title="Fee Breakdown" style={{ marginBottom: 24 }}>
                <Table
                  dataSource={feeData.feeBreakdown}
                  columns={feeBreakdownColumns}
                  pagination={false}
                  size="small"
                  rowKey="id"
                />
              </Card>
            )}

            {/* Payment History */}
            {feeData.hasPlan && feeData.payments.length > 0 && (
              <Card title="Payment History" extra={<EyeOutlined />}>
                <Table
                  dataSource={feeData.payments}
                  columns={paymentHistoryColumns}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  size="small"
                  rowKey="id"
                />
              </Card>
            )}

            {feeData.hasPlan && feeData.payments.length === 0 && (
              <Card title="Payment History">
                <Empty description="No payment records found yet." />
              </Card>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default StudentFees;
