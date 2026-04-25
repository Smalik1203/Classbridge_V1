import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Progress, Button, Tag, List, Space, Typography,
  Skeleton, Empty, App, Avatar, Divider,
} from 'antd';
import {
  TeamOutlined, CalendarOutlined, DollarOutlined, FileDoneOutlined,
  CheckOutlined, CloseOutlined, RightOutlined, ReloadOutlined,
  IdcardOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { supabase } from '@/config/supabaseClient';
import { hrService, formatINR } from '../services/hrService';

const { Title, Text } = Typography;

const STATUS_PRESENT = new Set(['present', 'late', 'half_day']);

export default function HrHub() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [leaveApps, setLeaveApps] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [currentRunPayslips, setCurrentRunPayslips] = useState([]);
  const [last7Attendance, setLast7Attendance] = useState([]);
  const [actionId, setActionId] = useState(null);

  const today = dayjs();
  const monthStart = today.startOf('month').format('YYYY-MM-DD');
  const monthEnd = today.endOf('month').format('YYYY-MM-DD');
  const sevenDaysAgo = today.subtract(6, 'day').format('YYYY-MM-DD');

  const load = async () => {
    if (!schoolCode) return;
    try {
      // employees
      const emps = await hrService.listEmployees(schoolCode);
      setEmployees(emps);

      // leave applications month-to-date
      const { data: leaves } = await supabase
        .from('leave_applications')
        .select('id, status, days, applied_at')
        .eq('school_code', schoolCode)
        .gte('applied_at', monthStart)
        .lte('applied_at', `${monthEnd}T23:59:59`);
      setLeaveApps(leaves ?? []);

      // pending leaves with joins (top 5)
      const pending = await hrService.listPendingLeaveApplications(schoolCode);
      setPendingLeaves(pending.slice(0, 5));

      // current month payroll run + payslips
      const runs = await hrService.listPayrollRuns(schoolCode);
      const cur = runs.find((r) => r.month === today.month() + 1 && r.year === today.year()) ?? null;
      setCurrentRun(cur);
      if (cur) {
        const slips = await hrService.listPayslipsForRun(cur.id);
        setCurrentRunPayslips(slips);
      } else {
        setCurrentRunPayslips([]);
      }

      // 7-day staff attendance
      const { data: att } = await supabase
        .from('staff_attendance')
        .select('date, status')
        .eq('school_code', schoolCode)
        .gte('date', sevenDaysAgo)
        .lte('date', today.format('YYYY-MM-DD'));
      setLast7Attendance(att ?? []);
    } catch (e) {
      message.error(e.message || 'Failed to load HR data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolCode]);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active').length;
    const total = employees.length;
    const pending = leaveApps.filter((l) => l.status === 'pending').length;
    const approved = leaveApps.filter((l) => l.status === 'approved').length;
    const rejected = leaveApps.filter((l) => l.status === 'rejected').length;

    // 7-day attendance per-day breakdown
    const daily = {};
    last7Attendance.forEach((a) => {
      if (!daily[a.date]) daily[a.date] = { present: 0, total: 0 };
      daily[a.date].total += 1;
      if (STATUS_PRESENT.has(a.status)) daily[a.date].present += 1;
    });
    const perDay = [];
    for (let i = 6; i >= 0; i--) {
      const d = today.subtract(i, 'day').format('YYYY-MM-DD');
      const day = daily[d] || { present: 0, total: 0 };
      const pct = day.total ? Math.round((day.present / day.total) * 100) : 0;
      perDay.push({ date: d, ...day, pct });
    }
    const avgPct = perDay.length
      ? Math.round(perDay.reduce((s, d) => s + d.pct, 0) / perDay.length)
      : 0;

    const todayKey = today.format('YYYY-MM-DD');
    const todayMarked = last7Attendance.filter((a) => a.date === todayKey).length;
    const gap = Math.max(0, active - todayMarked);

    const totalNet = currentRunPayslips.reduce((s, p) => s + Number(p.net_pay || 0), 0);

    return { active, total, pending, approved, rejected, avgPct, gap, totalNet, perDay };
  }, [employees, leaveApps, last7Attendance, currentRunPayslips, today]);

  const handleApprove = async (id) => {
    try {
      setActionId(id);
      await hrService.approveLeave(id);
      message.success('Leave approved');
      setPendingLeaves((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      message.error(e.message || 'Failed to approve');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setActionId(id);
      await hrService.rejectLeave(id);
      message.success('Leave rejected');
      setPendingLeaves((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      message.error(e.message || 'Failed to reject');
    } finally {
      setActionId(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
  };

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>HR Hub</Title>
          <Text type="secondary">{today.format('dddd, DD MMM YYYY')} · {schoolCode}</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={refreshing}>Refresh</Button>
          <Button type="primary" onClick={() => navigate('/hr/staff')}>Staff Directory</Button>
        </Space>
      </Space>

      {/* KPI cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/hr/staff')}>
            <Statistic title="Active Staff" value={stats.active} suffix={<Text type="secondary" style={{ fontSize: 14 }}>/ {stats.total}</Text>} prefix={<TeamOutlined />} />
            <Progress percent={stats.total ? Math.round((stats.active / stats.total) * 100) : 0} showInfo={false} strokeColor="#10B981" style={{ marginTop: 8 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/hr/attendance')}>
            <Statistic title="Attendance (7d avg)" value={stats.avgPct} suffix="%" prefix={<CalendarOutlined />} valueStyle={{ color: stats.avgPct >= 90 ? '#10B981' : stats.avgPct >= 75 ? '#F59E0B' : '#EF4444' }} />
            {stats.gap > 0 && <Tag color="orange" style={{ marginTop: 8 }}>{stats.gap} not marked today</Tag>}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/hr/leaves')}>
            <Statistic title="Leaves Pending" value={stats.pending} prefix={<FileDoneOutlined />} valueStyle={{ color: stats.pending > 0 ? '#F59E0B' : undefined }} />
            <Space size={8} style={{ marginTop: 8 }}>
              <Tag color="green">{stats.approved} approved</Tag>
              <Tag color="red">{stats.rejected} rejected</Tag>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/hr/payroll')}>
            <Statistic
              title={`Payroll · ${today.format('MMM YYYY')}`}
              value={currentRun ? formatINR(stats.totalNet) : 'No run'}
              prefix={<DollarOutlined />}
            />
            {currentRun && (
              <Tag color={currentRun.status === 'locked' ? 'green' : currentRun.status === 'processing' ? 'blue' : 'default'} style={{ marginTop: 8, textTransform: 'capitalize' }}>
                {currentRun.status}
              </Tag>
            )}
          </Card>
        </Col>
      </Row>

      {stats.gap > 0 && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#FEF3C7', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Text strong style={{ color: '#92400E' }}>
              {stats.gap} active staff missed check-in today
            </Text>
            <Text type="secondary">({today.format('DD MMM YYYY')})</Text>
          </Space>
          <Button size="small" onClick={() => navigate('/hr/attendance')}>Open Attendance</Button>
        </div>
      )}

      {/* 7-day attendance breakdown */}
      <Card title="Last 7 Days · Attendance Trend" style={{ marginTop: 16 }}>
        <Row gutter={[8, 8]}>
          {stats.perDay.map((d) => {
            const color = d.pct >= 90 ? '#10B981' : d.pct >= 75 ? '#F59E0B' : d.total > 0 ? '#EF4444' : '#9CA3AF';
            return (
              <Col xs={12} sm={8} md={Math.floor(24 / 7)} key={d.date} style={{ minWidth: 110 }}>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid #E5E7EB', textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(d.date).format('ddd')}</Text>
                  <div><Text strong style={{ fontSize: 13 }}>{dayjs(d.date).format('DD MMM')}</Text></div>
                  <div style={{ fontSize: 22, fontWeight: 700, color, margin: '6px 0' }}>
                    {d.total > 0 ? `${d.pct}%` : '—'}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{d.present}/{d.total} present</Text>
                  <Progress percent={d.pct} showInfo={false} strokeColor={color} size="small" style={{ marginTop: 4 }} />
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Action center: pending leaves */}
        <Col xs={24} lg={14}>
          <Card
            title={<Space><FileDoneOutlined /> Action Center</Space>}
            extra={<Button type="link" onClick={() => navigate('/hr/leaves')}>View all <RightOutlined /></Button>}
          >
            {pendingLeaves.length === 0 ? (
              <Empty description="No leave requests waiting" />
            ) : (
              <List
                dataSource={pendingLeaves}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        key="approve"
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        loading={actionId === item.id}
                        onClick={() => handleApprove(item.id)}
                      >Approve</Button>,
                      <Button
                        key="reject"
                        danger
                        size="small"
                        icon={<CloseOutlined />}
                        loading={actionId === item.id}
                        onClick={() => handleReject(item.id)}
                      >Reject</Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<IdcardOutlined />} />}
                      title={<Space><Text strong>{item.employees?.full_name}</Text><Tag>{item.leave_types?.code}</Tag></Space>}
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">
                            {dayjs(item.from_date).format('DD MMM')} → {dayjs(item.to_date).format('DD MMM YYYY')} · {item.days} day{item.days > 1 ? 's' : ''}
                          </Text>
                          {item.reason && <Text style={{ fontSize: 12 }}>"{item.reason}"</Text>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Quick links */}
        <Col xs={24} lg={10}>
          <Card title="Quick Actions">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Button block icon={<TeamOutlined />} onClick={() => navigate('/hr/staff')}>Staff Directory</Button>
              <Button block icon={<DollarOutlined />} onClick={() => navigate('/hr/payroll')}>Payroll Runs</Button>
              <Button block icon={<FileDoneOutlined />} onClick={() => navigate('/hr/leaves')}>Leaves & Approvals</Button>
              <Button block icon={<ClockCircleOutlined />} onClick={() => navigate('/hr/attendance')}>Staff Attendance</Button>
              <Divider style={{ margin: '8px 0' }} />
              <Button block type="dashed" onClick={() => navigate('/hr/my')}>My HR (Self-Service)</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
