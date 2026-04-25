import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Tabs, Table, Button, Space, Typography, Tag, Input, Select, Switch,
  App, Result, Skeleton, Tooltip, Empty, Statistic, Row, Col, Dropdown,
} from 'antd';
import {
  PlusOutlined, EditOutlined, EyeOutlined, ReloadOutlined, SearchOutlined,
  BankOutlined, AppstoreOutlined, MoreOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthProvider';
import { getUserRole } from '@/shared/utils/metadata';
import {
  resolveSchoolCode,
  financeAccountsService,
  financeCategoriesService,
  financeReportsService,
} from '../services/financeService';
import AccountFormModal  from '../components/AccountFormModal';
import CategoryFormModal from '../components/CategoryFormModal';

const { Text, Title } = Typography;

function moneyINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function AccountsCategories() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const userId = user?.id;
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [schoolCode, setSchoolCode] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [tab, setTab]               = useState('accounts');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [accounts, setAccounts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [trialBalance, setTrialBalance] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [accountForm, setAccountForm]   = useState({ open: false, mode: 'create', account: null });
  const [categoryForm, setCategoryForm] = useState({ open: false, mode: 'create', category: null, defaultType: 'expense' });

  const isReadOnly = role !== 'superadmin';

  useEffect(() => {
    resolveSchoolCode(user)
      .then(setSchoolCode)
      .catch(err => setAccessError(err.message || 'Could not determine school'));
  }, [user]);

  const refresh = async () => {
    if (!schoolCode) return;
    setRefreshing(true);
    try {
      const [acc, cat, tb] = await Promise.all([
        financeAccountsService.list(schoolCode, { includeInactive: true }),
        financeCategoriesService.list(schoolCode, { includeInactive: true }),
        financeReportsService.trialBalance({
          schoolCode,
          startDate: '1900-01-01',
          endDate:   '2999-12-31',
        }).catch(() => []),
      ]);
      setAccounts(acc);
      setCategories(cat);
      setTrialBalance(tb);
    } catch (err) {
      message.error(err.message || 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [schoolCode]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (!showInactive && !a.is_active) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [accounts, showInactive, typeFilter, search]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      if (!showInactive && !c.is_active) return false;
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [categories, showInactive, typeFilter, search]);

  const tbByAccount = useMemo(() => {
    const m = new Map();
    trialBalance.forEach(r => m.set(r.account_id, r));
    return m;
  }, [trialBalance]);

  const accountColumns = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, r) => (
        <Space>
          <Text strong style={{ color: r.is_active ? undefined : '#94a3b8' }}>{v}</Text>
          {!r.is_active && <Tag>inactive</Tag>}
        </Space>
      )},
    { title: 'Type', dataIndex: 'type', width: 120,
      filters: [
        { text: 'Cash', value: 'cash' }, { text: 'Bank', value: 'bank' }, { text: 'Virtual', value: 'virtual' },
      ],
      onFilter: (val, r) => r.type === val,
      render: (v) => <Tag color={v === 'cash' ? 'green' : v === 'bank' ? 'blue' : 'purple'}>{v}</Tag> },
    { title: 'Closing balance', width: 180, align: 'right',
      sorter: (a, b) => (tbByAccount.get(a.id)?.closing || 0) - (tbByAccount.get(b.id)?.closing || 0),
      render: (_, r) => {
        const tb = tbByAccount.get(r.id);
        if (!tb) return <Text type="secondary">—</Text>;
        const v = tb.closing;
        return <Text strong style={{ color: v >= 0 ? '#10b981' : '#ef4444' }}>₹{moneyINR(Math.abs(v))}{v < 0 ? ' (Cr)' : ''}</Text>;
      } },
    { title: 'Activity', width: 180, align: 'right',
      render: (_, r) => {
        const tb = tbByAccount.get(r.id);
        if (!tb) return null;
        return (
          <Space size={4}>
            <Tag color="green">+₹{moneyINR(tb.income)}</Tag>
            <Tag color="red">−₹{moneyINR(tb.expense)}</Tag>
          </Space>
        );
      } },
    { title: '', width: 60, fixed: 'right',
      render: (_, r) => {
        const items = [
          { key: 'ledger', icon: <EyeOutlined />, label: 'View ledger',
            onClick: () => navigate(`/finance/reports?tab=ledger&account=${r.id}`) },
        ];
        if (!isReadOnly) {
          items.push({ key: 'edit', icon: <EditOutlined />, label: 'Edit',
            onClick: () => setAccountForm({ open: true, mode: 'edit', account: r }) });
        }
        return <Dropdown menu={{ items }}><Button type="text" icon={<MoreOutlined />} /></Dropdown>;
      } },
  ];

  const categoryColumns = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, r) => (
        <Space>
          <Text strong style={{ color: r.is_active ? undefined : '#94a3b8' }}>{v}</Text>
          {!r.is_active && <Tag>inactive</Tag>}
        </Space>
      )},
    { title: 'Type', dataIndex: 'type', width: 120,
      filters: [{ text: 'Income', value: 'income' }, { text: 'Expense', value: 'expense' }],
      onFilter: (val, r) => r.type === val,
      render: (v) => <Tag color={v === 'income' ? 'green' : 'red'}>{v}</Tag> },
    { title: 'Created', dataIndex: 'created_at', width: 140,
      render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
    { title: '', width: 60, fixed: 'right',
      render: (_, r) => {
        const items = [
          { key: 'ledger', icon: <EyeOutlined />, label: 'View activity',
            onClick: () => navigate(`/finance/transactions?category=${r.id}`) },
        ];
        if (!isReadOnly) {
          items.push({ key: 'edit', icon: <EditOutlined />, label: 'Edit',
            onClick: () => setCategoryForm({ open: true, mode: 'edit', category: r, defaultType: r.type }) });
        }
        return <Dropdown menu={{ items }}><Button type="text" icon={<MoreOutlined />} /></Dropdown>;
      } },
  ];

  if (accessError) {
    return <Result status="warning" title="Cannot load Finance" subTitle={accessError}
             extra={<Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>} />;
  }

  const accountSummary = useMemo(() => {
    const totalCash    = accounts.filter(a => a.type === 'cash'    && a.is_active).length;
    const totalBank    = accounts.filter(a => a.type === 'bank'    && a.is_active).length;
    const totalVirtual = accounts.filter(a => a.type === 'virtual' && a.is_active).length;
    const totalCash$  = trialBalance.filter(t => accounts.find(a => a.id === t.account_id)?.type === 'cash').reduce((s, r) => s + r.closing, 0);
    const totalBank$  = trialBalance.filter(t => accounts.find(a => a.id === t.account_id)?.type === 'bank').reduce((s, r) => s + r.closing, 0);
    const totalVirt$  = trialBalance.filter(t => accounts.find(a => a.id === t.account_id)?.type === 'virtual').reduce((s, r) => s + r.closing, 0);
    return {
      totalCash, totalBank, totalVirtual,
      totalCashAmt: totalCash$, totalBankAmt: totalBank$, totalVirtAmt: totalVirt$,
      totalAmt: totalCash$ + totalBank$ + totalVirt$,
    };
  }, [accounts, trialBalance]);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ margin: 0 }}>Accounts & categories</Title>
            <Text type="secondary">The chart of accounts and the income/expense buckets that classify every transaction.</Text>
          </Col>
          <Col>
            <Space wrap>
              <Tooltip title="Refresh"><Button icon={<ReloadOutlined />} loading={refreshing} onClick={refresh} /></Tooltip>
              {tab === 'accounts' && (
                <Button type="primary" icon={<PlusOutlined />} disabled={isReadOnly}
                  onClick={() => setAccountForm({ open: true, mode: 'create', account: null })}>
                  New account
                </Button>
              )}
              {tab === 'categories' && (
                <Button type="primary" icon={<PlusOutlined />} disabled={isReadOnly}
                  onClick={() => setCategoryForm({ open: true, mode: 'create', category: null, defaultType: 'expense' })}>
                  New category
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {tab === 'accounts' && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card><Statistic title="Cash on hand" value={accountSummary.totalCashAmt} prefix="₹" precision={2}
              valueStyle={{ color: '#10b981' }} /><Text type="secondary">{accountSummary.totalCash} account(s)</Text></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title="Bank balance" value={accountSummary.totalBankAmt} prefix="₹" precision={2}
              valueStyle={{ color: '#0ea5e9' }} /><Text type="secondary">{accountSummary.totalBank} account(s)</Text></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title="Virtual / UPI" value={accountSummary.totalVirtAmt} prefix="₹" precision={2}
              valueStyle={{ color: '#a855f7' }} /><Text type="secondary">{accountSummary.totalVirtual} account(s)</Text></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title="Total liquidity" value={accountSummary.totalAmt} prefix="₹" precision={2} /></Card>
          </Col>
        </Row>
      )}

      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          tabBarExtraContent={
            <Space>
              <Input prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…" allowClear style={{ width: 200 }} />
              <Select
                value={typeFilter} onChange={setTypeFilter} style={{ width: 140 }}
                options={tab === 'accounts'
                  ? [{ value: 'all', label: 'All types' }, { value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }, { value: 'virtual', label: 'Virtual' }]
                  : [{ value: 'all', label: 'All types' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]
                }
              />
              <Space size={4}><Switch size="small" checked={showInactive} onChange={setShowInactive} /><Text type="secondary">Inactive</Text></Space>
            </Space>
          }
          items={[
            { key: 'accounts', label: <Space><BankOutlined />Accounts ({filteredAccounts.length})</Space>,
              children: loading
                ? <Skeleton active paragraph={{ rows: 6 }} />
                : filteredAccounts.length === 0
                  ? <Empty description="No accounts. Click 'New account' to create one (or post a fee to auto-create Cash / Bank Account / UPI)." />
                  : <Table size="small" dataSource={filteredAccounts} columns={accountColumns} rowKey="id" pagination={{ pageSize: 50 }} /> },
            { key: 'categories', label: <Space><AppstoreOutlined />Categories ({filteredCategories.length})</Space>,
              children: loading
                ? <Skeleton active paragraph={{ rows: 6 }} />
                : filteredCategories.length === 0
                  ? <Empty description="No categories. Click 'New category' to create one (or post a fee — a 'Fees' income category is auto-created)." />
                  : <Table size="small" dataSource={filteredCategories} columns={categoryColumns} rowKey="id" pagination={{ pageSize: 50 }} /> },
          ]}
        />
      </Card>

      <AccountFormModal
        open={accountForm.open}
        mode={accountForm.mode}
        account={accountForm.account}
        onClose={() => setAccountForm({ ...accountForm, open: false })}
        onSuccess={refresh}
        schoolCode={schoolCode} userId={userId} userRole={role}
      />
      <CategoryFormModal
        open={categoryForm.open}
        mode={categoryForm.mode}
        category={categoryForm.category}
        defaultType={categoryForm.defaultType}
        onClose={() => setCategoryForm({ ...categoryForm, open: false })}
        onSuccess={refresh}
        schoolCode={schoolCode} userId={userId} userRole={role}
      />
    </div>
  );
}
