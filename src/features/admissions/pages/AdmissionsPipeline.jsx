import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Button, Tag, Space, Typography, Input, Select, Segmented,
  App, Empty, Skeleton, Table, Statistic, Popconfirm, Tooltip, Dropdown,
} from 'antd';
import {
  UsergroupAddOutlined, PlusOutlined, ReloadOutlined, SearchOutlined,
  EditOutlined, DeleteOutlined, ExportOutlined, FilterOutlined,
  AppstoreOutlined, UnorderedListOutlined, FundProjectionScreenOutlined,
  PhoneOutlined, MailOutlined, TeamOutlined, RiseOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, MoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import {
  admissionsService, STATUS_META, ENQUIRY_STATUSES, SOURCES, PRIORITIES,
} from '../services/admissionsService';
import EnquiryFormModal from '../components/EnquiryFormModal';
import EnquiryDetailDrawer from '../components/EnquiryDetailDrawer';
import KanbanBoard from '../components/KanbanBoard';

dayjs.extend(relativeTime);
const { Title, Text } = Typography;

const VIEWS = [
  { label: <><UnorderedListOutlined /> Table</>, value: 'table' },
  { label: <><AppstoreOutlined /> Kanban</>, value: 'kanban' },
  { label: <><FundProjectionScreenOutlined /> Funnel</>, value: 'funnel' },
];

const STAGE_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'new',       label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'follow_up', label: 'Follow Up' },
  { key: 'admitted',  label: 'Admitted' },
  { key: 'rejected',  label: 'Rejected' },
];

