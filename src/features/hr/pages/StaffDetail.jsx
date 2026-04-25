import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Row, Col, Avatar, Space, Button, Tag, Typography, Descriptions, Statistic,
  Table, App, Skeleton, Result, Tabs, Tooltip, Dropdown,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, DollarOutlined, MailOutlined, PhoneOutlined,
  UserOutlined, FilePdfOutlined, LeftOutlined, RightOutlined, FileTextOutlined, DownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { hrService, formatINR } from '../services/hrService';
import EmployeeFormModal from '../components/EmployeeFormModal';
import SalaryStructureModal from '../components/SalaryStructureModal';
import HrDocumentViewer from '../components/HrDocumentViewer';

const { Title, Text } = Typography;

const STATUS_COLORS = { active: 'green', on_notice: 'orange', inactive: 'default', terminated: 'red' };

const ATTENDANCE_COLORS = {
  present: '#10B981', late: '#F59E0B', half_day: '#FBBF24', absent: '#EF4444',
  on_leave: '#6366F1', holiday: '#9CA3AF', weekoff: '#9CA3AF',
};

export default function StaffDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [leaveApps, setLeaveApps] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attYearMonth, setAttYearMonth] = useState({ year: dayjs().year(), month: dayjs().month() + 1 });
  const [editOpen, setEditOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryStructure, setSalaryStructure] = useState(null);
  const [docViewer, setDocViewer] = useState({ open: false, docType: null, payslipId: null });

  const loadEmployee = async () => {
    try {
      const emp = await hrService.getEmployee(id);
      setEmployee(emp);
      const ay = await hrService.getActiveAcademicYearId(schoolCode);
      if (ay?.id) {
        try {
          const lb = await hrService.getLeaveBalance(emp.id, ay.id);
          setLeaveBalance(lb);
        } catch { /* RPC may fail if no balance row */ }
      }
      const apps = await hrService.listLeaveApplications(emp.id);
      setLeaveApps(apps);
      const slips = await hrService.listPayslipsForEmployee(emp.id);
      setPayslips(slips);
      try {
        const struct = await hrService.getActiveSalaryStructure(emp.id);
        setSalaryStructure(struct);
      } catch { /* ignore — RLS or empty */ }
    } catch (e) {
      message.error(e.message || 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    if (!employee) return;
    try {
      const att = await hrService.getEmployeeAttendance(employee.id, attYearMonth.year, attYearMonth.month);
      setAttendance(att);
    } catch (e) {
      message.error(e.message || 'Failed to load attendance');
    }
  };

  useEffect(() => { loadEmployee(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { loadAttendance(); /* eslint-disable-next-line */ }, [employee?.id, attYearMonth.year, attYearMonth.month]);

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (!employee) {
    return <Result status="404" title="Employee not found" extra={<Button onClick={() => navigate('/hr/staff')}>Back</Button>} />;
  }

  const yearsInService = employee.join_date
    ? dayjs().diff(dayjs(employee.join_date), 'month')
    : 0;
  const ysLabel = `${Math.floor(yearsInService / 12)}y ${yearsInService % 12}m`;

  const monthLabel = dayjs(`${attYearMonth.year}-${String(attYearMonth.month).padStart(2, '0')}-01`).format('MMMM YYYY');
  const isCurrentMonth = attYearMonth.year === dayjs().year() && attYearMonth.month === dayjs().month() + 1;

  const moveMonth = (delta) => {
    const d = dayjs(`${attYearMonth.year}-${String(attYearMonth.month).padStart(2, '0')}-01`).add(delta, 'month');
    setAttYearMonth({ year: d.year(), month: d.month() + 1 });
  };

  const tabs = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card size="small" title="Personal">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Gender">{employee.gender ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="DOB">{employee.date_of_birth ? dayjs(employee.date_of_birth).format('DD MMM YYYY') : '—'}</Descriptions.Item>
                <Descriptions.Item label="Phone">{employee.phone ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{employee.email ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Address">{employee.address ?? '—'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="Employment">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Department">{employee.department}</Descriptions.Item>
                <Descriptions.Item label="Designation">{employee.designation}</Descriptions.Item>
                <Descriptions.Item label="Type">{employee.employment_type}</Descriptions.Item>
                <Descriptions.Item label="Joined">{employee.join_date ? dayjs(employee.join_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
                <Descriptions.Item label="Confirmed">{employee.confirmation_date ? dayjs(employee.confirmation_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
                <Descriptions.Item label="Years in service">{ysLabel}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="Bank & Tax">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="PAN">{employee.pan_number ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="A/C #">{employee.bank_account_number ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="IFSC">{employee.bank_ifsc ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Bank">{employee.bank_name ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="TDS Applicable">{employee.is_tds_applicable ? 'Yes' : 'No'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="Leave Balance">
              {leaveBalance.length === 0 ? (
                <Text type="secondary">No leave balance available for the active academic year.</Text>
              ) : (
                <Row gutter={[8, 8]}>
                  {leaveBalance.map((b) => (
                    <Col span={12} key={b.leave_type_id}>
                      <Card size="small" style={{ background: '#F9FAFB' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space direction="vertical" size={0}>
                            <Tag>{b.leave_type_code}</Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>{b.leave_type_name}</Text>
                          </Space>
                          <div style={{ textAlign: 'right' }}>
                            <div><Text strong style={{ fontSize: 22 }}>{b.balance}</Text></div>
                            <Text type="secondary" style={{ fontSize: 11 }}>used {b.used} / {b.annual_quota}</Text>
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Card>
          </Col>
          <Col xs={24}>
            <Card
              size="small"
              title={<Space><DollarOutlined /> Salary Structure</Space>}
              extra={<Button size="small" type="link" onClick={() => setSalaryOpen(true)}>{salaryStructure ? 'Edit' : 'Set up'}</Button>}
            >
              {!salaryStructure ? (
                <Text type="secondary">No salary structure set yet.</Text>
              ) : (
                <Row gutter={16}>
                  <Col xs={12} md={6}><Statistic title="Annual CTC" value={formatINR(salaryStructure.structure.ctc)} /></Col>
                  <Col xs={12} md={6}><Statistic title="Effective From" value={dayjs(salaryStructure.structure.effective_from).format('DD MMM YYYY')} /></Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="Monthly Earnings"
                      value={formatINR(salaryStructure.lines.filter((l) => l.component?.type === 'earning').reduce((s, l) => s + Number(l.monthly_amount || 0), 0))}
                      valueStyle={{ color: '#10B981' }}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="Monthly Deductions"
                      value={formatINR(salaryStructure.lines.filter((l) => l.component?.type === 'deduction').reduce((s, l) => s + Number(l.monthly_amount || 0), 0))}
                      valueStyle={{ color: '#EF4444' }}
                    />
                  </Col>
                </Row>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'leaves',
      label: `Leaves (${leaveApps.length})`,
      children: (
        <Table
          rowKey="id"
          size="small"
          dataSource={leaveApps}
          columns={[
            { title: 'Type', dataIndex: ['leave_types', 'name'], render: (v, r) => v ?? r.leave_type_id },
            { title: 'From', dataIndex: 'from_date', render: (d) => dayjs(d).format('DD MMM YYYY') },
            { title: 'To', dataIndex: 'to_date', render: (d) => dayjs(d).format('DD MMM YYYY') },
            { title: 'Days', dataIndex: 'days', align: 'right' },
            { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'approved' ? 'green' : s === 'rejected' ? 'red' : s === 'cancelled' ? 'default' : 'gold'}>{s}</Tag> },
            { title: 'Reason', dataIndex: 'reason', ellipsis: true },
            { title: 'Applied', dataIndex: 'applied_at', render: (d) => dayjs(d).format('DD MMM YYYY HH:mm') },
          ]}
        />
      ),
    },
    {
      key: 'payslips',
      label: `Payslips (${payslips.length})`,
      children: (
        <Table
          rowKey="id"
          size="small"
          dataSource={payslips}
          columns={[
            { title: 'Period', key: 'period', render: (_, r) => `${dayjs().month(r.run_month - 1).format('MMM')} ${r.run_year}` },
            { title: 'FY', dataIndex: 'financial_year' },
            { title: 'Gross', dataIndex: 'gross_earnings', align: 'right', render: formatINR },
            { title: 'Deductions', dataIndex: 'total_deductions', align: 'right', render: formatINR },
            { title: 'Net Pay', dataIndex: 'net_pay', align: 'right', render: (v) => <Text strong>{formatINR(v)}</Text> },
            { title: 'Status', dataIndex: 'run_status', render: (s) => <Tag>{s}</Tag> },
            {
              title: '',
              key: 'view',
              render: (_, r) => (
                <Tooltip title="View payslip">
                  <Button size="small" icon={<FilePdfOutlined />} onClick={() => setDocViewer({ open: true, docType: 'payslip', payslipId: r.id })} />
                </Tooltip>
              ),
            },
          ]}
        />
      ),
    },
    {
      key: 'attendance',
      label: 'Attendance',
      children: (
        <>
          <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button icon={<LeftOutlined />} onClick={() => moveMonth(-1)} />
              <Text strong>{monthLabel}</Text>
              <Button icon={<RightOutlined />} onClick={() => moveMonth(1)} disabled={isCurrentMonth} />
            </Space>
            <Space wrap size={4}>
              {Object.entries({ present: 'P', late: 'L', half_day: 'H', absent: 'A', on_leave: 'LV' }).map(([k, label]) => (
                <Tag key={k} style={{ background: ATTENDANCE_COLORS[k], color: '#fff', border: 'none' }}>
                  {label} {attendance.filter((a) => a.status === k).length}
                </Tag>
              ))}
            </Space>
          </Space>
          <AttendanceCalendar
            year={attYearMonth.year}
            month={attYearMonth.month}
            data={attendance}
          />
          {attendance.length > 0 && (
            <Table
              rowKey="date"
              size="small"
              dataSource={attendance}
              pagination={{ pageSize: 10 }}
              style={{ marginTop: 16 }}
              columns={[
                { title: 'Date', dataIndex: 'date', render: (d) => dayjs(d).format('ddd, DD MMM') },
                { title: 'Status', dataIndex: 'status', render: (s) => <Tag style={{ background: ATTENDANCE_COLORS[s] || '#9CA3AF', color: '#fff', border: 'none' }}>{s}</Tag> },
                { title: 'In', dataIndex: 'in_time' },
                { title: 'Out', dataIndex: 'out_time' },
                { title: 'Late (min)', dataIndex: 'late_minutes', align: 'right' },
                { title: 'Note', dataIndex: 'note', ellipsis: true },
              ]}
            />
          )}
        </>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr/staff')}>Staff Directory</Button>
      </Space>

      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="80px">
            <Avatar size={72} src={employee.photo_url} icon={<UserOutlined />} />
          </Col>
          <Col flex="auto">
            <Space direction="vertical" size={2}>
              <Title level={4} style={{ margin: 0 }}>{employee.full_name}</Title>
              <Space wrap>
                <Tag>{employee.employee_code}</Tag>
                <Text type="secondary">{employee.designation} · {employee.department}</Text>
                <Tag color={STATUS_COLORS[employee.status] || 'default'}>{employee.status}</Tag>
              </Space>
              <Space wrap>
                {employee.phone && <a href={`tel:${employee.phone}`}><PhoneOutlined /> {employee.phone}</a>}
                {employee.email && <a href={`mailto:${employee.email}`}><MailOutlined /> {employee.email}</a>}
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              <Dropdown
                menu={{
                  items: [
                    { key: 'appointment_letter', label: 'Appointment Letter' },
                    { key: 'experience_letter', label: 'Experience Letter' },
                    {
                      key: 'relieving_letter',
                      label: 'Relieving Letter',
                      disabled: !employee.relieving_date,
                    },
                  ],
                  onClick: ({ key }) => setDocViewer({ open: true, docType: key, payslipId: null }),
                }}
              >
                <Button icon={<FileTextOutlined />}>Generate Document <DownOutlined /></Button>
              </Dropdown>
              <Button icon={<DollarOutlined />} onClick={() => setSalaryOpen(true)}>Salary Structure</Button>
              <Button type="primary" icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit</Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={12} md={6}><Statistic title="Years in service" value={ysLabel} /></Col>
          <Col xs={12} md={6}><Statistic title="Pending leaves" value={leaveApps.filter((l) => l.status === 'pending').length} /></Col>
          <Col xs={12} md={6}><Statistic title="Approved (FY)" value={leaveApps.filter((l) => l.status === 'approved').length} /></Col>
          <Col xs={12} md={6}><Statistic title="Payslips" value={payslips.length} /></Col>
        </Row>

        <Tabs items={tabs} style={{ marginTop: 16 }} />
      </Card>

      <EmployeeFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        schoolCode={schoolCode}
        employee={employee}
        onSaved={(saved) => setEmployee(saved)}
      />
      <SalaryStructureModal
        open={salaryOpen}
        onClose={() => setSalaryOpen(false)}
        schoolCode={schoolCode}
        employee={employee}
        onSaved={async () => {
          try {
            const struct = await hrService.getActiveSalaryStructure(employee.id);
            setSalaryStructure(struct);
          } catch { /* ignore */ }
        }}
      />
      <HrDocumentViewer
        open={docViewer.open}
        onClose={() => setDocViewer({ open: false, docType: null, payslipId: null })}
        docType={docViewer.docType}
        employeeId={employee.id}
        payslipId={docViewer.payslipId}
        employeeName={employee.full_name}
      />
    </div>
  );
}

// Color-coded month grid (Mon-first), web-native enhancement over the mobile 7x7 calendar.
function AttendanceCalendar({ year, month, data }) {
  const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const daysInMonth = monthStart.daysInMonth();
  // Mon=0..Sun=6
  const firstWeekday = (monthStart.day() + 6) % 7;
  const today = dayjs();
  const byDate = {};
  data.forEach((a) => { byDate[a.date] = a; });

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = monthStart.date(d).format('YYYY-MM-DD');
    cells.push({ d, date, rec: byDate[date] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((c, i) => {
          if (!c) return <div key={i} style={{ aspectRatio: '1' }} />;
          const status = c.rec?.status;
          const isFuture = dayjs(c.date).isAfter(today, 'day');
          const bg = status ? ATTENDANCE_COLORS[status] : isFuture ? '#F3F4F6' : '#FFFFFF';
          const color = status ? '#fff' : '#9CA3AF';
          const tooltipParts = [c.rec?.status, c.rec?.in_time && `In: ${c.rec.in_time}`, c.rec?.out_time && `Out: ${c.rec.out_time}`].filter(Boolean);
          return (
            <Tooltip key={i} title={tooltipParts.length ? `${dayjs(c.date).format('DD MMM YYYY')} · ${tooltipParts.join(' · ')}` : dayjs(c.date).format('DD MMM YYYY')}>
              <div
                style={{
                  aspectRatio: '1',
                  borderRadius: 6,
                  background: bg,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid #E5E7EB',
                  cursor: 'default',
                }}
              >
                {c.d}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
