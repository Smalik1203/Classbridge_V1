import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Button, Tag, Table, Select, Space, Typography, Modal, Form, InputNumber, Input, App, Empty, Skeleton, Popconfirm, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, ThunderboltOutlined, LockOutlined, FilePdfOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { hrService, formatINR, financialYearForMonth } from '../services/hrService';
import HrDocumentViewer from '../components/HrDocumentViewer';

const { Title, Text } = Typography;

const STATUS_COLORS = { draft: 'default', processing: 'blue', locked: 'green' };

export default function Payroll() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [slipsLoading, setSlipsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const [docViewer, setDocViewer] = useState({ open: false, payslipId: null, employeeId: null, employeeName: null });

  const loadRuns = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const r = await hrService.listPayrollRuns(schoolCode);
      setRuns(r);
      if (r.length > 0 && !selectedRunId) setSelectedRunId(r[0].id);
    } catch (e) {
      message.error(e.message || 'Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  };

  const loadPayslips = async (runId) => {
    if (!runId) { setPayslips([]); return; }
    try {
      setSlipsLoading(true);
      const data = await hrService.listPayslipsForRun(runId);
      setPayslips(data);
    } catch (e) {
      message.error(e.message || 'Failed to load payslips');
    } finally {
      setSlipsLoading(false);
    }
  };

  useEffect(() => { loadRuns(); /* eslint-disable-next-line */ }, [schoolCode]);
  useEffect(() => { loadPayslips(selectedRunId); /* eslint-disable-next-line */ }, [selectedRunId]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  const totals = useMemo(() => {
    return payslips.reduce((acc, p) => ({
      gross: acc.gross + Number(p.gross_earnings || 0),
      deductions: acc.deductions + Number(p.total_deductions || 0),
      net: acc.net + Number(p.net_pay || 0),
    }), { gross: 0, deductions: 0, net: 0 });
  }, [payslips]);

  const hasCurrentMonthRun = runs.some((r) => r.month === dayjs().month() + 1 && r.year === dayjs().year());

  const openCreate = () => {
    const month = dayjs().month() + 1;
    const year = dayjs().year();
    form.setFieldsValue({ month, year, financial_year: financialYearForMonth(year, month) });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    try {
      const v = await form.validateFields();
      setBusy(true);
      const created = await hrService.createPayrollRun({
        school_code: schoolCode,
        month: v.month,
        year: v.year,
        financial_year: v.financial_year,
      });
      message.success('Payroll run created');
      setCreateOpen(false);
      await loadRuns();
      setSelectedRunId(created.id);
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to create run');
    } finally {
      setBusy(false);
    }
  };

  const processRun = async () => {
    if (!selectedRun) return;
    try {
      setBusy(true);
      await hrService.processPayrollRun(selectedRun.id);
      message.success('Payroll processed');
      await loadRuns();
      await loadPayslips(selectedRun.id);
    } catch (e) {
      message.error(e.message || 'Failed to process payroll');
    } finally {
      setBusy(false);
    }
  };

  const lockRun = async () => {
    if (!selectedRun) return;
    try {
      setBusy(true);
      await hrService.lockPayrollRun(selectedRun.id);
      message.success('Payroll locked');
      await loadRuns();
    } catch (e) {
      message.error(e.message || 'Failed to lock run');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      title: 'Employee',
      key: 'emp',
      render: (_, r) => (
        <div>
          <div><Text strong>{r.employees?.full_name}</Text></div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employees?.employee_code} · {r.employees?.designation}</Text>
        </div>
      ),
    },
    { title: 'Department', dataIndex: ['employees', 'department'] },
    { title: 'Paid Days', dataIndex: 'paid_days', align: 'right' },
    { title: 'Gross', dataIndex: 'gross_earnings', align: 'right', render: formatINR },
    { title: 'Deductions', dataIndex: 'total_deductions', align: 'right', render: formatINR },
    { title: 'Net Pay', dataIndex: 'net_pay', align: 'right', render: (v) => <Text strong>{formatINR(v)}</Text> },
    {
      title: '',
      key: 'view',
      render: (_, r) => (
        <Tooltip title="View payslip">
          <Button
            size="small"
            icon={<FilePdfOutlined />}
            onClick={() => setDocViewer({ open: true, payslipId: r.id, employeeId: r.employee_id, employeeName: r.employees?.full_name })}
          />
        </Tooltip>
      ),
    },
  ];

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr')}>HR Hub</Button>
      </Space>

      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Payroll</Title>
            <Text type="secondary">{runs.length} run{runs.length !== 1 ? 's' : ''}</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadRuns}>Refresh</Button>
            {!hasCurrentMonthRun && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Create Run for {dayjs().format('MMM YYYY')}
              </Button>
            )}
          </Space>
        </Space>

        {runs.length === 0 ? (
          <Empty description="No payroll runs yet" />
        ) : (
          <>
            <Space style={{ marginBottom: 16 }} wrap>
              <Select
                value={selectedRunId}
                onChange={setSelectedRunId}
                style={{ minWidth: 280 }}
                options={runs.map((r) => ({
                  value: r.id,
                  label: `${dayjs().month(r.month - 1).format('MMMM')} ${r.year} · FY ${r.financial_year}`,
                }))}
              />
              {selectedRun && (
                <Tag color={STATUS_COLORS[selectedRun.status] || 'default'} style={{ textTransform: 'capitalize' }}>
                  {selectedRun.status}
                </Tag>
              )}
              {selectedRun?.status === 'draft' && (
                <Popconfirm title="Process this run? Payslips will be computed for all active employees." onConfirm={processRun}>
                  <Button icon={<ThunderboltOutlined />} loading={busy}>Process Run</Button>
                </Popconfirm>
              )}
              {selectedRun?.status === 'processing' && (
                <Popconfirm title="Lock this run? No further edits allowed." onConfirm={lockRun}>
                  <Button danger icon={<LockOutlined />} loading={busy}>Lock Run</Button>
                </Popconfirm>
              )}
            </Space>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8}><Card size="small"><Statistic title="Gross" value={formatINR(totals.gross)} /></Card></Col>
              <Col xs={24} sm={8}><Card size="small"><Statistic title="Deductions" value={formatINR(totals.deductions)} valueStyle={{ color: '#EF4444' }} /></Card></Col>
              <Col xs={24} sm={8}><Card size="small"><Statistic title="Net Total" value={formatINR(totals.net)} valueStyle={{ color: '#10B981' }} /></Card></Col>
            </Row>

            <Table
              rowKey="id"
              loading={slipsLoading}
              dataSource={payslips}
              columns={columns}
              pagination={{ pageSize: 25 }}
              locale={{ emptyText: <Empty description="No payslips for this run yet" /> }}
            />
          </>
        )}
      </Card>

      <Modal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        title="Create Payroll Run"
        okText="Create"
        confirmLoading={busy}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="month" label="Month (1-12)" rules={[{ required: true, type: 'number', min: 1, max: 12 }]}>
            <InputNumber min={1} max={12} style={{ width: '100%' }} onChange={(m) => {
              const y = form.getFieldValue('year');
              if (m && y) form.setFieldsValue({ financial_year: financialYearForMonth(y, m) });
            }} />
          </Form.Item>
          <Form.Item name="year" label="Year" rules={[{ required: true }]}>
            <InputNumber min={2000} max={2100} style={{ width: '100%' }} onChange={(y) => {
              const m = form.getFieldValue('month');
              if (m && y) form.setFieldsValue({ financial_year: financialYearForMonth(y, m) });
            }} />
          </Form.Item>
          <Form.Item name="financial_year" label="Financial Year" rules={[{ required: true }]}>
            <Input addonBefore="FY" disabled style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <HrDocumentViewer
        open={docViewer.open}
        onClose={() => setDocViewer({ open: false, payslipId: null, employeeId: null, employeeName: null })}
        docType="payslip"
        employeeId={docViewer.employeeId}
        payslipId={docViewer.payslipId}
        employeeName={docViewer.employeeName}
      />
    </div>
  );
}
