import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Button, Tag, Space, Typography, List, Avatar, Modal, Input, App, Empty, Skeleton,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, SettingOutlined, IdcardOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { hrService } from '../services/hrService';
import LeaveTypesModal from '../components/LeaveTypesModal';

dayjs.extend(relativeTime);
const { Title, Text } = Typography;

export default function LeavesApprovals() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [reviewMode, setReviewMode] = useState('approve');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await hrService.listPendingLeaveApplications(schoolCode);
      setPending(data);
    } catch (e) {
      message.error(e.message || 'Failed to load pending leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const stats = useMemo(() => ({
    count: pending.length,
    days: pending.reduce((s, p) => s + Number(p.days || 0), 0),
    staff: new Set(pending.map((p) => p.employee_id)).size,
  }), [pending]);

  const openReview = (item, mode) => {
    setReviewing(item);
    setReviewMode(mode);
    setNote('');
  };

  const submitReview = async () => {
    if (!reviewing) return;
    try {
      setBusy(true);
      if (reviewMode === 'approve') await hrService.approveLeave(reviewing.id, note || undefined);
      else await hrService.rejectLeave(reviewing.id, note || undefined);
      message.success(reviewMode === 'approve' ? 'Leave approved' : 'Leave rejected');
      setPending((p) => p.filter((x) => x.id !== reviewing.id));
      setReviewing(null);
    } catch (e) {
      message.error(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const formatRange = (from, to) => {
    const f = dayjs(from), t = dayjs(to);
    if (f.isSame(t, 'day')) return f.format('DD MMM YYYY');
    if (f.isSame(t, 'month')) return `${f.format('DD')} → ${t.format('DD MMM YYYY')}`;
    return `${f.format('DD MMM')} → ${t.format('DD MMM YYYY')}`;
  };

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr')}>HR Hub</Button>
      </Space>

      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Leaves & Approvals</Title>
            <Text type="secondary">Pending leave applications</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            <Button icon={<SettingOutlined />} onClick={() => setTypesOpen(true)}>Leave Types</Button>
          </Space>
        </Space>

        {stats.count > 0 && (
          <div style={{
            padding: 16,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
            color: '#fff',
            marginBottom: 16,
          }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
              {stats.count} request{stats.count > 1 ? 's' : ''} awaiting review
            </Text>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 }}>
              {stats.days.toFixed(1)} total day{stats.days === 1 ? '' : 's'} across {stats.staff} staff member{stats.staff > 1 ? 's' : ''}
            </div>
          </div>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}><Card size="small"><Statistic title="Pending requests" value={stats.count} /></Card></Col>
          <Col xs={24} sm={8}><Card size="small"><Statistic title="Total days" value={stats.days.toFixed(1)} /></Card></Col>
          <Col xs={24} sm={8}><Card size="small"><Statistic title="Staff members" value={stats.staff} /></Card></Col>
        </Row>

        {pending.length === 0 ? (
          <Empty description="All caught up — no pending requests" />
        ) : (
          <List
            dataSource={pending}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key="a" type="primary" icon={<CheckOutlined />} onClick={() => openReview(item, 'approve')}>Approve</Button>,
                  <Button key="r" danger icon={<CloseOutlined />} onClick={() => openReview(item, 'reject')}>Reject</Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<IdcardOutlined />} />}
                  title={
                    <Space wrap>
                      <Text strong>{item.employees?.full_name}</Text>
                      <Text type="secondary">{item.employees?.designation}</Text>
                      <Tag>{item.leave_types?.code}</Tag>
                      {item.is_half_day && <Tag color="blue">Half-day {item.half_day_slot}</Tag>}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text>{formatRange(item.from_date, item.to_date)} · <Text strong>{item.days} day{item.days > 1 ? 's' : ''}</Text></Text>
                      {item.reason && <Text style={{ fontStyle: 'italic' }}>"{item.reason}"</Text>}
                      <Text type="secondary" style={{ fontSize: 12 }}>Applied {dayjs(item.applied_at).fromNow()}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        open={!!reviewing}
        onCancel={() => setReviewing(null)}
        onOk={submitReview}
        confirmLoading={busy}
        okText={reviewMode === 'approve' ? 'Approve' : 'Reject'}
        okButtonProps={{ danger: reviewMode === 'reject' }}
        title={reviewMode === 'approve' ? 'Approve Leave' : 'Reject Leave'}
        destroyOnClose
      >
        {reviewing && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>{reviewing.employees?.full_name}</Text>
            <Text type="secondary">
              {formatRange(reviewing.from_date, reviewing.to_date)} · {reviewing.days} day{reviewing.days > 1 ? 's' : ''} · {reviewing.leave_types?.name}
            </Text>
            {reviewing.reason && <Text style={{ fontStyle: 'italic' }}>"{reviewing.reason}"</Text>}
            <Input.TextArea
              rows={3}
              placeholder="Optional review note (visible to employee)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Space>
        )}
      </Modal>

      <LeaveTypesModal open={typesOpen} onClose={() => setTypesOpen(false)} schoolCode={schoolCode} />
    </div>
  );
}
