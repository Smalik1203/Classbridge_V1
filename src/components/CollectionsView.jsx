import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card, Table, Space, Button, Typography, Select, 
  Row, Col, message, Empty, Spin, Alert, Tooltip, Divider,
  Progress, Tag, DatePicker, Statistic, Descriptions, Input, Modal
} from "antd";
import {
  DownloadOutlined, EyeOutlined, FilterOutlined,
  TeamOutlined, FileTextOutlined, WalletOutlined,
  CalendarOutlined, DollarOutlined, SearchOutlined
} from "@ant-design/icons";
import { supabase } from "../config/supabaseClient";
import { getUserRole, getSchoolCode } from "../utils/metadata";
import { Page, EmptyState } from "../ui";
import { fmtINR, toPaise, parseINR } from "../utils/money";
import dayjs from "dayjs";
import { useErrorHandler } from "../hooks/useErrorHandler.jsx";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

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

export default function CollectionsView() {
  // User context
  const [me, setMe] = useState({ id: null, role: "", school_code: null });
  const { showError, showSuccess } = useErrorHandler();

  // Data state
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [collectionData, setCollectionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(false);

  // Filter state
  const [dateRange, setDateRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // all, paid, partial, unpaid
  const [searchText, setSearchText] = useState("");

  // UI state
  const [ledgerModal, setLedgerModal] = useState({ open: false, student: null });

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
        console.error("Bootstrap error:", e);
        showError(e, {
          useNotification: true,
          context: {
            item: 'collections view',
            resource: 'collection data'
          }
        });
      }
    })();
  }, []);

  // ---------- load collection data ----------
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
        let q = supabase
          .from("fee_payments")
          .select(`
            student_id,
            component_type_id,
            amount_paise,
            payment_date,
            plan_id,
            payment_method,
            transaction_id,
            remarks
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
        // fee_payments table doesn't exist yet
      }

      // Build collection data
      const collectionData = students.map(student => {
        const planId = planByStudent.get(student.id);
        const studentPlanItems = planItems.filter(item => item.plan_id === planId);
        
        const totalPlanAmount = studentPlanItems.reduce((sum, item) => sum + (item.amount_paise || 0), 0);
        const studentPayments = payments.filter(p => p.student_id === student.id);
        const totalCollected = studentPayments.reduce((sum, payment) => sum + (payment.amount_paise || 0), 0);
        
        const outstanding = totalPlanAmount - totalCollected;
        const collectionPercentage = totalPlanAmount > 0 ? Math.round((totalCollected / totalPlanAmount) * 100) : 0;

        // Determine status
        let status = 'unpaid';
        if (collectionPercentage === 100) status = 'paid';
        else if (collectionPercentage > 0) status = 'partial';

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
          status: status,
          plan_items: studentPlanItems,
          payments: studentPayments
        };
      });

      setCollectionData(collectionData);
    } catch (e) {
      console.error("Error loading collection data:", e);
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

  // ---------- filtered data ----------
  const filteredData = useMemo(() => {
    let filtered = collectionData;

    // Apply search filter
    if (searchText) {
      filtered = filtered.filter(row => 
        row.student_name.toLowerCase().includes(searchText.toLowerCase()) ||
        row.student_code.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(row => row.status === statusFilter);
    }

    return filtered;
  }, [collectionData, searchText, statusFilter]);

  // ---------- statistics ----------
  const stats = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return { totalPlan: 0, totalCollected: 0, totalOutstanding: 0, overallCollectionRate: 0 };
    }

    const totalPlan = filteredData.reduce((sum, row) => sum + row.total_plan_amount_paise, 0);
    const totalCollected = filteredData.reduce((sum, row) => sum + row.total_collected_paise, 0);
    const totalOutstanding = totalPlan - totalCollected;
    
    const overallCollectionRate = totalPlan > 0 ? Math.round((totalCollected / totalPlan) * 100) : 0;

    return { totalPlan, totalCollected, totalOutstanding, overallCollectionRate };
  }, [filteredData]);

  // ---------- student ledger ----------
  const openLedgerModal = async (student) => {
    try {
      setLedgerModal({
        open: true,
        student,
        payments: student.payments || [],
        planItems: student.plan_items || []
      });
    } catch (e) {
      console.error("Error loading ledger:", e);
      message.error(e.message || "Failed to load student ledger");
    }
  };

  // ---------- export data ----------
  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) {
      message.warning('No data to export');
      return;
    }

    const exportData = filteredData.map(row => ({
      'Student Name': row.student_name,
      'Student Code': row.student_code,
      'Class': `${row.grade}-${row.section}`,
      'Total Plan Amount': fmtINR(row.total_plan_amount_paise),
      'Total Collected': fmtINR(row.total_collected_paise),
      'Total Outstanding': fmtINR(row.total_outstanding_paise),
      'Collection %': `${row.collection_percentage}%`,
      'Status': row.status.charAt(0).toUpperCase() + row.status.slice(1)
    }));

    exportToCSV(exportData, `collections_${classId}_${new Date().toISOString().split('T')[0]}`);
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
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const colors = { paid: 'success', partial: 'warning', unpaid: 'error' };
        const labels = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' };
        return <Tag color={colors[record.status]}>{labels[record.status]}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Payment History">
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
      title="Collections"
      subtitle="Monitor payment history and outstanding dues"
    >
      {/* Filters */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Class</Text>
              <Select
                placeholder="Select a class"
                value={classId}
                onChange={(value) => {
                  setClassId(value);
                  loadCollectionData(value, dateRange);
                }}
                style={{ width: '100%' }}
                options={classes}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Date Range</Text>
              <RangePicker
                style={{ width: '100%' }}
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates);
                  if (classId) {
                    loadCollectionData(classId, dates);
                  }
                }}
                placeholder={['Start Date', 'End Date']}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Status</Text>
              <Select
                placeholder="Filter by status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
                options={[
                  { value: 'all', label: 'All Students' },
                  { value: 'paid', label: 'Fully Paid' },
                  { value: 'partial', label: 'Partially Paid' },
                  { value: 'unpaid', label: 'Unpaid' }
                ]}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Search</Text>
              <Input
                placeholder="Search students..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Summary Statistics */}
      {classId && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Plan Amount"
                value={fmtINR(stats.totalPlan)}
                prefix={<WalletOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Collected"
                value={fmtINR(stats.totalCollected)}
                prefix={<WalletOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Outstanding"
                value={fmtINR(stats.totalOutstanding)}
                prefix={<WalletOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Overall Collection Rate"
                value={stats.overallCollectionRate}
                suffix="%"
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Export Button */}
      {classId && (
        <Card style={{ marginBottom: 24, borderRadius: 12 }}>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={!filteredData || filteredData.length === 0}
            >
              Export to CSV
            </Button>
            <Text type="secondary">
              Showing {filteredData.length} of {collectionData.length} students
            </Text>
          </Space>
        </Card>
      )}

      {/* Collections Table */}
      <Card style={{ borderRadius: 12 }}>
        {!classId ? (
          <EmptyState
            title="Select a Class"
            description="Choose a class from the dropdown above to view collection data."
            icon="👥"
          />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '20px' }}>Loading collection data...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <EmptyState
            title="No Collection Data"
            description="No fee plans found for the selected class. Create fee plans first in the Fee Management section."
            icon="💰"
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
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
                  { title: 'Amount', dataIndex: 'amount_paise', key: 'amount', render: (amount) => fmtINR(amount) },
                  { title: 'Method', dataIndex: 'payment_method', key: 'method' },
                  { title: 'Transaction ID', dataIndex: 'transaction_id', key: 'transaction_id', render: (id) => id || '-' },
                  { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', render: (r) => r || '-' }
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