function exportCsv(rows) {
  const headers = [
    'Student Name', 'Class', 'Parent Name', 'Parent Phone', 'Parent Email',
    'Status', 'Priority', 'Source', 'Date of Birth', 'Gender', 'Address',
    'Notes', 'Assigned To', 'Created At',
  ];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push([
      r.student_name, r.class_applying_for, r.parent_name, r.parent_phone, r.parent_email || '',
      r.status, r.priority, r.source, r.date_of_birth || '', r.gender || '', r.address || '',
      (r.notes || '').replace(/\n/g, ' '), r.assigned_to_name || '',
      dayjs(r.created_at).format('YYYY-MM-DD HH:mm'),
    ].map(escape).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `admissions_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdmissionsPipeline() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const role = getUserRole(user);
  const { message, modal } = App.useApp();

  // Mobile capability mapping: superadmin → manage, admin → read-only
  const canRead = role === 'superadmin' || role === 'admin';
  const canManage = role === 'superadmin';

  const [view, setView] = useState('table');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enquiries, setEnquiries] = useState([]);
  const [activeStage, setActiveStage] = useState('all');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const { data } = await admissionsService.list(schoolCode, {}, { limit: 500 });
      setEnquiries(data);
    } catch (e) {
      message.error(e.message || 'Failed to load enquiries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const refresh = async () => { setRefreshing(true); await load(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enquiries.filter(e => {
      if (activeStage !== 'all' && e.status !== activeStage) return false;
      if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
      if (priorityFilter !== 'all' && e.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${e.student_name} ${e.parent_name} ${e.parent_phone} ${e.parent_email || ''} ${e.class_applying_for}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enquiries, activeStage, search, sourceFilter, priorityFilter]);

  // Stats / KPIs
  const stats = useMemo(() => {
    const total = enquiries.length;
    const counts = ENQUIRY_STATUSES.reduce((acc, s) => {
      acc[s] = enquiries.filter(e => e.status === s).length;
      return acc;
    }, {});
    const closed = counts.admitted + counts.rejected;
    const conversion = total > 0 ? Math.round((counts.admitted / total) * 100) : 0;
    const last7 = enquiries.filter(e => dayjs().diff(dayjs(e.created_at), 'day') < 7).length;
    return { total, counts, closed, conversion, last7 };
  }, [enquiries]);

  const stageCounts = useMemo(() => {
    const counts = { all: enquiries.length };
    ENQUIRY_STATUSES.forEach(s => {
      counts[s] = enquiries.filter(e => e.status === s).length;
    });
    return counts;
  }, [enquiries]);

  const onCreate = () => { setEditingItem(null); setFormOpen(true); };
  const onEdit = (item) => { setEditingItem(item); setFormOpen(true); };

  const onDelete = (item) => {
    modal.confirm({
      title: `Delete enquiry for ${item.student_name}?`,
      okType: 'danger',
      okText: 'Delete',
      onOk: async () => {
        try {
          await admissionsService.delete(item.id);
          message.success('Enquiry deleted');
          await load();
        } catch (e) {
          message.error(e.message || 'Failed to delete');
        }
      },
    });
  };

  const onMoveStage = async (id, status) => {
    try {
      await admissionsService.updateStatus(id, status);
      message.success(`Moved to ${STATUS_META[status].label}`);
      await load();
    } catch (e) {
      message.error(e.message || 'Failed to update status');
    }
  };

  const bulkSetStatus = (status) => {
    if (!selectedRowKeys.length) return;
    modal.confirm({
      title: `Move ${selectedRowKeys.length} enquiries to ${STATUS_META[status].label}?`,
      okText: 'Yes, move',
      onOk: async () => {
        try {
          await admissionsService.bulkUpdateStatus(selectedRowKeys, status);
          message.success(`${selectedRowKeys.length} updated`);
          setSelectedRowKeys([]);
          await load();
        } catch (e) {
          message.error(e.message || 'Failed bulk update');
        }
      },
    });
  };

  const bulkDelete = () => {
    if (!selectedRowKeys.length) return;
    modal.confirm({
      title: `Delete ${selectedRowKeys.length} enquiries?`,
      okType: 'danger',
      okText: 'Delete',
      onOk: async () => {
        try {
          await admissionsService.bulkDelete(selectedRowKeys);
          message.success(`${selectedRowKeys.length} deleted`);
          setSelectedRowKeys([]);
          await load();
        } catch (e) {
          message.error(e.message || 'Failed bulk delete');
        }
      },
    });
  };

  if (!canRead) {
    return (
      <Empty
        description="You don't have access to admissions."
        style={{ padding: 60 }}
      />
    );
  }

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Applicant',
      dataIndex: 'student_name',
      sorter: (a, b) => a.student_name.localeCompare(b.student_name),
      render: (name, r) => (
        <div style={{ cursor: 'pointer' }} onClick={() => setDetailId(r.id)}>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>Class {r.class_applying_for}</Text>
        </div>
      ),
    },
    {
      title: 'Parent',
      key: 'parent',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 13 }}>{r.parent_name}</div>
          <Space size={10} style={{ fontSize: 12, color: '#6B7280' }}>
            <a href={`tel:${r.parent_phone}`} onClick={e => e.stopPropagation()}>
              <PhoneOutlined /> {r.parent_phone}
            </a>
            {r.parent_email && (
              <a href={`mailto:${r.parent_email}`} onClick={e => e.stopPropagation()}>
                <MailOutlined /> {r.parent_email}
              </a>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'status',
      filters: ENQUIRY_STATUSES.map(s => ({ text: STATUS_META[s].label, value: s })),
      onFilter: (val, r) => r.status === val,
      render: (status) => {
        const m = STATUS_META[status];
        return <Tag color={m.color} style={{ borderRadius: 12, border: 'none', color: '#fff' }}>{m.label}</Tag>;
      },
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 100,
      filters: PRIORITIES.map(p => ({ text: p.label, value: p.value })),
      onFilter: (val, r) => r.priority === val,
      render: (p) => {
        const m = PRIORITIES.find(x => x.value === p);
        return m ? <Tag color={m.color} style={{ border: 'none', color: '#fff' }}>{m.label}</Tag> : p;
      },
    },
    {
      title: 'Source',
      dataIndex: 'source',
      width: 110,
      render: (s) => SOURCES.find(x => x.value === s)?.label || s,
    },
    {
      title: 'Received',
      dataIndex: 'created_at',
      width: 130,
      sorter: (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      render: (d) => (
        <Tooltip title={dayjs(d).format('YYYY-MM-DD HH:mm')}>
          {dayjs(d).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, r) => canManage ? (
        <Dropdown
          menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: 'Edit' },
              { type: 'divider' },
              ...ENQUIRY_STATUSES.filter(s => s !== r.status).map(s => ({
                key: `move-${s}`,
                label: `Move to ${STATUS_META[s].label}`,
              })),
              { type: 'divider' },
              { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true },
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === 'edit') onEdit(r);
              else if (key === 'delete') onDelete(r);
              else if (key.startsWith('move-')) onMoveStage(r.id, key.slice(5));
            },
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
        </Dropdown>
      ) : null,
    },
  ];

  // ── Funnel data ─────────────────────────────────────────────────────────────
  const funnel = ENQUIRY_STATUSES.filter(s => s !== 'rejected').map(s => ({
    stage: s,
    label: STATUS_META[s].label,
    color: STATUS_META[s].color,
    count: stats.counts[s],
  }));
  const funnelMax = Math.max(1, ...funnel.map(f => f.count));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <UsergroupAddOutlined /> Admissions Pipeline
          </Title>
          <Text type="secondary">Track enquiries from first contact to enrolment.</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={refresh}>Refresh</Button>
          <Button icon={<ExportOutlined />} onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
            Export CSV
          </Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              New Enquiry
            </Button>
          )}
        </Space>
      </div>

      {/* KPI summary */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small" hoverable onClick={() => setActiveStage('all')}>
            <Statistic title="Total Enquiries" value={stats.total} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" hoverable onClick={() => setActiveStage('new')} style={{ borderLeft: `3px solid ${STATUS_META.new.color}` }}>
            <Statistic title="New" value={stats.counts.new} valueStyle={{ color: STATUS_META.new.color }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" hoverable onClick={() => setActiveStage('contacted')} style={{ borderLeft: `3px solid ${STATUS_META.contacted.color}` }}>
            <Statistic title="In Progress" value={stats.counts.contacted + stats.counts.follow_up} valueStyle={{ color: STATUS_META.contacted.color }} prefix={<RiseOutlined />} />
            <Text type="secondary" style={{ fontSize: 11 }}>Contacted + Follow-up</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" hoverable style={{ borderLeft: `3px solid ${STATUS_META.admitted.color}` }}>
            <Statistic title="Conversion" value={stats.conversion} suffix="%" valueStyle={{ color: STATUS_META.admitted.color }} prefix={<CheckCircleOutlined />} />
            <Text type="secondary" style={{ fontSize: 11 }}>{stats.counts.admitted} admitted of {stats.total}</Text>
          </Card>
        </Col>
      </Row>

      {/* Filters bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search by name, parent, phone, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              value={sourceFilter}
              onChange={setSourceFilter}
              style={{ width: '100%' }}
              prefix={<FilterOutlined />}
              options={[{ label: 'All sources', value: 'all' }, ...SOURCES]}
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: '100%' }}
              options={[{ label: 'All priorities', value: 'all' }, ...PRIORITIES.map(p => ({ label: p.label, value: p.value }))]}
            />
          </Col>
          <Col xs={24} md={7} style={{ textAlign: 'right' }}>
            <Segmented options={VIEWS} value={view} onChange={setView} />
          </Col>
        </Row>

        {/* Stage tabs */}
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <Space size={6} wrap>
            {STAGE_TABS.map(t => {
              const active = activeStage === t.key;
              const meta = t.key !== 'all' ? STATUS_META[t.key] : null;
              return (
                <Tag.CheckableTag
                  key={t.key}
                  checked={active}
                  onChange={() => setActiveStage(t.key)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 16,
                    border: `1px solid ${active ? (meta?.color || '#1677ff') : '#E5E7EB'}`,
                    background: active ? (meta?.color || '#1677ff') : '#fff',
                    color: active ? '#fff' : '#374151',
                  }}
                >
                  {t.label} <span style={{ opacity: 0.85, marginLeft: 4 }}>({stageCounts[t.key] ?? 0})</span>
                </Tag.CheckableTag>
              );
            })}
          </Space>
        </div>
      </Card>

      {/* Bulk actions bar */}
      {canManage && view === 'table' && selectedRowKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#FFFBEB' }}>
          <Space wrap>
            <Text strong>{selectedRowKeys.length} selected</Text>
            <Dropdown
              menu={{
                items: ENQUIRY_STATUSES.map(s => ({ key: s, label: `Move to ${STATUS_META[s].label}` })),
                onClick: ({ key }) => bulkSetStatus(key),
              }}
            >
              <Button>Bulk move stage</Button>
            </Dropdown>
            <Button danger icon={<DeleteOutlined />} onClick={bulkDelete}>Bulk delete</Button>
            <Button onClick={() => setSelectedRowKeys([])}>Clear</Button>
          </Space>
        </Card>
      )}

      {/* Main content */}
      <Card>
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : filtered.length === 0 ? (
          <Empty description={enquiries.length === 0 ? 'No enquiries yet — log your first one' : 'No matches'} />
        ) : view === 'table' ? (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            size="middle"
            pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} enquiries` }}
            rowSelection={canManage ? {
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            } : undefined}
            onRow={(r) => ({
              onClick: () => setDetailId(r.id),
              style: { cursor: 'pointer' },
            })}
          />
        ) : view === 'kanban' ? (
          <KanbanBoard
            enquiries={filtered}
            onCardClick={(item) => setDetailId(item.id)}
            onMove={onMoveStage}
            canManage={canManage}
          />
        ) : (
          <FunnelView funnel={funnel} max={funnelMax} stats={stats} />
        )}
      </Card>

      {/* Modals */}
      <EnquiryFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        schoolCode={schoolCode}
        editing={editingItem}
        onSaved={load}
      />
      <EnquiryDetailDrawer
        open={!!detailId}
        enquiryId={detailId}
        onClose={() => setDetailId(null)}
        canManage={canManage}
        onChanged={load}
        onEdit={(item) => {
          setDetailId(null);
          setEditingItem(item);
          setFormOpen(true);
        }}
      />
    </div>
  );
}

