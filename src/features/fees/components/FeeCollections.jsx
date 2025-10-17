// src/components/FeeCollections.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card, Table, Space, Button, Typography, Select, Modal, Upload,
  Row, Col, message, Empty, InputNumber, Spin, Alert, Tooltip, Divider,
  Progress, Tag, DatePicker, Form, Input, Tabs, Statistic, Descriptions, Checkbox
} from "antd";
import {
  UploadOutlined, DownloadOutlined, EyeOutlined, PlusOutlined,
  TeamOutlined, FileTextOutlined, PieChartOutlined, WalletOutlined,
  CalendarOutlined
} from "@ant-design/icons";
import { supabase } from '@/config/supabaseClient';
import { getUserRole, getSchoolCode } from '@/shared/utils/metadata';
import { Page, EmptyState } from '@/shared/ui/index';
import { fmtINR, toPaise, parseINR } from '@/features/fees/utils/money';
import dayjs from "dayjs";
import { useErrorHandler } from '@/shared/hooks/useErrorHandler';
import { useFees } from '../context/FeesContext';
import { useAuth } from '@/AuthProvider';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

// CSV parsing utility
const parseCSV = (csvText) => {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return data;
};

// CSV export utility
const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    message.warning('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function FeeCollections() {
  // Use centralized fees context
  const { 
    loading, 
    error, 
    feeComponents, 
    studentPlans, 
    payments, 
    classes, 
    academicYear,
    schoolCode,
    userRole,
    loadStudentPlans,
    loadPayments,
    addPayment,
    refreshData,
    getStudentPlan,
    getStudentPayments,
    getStudentTotalPaid,
    getStudentOutstanding
  } = useFees();
  
  const { user } = useAuth();
  const { showError, showSuccess } = useErrorHandler();
  const canWrite = useMemo(() => ["admin", "superadmin"].includes(userRole || ""), [userRole]);

  // Local state for UI
  const [classId, setClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [collectionData, setCollectionData] = useState([]);
  const [boot, setBoot] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('record');
  const [paymentModal, setPaymentModal] = useState({ open: false, student: null });
  const [ledgerModal, setLedgerModal] = useState({ open: false, student: null });
  const [bulkUploadModal, setBulkUploadModal] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  // Payment form state
  const [paymentForm] = Form.useForm();
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentLines, setPaymentLines] = useState([]); // [{ component_type_id, component_name, plan_amount_paise, selected, mode, amount_inr }]

  // Prepare payment lines when opening modal
  useEffect(() => {
    if (paymentModal.open && paymentModal.student) {
      const items = (paymentModal.student.plan_items || []).map((item) => ({
        component_type_id: item.fee_component_types.id,
        component_name: item.fee_component_types.name,
        plan_amount_paise: Number(item.amount_paise || 0),
        selected: false,
        mode: 'full',
        amount_inr: Number(item.amount_paise || 0) / 100
      }));
      setPaymentLines(items);
    } else if (!paymentModal.open) {
      setPaymentLines([]);
      paymentForm.resetFields();
    }
  }, [paymentModal.open, paymentModal.student]);

  // ---------- bootstrap ----------
  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) throw new Error("Not authenticated");

        const role = getUserRole(user) || "";
        const school_code = getSchoolCode(user) || null;
        setMe({ id: user.id, role, school_code });

        // Load classes
        const { data: classData, error: classErr } = await supabase
          .from("class_instances")
          .select("id, grade, section")
          .eq("school_code", school_code)
          .order("grade", { ascending: true });

        if (classErr) throw classErr;
        setClasses(classData.map(c => ({ value: c.id, label: `${c.grade}-${c.section}` })));

      } catch (e) {
        showError(e, {
          useNotification: true,
          context: {
            item: 'fee collections',
            resource: 'fee data'
          }
        });
      }
    })();
  }, []);

  // ---------- load collection data from existing fee management tables ----------
  const loadCollectionData = useCallback(async (cid, dateFilter = null) => {
    if (!cid || !me.school_code) return;
    setLoading(true);

    try {
      // Get students with their fee plans and items
      const { data: students, error: studentsErr } = await supabase
        .from("student")
        .select(`
          id,
          full_name,
          student_code,
          class_instances!inner(grade, section)
        `)
        .eq("class_instance_id", cid)
        .eq("school_code", me.school_code)
        .order("full_name");

      if (studentsErr) throw studentsErr;

      // Get fee plans for these students (scoped to this class)
      const studentIds = students.map(s => s.id);
      const { data: plans, error: plansErr } = await supabase
        .from("fee_student_plans")
        .select("id, student_id")
        .in("student_id", studentIds)
        .eq("class_instance_id", cid)
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

      // Get existing payments (if fee_payments table exists)
      let payments = [];
      try {
        let q = supabase
          .from("fee_payments")
          .select(`
            student_id,
            component_type_id,
            amount_paise,
            payment_date,
            plan_id
          `)
          .in("student_id", studentIds)
          .eq("school_code", me.school_code);
        if (planIds.length > 0) {
          q = q.in("plan_id", planIds);
        }
        if (dateFilter && Array.isArray(dateFilter) && dateFilter[0] && dateFilter[1]) {
          q = q.gte("payment_date", dateFilter[0].format("YYYY-MM-DD")).lte("payment_date", dateFilter[1].format("YYYY-MM-DD"));
        }
        const { data: paymentData, error: paymentErr } = await q;

        if (!paymentErr) {
          payments = paymentData || [];
        }
      } catch (e) {
        // fee_payments table doesn't exist yet, that's okay
      }

      // Build collection data
      const collectionData = students.map(student => {
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
          class_instance_id: cid,
          plan_id: planId,
          total_plan_amount_paise: totalPlanAmount,
          total_collected_paise: totalCollected,
          total_outstanding_paise: outstanding,
          collection_percentage: collectionPercentage,
          plan_items: studentPlanItems,
          payments: studentPayments
        };
      });

      setCollectionData(collectionData);
    } catch (e) {
      showError(e, {
        useNotification: true,
        context: {
          item: 'collection data',
          resource: 'fee collection records'
        }
      });
    } finally {
      setLoading(false);
    }
  }, [me.school_code]);

  // ---------- class change handler ----------
  const handleClassChange = useCallback((cid) => {
    setClassId(cid);
    if (!cid) {
      setCollectionData([]);
    }
  }, []);

  // ---------- date range change handler ----------
  const handleDateRangeChange = useCallback((dates) => {
    setDateRange(dates);
  }, []);

  // ---------- save payment ----------
  const savePayment = async (values) => {
    if (!paymentModal.student) return;
    if (!paymentModal.student.plan_id) {
      showError(new Error("No fee plan found"), {
        context: {
          item: 'fee plan',
          resource: 'student fee plan'
        }
      });
      return;
    }

    const selectedLines = paymentLines.filter(l => l.selected);
    if (selectedLines.length === 0) {
      message.error("Select at least one fee component to record payment.");
      return;
    }

    // Build rows
    const inserts = selectedLines.map(l => ({
      student_id: paymentModal.student.student_id,
      plan_id: paymentModal.student.plan_id,
      component_type_id: l.component_type_id,
      amount_paise: toPaise(l.mode === 'full' ? (l.plan_amount_paise / 100) : Number(l.amount_inr || 0)),
      payment_date: values.payment_date && values.payment_date.format ? values.payment_date.format('YYYY-MM-DD') : values.payment_date,
      payment_method: values.payment_method,
      transaction_id: values.transaction_id,
      remarks: values.remarks,
      school_code: schoolCode,
      created_by: user?.id
    })).filter(r => r.amount_paise > 0);

    if (inserts.length === 0) {
      message.error("All selected amounts are zero. Please enter valid amounts.");
      return;
    }

    setSavingPayment(true);

    try {
      // Use context to add payment
      await addPayment(inserts);

      message.success("Payment recorded successfully!");
      setPaymentModal({ open: false, student: null });
      paymentForm.resetFields();
      
      // Refresh data using context
      if (classId) {
        await Promise.all([
          loadStudentPlans(classId),
          loadPayments(classId)
        ]);
      }
    } catch (e) {
      showError(e, {
        useNotification: true,
        context: {
          item: 'payment',
          resource: 'fee payment record',
          action: 'save'
        }
      });
    } finally {
      setSavingPayment(false);
    }
  };

  // Removed client-side DDL; rely on migration supabase/migrations/20250101000000_fee_collections.sql

  // ---------- bulk upload ----------
  const handleBulkUpload = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvData = parseCSV(e.target.result);
        let successCount = 0;
        let errorCount = 0;

        // Assume migrations are applied; do not attempt client-side DDL

        for (const row of csvData) {
          try {
            // Find student
            const { data: student, error: studentErr } = await supabase
              .from("student")
              .select("id")
              .eq("student_code", row.student_code)
              .eq("school_code", me.school_code)
              .single();

            if (studentErr) {
              errorCount++;
              continue;
            }

            // Find component
            const { data: component, error: componentErr } = await supabase
              .from("fee_component_types")
              .select("id")
              .eq("name", row.component_name)
              .eq("school_code", me.school_code)
              .single();

            if (componentErr) {
              errorCount++;
              continue;
            }

            // Determine student's plan for current class
            const { data: plan, error: planErr } = await supabase
              .from("fee_student_plans")
              .select("id")
              .eq("student_id", student.id)
              .eq("class_instance_id", classId)
              .eq("school_code", me.school_code)
              .maybeSingle();
            if (planErr || !plan) {
              errorCount++;
              continue;
            }

            // Insert payment
            const { error: paymentErr } = await supabase
              .from("fee_payments")
              .insert({
                student_id: student.id,
                plan_id: plan.id,
                component_type_id: component.id,
                amount_paise: toPaise(parseFloat(row.amount || 0)),
                payment_date: row.payment_date && row.payment_date.trim() ? row.payment_date.trim() : dayjs().format('YYYY-MM-DD'),
                payment_method: row.payment_method,
                remarks: row.remarks || '',
                school_code: me.school_code,
                created_by: me.id
              });

            if (paymentErr) {
              errorCount++;
            } else {
              successCount++;
            }
          } catch (e) {
            errorCount++;
          }
        }

        message.success(`Bulk upload completed: ${successCount} successful, ${errorCount} failed`);
        setBulkUploadModal(false);
        
        // Reload data
        if (classId) {
          loadCollectionData(classId, dateRange);
        }
      } catch (e) {
        message.error("Failed to process CSV file");
      }
    };
    reader.readAsText(file);
    return false; // Prevent default upload
  };

  // ---------- student ledger ----------
  const openLedgerModal = async (student) => {
    try {
      // Get payments for this student
      let payments = [];
      try {
        const { data: paymentData, error: paymentsErr } = await supabase
          .from("fee_payments")
          .select(`
            id,
            receipt_number,
            amount_paise,
            payment_date,
            payment_method,
            transaction_id,
            remarks,
            fee_component_types(name)
          `)
          .eq("student_id", student.student_id)
          .eq("school_code", me.school_code)
          .order("payment_date", { ascending: false });

        if (!paymentsErr) {
          payments = paymentData || [];
        }
      } catch (e) {
        // fee_payments table doesn't exist
        payments = [];
      }

      setLedgerModal({
        open: true,
        student,
        payments,
        planItems: student.plan_items || []
      });
    } catch (e) {
      message.error(e.message || "Failed to load student ledger");
    }
  };

  // ---------- export data ----------
  const handleExport = () => {
    if (!collectionData || collectionData.length === 0) {
      message.warning('No data to export');
      return;
    }

    const exportData = collectionData.map(row => ({
      'Student Name': row.student_name,
      'Student Code': row.student_code,
      'Class': `${row.grade}-${row.section}`,
      'Total Plan Amount': fmtINR(row.total_plan_amount_paise),
      'Total Collected': fmtINR(row.total_collected_paise),
      'Total Outstanding': fmtINR(row.total_outstanding_paise),
      'Collection %': `${row.collection_percentage}%`
    }));

    exportToCSV(exportData, `fee_collections_${classId}_${new Date().toISOString().split('T')[0]}`);
  };

  // ---------- statistics ----------
  const stats = useMemo(() => {
    if (!collectionData || collectionData.length === 0) {
      return { totalPlan: 0, totalCollected: 0, totalOutstanding: 0, overallCollectionRate: 0 };
    }

    const totalPlan = collectionData.reduce((sum, row) => sum + row.total_plan_amount_paise, 0);
    const totalCollected = collectionData.reduce((sum, row) => sum + row.total_collected_paise, 0);
    const totalOutstanding = totalPlan - totalCollected;
    
    // Calculate overall collection rate (total collected / total plan amount)
    const overallCollectionRate = totalPlan > 0 ? Math.round((totalCollected / totalPlan) * 100) : 0;

    return { totalPlan, totalCollected, totalOutstanding, overallCollectionRate };
  }, [collectionData]);

  // ---------- table columns ----------
  const columns = [
    {
      title: 'Student',
      dataIndex: 'student_name',
      key: 'student_name',
      render: (text, record) => (
        <div>
          <div>{text}</div>
          <Text type="secondary">{record.student_code}</Text>
        </div>
      )
    },
    {
      title: 'Class',
      dataIndex: 'grade',
      key: 'class',
      render: (_, record) => `${record.grade}-${record.section}`
    },
    {
      title: 'Total Plan Amount',
      dataIndex: 'total_plan_amount_paise',
      key: 'total_plan_amount_paise',
      render: (amount) => fmtINR(amount)
    },
    {
      title: 'Collected',
      dataIndex: 'total_collected_paise',
      key: 'total_collected_paise',
      render: (amount) => fmtINR(amount)
    },
    {
      title: 'Outstanding',
      dataIndex: 'total_outstanding_paise',
      key: 'total_outstanding_paise',
      render: (amount) => fmtINR(amount)
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_, record) => (
        <div>
          <Progress 
            percent={record.collection_percentage} 
            size="small"
            status={record.collection_percentage === 100 ? 'success' : 'active'}
          />
          <Text type="secondary">{record.collection_percentage}%</Text>
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Record Payment">
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setPaymentModal({ open: true, student: record })}
              disabled={!canWrite}
            />
          </Tooltip>
          <Tooltip title="View Ledger">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openLedgerModal(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];



  return (
    <Page
      title="Fee Collections"
      subtitle="Record payments and track collection progress"
      extra={
        <Space>
          <Select
            placeholder="Select Class"
            value={classId}
            onChange={handleClassChange}
            style={{ width: 300 }}
            options={classes}
          />
          <RangePicker
            placeholder={['Start Date', 'End Date']}
            value={dateRange}
            onChange={handleDateRangeChange}
            size="small"
            disabledDate={(current) => current && current > dayjs().endOf('day')}
            maxDate={dayjs()}
          />
          <Button
            type="primary"
            onClick={() => {
              if (classId && dateRange && dateRange[0] && dateRange[1]) {
                loadCollectionData(classId, dateRange);
              } else {
                message.warning('Please select both a class and date range before loading data');
              }
            }}
            disabled={!classId || !dateRange || !dateRange[0] || !dateRange[1]}
          >
            Load Data
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={!collectionData || collectionData.length === 0}
          >
            Export
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Record Payments" key="record">
          <Card>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Statistic
                  title="Total Plan Amount"
                  value={fmtINR(stats.totalPlan)}
                  prefix={<WalletOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Total Collected"
                  value={fmtINR(stats.totalCollected)}
                  prefix={<WalletOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Total Outstanding"
                  value={fmtINR(stats.totalOutstanding)}
                  prefix={<WalletOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Overall Collection Rate"
                  value={stats.overallCollectionRate}
                  suffix="%"
                  prefix={<PieChartOutlined />}
                />
              </Col>
            </Row>

            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  const firstStudent = collectionData?.[0] || null;
                  setPaymentModal({ open: true, student: firstStudent });
                }}
                disabled={!canWrite || !classId || collectionData.length === 0}
              >
                Record Payment
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setBulkUploadModal(true)}
                disabled={!canWrite || !classId}
              >
                Bulk Upload
              </Button>
            </Space>

            {!classId ? (
              <EmptyState
                title="Select a Class"
                description="Choose a class from the dropdown above to view and record payments."
                icon="👥"
              />
            ) : !dateRange || !dateRange[0] || !dateRange[1] ? (
              <EmptyState
                title="Select Date Range"
                description="Choose a date range to view fee collection data for the selected period."
                icon="📅"
              />
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '20px' }}>Loading collection data...</div>
              </div>
            ) : collectionData.length === 0 ? (
              <EmptyState
                title="No Collection Data"
                description="No fee plans found for the selected class. Create fee plans first in the Fee Management section."
                icon="💰"
                actionText="Go to Fee Management"
                onAction={() => {
                  // Navigate to fee management
                  window.location.href = '/fees';
                }}
              />
            ) : (
              <Table
                columns={columns}
                dataSource={collectionData}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`
                }}
              />
            )}
          </Card>
        </TabPane>

        <TabPane tab="View Collections" key="view">
          <Card>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Statistic
                  title="Total Plan Amount"
                  value={fmtINR(stats.totalPlan)}
                  prefix={<WalletOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Total Collected"
                  value={fmtINR(stats.totalCollected)}
                  prefix={<WalletOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Total Outstanding"
                  value={fmtINR(stats.totalOutstanding)}
                  prefix={<WalletOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Overall Collection Rate"
                  value={stats.overallCollectionRate}
                  suffix="%"
                  prefix={<PieChartOutlined />}
                />
              </Col>
            </Row>

            {!classId ? (
              <EmptyState
                icon={<TeamOutlined />}
                title="Select a Class"
                description="Choose a class from the dropdown above to view collection progress"
              />
            ) : !dateRange || !dateRange[0] || !dateRange[1] ? (
              <EmptyState
                icon={<CalendarOutlined />}
                title="Select Date Range"
                description="Choose a date range to view collection progress for the selected period"
              />
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '20px' }}>Loading collection data...</div>
              </div>
            ) : collectionData.length === 0 ? (
              <EmptyState
                icon={<FileTextOutlined />}
                title="No Collection Data"
                description="No fee plans found for the selected class. Create fee plans first in the Fee Management section."
              />
            ) : (
              <Table
                columns={columns.filter(col => col.key !== 'actions')}
                dataSource={collectionData}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`
                }}
              />
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* Payment Modal */}
      <Modal
        title="Record Payment"
        open={paymentModal.open}
        onCancel={() => setPaymentModal({ open: false, student: null })}
        footer={null}
        width={600}
      >
        <Form
          form={paymentForm}
          layout="vertical"
          onFinish={savePayment}
          initialValues={{
            payment_date: dayjs(),
            payment_method: 'cash'
          }}
        >
          {paymentModal.student && (
            <Alert
              message={`Recording payment for ${paymentModal.student.student_name} (${paymentModal.student.student_code})`}
              type="info"
              style={{ marginBottom: 16 }}
            />
          )}

          <Divider>Components</Divider>
          {paymentLines.length === 0 ? (
            <Empty description="No fee plan items found" />
          ) : (
            <Table
              dataSource={paymentLines}
              rowKey={(r) => r.component_type_id}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Select',
                  key: 'select',
                  render: (_, record) => (
                    <Checkbox
                      checked={record.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPaymentLines(prev => prev.map(l => l.component_type_id === record.component_type_id ? { ...l, selected: checked } : l));
                      }}
                    />
                  )
                },
                { title: 'Component', dataIndex: 'component_name', key: 'name' },
                { title: 'Plan Amount', dataIndex: 'plan_amount_paise', key: 'plan', render: (v) => fmtINR(v) },
                {
                  title: 'Mode',
                  key: 'mode',
                  render: (_, record) => (
                    <Select
                      value={record.mode}
                      options={[{ value: 'full', label: 'Full' }, { value: 'custom', label: 'Custom' }]}
                      style={{ width: 120 }}
                      onChange={(val) => setPaymentLines(prev => prev.map(l => l.component_type_id === record.component_type_id ? { ...l, mode: val } : l))}
                    />
                  )
                },
                {
                  title: 'Amount (₹)',
                  key: 'amount',
                  render: (_, record) => (
                    <InputNumber
                      min={0}
                      step={0.01}
                      disabled={record.mode === 'full'}
                      value={record.mode === 'full' ? record.plan_amount_paise / 100 : record.amount_inr}
                      onChange={(val) => setPaymentLines(prev => prev.map(l => l.component_type_id === record.component_type_id ? { ...l, amount_inr: Number(val || 0) } : l))}
                      style={{ width: 140 }}
                    />
                  )
                }
              ]}
            />
          )}

          <Form.Item
            name="payment_date"
            label="Payment Date"
            rules={[{ required: true, message: 'Please select payment date' }]}
            getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="payment_method"
            label="Payment Method"
            rules={[{ required: true, message: 'Please select payment method' }]}
          >
            <Select>
              <Select.Option value="cash">Cash</Select.Option>
              <Select.Option value="cheque">Cheque</Select.Option>
              <Select.Option value="online">Online</Select.Option>
              <Select.Option value="card">Card</Select.Option>
              <Select.Option value="other">Other</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="transaction_id" label="Transaction ID">
            <Input placeholder="Optional transaction ID" />
          </Form.Item>

          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea placeholder="Optional remarks" rows={3} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={savingPayment}>
                Record Payment
              </Button>
              <Button onClick={() => setPaymentModal({ open: false, student: null })}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        title="Bulk Upload Payments"
        open={bulkUploadModal}
        onCancel={() => setBulkUploadModal(false)}
        footer={null}
        width={600}
      >
        <Alert
          message="CSV Format Required"
          description={
            <div>
              <p>Your CSV file should have the following columns:</p>
              <ul>
                <li><strong>student_code</strong> - Student's unique code</li>
                <li><strong>component_name</strong> - Fee component name (e.g., "Tuition Fee")</li>
                <li><strong>amount</strong> - Payment amount in rupees</li>
                <li><strong>payment_date</strong> - Date in YYYY-MM-DD format</li>
                <li><strong>payment_method</strong> - cash, cheque, online, card, or other</li>
                <li><strong>remarks</strong> - Optional remarks</li>
              </ul>
            </div>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />

        <Upload.Dragger
          accept=".csv"
          beforeUpload={handleBulkUpload}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">Click or drag CSV file to upload</p>
          <p className="ant-upload-hint">
            Support for CSV files only
          </p>
        </Upload.Dragger>
      </Modal>

      {/* Ledger Modal */}
      <Modal
        title={`Student Ledger - ${ledgerModal.student?.student_name}`}
        open={ledgerModal.open}
        onCancel={() => setLedgerModal({ open: false, student: null })}
        footer={null}
        width={800}
      >
        {ledgerModal.student && (
          <div>
            <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Student Name">{ledgerModal.student.student_name}</Descriptions.Item>
              <Descriptions.Item label="Student Code">{ledgerModal.student.student_code}</Descriptions.Item>
              <Descriptions.Item label="Class">{`${ledgerModal.student.grade}-${ledgerModal.student.section}`}</Descriptions.Item>
            </Descriptions>

            <Divider>Fee Plan Items</Divider>
            <Table
              columns={[
                { title: 'Component', dataIndex: 'fee_component_types', key: 'component', render: (ct) => ct?.name },
                { title: 'Amount', dataIndex: 'amount_paise', key: 'amount', render: (amount) => fmtINR(amount) }
              ]}
              dataSource={ledgerModal.planItems}
              rowKey="id"
              pagination={false}
              size="small"
            />

            <Divider>Payment History</Divider>
            {ledgerModal.payments.length === 0 ? (
              <Empty description="No payments recorded yet" />
            ) : (
              <Table
                columns={[
                  { title: 'Date', dataIndex: 'payment_date', key: 'date' },
                  { title: 'Receipt #', dataIndex: 'receipt_number', key: 'receipt_number', render: (r) => r || '-' },
                  { title: 'Component', dataIndex: 'fee_component_types', key: 'component', render: (ct) => ct?.name },
                  { title: 'Amount', dataIndex: 'amount_paise', key: 'amount', render: (amount) => fmtINR(amount) },
                  { title: 'Method', dataIndex: 'payment_method', key: 'method' },
                  { title: 'Transaction ID', dataIndex: 'transaction_id', key: 'transaction_id', render: (id) => id || '-' }
                ]}
                dataSource={ledgerModal.payments}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </div>
        )}
      </Modal>
    </Page>
  );
}
