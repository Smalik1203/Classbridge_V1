import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card, Table, Space, Button, Typography, Select, Modal, Upload,
  Row, Col, message, Empty, InputNumber, Spin, Alert, Tooltip, Divider,
  Progress, Tag, DatePicker, Form, Input, Statistic, Descriptions, Checkbox
} from "antd";
import {
  UploadOutlined, DownloadOutlined, PlusOutlined,
  TeamOutlined, FileTextOutlined, WalletOutlined,
  CalendarOutlined, DollarOutlined
} from "@ant-design/icons";
import { supabase } from "../config/supabaseClient";
import { getUserRole, getSchoolCode } from "../utils/metadata";
import { Page, EmptyState } from "../ui";
import { fmtINR, toPaise, parseINR } from "../utils/money";
import dayjs from "dayjs";
import { useErrorHandler } from "../hooks/useErrorHandler.jsx";

const { Title, Text } = Typography;
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

export default function RecordPayments() {
  // User context
  const [me, setMe] = useState({ id: null, role: "", school_code: null });
  const { showError, showSuccess } = useErrorHandler();
  const canWrite = useMemo(() => ["admin", "superadmin"].includes(me.role || ""), [me.role]);

  // Data state
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(false);

  // UI state
  const [paymentModal, setPaymentModal] = useState({ open: false, student: null });
  const [bulkUploadModal, setBulkUploadModal] = useState(false);

  // Payment form state
  const [paymentForm] = Form.useForm();
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentLines, setPaymentLines] = useState([]);

  // Summary statistics
  const [summaryStats, setSummaryStats] = useState({
    totalPlanAmount: 0,
    totalCollected: 0,
    totalOutstanding: 0
  });

  // Prepare payment lines when opening modal
  useEffect(() => {
    if (paymentModal.open && paymentModal.student) {
      const items = (paymentModal.student.plan_items || [])
        .map((item) => {
          // Calculate outstanding amount for this component
          const planAmount = Number(item.amount_paise || 0);
          const componentPayments = (paymentModal.student.payments || [])
            .filter(payment => payment.component_type_id === item.fee_component_types.id)
            .reduce((sum, payment) => sum + Number(payment.amount_paise || 0), 0);
          const outstandingAmount = Math.max(0, planAmount - componentPayments);
          
          return {
            component_type_id: item.fee_component_types.id,
            component_name: item.fee_component_types.name,
            plan_amount_paise: planAmount,
            outstanding_amount_paise: outstandingAmount,
            selected: false,
            mode: 'full',
            amount_inr: outstandingAmount / 100
          };
        })
        .filter(item => item.outstanding_amount_paise > 0); // Only show components with outstanding amounts
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
            item: 'record payments',
            resource: 'payment data'
          }
        });
      }
    })();
  }, []);

  // ---------- load students and summary for selected class ----------
  const loadStudentsAndSummary = useCallback(async (cid) => {
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

      // Get fee plans for these students
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

      // Get existing payments
      let payments = [];
      try {
        const { data: paymentData, error: paymentErr } = await supabase
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

        if (!paymentErr) {
          payments = paymentData || [];
        }
      } catch (e) {
        // fee_payments table doesn't exist yet
      }

      // Build student data with payment info
      const studentData = students.map(student => {
        const planId = planByStudent.get(student.id);
        const studentPlanItems = planItems.filter(item => item.plan_id === planId);
        
        const totalPlanAmount = studentPlanItems.reduce((sum, item) => sum + (item.amount_paise || 0), 0);
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
          plan_id: planId,
          total_plan_amount_paise: totalPlanAmount,
          total_collected_paise: totalCollected,
          total_outstanding_paise: outstanding,
          collection_percentage: collectionPercentage,
          plan_items: studentPlanItems,
          payments: studentPayments
        };
      });

      setStudents(studentData);

      // Calculate summary statistics
      const totalPlanAmount = studentData.reduce((sum, row) => sum + row.total_plan_amount_paise, 0);
      const totalCollected = studentData.reduce((sum, row) => sum + row.total_collected_paise, 0);
      const totalOutstanding = totalPlanAmount - totalCollected;

      setSummaryStats({
        totalPlanAmount,
        totalCollected,
        totalOutstanding
      });

    } catch (e) {
      showError(e, {
        useNotification: true,
        context: {
          item: 'student data',
          resource: 'payment records'
        }
      });
    } finally {
      setLoading(false);
    }
  }, [me.school_code]);

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
      amount_paise: toPaise(l.mode === 'full' ? (l.outstanding_amount_paise / 100) : Number(l.amount_inr || 0)),
      payment_date: values.payment_date && values.payment_date.format ? values.payment_date.format('YYYY-MM-DD') : values.payment_date,
      payment_method: values.payment_method,
      transaction_id: values.transaction_id,
      remarks: values.remarks,
      school_code: me.school_code,
      created_by: me.id
    })).filter(r => r.amount_paise > 0);

    if (inserts.length === 0) {
      message.error("All selected amounts are zero. Please enter valid amounts.");
      return;
    }

    setSavingPayment(true);

    try {
      // Insert payment
      const { error: paymentErr } = await supabase
        .from("fee_payments")
        .insert(inserts);

      if (paymentErr) throw paymentErr;

      message.success("Payment recorded successfully!");
      setPaymentModal({ open: false, student: null });
      paymentForm.resetFields();
      
      // Reload data
      if (classId) {
        loadStudentsAndSummary(classId);
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

  // ---------- bulk upload ----------
  const handleBulkUpload = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvData = parseCSV(e.target.result);
        let successCount = 0;
        let errorCount = 0;

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
          loadStudentsAndSummary(classId);
        }
      } catch (e) {
        message.error("Failed to process CSV file");
      }
    };
    reader.readAsText(file);
    return false; // Prevent default upload
  };

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
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setPaymentModal({ open: true, student: record })}
              disabled={!canWrite || !record.plan_id}
            >
              Record
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <Page
      title="Record Payments"
      subtitle="Enter payment transactions for students"
    >
      {/* Class Selection and Summary */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Select Class</Text>
              <Select
                placeholder="Choose a class"
                value={classId}
                onChange={(value) => {
                  setClassId(value);
                  loadStudentsAndSummary(value);
                }}
                style={{ width: '100%' }}
                options={classes}
              />
            </div>
          </Col>
          {classId && (
            <>
              <Col xs={24} sm={12} md={6}>
                <Statistic
                  title="Total Plan Amount"
                  value={fmtINR(summaryStats.totalPlanAmount)}
                  prefix={<WalletOutlined />}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Statistic
                  title="Total Collected"
                  value={fmtINR(summaryStats.totalCollected)}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Statistic
                  title="Total Outstanding"
                  value={fmtINR(summaryStats.totalOutstanding)}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
            </>
          )}
        </Row>
      </Card>

      {/* Action Buttons */}
      {classId && (
        <Card style={{ marginBottom: 24, borderRadius: 12 }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                const firstStudent = students?.[0] || null;
                setPaymentModal({ open: true, student: firstStudent });
              }}
              disabled={!canWrite || !classId || students.length === 0}
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
        </Card>
      )}

      {/* Students Table */}
      <Card style={{ borderRadius: 12 }}>
        {!classId ? (
          <EmptyState
            title="Select a Class"
            description="Choose a class from the dropdown above to view students and record payments."
            icon="👥"
          />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '20px' }}>Loading students...</div>
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            title="No Students Found"
            description="No students are assigned to this class. Add students first to record payments."
            icon="👥"
          />
        ) : (
          <Table
            columns={columns}
            dataSource={students}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`
            }}
          />
        )}
      </Card>

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
            <Empty description="No outstanding payments found - all fees are already paid" />
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
                { title: 'Outstanding Amount', dataIndex: 'outstanding_amount_paise', key: 'outstanding', render: (v) => fmtINR(v) },
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
                      value={record.mode === 'full' ? record.outstanding_amount_paise / 100 : record.amount_inr}
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
    </Page>
  );
}
