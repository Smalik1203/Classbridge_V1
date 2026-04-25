import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Button, Tag, Space, Typography, Input, Select, Segmented,
  App, Empty, Skeleton, Table, Statistic, Popconfirm, Tooltip, Dropdown, Alert, Tabs,
} from 'antd';
import {
  InboxOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, EditOutlined,
  DeleteOutlined, ExportOutlined, MoreOutlined, RollbackOutlined, ThunderboltOutlined,
  WarningOutlined, ShoppingOutlined, DollarOutlined, AppstoreOutlined,
  UnorderedListOutlined, ArrowUpOutlined, BarcodeOutlined, FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import {
  inventoryItemsService, inventoryIssuesService, inventoryBulkService,
  getStockStatus,
} from '../services/inventoryService';

import InventoryItemFormDrawer from '../components/InventoryItemFormDrawer';
import IssueInventoryModal from '../components/IssueInventoryModal';
import ReturnInventoryModal from '../components/ReturnInventoryModal';
import IssueDetailsDrawer from '../components/IssueDetailsDrawer';
import StockAdjustmentDrawer from '../components/StockAdjustmentDrawer';

const { Title, Text } = Typography;

const STAGE_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'issuable',   label: 'Issuable' },
  { key: 'chargeable', label: 'Chargeable' },
  { key: 'low_stock',  label: 'Low Stock' },
  { key: 'issued',     label: 'Issued' },
];

const STOCK_TAG = {
  healthy:   { color: 'green',  label: 'In stock' },
  low:       { color: 'orange', label: 'Low' },
  critical:  { color: 'red',    label: 'Out' },
  untracked: { color: 'default', label: 'Untracked' },
};

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

