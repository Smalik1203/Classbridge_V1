import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Button, Tag, Space, Typography, Input, Select,
  App, Empty, Skeleton, Dropdown, Tooltip, Popconfirm, Statistic, Badge, Avatar,
} from 'antd';
import {
  NotificationOutlined, PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  PushpinOutlined, PushpinFilled, BellOutlined, MoreOutlined, SearchOutlined,
  PictureOutlined, UserOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { announcementsService, PRIORITY_META } from '../services/communicationsService';
import AnnouncementFormModal from '../components/AnnouncementFormModal';
import AnnouncementImage from '../components/AnnouncementImage';

dayjs.extend(relativeTime);
const { Title, Text, Paragraph } = Typography;

function audienceLabel(a, classMap) {
  if (a.target_type === 'all') return 'Everyone';
  const ids = a.class_instance_ids?.length
    ? a.class_instance_ids
    : (a.class_instance_id ? [a.class_instance_id] : []);
  if (!ids.length) return 'Classes';
  const labels = ids
    .map((id) => classMap[id])
    .filter(Boolean)
    .map((c) => `Grade ${c.grade}-${c.section}`);
  if (labels.length === 0) return 'Classes';
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`;
}

export default function Announcements() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const role = getUserRole(user);
  const { message, modal } = App.useApp();

  const canPost = role === 'superadmin' || role === 'admin' || role === 'teacher';
  const canManageAll = role === 'superadmin' || role === 'admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const classMap = useMemo(() => {
    const m = {};
    classes.forEach((c) => { m[c.id] = c; });
    return m;
  }, [classes]);

  const load = async (reset = true) => {
    if (!schoolCode) return;
    try {
      if (reset) setLoading(true);
      const [items, cls] = await Promise.all([
        announcementsService.listFeed(schoolCode, 0).catch(async (e) => {
          // if join FK alias fails (relationship not declared), retry without joins
          if (String(e?.message || '').toLowerCase().includes('relationship')) {
            return announcementsService.listFeedSimple(schoolCode, 0);
          }
          throw e;
        }),
        announcementsService.listClasses(schoolCode),
      ]);
      setAnnouncements(items);
      setClasses(cls);
      setPage(0);
      setHasMore(items.length >= 20);
    } catch (e) {
      message.error(e.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const next = page + 1;
      let items;
      try {
        items = await announcementsService.listFeed(schoolCode, next);
      } catch {
        items = await announcementsService.listFeedSimple(schoolCode, next);
      }
      setAnnouncements((prev) => [...prev, ...items]);
      setPage(next);
      setHasMore(items.length >= 20);
    } catch (e) {
      message.error(e.message || 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return announcements.filter((a) => {
      if (audienceFilter === 'all_only' && a.target_type !== 'all') return false;
      if (audienceFilter === 'class_only' && a.target_type !== 'class') return false;
      if (q) {
        const hay = `${a.title || ''} ${a.message || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [announcements, searchText, audienceFilter]);

  const stats = useMemo(() => {
    const total = announcements.length;
    const pinned = announcements.filter((a) => a.pinned).length;
    const last7 = announcements.filter((a) => dayjs().diff(dayjs(a.created_at), 'day') < 7).length;
    return { total, pinned, last7 };
  }, [announcements]);

  const onCreate = () => { setEditingItem(null); setFormOpen(true); };
  const onEdit = (item) => { setEditingItem(item); setFormOpen(true); };

  const onDelete = (item) => {
    modal.confirm({
      title: 'Delete this announcement?',
      content: 'This cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setBusyId(item.id);
          await announcementsService.remove(item.id);
          setAnnouncements((p) => p.filter((x) => x.id !== item.id));
          message.success('Announcement deleted');
        } catch (e) {
          message.error(e.message || 'Delete failed');
        } finally { setBusyId(null); }
      },
    });
  };

  const onTogglePin = async (item) => {
    try {
      setBusyId(item.id);
      await announcementsService.togglePin(item.id, !item.pinned);
      setAnnouncements((p) => p.map((x) => x.id === item.id ? { ...x, pinned: !item.pinned } : x));
      message.success(item.pinned ? 'Unpinned' : 'Pinned to top');
    } catch (e) {
      message.error(e.message || 'Failed');
    } finally { setBusyId(null); }
  };

  const onSendReminder = async (item) => {
    try {
      setBusyId(item.id);
      const res = await announcementsService.sendReminder(item.id);
      if (res?.skipped) {
        const cd = res?.cooldown_minutes ?? '';
        message.warning(res?.message || `Reminder skipped${cd ? ` (cooldown ${cd}m)` : ''}`);
      } else {
        const n = res?.notified;
        message.success(n != null ? `Reminder sent to ${n}` : 'Reminder sent');
      }
    } catch (e) {
      message.error(e.message || 'Reminder failed');
    } finally { setBusyId(null); }
  };

  const cardMenu = (item) => {
    const items = [
      { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => onEdit(item) },
      { key: 'pin', icon: item.pinned ? <PushpinFilled /> : <PushpinOutlined />, label: item.pinned ? 'Unpin' : 'Pin to top', onClick: () => onTogglePin(item) },
      { key: 'reminder', icon: <BellOutlined />, label: 'Send reminder', onClick: () => onSendReminder(item) },
      { type: 'divider' },
      { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: () => onDelete(item) },
    ];
    return { items };
  };

  const canManageItem = (item) => canManageAll || item.created_by === user?.id;

  if (loading) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Skeleton active paragraph={{ rows: 1 }} />
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map((i) => (
            <Col xs={12} md={6} key={i}><Card><Skeleton active paragraph={{ rows: 1 }} /></Card></Col>
          ))}
        </Row>
        <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row align="middle" justify="space-between" gutter={[12, 12]}>
        <Col>
          <Space align="center">
            <Tag color="blue">{stats.total} total</Tag>
            {stats.pinned > 0 && <Tag icon={<PushpinFilled />} color="gold">{stats.pinned} pinned</Tag>}
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { setRefreshing(true); load(); }} loading={refreshing}>
              Refresh
            </Button>
            {canPost && (
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                Post announcement
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="Total posts" value={stats.total} prefix={<NotificationOutlined />} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="Pinned" value={stats.pinned} valueStyle={{ color: '#D97706' }} prefix={<PushpinFilled />} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="Last 7 days" value={stats.last7} prefix={<NotificationOutlined />} /></Card></Col>
      </Row>

      <Card size="small" bodyStyle={{ padding: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={16}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search title or message"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              value={audienceFilter}
              onChange={setAudienceFilter}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: 'All audiences' },
                { value: 'all_only', label: 'Everyone (school-wide)' },
                { value: 'class_only', label: 'Class-targeted' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={announcements.length === 0
              ? 'No announcements yet'
              : 'No posts match your filters'}
          >
            {canPost && announcements.length === 0 && (
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                Post the first announcement
              </Button>
            )}
          </Empty>
        </Card>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {filtered.map((a) => {
            const meta = PRIORITY_META[a.priority] || PRIORITY_META.medium;
            const creator = a.creator?.full_name || 'Unknown';
            const creatorRole = a.creator?.role;
            const creatorLabel = creatorRole === 'superadmin' || creatorRole === 'admin' ? 'Admin'
              : creatorRole === 'teacher' ? 'Teacher' : 'Staff';
            const isMgmt = canManageItem(a);

            return (
              <Card
                key={a.id}
                hoverable
                style={{
                  borderLeft: `4px solid ${meta.color}`,
                  background: a.pinned ? 'linear-gradient(135deg, rgba(245,158,11,0.06), transparent)' : undefined,
                }}
                title={
                  <Space wrap>
                    <Avatar style={{ background: '#6366F1' }} icon={<UserOutlined />} />
                    <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
                      <Text strong>{creator}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{creatorLabel} · {dayjs(a.created_at).fromNow()}</Text>
                    </div>
                  </Space>
                }
                extra={
                  <Space wrap>
                    {a.pinned && <Tag icon={<PushpinFilled />} color="gold">Pinned</Tag>}
                    <Tag color={meta.color} style={{ color: '#fff', borderColor: meta.color }}>
                      {meta.icon} {meta.label}
                    </Tag>
                    <Tag icon={a.target_type === 'all' ? <TeamOutlined /> : <TeamOutlined />}>
                      {audienceLabel(a, classMap)}
                    </Tag>
                    {isMgmt && (
                      <Dropdown menu={cardMenu(a)} trigger={['click']}>
                        <Button type="text" icon={<MoreOutlined />} loading={busyId === a.id} />
                      </Dropdown>
                    )}
                  </Space>
                }
              >
                {a.title && <Title level={5} style={{ marginTop: 0 }}>{a.title}</Title>}
                <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: a.image_url ? 12 : 0 }}>
                  {a.message}
                </Paragraph>
                {a.image_url && (
                  <AnnouncementImage path={a.image_url} height={280} />
                )}
                {isMgmt && (
                  <Space style={{ marginTop: 12 }} wrap>
                    <Tooltip title={a.pinned ? 'Unpin' : 'Pin to top'}>
                      <Button
                        size="small"
                        icon={a.pinned ? <PushpinFilled /> : <PushpinOutlined />}
                        onClick={() => onTogglePin(a)}
                      >{a.pinned ? 'Unpin' : 'Pin'}</Button>
                    </Tooltip>
                    <Button size="small" icon={<BellOutlined />} onClick={() => onSendReminder(a)}>
                      Send reminder
                    </Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(a)}>Edit</Button>
                    <Popconfirm
                      title="Delete announcement?"
                      onConfirm={() => onDelete(a)}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
                    </Popconfirm>
                  </Space>
                )}
              </Card>
            );
          })}

          {hasMore && (
            <div style={{ textAlign: 'center' }}>
              <Button onClick={loadMore} loading={loadingMore}>Load more</Button>
            </div>
          )}
        </Space>
      )}

      <AnnouncementFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => load()}
        schoolCode={schoolCode}
        classes={classes}
        editing={editingItem}
      />
    </Space>
  );
}
