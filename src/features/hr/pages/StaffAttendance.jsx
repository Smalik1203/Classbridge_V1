import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Typography, Table, App, Empty, Skeleton, Tag, Avatar,
} from 'antd';
import {
  ArrowLeftOutlined, LeftOutlined, RightOutlined, ReloadOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { hrService } from '../services/hrService';

const { Title, Text } = Typography;

const COLS = [
  { key: 'present_days', label: 'P', color: '#10B981', tooltip: 'Present' },
  { key: 'absent_days', label: 'A', color: '#EF4444', tooltip: 'Absent' },
  { key: 'late_days', label: 'L', color: '#F59E0B', tooltip: 'Late' },
  { key: 'on_leave_days', label: 'LV', color: '#6366F1', tooltip: 'On Leave' },
  { key: 'half_days', label: 'H', color: '#FBBF24', tooltip: 'Half Day' },
];

export default function StaffAttendance() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [ym, setYm] = useState({ year: dayjs().year(), month: dayjs().month() + 1 });

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const rows = await hrService.getAttendanceSummary(schoolCode, ym.year, ym.month);
      setData(rows);
    } catch (e) {
      message.error(e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode, ym.year, ym.month]);

  const monthLabel = dayjs(`${ym.year}-${String(ym.month).padStart(2, '0')}-01`).format('MMMM YYYY');
  const isCurrent = ym.year === dayjs().year() && ym.month === dayjs().month() + 1;
  const move = (delta) => {
    const d = dayjs(`${ym.year}-${String(ym.month).padStart(2, '0')}-01`).add(delta, 'month');
    setYm({ year: d.year(), month: d.month() + 1 });
  };

  const cellRender = (v, color) => v > 0
    ? <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{v}</span>
    : <Text type="secondary">—</Text>;

  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      fixed: 'left',
      width: 280,
      render: (_, r) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div><Text strong>{r.full_name}</Text></div>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.employee_code} · {r.department}</Text>
          </div>
        </Space>
      ),
    },
    ...COLS.map((c) => ({
      title: <span style={{ color: c.color, fontWeight: 700 }} title={c.tooltip}>{c.label}</span>,
      dataIndex: c.key,
      align: 'center',
      width: 80,
      render: (v) => cellRender(v, c.color),
    })),
    { title: 'Working Days', dataIndex: 'working_days', align: 'right', width: 120 },
    { title: 'Late (min)', dataIndex: 'total_late_minutes', align: 'right', width: 110 },
  ];

  if (loading && data.length === 0) return <Skeleton active paragraph={{ rows: 8 }} />;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr')}>HR Hub</Button>
      </Space>

      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' }}>
          <Title level={4} style={{ margin: 0 }}>Staff Attendance</Title>
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => move(-1)} />
            <Text strong>{monthLabel}</Text>
            <Button icon={<RightOutlined />} onClick={() => move(1)} disabled={isCurrent} />
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          </Space>
        </Space>

        <Space wrap style={{ marginBottom: 12 }}>
          <Text type="secondary">Legend:</Text>
          {COLS.map((c) => (
            <Tag key={c.key} color="default" style={{ background: c.color, color: '#fff', border: 'none' }}>{c.label} {c.tooltip}</Tag>
          ))}
        </Space>

        <Table
          rowKey="employee_id"
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="No attendance data for this month" /> }}
        />
      </Card>
    </div>
  );
}