// ── Funnel view (web-native enhancement) ──────────────────────────────────────

function FunnelView({ funnel, max, stats }) {
  return (
    <div style={{ padding: '8px 8px 16px' }}>
      <Title level={5} style={{ marginBottom: 16 }}>Conversion Funnel</Title>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {funnel.map((f, idx) => {
          const widthPct = Math.max(8, Math.round((f.count / max) * 100));
          const dropoff = idx > 0 && funnel[idx - 1].count > 0
            ? Math.round((f.count / funnel[idx - 1].count) * 100)
            : null;
          return (
            <div key={f.stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 110, fontWeight: 600, color: f.color }}>{f.label}</div>
              <div style={{ flex: 1, height: 32, background: '#F3F4F6', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${widthPct}%`, height: '100%', background: f.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 12, color: '#fff', fontWeight: 600, fontSize: 13,
                  transition: 'width 0.4s',
                }}>
                  {f.count}
                </div>
              </div>
              <div style={{ width: 110, fontSize: 12, color: '#6B7280' }}>
                {dropoff != null ? `${dropoff}% from prev` : 'entry stage'}
              </div>
            </div>
          );
        })}
      </Space>
      <div style={{ marginTop: 24, padding: 16, background: '#F9FAFB', borderRadius: 8 }}>
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Statistic title="Rejected" value={stats.counts.rejected} valueStyle={{ color: STATUS_META.rejected.color }} prefix={<CloseCircleOutlined />} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Closed (admitted + rejected)" value={stats.closed} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Last 7 days" value={stats.last7} prefix={<ClockCircleOutlined />} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Conversion rate" value={stats.conversion} suffix="%" valueStyle={{ color: STATUS_META.admitted.color }} />
          </Col>
        </Row>
      </div>
    </div>
  );
}
