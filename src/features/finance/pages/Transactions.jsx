import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Table, Button, Space, Typography, Tag, Input, Select, DatePicker,
  Segmented, Statistic, Dropdown, App, Result, Switch, Tooltip, Skeleton,
} from 'antd';
import {
  PlusOutlined, ThunderboltOutlined, FileExcelOutlined, FilePdfOutlined,
  ReloadOutlined, SearchOutlined, FilterOutlined, MoreOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, ImportOutlined, LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthProvider';
import { getUserRole, getSchoolName } from '@/shared/utils/metadata';
import {
  resolveSchoolCode,
  financeTransactionsService,
  financeAccountsService,
  financeCategoriesService,
} from '../services/financeService';
import {
  exportTransactionsCSV, exportTransactionsXLSX, printSummaryReport,
} from '../services/financeExportService';
import TransactionFormModal     from '../components/TransactionFormModal';
import MultiLineEntryDrawer     from '../components/MultiLineEntryDrawer';
import TransactionDetailDrawer  from '../components/TransactionDetailDrawer';
import ImportDrawer             from '../components/ImportDrawer';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

function moneyINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function Transactions() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const userId = user?.id;
  const schoolName = getSchoolName(user);
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [schoolCode, setSchoolCode] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [accounts, setAccounts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [txns, setTxns]           = useState([]);
  const [linksByTxn, setLinksByTxn] = useState({});

  const [search, setSearch]            = useState('');
  const [typeFilter, setTypeFilter]    = useState('all');
  const [accountFilter, setAccountFilter]   = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showVoided, setShowVoided]    = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showMulti, setShowMulti]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detail, setDetail]         = useState(null);
  const [editTxn, setEditTxn]       = useState(null);

  const isReadOnly = role !== 'superadmin';
  const startDate = range[0].format('YYYY-MM-DD');
  const endDate   = range[1].format('YYYY-MM-DD');

  useEffect(() => {
    resolveSchoolCode(user)
      .then(setSchoolCode)
      .catch(err => setAccessError(err.message || 'Could not determine school'));
  }, [user]);

  useEffect(() => {
    if (!schoolCode) return;
    Promise.all([
      financeAccountsService.list(schoolCode, { includeInactive: true }),
      financeCategoriesService.list(schoolCode, { includeInactive: true }),
    ]).then(([acc, cat]) => {
      setAccounts(acc);
      setCategories(cat);
    });
  }, [schoolCode]);

  const refresh = async () => {
    if (!schoolCode) return;
    setRefreshing(true);
    try {
      const { data } = await financeTransactionsService.list({
        schoolCode, startDate, endDate,
        type: typeFilter === 'all' ? undefined : typeFilter,
        categoryId: categoryFilter || undefined,
        accountId:  accountFilter  || undefined,
        search,
        includeDeleted: showVoided,
        limit: 1000,
      });
      setTxns(data);
      // Pre-fetch source links to flag fee/payroll-derived rows in the table.
      // One bulk query (in chunks if needed).
      const ids = data.map(d => d.id);
      const links = {};
      if (ids.length) {
        const chunkSize = 200;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const lp = await Promise.all(chunk.map(id => financeTransactionsService.getLinks(id)));
          chunk.forEach((id, j) => { links[id] = lp[j]; });
        }
      }
      setLinksByTxn(links);
    } catch (err) {
      message.error(err.message || 'Failed to load transactions');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ },
    [schoolCode, startDate, endDate, typeFilter, categoryFilter, accountFilter, showVoided, search]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    txns.forEach(t => {
      if (t.deleted_at) return;
      const a = Number(t.amount);
      if (t.type === 'income') income += a; else expense += a;
    });
    return { income, expense, net: income - expense, count: txns.length };
  }, [txns]);

  const columns = [
    { title: 'Date', dataIndex: 'txn_date', width: 110, sorter: (a, b) => a.txn_date.localeCompare(b.txn_date),
      defaultSortOrder: 'descend',
      render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Type', dataIndex: 'type', width: 90,
      render: (v) => v === 'income' ? <Tag color="green">income</Tag> : <Tag color="red">expense</Tag> },
    { title: 'Category', dataIndex: ['category', 'name'], width: 160, ellipsis: true,
      render: (v) => v || <Text type="secondary">—</Text> },
    { title: 'Account', dataIndex: ['account', 'name'], width: 160, ellipsis: true,
      render: (v, r) => v
        ? <Space size={4}>{v}<Tag color={r.account?.type === 'cash' ? 'green' : r.account?.type === 'bank' ? 'blue' : 'purple'}>{r.account?.type}</Tag></Space>
        : <Text type="secondary">—</Text> },
    { title: 'Description', dataIndex: 'description', ellipsis: true,
      render: (v) => v || <Text type="secondary">—</Text> },
    { title: 'Source', width: 130,
      render: (_, r) => {
        const links = linksByTxn[r.id] || [];
        if (!links.length) return <Tag>manual</Tag>;
        return (
          <Space size={2} wrap>
            {links.map(l => (
              <Tag key={l.id} color={l.source_type === 'fee_payment' ? 'blue' : l.source_type === 'salary' ? 'purple' : 'default'}
                icon={l.source_type !== 'manual' ? <LockOutlined /> : null}>
                {l.source_type}
              </Tag>
            ))}
          </Space>
        );
      } },
    { title: 'Amount', dataIndex: 'amount', align: 'right', width: 130,
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (v, r) => (
        <Text strong style={{
          color: r.deleted_at ? '#94a3b8' : (r.type === 'income' ? '#10b981' : '#ef4444'),
          textDecoration: r.deleted_at ? 'line-through' : 'none',
        }}>
          {r.type === 'income' ? '+' : '−'} ₹{moneyINR(v)}
        </Text>
      ) },
    { title: '', width: 50, fixed: 'right',
      render: (_, r) => {
        const links = linksByTxn[r.id] || [];
        const isLocked = links.some(l => l.source_type === 'fee_payment' || l.source_type === 'salary');
        const items = [
          { key: 'view', icon: <EyeOutlined />,    label: 'View details', onClick: () => setDetail(r) },
        ];
        if (!isLocked && !r.deleted_at && !isReadOnly) {
          items.push({ key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => setEditTxn(r) });
          items.push({ key: 'void', icon: <DeleteOutlined />, label: 'Void…', danger: true, onClick: () => setDetail(r) });
        }
        return <Dropdown menu={{ items }} trigger={['click']}><Button type="text" icon={<MoreOutlined />} /></Dropdown>;
      } },
  ];

  if (accessError) {
    return <Result status="warning" title="Cannot load Finance" subTitle={accessError}
             extra={<Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>} />;
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ margin: 0 }}>Transactions ledger</Title>
            <Text type="secondary">All income & expense rows for the selected period.</Text>
          </Col>
          <Col>
            <Space wrap>
              <RangePicker value={range} onChange={(v) => v && setRange(v)} allowClear={false} format="DD MMM YYYY" />
              <Tooltip title="Refresh"><Button icon={<ReloadOutlined />} loading={refreshing} onClick={refresh} /></Tooltip>
              <Button icon={<ImportOutlined />} disabled={isReadOnly} onClick={() => setShowImport(true)}>Import</Button>
              <Dropdown menu={{
                items: [
                  { key: 'csv',  icon: <FileExcelOutlined />, label: 'Export CSV',  onClick: async () => {
                      try { const r = await exportTransactionsCSV({ schoolCode, startDate, endDate, type: typeFilter === 'all' ? undefined : typeFilter, categoryId: categoryFilter, accountId: accountFilter, userId, userRole: role }); message.success(`Exported ${r.count} rows`); }
                      catch (e) { message.error(e.message); } } },
                  { key: 'xlsx', icon: <FileExcelOutlined />, label: 'Export XLSX', onClick: async () => {
                      try { const r = await exportTransactionsXLSX({ schoolCode, startDate, endDate, type: typeFilter === 'all' ? undefined : typeFilter, categoryId: categoryFilter, accountId: accountFilter, userId, userRole: role }); message.success(`Exported ${r.count} rows`); }
                      catch (e) { message.error(e.message); } } },
                  { key: 'pdf',  icon: <FilePdfOutlined />,   label: 'Print summary report', onClick: async () => {
                      try { await printSummaryReport({ schoolCode, startDate, endDate, schoolName, userId, userRole: role }); }
                      catch (e) { message.error(e.message); } } },
                ]
              }}>
                <Button icon={<FilePdfOutlined />}>Export</Button>
              </Dropdown>
              <Button icon={<ThunderboltOutlined />} disabled={isReadOnly} onClick={() => setShowMulti(true)}>Multi-line</Button>
              <Button type="primary" icon={<PlusOutlined />} disabled={isReadOnly} onClick={() => setShowCreate(true)}>New</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card><Statistic title="Income"  value={totals.income}  prefix="₹" precision={2} valueStyle={{ color: '#10b981' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Expense" value={totals.expense} prefix="₹" precision={2} valueStyle={{ color: '#ef4444' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Net"     value={totals.net}     prefix="₹" precision={2} valueStyle={{ color: totals.net >= 0 ? '#10b981' : '#ef4444' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Rows"    value={totals.count} /></Card></Col>
      </Row>

      <Card>
        <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 12 }}>
          <Col xs={24} md={6}>
            <Input prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description…" allowClear />
          </Col>
          <Col xs={12} md={5}>
            <Select
              placeholder="Account"
              value={accountFilter}
              onChange={setAccountFilter}
              allowClear style={{ width: '100%' }}
              options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.type})` }))}
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              placeholder="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              allowClear style={{ width: '100%' }}
              options={categories.map(c => ({ value: c.id, label: `${c.name} (${c.type})` }))}
            />
          </Col>
          <Col xs={12} md={5}>
            <Segmented
              block
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Income', value: 'income' },
                { label: 'Expense', value: 'expense' },
              ]}
            />
          </Col>
          <Col xs={12} md={3} style={{ textAlign: 'right' }}>
            <Space size={6}>
              <Switch size="small" checked={showVoided} onChange={setShowVoided} />
              <Text type="secondary">Show voided</Text>
            </Space>
          </Col>
        </Row>

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table
            size="small"
            dataSource={txns}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200] }}
            scroll={{ x: 1100 }}
            rowClassName={(r) => r.deleted_at ? 'finance-voided-row' : ''}
            onRow={(r) => ({ onClick: (e) => {
              // ignore clicks on the action column
              if (e.target.closest('.ant-dropdown-trigger') || e.target.closest('.ant-btn')) return;
              setDetail(r);
            }, style: { cursor: 'pointer' } })}
          />
        )}
      </Card>

      <TransactionFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={refresh}
        mode="create"
        schoolCode={schoolCode}
        userId={userId}
        userRole={role}
      />
      <TransactionFormModal
        open={!!editTxn}
        onClose={() => setEditTxn(null)}
        onSuccess={refresh}
        mode="edit"
        txn={editTxn}
        schoolCode={schoolCode}
        userId={userId}
        userRole={role}
      />
      <MultiLineEntryDrawer
        open={showMulti}
        onClose={() => setShowMulti(false)}
        onSuccess={refresh}
        schoolCode={schoolCode}
        userId={userId}
        userRole={role}
      />
      <ImportDrawer
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={refresh}
        schoolCode={schoolCode}
        userId={userId}
        userRole={role}
      />
      <TransactionDetailDrawer
        open={!!detail}
        txn={detail}
        onClose={() => setDetail(null)}
        schoolCode={schoolCode}
        userId={userId}
        userRole={role}
        onChanged={refresh}
        onEdit={(t) => { setDetail(null); setEditTxn(t); }}
      />
    </div>
  );
}