function exportItemsCsv(rows) {
  const headers = [
    'Name', 'Category', 'Description', 'Tracked', 'Current Qty', 'Low Threshold',
    'Serial Tracked', 'Issuable', 'Issue To', 'Returnable', 'Return Days',
    'Chargeable', 'Charge Type', 'Charge Amount', 'Auto-add to Fees',
    'Fee Category', 'Unit Cost', 'Internal Notes', 'Created At',
  ];
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push([
      r.name, r.category, r.description || '',
      r.track_quantity ? 'yes' : 'no', r.current_quantity ?? '', r.low_stock_threshold ?? '',
      r.track_serially ? 'yes' : 'no',
      r.can_be_issued ? 'yes' : 'no', r.issue_to || '',
      r.must_be_returned ? 'yes' : 'no', r.return_duration_days ?? '',
      r.is_chargeable ? 'yes' : 'no', r.charge_type || '', r.charge_amount ?? '',
      r.auto_add_to_fees ? 'yes' : 'no', r.fee_category || '',
      r.unit_cost ?? '', (r.internal_notes || '').replace(/\n/g, ' '),
      dayjs(r.created_at).format('YYYY-MM-DD HH:mm'),
    ].map(csvEscape).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportIssuesCsv(rows) {
  const headers = ['Item', 'Category', 'Recipient', 'Type', 'Qty', 'Issued', 'Return By', 'Status', 'Charge', 'Charge Type', 'Serial #'];
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push([
      r.inventory_item?.name || '', r.inventory_item?.category || '',
      r.issued_to_name || '', r.issued_to_type || '',
      r.quantity, dayjs(r.issue_date).format('YYYY-MM-DD'),
      r.expected_return_date ? dayjs(r.expected_return_date).format('YYYY-MM-DD') : '',
      r.status, r.charge_amount ?? '', r.charge_type || '', r.serial_number || '',
    ].map(csvEscape).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory_issues_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Inventory() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const role = getUserRole(user);
  const userId = user?.id;
  const { message, modal } = App.useApp();

  // Mobile capability mapping: superadmin → manage, admin → read+create
  const canRead   = role === 'superadmin' || role === 'admin';
  const canCreate = role === 'superadmin' || role === 'admin';
  const canManage = role === 'superadmin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [issues, setIssues] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState('table');

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueTargetItem, setIssueTargetItem] = useState(null);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnTargetIssue, setReturnTargetIssue] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItemName, setDetailsItemName] = useState('');
  const [detailsIssues, setDetailsIssues] = useState([]);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState(null);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const [it, is] = await Promise.all([
        inventoryItemsService.list(schoolCode, { limit: 500 }),
        inventoryIssuesService.listIssues(schoolCode, { status: 'issued' }, { limit: 500 }),
      ]);
      setItems(it.data);
      setIssues(is.data);
    } catch (e) {
      message.error(e.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const reloadIssues = async () => {
    try {
      const is = await inventoryIssuesService.listIssues(schoolCode, { status: 'issued' }, { limit: 500 });
      setIssues(is.data);
    } catch {/* silent */}
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [schoolCode]);

  const lowStockItems = useMemo(
    () => items.filter(it => { const s = getStockStatus(it); return s === 'low' || s === 'critical'; }),
    [items]
  );

  const totalStockValue = useMemo(
    () => items.reduce((sum, it) => {
      const cost = Number(it.unit_cost ?? it.charge_amount ?? 0);
      const qty  = Number(it.current_quantity ?? 0);
      return sum + (cost * qty);
    }, 0),
    [items]
  );

  const tabCounts = useMemo(() => ({
    all:        items.length,
    issuable:   items.filter(it => it.can_be_issued).length,
    chargeable: items.filter(it => it.is_chargeable).length,
    low_stock:  lowStockItems.length,
    issued:     issues.length,
  }), [items, issues, lowStockItems]);

  const categories = useMemo(() => {
    const set = new Set(items.map(it => it.category).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeTab === 'issuable')   list = list.filter(it => it.can_be_issued);
    if (activeTab === 'chargeable') list = list.filter(it => it.is_chargeable);
    if (activeTab === 'low_stock')  list = list.filter(it => {
      const s = getStockStatus(it); return s === 'low' || s === 'critical';
    });
    if (categoryFilter !== 'all') list = list.filter(it => it.category === categoryFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(it =>
      (it.name || '').toLowerCase().includes(q) ||
      (it.category || '').toLowerCase().includes(q) ||
      (it.description || '').toLowerCase().includes(q)
    );
    return list;
  }, [items, activeTab, categoryFilter, search]);

  const groupedIssues = useMemo(() => {
    const grouped = new Map();
    for (const issue of issues) {
      const id = issue.inventory_item_id;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(issue);
    }
    return Array.from(grouped.entries()).map(([itemId, list]) => {
      const totalQty = list.reduce((s, i) => s + i.quantity, 0);
      const overdue  = list.filter(i => i.expected_return_date && new Date(i.expected_return_date) < new Date()).length;
      const totalCharge = list.reduce((s, i) => s + ((i.charge_amount || 0) * i.quantity), 0);
      const latest = list.reduce(
        (acc, i) => new Date(i.issue_date) > new Date(acc) ? i.issue_date : acc,
        list[0].issue_date
      );
      return {
        inventory_item_id: itemId,
        inventory_item: list[0].inventory_item,
        totalQty, issueCount: list.length, overdue, totalCharge,
        latest, issues: list,
      };
    }).sort((a, b) => new Date(b.latest) - new Date(a.latest));
  }, [issues]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openCreate = () => { setEditingItem(null); setFormOpen(true); };
  const openEdit   = (item) => { setEditingItem(item); setFormOpen(true); };
  const openIssue  = (item) => {
    if (!item.can_be_issued) {
      message.warning('This item is not configured to be issued');
      return;
    }
    setIssueTargetItem(item); setIssueModalOpen(true);
  };
  const openAdjust = (item) => { setAdjustTarget(item); setAdjustOpen(true); };
  const openDetails = (group) => {
    setDetailsItemName(group.inventory_item?.name || 'Item');
    setDetailsIssues(group.issues);
    setDetailsOpen(true);
  };
  const openReturn = (issue) => { setReturnTargetIssue(issue); setReturnModalOpen(true); };

  const handleDelete = async (item) => {
    try {
      await inventoryItemsService.softDelete(item.id, schoolCode);
      message.success('Item archived');
      load();
    } catch (e) {
      message.error(e.message || 'Failed to delete');
    }
  };

  const handleBulkDelete = () => {
    modal.confirm({
      title: `Archive ${selectedRowKeys.length} items?`,
      content: 'Archived items are hidden but their issuance history is preserved.',
      okType: 'danger',
      okText: 'Archive',
      onOk: async () => {
        try {
          await inventoryBulkService.bulkSoftDelete(schoolCode, selectedRowKeys);
          setSelectedRowKeys([]);
          message.success(`Archived ${selectedRowKeys.length} items`);
          load();
        } catch (e) {
          message.error(e.message || 'Failed to archive');
        }
      },
    });
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const itemColumns = [
    {
      title: 'Item',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (v, r) => (
        <a onClick={() => openIssue(r)}>
          <Space direction="vertical" size={0}>
            <Text strong>{v}</Text>
            {r.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>
            )}
          </Space>
        </a>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      filters: categories.map(c => ({ text: c, value: c })),
      onFilter: (v, r) => r.category === v,
      render: v => <Tag>{v}</Tag>,
    },
    {
      title: 'Stock',
      key: 'stock',
      width: 130,
      sorter: (a, b) => (a.current_quantity ?? -1) - (b.current_quantity ?? -1),
      render: (_, r) => {
        const s = getStockStatus(r);
        const meta = STOCK_TAG[s];
        if (s === 'untracked') {
          return <Tag color={meta.color}>{meta.label}</Tag>;
        }
        return (
          <Space size={6}>
            <Text strong style={{ fontSize: 14 }}>{r.current_quantity ?? 0}</Text>
            <Tag color={meta.color} style={{ margin: 0 }}>{meta.label}</Tag>
          </Space>
        );
      },
    },
    {
      title: 'Charge',
      key: 'charge',
      width: 130,
      render: (_, r) => r.is_chargeable
        ? <Space size={4}>
            <Text>₹{r.charge_amount ?? 0}</Text>
            <Tag style={{ margin: 0 }} color={r.charge_type === 'deposit' ? 'blue' : 'default'}>
              {r.charge_type === 'deposit' ? 'deposit' : 'one-time'}
            </Tag>
          </Space>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Issuable',
      key: 'issuable',
      width: 130,
      filters: [
        { text: 'Issuable', value: true },
        { text: 'Internal only', value: false },
      ],
      onFilter: (v, r) => !!r.can_be_issued === v,
      render: (_, r) => r.can_be_issued
        ? <Space size={4}>
            <Tag color="green">Issuable</Tag>
            {r.issue_to && r.issue_to !== 'both' && <Tag>{r.issue_to}</Tag>}
            {r.must_be_returned && <Tag color="orange">returnable</Tag>}
          </Space>
        : <Text type="secondary">internal</Text>,
    },
    {
      title: 'Auto-fee',
      key: 'fee',
      width: 100,
      render: (_, r) => r.auto_add_to_fees
        ? <Tag color="purple">auto</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, r) => {
        const moreItems = [
          { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => openEdit(r) },
          ...(r.track_quantity ? [{
            key: 'adjust', icon: <ArrowUpOutlined />, label: 'Adjust stock',
            onClick: () => openAdjust(r),
          }] : []),
          { type: 'divider' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: 'Archive',
            danger: true,
            onClick: () => modal.confirm({
              title: `Archive "${r.name}"?`,
              content: 'It will be hidden from active inventory but its issuance history is kept.',
              okType: 'danger',
              onOk: () => handleDelete(r),
            }),
          },
        ];
        return (
          <Space size={4}>
            {r.can_be_issued && (
              <Tooltip title="Issue">
                <Button size="small" type="primary" ghost icon={<ThunderboltOutlined />} onClick={() => openIssue(r)}>
                  Issue
                </Button>
              </Tooltip>
            )}
            {canManage && (
              <Dropdown menu={{ items: moreItems }} trigger={['click']}>
                <Button size="small" icon={<MoreOutlined />} />
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  const issueGroupColumns = [
    {
      title: 'Item',
      key: 'item',
      sorter: (a, b) => (a.inventory_item?.name || '').localeCompare(b.inventory_item?.name || ''),
      render: (_, r) => (
        <a onClick={() => openDetails(r)}>
          <Space direction="vertical" size={0}>
            <Text strong>{r.inventory_item?.name || 'Unknown'}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.inventory_item?.category || ''}</Text>
          </Space>
        </a>
      ),
    },
    {
      title: 'Units out',
      dataIndex: 'totalQty',
      key: 'qty',
      width: 110,
      sorter: (a, b) => a.totalQty - b.totalQty,
    },
    {
      title: 'Active issues',
      dataIndex: 'issueCount',
      key: 'count',
      width: 130,
      sorter: (a, b) => a.issueCount - b.issueCount,
    },
    {
      title: 'Overdue',
      dataIndex: 'overdue',
      key: 'overdue',
      width: 100,
      sorter: (a, b) => a.overdue - b.overdue,
      render: v => v > 0 ? <Tag color="red">{v}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: 'Charged',
      dataIndex: 'totalCharge',
      key: 'charge',
      width: 120,
      render: v => v > 0 ? `₹${v.toFixed(0)}` : <Text type="secondary">—</Text>,
      sorter: (a, b) => a.totalCharge - b.totalCharge,
    },
    {
      title: 'Latest',
      dataIndex: 'latest',
      key: 'latest',
      width: 130,
      render: v => dayjs(v).format('DD MMM YYYY'),
      sorter: (a, b) => new Date(a.latest) - new Date(b.latest),
      defaultSortOrder: 'descend',
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, r) => (
        <Button size="small" onClick={() => openDetails(r)}>Details</Button>
      ),
    },
  ];

  // ── Empty / unauthorized ───────────────────────────────────────────────────
  if (!canRead) {
    return (
      <Card>
        <Empty description="You don't have permission to view inventory." />
      </Card>
    );
  }

  if (!schoolCode) {
    return (
      <Card>
        <Alert type="error" message="No school context" description="Cannot determine your school code from your profile." />
      </Card>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Space align="center">
          <InboxOutlined style={{ fontSize: 22, color: '#6366f1' }} />
          <Title level={3} style={{ margin: 0 }}>Inventory & Fee Linkage</Title>
        </Space>
        <Space>
          <Tooltip title="Reload">
            <Button icon={<ReloadOutlined />} onClick={() => { setRefreshing(true); load(); }} loading={refreshing} />
          </Tooltip>
          <Tooltip title="Export current view to CSV">
            <Button icon={<ExportOutlined />} onClick={() => activeTab === 'issued'
              ? exportIssuesCsv(issues)
              : exportItemsCsv(filteredItems)}>
              Export CSV
            </Button>
          </Tooltip>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              New Item
            </Button>
          )}
        </Space>
      </div>

      {/* KPI cards */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Total items" value={items.length} prefix={<InboxOutlined style={{ color: '#6366f1' }} />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Active issuances"
              value={issues.length}
              prefix={<ShoppingOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={lowStockItems.length ? { borderColor: '#ef4444' } : undefined}>
            <Statistic
              title="Low / out of stock"
              value={lowStockItems.length}
              prefix={<WarningOutlined style={{ color: lowStockItems.length ? '#ef4444' : '#94a3b8' }} />}
              valueStyle={{ color: lowStockItems.length ? '#ef4444' : '#94a3b8' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Stock value"
              value={totalStockValue}
              precision={0}
              prefix={<DollarOutlined style={{ color: '#10b981' }} />}
              suffix="₹"
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Low stock alert banner */}
      {lowStockItems.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${lowStockItems.length} item${lowStockItems.length === 1 ? '' : 's'} need${lowStockItems.length === 1 ? 's' : ''} restocking`}
          description={
            <Space wrap size={4}>
              {lowStockItems.slice(0, 8).map(it => (
                <Tag
                  key={it.id}
                  color={getStockStatus(it) === 'critical' ? 'red' : 'orange'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => canManage && openAdjust(it)}
                >
                  {it.name} ({it.current_quantity ?? 0})
                </Tag>
              ))}
              {lowStockItems.length > 8 && <Text type="secondary">+ {lowStockItems.length - 8} more</Text>}
            </Space>
          }
          action={
            <Button size="small" onClick={() => setActiveTab('low_stock')}>View all</Button>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={STAGE_TABS.map(t => ({
                key: t.key,
                label: <Space size={6}>{t.label}<Tag>{tabCounts[t.key] ?? 0}</Tag></Space>,
              }))}
              size="small"
              style={{ marginBottom: -16 }}
            />
          </Space>
          <Space wrap>
            {activeTab !== 'issued' && (
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ minWidth: 160 }}
                options={[
                  { label: 'All categories', value: 'all' },
                  ...categories.map(c => ({ label: c, value: c })),
                ]}
                suffixIcon={<FilterOutlined />}
                size="middle"
              />
            )}
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={activeTab === 'issued' ? 'Search by item or recipient' : 'Search items'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { label: <UnorderedListOutlined />, value: 'table' },
                { label: <AppstoreOutlined />,    value: 'cards' },
              ]}
            />
          </Space>
        </Space>
      </Card>

      {/* Bulk actions */}
      {activeTab !== 'issued' && canManage && selectedRowKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#FFF7ED', borderColor: '#fdba74' }}>
          <Space>
            <Text strong>{selectedRowKeys.length} selected</Text>
            <Button danger size="small" icon={<DeleteOutlined />} onClick={handleBulkDelete}>
              Archive selected
            </Button>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear</Button>
          </Space>
        </Card>
      )}

      {/* Body */}
      {loading ? (
        <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
      ) : activeTab === 'issued' ? (
        <Card size="small">
          {issues.length === 0 ? (
            <Empty description="No active issuances" />
          ) : (
            <Table
              rowKey="inventory_item_id"
              size="small"
              dataSource={
                search.trim()
                  ? groupedIssues.filter(g => {
                      const q = search.trim().toLowerCase();
                      return (g.inventory_item?.name || '').toLowerCase().includes(q) ||
                             g.issues.some(i => (i.issued_to_name || '').toLowerCase().includes(q));
                    })
                  : groupedIssues
              }
              columns={issueGroupColumns}
              pagination={{ pageSize: 25, showSizeChanger: true }}
              onRow={(r) => ({ onClick: () => openDetails(r), style: { cursor: 'pointer' } })}
            />
          )}
        </Card>
      ) : view === 'table' ? (
        <Card size="small">
          {filteredItems.length === 0 ? (
            <Empty description={search ? `Nothing matched "${search}"` : 'No items'} />
          ) : (
            <Table
              rowKey="id"
              size="small"
              dataSource={filteredItems}
              columns={itemColumns}
              rowSelection={canManage ? {
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              } : undefined}
              pagination={{ pageSize: 25, showSizeChanger: true }}
              scroll={{ x: 900 }}
            />
          )}
        </Card>
      ) : (
        // Card grid view
        <Row gutter={[12, 12]}>
          {filteredItems.length === 0 ? (
            <Col span={24}><Card><Empty description={search ? `Nothing matched "${search}"` : 'No items'} /></Card></Col>
          ) : filteredItems.map(it => {
            const s = getStockStatus(it);
            const meta = STOCK_TAG[s];
            return (
              <Col key={it.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => openIssue(it)}
                  style={{
                    borderLeft: `4px solid ${
                      s === 'critical' ? '#ef4444' :
                      s === 'low' ? '#f59e0b' :
                      it.can_be_issued ? '#6366f1' : '#94a3b8'
                    }`,
                  }}
                  actions={canManage ? [
                    <Tooltip title="Issue" key="issue"><ThunderboltOutlined onClick={(e) => { e.stopPropagation(); openIssue(it); }} /></Tooltip>,
                    <Tooltip title="Edit" key="edit"><EditOutlined onClick={(e) => { e.stopPropagation(); openEdit(it); }} /></Tooltip>,
                    ...(it.track_quantity ? [
                      <Tooltip title="Adjust stock" key="adj"><ArrowUpOutlined onClick={(e) => { e.stopPropagation(); openAdjust(it); }} /></Tooltip>,
                    ] : []),
                  ] : []}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                      <Text strong style={{ fontSize: 14 }}>{it.name}</Text>
                      <Tag color={meta.color} style={{ margin: 0 }}>
                        {s === 'untracked' ? meta.label : `${it.current_quantity ?? 0}`}
                      </Tag>
                    </Space>
                    <Tag>{it.category}</Tag>
                    {it.is_chargeable && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ₹{it.charge_amount ?? 0} {it.charge_type === 'deposit' ? 'deposit' : 'one-time'}
                      </Text>
                    )}
                    {it.must_be_returned && <Tag color="orange" style={{ margin: 0 }}>Returnable</Tag>}
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Modals & drawers */}
      <InventoryItemFormDrawer
        open={formOpen}
        editing={editingItem}
        schoolCode={schoolCode}
        userId={userId}
        onClose={() => setFormOpen(false)}
        onSaved={() => load()}
      />
      <IssueInventoryModal
        open={issueModalOpen}
        item={issueTargetItem}
        schoolCode={schoolCode}
        userId={userId}
        onClose={() => { setIssueModalOpen(false); setIssueTargetItem(null); }}
        onIssued={() => load()}
      />
      <ReturnInventoryModal
        open={returnModalOpen}
        issue={returnTargetIssue}
        schoolCode={schoolCode}
        onClose={() => { setReturnModalOpen(false); setReturnTargetIssue(null); }}
        onReturned={() => { load(); }}
      />
      <IssueDetailsDrawer
        open={detailsOpen}
        itemName={detailsItemName}
        issues={detailsIssues}
        canManage={canManage}
        onClose={() => setDetailsOpen(false)}
        onReturnPress={(issue) => { setDetailsOpen(false); openReturn(issue); }}
      />
      <StockAdjustmentDrawer
        open={adjustOpen}
        item={adjustTarget}
        schoolCode={schoolCode}
        onClose={() => { setAdjustOpen(false); setAdjustTarget(null); }}
        onAdjusted={() => load()}
      />
    </div>
  );
}
