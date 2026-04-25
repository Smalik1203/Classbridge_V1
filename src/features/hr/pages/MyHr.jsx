import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Avatar, Space, Button, Tag, Typography, Statistic, Table, App, Skeleton, Result,
  Modal, Form, DatePicker, Select, Input, Switch, Radio, Empty, Popconfirm, Tooltip,
} from 'antd';
import {
  UserOutlined, PlusOutlined, ReloadOutlined, FilePdfOutlined, MailOutlined, PhoneOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { hrService, formatINR } from '../services/hrService';
import HrDocumentViewer from '../components/HrDocumentViewer';

const { Title, Text } = Typography;

export default function MyHr() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [academicYear, setAcademicYear] = useState(null);
  const [balance, setBalance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [requestOpen, setRequestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [docViewer, setDocViewer] = useState({ open: false, payslipId: null });
  const [previewLeaveType, setPreviewLeaveType] = useState(null);
  const [previewRange, setPreviewRange] = useState(null);
  const [previewHalfDay, setPreviewHalfDay] = useState(false);

  const load = async () => {
    if (!schoolCode || !user) return;
    try {
      const emp = await hrService.getEmployeeByUserId(user.id);
      setEmployee(emp);
      if (!emp) { setLoading(false); return; }

      const ay = await hrService.getActiveAcademicYearId(schoolCode);
      setAcademicYear(ay);

      const [bal, apps, slips, types] = await Promise.all([
        ay?.id ? hrService.getLeaveBalance(emp.id, ay.id).catch(() => []) : Promise.resolve([]),
        hrService.listLeaveApplications(emp.id),
        hrService.listPayslipsForEmployee(emp.id),
        hrService.listLeaveTypes(schoolCode),
      ]);
      setBalance(bal);
      setLeaves(apps);
      setPayslips(slips);
      setLeaveTypes(types.filter((t) => t.is_active));
    } catch (e) {
      message.error(e.message || 'Failed to load HR data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, schoolCode]);

  const stats = useMemo(() => ({
    pending: leaves.filter((l) => l.status === 'pending').length,
    approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length,
  }), [leaves]);

  const latestPayslip = payslips[0];

  const openRequest = () => {
    form.resetFields();
    form.setFieldsValue({ is_half_day: false });
    setRequestOpen(true);
  };

  const submitRequest = async () => {
    try {
      const v = await form.validateFields();
      if (!academicYear?.id) {
        message.error('No active academic year configured');
        return;
      }
      setSubmitting(true);
      const from = v.range[0];
      const to = v.range[1];
      const days = v.is_half_day ? 0.5 : (to.diff(from, 'day') + 1);
      await hrService.applyForLeave({
        school_code: schoolCode,
        employee_id: employee.id,
        leave_type_id: v.leave_type_id,
        academic_year_id: academicYear.id,
        from_date: from.format('YYYY-MM-DD'),
        to_date: to.format('YYYY-MM-DD'),
        days,
        is_half_day: !!v.is_half_day,
        half_day_slot: v.is_half_day ? v.half_day_slot : undefined,
        reason: v.reason,
      });
      message.success('Leave request submitted');
      setRequestOpen(false);
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelLeave = async (id) => {
    try {
      await hrService.cancelLeaveApplication(id);
      message.success('Leave cancelled');
      load();
    } catch (e) {
      message.error(e.message || 'Failed');
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

  if (!employee) {
    return (
      <Result
        status="warning"
        title="Your HR record isn't set up yet"
        subTitle="Please contact your school administrator to link your account to an employee profile."
      />
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="80px"><Avatar size={72} src={employee.photo_url} icon={<UserOutlined />} /></Col>
          <Col flex="auto">
            <Space direction="vertical" size={2}>
              <Title level={4} style={{ margin: 0 }}>{employee.full_name}</Title>
              <Space wrap>
                <Tag>{employee.employee_code}</Tag>
                <Text type="secondary">{employee.designation} · {employee.department}</Text>
              </Space>
              <Space wrap>
                {employee.phone && <a href={`tel:${employee.phone}`}><PhoneOutlined /> {employee.phone}</a>}
                {employee.email && <a href={`mailto:${employee.email}`}><MailOutlined /> {employee.email}</a>}
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openRequest}>Request Leave</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card title="Leave Balance">
            {balance.length === 0 ? <Empty description="No balance available" /> : (
              <Table
                size="small"
                pagination={false}
                rowKey="leave_type_id"
                dataSource={balance}
                columns={[
                  { title: 'Type', dataIndex: 'leave_type_name' },
                  { title: 'Used', dataIndex: 'used', align: 'right' },
                  { title: 'Balance', dataIndex: 'balance', align: 'right', render: (v) => <Text strong>{v}</Text> },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="My Leaves">
            <Row gutter={8}>
              <Col span={8}><Statistic title="Pending" value={stats.pending} valueStyle={{ color: '#F59E0B' }} /></Col>
              <Col span={8}><Statistic title="Approved" value={stats.approved} valueStyle={{ color: '#10B981' }} /></Col>
              <Col span={8}><Statistic title="Rejected" value={stats.rejected} valueStyle={{ color: '#EF4444' }} /></Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card
            title="Latest Payslip"
            style={!latestPayslip ? {} : { background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', color: '#fff' }}
            headStyle={!latestPayslip ? {} : { color: '#fff', borderBottomColor: 'rgba(255,255,255,0.2)' }}
            bodyStyle={!latestPayslip ? {} : { color: '#fff' }}
          >
            {!latestPayslip ? <Empty description="No payslips yet" /> : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{dayjs().month(latestPayslip.run_month - 1).format('MMMM')} {latestPayslip.run_year}</Text>
                <div style={{ fontSize: 32, fontWeight: 700 }}>{formatINR(latestPayslip.net_pay)}</div>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  Net pay · {latestPayslip.paid_days} paid days · FY {latestPayslip.financial_year}
                </Text>
                <Button icon={<FilePdfOutlined />} onClick={() => setDocViewer({ open: true, payslipId: latestPayslip.id })}>
                  View Payslip
                </Button>
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Recent Leave Applications" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          size="small"
          dataSource={leaves.slice(0, 10)}
          columns={[
            { title: 'Type', dataIndex: ['leave_types', 'name'] },
            { title: 'From', dataIndex: 'from_date', render: (d) => dayjs(d).format('DD MMM YYYY') },
            { title: 'To', dataIndex: 'to_date', render: (d) => dayjs(d).format('DD MMM YYYY') },
            { title: 'Days', dataIndex: 'days', align: 'right' },
            { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'approved' ? 'green' : s === 'rejected' ? 'red' : s === 'cancelled' ? 'default' : 'gold'}>{s}</Tag> },
            { title: 'Reason', dataIndex: 'reason', ellipsis: true },
            {
              title: '',
              key: 'cancel',
              render: (_, r) => r.status === 'pending' ? (
                <Popconfirm title="Cancel this leave request?" onConfirm={() => cancelLeave(r.id)}>
                  <Button size="small" danger>Cancel</Button>
                </Popconfirm>
              ) : null,
            },
          ]}
        />
      </Card>

      <Card title="Recent Payslips" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          size="small"
          dataSource={payslips}
          columns={[
            { title: 'Period', key: 'p', render: (_, r) => `${dayjs().month(r.run_month - 1).format('MMM')} ${r.run_year}` },
            { title: 'FY', dataIndex: 'financial_year' },
            { title: 'Gross', dataIndex: 'gross_earnings', align: 'right', render: formatINR },
            { title: 'Deductions', dataIndex: 'total_deductions', align: 'right', render: formatINR },
            { title: 'Net', dataIndex: 'net_pay', align: 'right', render: (v) => <Text strong>{formatINR(v)}</Text> },
            { title: '', key: 'view', render: (_, r) => (
              <Tooltip title="View payslip">
                <Button size="small" icon={<FilePdfOutlined />} onClick={() => setDocViewer({ open: true, payslipId: r.id })} />
              </Tooltip>
            ) },
          ]}
        />
      </Card>

      <Modal
        open={requestOpen}
        onCancel={() => setRequestOpen(false)}
        onOk={submitRequest}
        title="Request Leave"
        okText="Submit"
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, all) => {
            setPreviewLeaveType(all.leave_type_id);
            setPreviewRange(all.range);
            setPreviewHalfDay(!!all.is_half_day);
          }}
        >
          <Form.Item name="leave_type_id" label="Leave Type" rules={[{ required: true }]}>
            <Select options={leaveTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))} />
          </Form.Item>
          <Form.Item name="range" label="Date Range" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          <Form.Item name="is_half_day" label="Half-day" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item shouldUpdate={(p, c) => p.is_half_day !== c.is_half_day} noStyle>
            {({ getFieldValue }) => getFieldValue('is_half_day') ? (
              <Form.Item name="half_day_slot" label="Slot" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="morning">Morning</Radio>
                  <Radio value="afternoon">Afternoon</Radio>
                </Radio.Group>
              </Form.Item>
            ) : null}
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please enter a reason' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>

          <LeaveBalancePreview
            leaveType={leaveTypes.find((t) => t.id === previewLeaveType)}
            balance={balance.find((b) => b.leave_type_id === previewLeaveType)}
            range={previewRange}
            isHalfDay={previewHalfDay}
          />
        </Form>
      </Modal>

      <HrDocumentViewer
        open={docViewer.open}
        onClose={() => setDocViewer({ open: false, payslipId: null })}
        docType="payslip"
        employeeId={employee?.id}
        payslipId={docViewer.payslipId}
        employeeName={employee?.full_name}
      />
    </div>
  );
}

function LeaveBalancePreview({ leaveType, balance, range, isHalfDay }) {
  if (!leaveType || !range || range.length !== 2) return null;
  const [from, to] = range;
  const days = isHalfDay ? 0.5 : (to.diff(from, 'day') + 1);
  const available = balance?.balance ?? 0;
  const after = available - days;
  const insufficient = after < 0 && leaveType.is_paid;

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      background: insufficient ? '#FEE2E2' : '#EEF2FF',
      border: `1px solid ${insufficient ? '#FCA5A5' : '#C7D2FE'}`,
    }}>
      <Row gutter={16}>
        <Col span={8}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Requesting</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{days.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 400 }}>day{days === 1 ? '' : 's'}</span></div>
        </Col>
        <Col span={8}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Available</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{available}</div>
        </Col>
        <Col span={8}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>After Approval</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: insufficient ? '#DC2626' : '#10B981' }}>
            {after.toFixed(1)}
          </div>
        </Col>
      </Row>
      {insufficient && (
        <Text type="danger" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          Insufficient balance. Approval may be denied or treated as loss-of-pay.
        </Text>
      )}
      {!leaveType.is_paid && (
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          {leaveType.name} is unpaid leave.
        </Text>
      )}
    </div>
  );
}
