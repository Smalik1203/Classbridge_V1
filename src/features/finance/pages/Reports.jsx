import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Tabs, DatePicker, Button, Space, Typography, Row, Col, Statistic, Table,
  Tag, Empty, Select, App, Skeleton, Result, Tooltip, Segmented,
} from 'antd';
import {
  ReloadOutlined, FilePdfOutlined, FileExcelOutlined, BankOutlined,
  AppstoreOutlined, BarChartOutlined, ProfileOutlined, AccountBookOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, Legend, PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';
import { useAuth } from '@/AuthProvider';
import { getUserRole, getSchoolName } from '@/shared/utils/metadata';
import {
  resolveSchoolCode,
  financeReportsService,
  financeAccountsService,
  financeCategoriesService,
} from '../services/financeService';
import {
  printSummaryReport, printPnL, printTrialBalance, printAccountLedger,
} from '../services/financeExportService';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const COLORS = ['#10b981', '#0ea5e9', '#a855f7', '#f59e0b', '#ef4444', '#22c55e', '#6366f1', '#ec4899', '#14b8a6'];

function moneyINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function Reports() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const userId = user?.id;
  const schoolName = getSchoolName(user);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [schoolCode, setSchoolCode] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [tab, setTab] = useState(params.get('tab') || 'pnl');
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [compare, setCompare] = useState('none');

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pnl, setPnl] = useState(null);
  const [comparePnl, setComparePnl] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [trial, setTrial] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [ledgerAccount, setLedgerAccount] = useState(params.get('account') || null);
  const [categoryLedger, setCategoryLedger] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [loading, setLoading] = useState(false);

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
      if (!ledgerAccount && acc.length) setLedgerAccount(acc[0].id);
      if (!categoryFilter && cat.length) setCategoryFilter(cat[0].id);
    });
  }, [schoolCode]);

  useEffect(() => { setParams({ tab, ...(ledgerAccount ? { account: ledgerAccount } : {}) }, { replace: true }); /* eslint-disable-next-line */ }, [tab, ledgerAccount]);

  const compareRange = useMemo(() => {
    const days = range[1].diff(range[0], 'day') + 1;
    if (compare === 'prev_period') {
      return [range[0].subtract(days, 'day'), range[0].subtract(1, 'day')];
    }
    if (compare === 'prev_year') {
      return [range[0].subtract(1, 'year'), range[1].subtract(1, 'year')];
    }
    return null;
  }, [range, compare]);

  const refresh = async () => {
    if (!schoolCode) return;
    setLoading(true);
    try {
      if (tab === 'pnl' || tab === 'monthly') {
        const [p, m] = await Promise.all([
          financeReportsService.profitAndLoss({ schoolCode, startDate, endDate }),
          financeReportsService.monthlySummary({ schoolCode, startDate, endDate }),
        ]);
        setPnl(p); setMonthly(m);
        if (compareRange) {
          const cp = await financeReportsService.profitAndLoss({
            schoolCode,
            startDate: compareRange[0].format('YYYY-MM-DD'),
            endDate:   compareRange[1].format('YYYY-MM-DD'),
          });
          setComparePnl(cp);
        } else { setComparePnl(null); }
      }
      if (tab === 'trial') {
        const t = await financeReportsService.trialBalance({ schoolCode, startDate, endDate });
        setTrial(t);
      }
      if (tab === 'ledger' && ledgerAccount) {
        const l = await financeReportsService.accountLedger({ schoolCode, accountId: ledgerAccount, startDate, endDate });
        setLedger(l);
      }
      if (tab === 'category' && categoryFilter) {
        const c = await financeReportsService.categoryLedger({ schoolCode, categoryId: categoryFilter, startDate, endDate });
        setCategoryLedger(c);
      }
    } catch (err) {
      message.error(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ },
    [schoolCode, tab, startDate, endDate, ledgerAccount, categoryFilter, compare]);

  if (accessError) {
    return <Result status="warning" title="Cannot load Finance" subTitle={accessError}
             extra={<Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>} />;
  }

  // ── Tab content ─────────────────────────────────────────────────────────

  const renderPnL = () => {
    if (loading || !pnl) return <Skeleton active paragraph={{ rows: 8 }} />;
    const colsBase = (label) => [
      { title: 'Category', dataIndex: 'name', key: 'name' },
      { title: 'Txns', dataIndex: 'count', key: 'count', width: 80, align: 'center' },
      { title: label, dataIndex: 'total', key: 'total', width: 160, align: 'right',
        sorter: (a, b) => a.total - b.total,
        render: (v) => `₹${moneyINR(v)}` },
    ];
    const compareRows = (rows, compareRows) => {
      const idx = new Map((compareRows || []).map(r => [r.id, r]));
      return rows.map(r => ({ ...r, prev: idx.get(r.id)?.total || 0 }));
    };
    const incomeRows  = comparePnl ? compareRows(pnl.income,  comparePnl.income)  : pnl.income;
    const expenseRows = comparePnl ? compareRows(pnl.expense, comparePnl.expense) : pnl.expense;
    const compareCol = comparePnl ? [
      { title: 'Prev', dataIndex: 'prev', width: 130, align: 'right', render: (v) => `₹${moneyINR(v)}` },
      { title: 'Δ', width: 100, align: 'right',
        render: (_, r) => {
          const d = (r.total || 0) - (r.prev || 0);
          if (d === 0) return <Text type="secondary">—</Text>;
          return <Text style={{ color: d > 0 ? '#10b981' : '#ef4444' }}>{d > 0 ? '+' : ''}₹{moneyINR(d)}</Text>;
        } },
    ] : [];

    return (
      <>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}><Card><Statistic title="Total income"  value={pnl.total_income}  prefix="₹" precision={2} valueStyle={{ color: '#10b981' }} />{comparePnl && <Text type="secondary">vs ₹{moneyINR(comparePnl.total_income)}</Text>}</Card></Col>
          <Col xs={24} sm={8}><Card><Statistic title="Total expense" value={pnl.total_expense} prefix="₹" precision={2} valueStyle={{ color: '#ef4444' }} />{comparePnl && <Text type="secondary">vs ₹{moneyINR(comparePnl.total_expense)}</Text>}</Card></Col>
          <Col xs={24} sm={8}><Card><Statistic title="Net income"    value={pnl.net_income}    prefix="₹" precision={2} valueStyle={{ color: pnl.net_income >= 0 ? '#10b981' : '#ef4444' }} />{comparePnl && <Text type="secondary">vs ₹{moneyINR(comparePnl.net_income)}</Text>}</Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Income by category">
              {pnl.income.length === 0 ? <Empty /> : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pnl.income} dataKey="total" nameKey="name" outerRadius={80} label>
                        {pnl.income.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <RTooltip formatter={(v) => `₹${moneyINR(v)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Table size="small" dataSource={incomeRows} columns={[...colsBase('Total'), ...compareCol]}
                    rowKey="id" pagination={false}
                    summary={(rows) => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell><Text strong>Total</Text></Table.Summary.Cell>
                        <Table.Summary.Cell />
                        <Table.Summary.Cell align="right"><Text strong style={{ color: '#10b981' }}>₹{moneyINR(pnl.total_income)}</Text></Table.Summary.Cell>
                        {comparePnl && <Table.Summary.Cell align="right"><Text strong>₹{moneyINR(comparePnl.total_income)}</Text></Table.Summary.Cell>}
                        {comparePnl && <Table.Summary.Cell />}
                      </Table.Summary.Row>
                    )} />
                </>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Expense by category">
              {pnl.expense.length === 0 ? <Empty /> : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pnl.expense} dataKey="total" nameKey="name" outerRadius={80} label>
                        {pnl.expense.map((_, i) => <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />)}
                      </Pie>
                      <RTooltip formatter={(v) => `₹${moneyINR(v)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Table size="small" dataSource={expenseRows} columns={[...colsBase('Total'), ...compareCol]}
                    rowKey="id" pagination={false}
                    summary={() => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell><Text strong>Total</Text></Table.Summary.Cell>
                        <Table.Summary.Cell />
                        <Table.Summary.Cell align="right"><Text strong style={{ color: '#ef4444' }}>₹{moneyINR(pnl.total_expense)}</Text></Table.Summary.Cell>
                        {comparePnl && <Table.Summary.Cell align="right"><Text strong>₹{moneyINR(comparePnl.total_expense)}</Text></Table.Summary.Cell>}
                        {comparePnl && <Table.Summary.Cell />}
                      </Table.Summary.Row>
                    )} />
                </>
              )}
            </Card>
          </Col>
        </Row>
      </>
    );
  };

  const renderMonthly = () => {
    if (loading) return <Skeleton active paragraph={{ rows: 6 }} />;
    if (!monthly.length) return <Empty description="No transactions in this period" />;
    return (
      <>
        <Card style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={(v) => dayjs(v + '-01').format('MMM YY')} />
              <YAxis />
              <RTooltip formatter={(v) => `₹${moneyINR(v)}`} labelFormatter={(l) => dayjs(l + '-01').format('MMMM YYYY')} />
              <Legend />
              <Bar dataKey="total_income"  name="Income"  fill="#10b981" />
              <Bar dataKey="total_expense" name="Expense" fill="#ef4444" />
              <Line type="monotone" dataKey="net_income" name="Net" stroke="#6366f1" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <Table
            size="small"
            dataSource={monthly}
            rowKey="month"
            pagination={false}
            columns={[
              { title: 'Month',     dataIndex: 'month', render: (v) => dayjs(v + '-01').format('MMMM YYYY') },
              { title: 'Income',    dataIndex: 'total_income',  align: 'right', render: (v) => <Text style={{ color: '#10b981' }}>₹{moneyINR(v)}</Text> },
              { title: 'Expense',   dataIndex: 'total_expense', align: 'right', render: (v) => <Text style={{ color: '#ef4444' }}>₹{moneyINR(v)}</Text> },
              { title: 'Net',       dataIndex: 'net_income', align: 'right', render: (v) => <Text strong style={{ color: v >= 0 ? '#10b981' : '#ef4444' }}>₹{moneyINR(Math.abs(v))}</Text> },
              { title: 'Txns',      dataIndex: 'transaction_count', align: 'center', width: 90 },
            ]}
          />
        </Card>
      </>
    );
  };

  const renderTrial = () => {
    if (loading) return <Skeleton active paragraph={{ rows: 6 }} />;
    if (!trial.length) return <Empty description="No accounts to show" />;
    return (
      <Card>
        <Table
          size="small"
          dataSource={trial}
          rowKey="account_id"
          pagination={false}
          columns={[
            { title: 'Account', dataIndex: 'account_name',
              render: (v, r) => (
                <a onClick={() => { setLedgerAccount(r.account_id); setTab('ledger'); }}>{v}</a>
              ) },
            { title: 'Type', dataIndex: 'account_type', width: 110,
              render: (v) => <Tag color={v === 'cash' ? 'green' : v === 'bank' ? 'blue' : 'purple'}>{v}</Tag> },
            { title: 'Opening',  dataIndex: 'opening',  align: 'right', render: (v) => `₹${moneyINR(v)}` },
            { title: 'Income',   dataIndex: 'income',   align: 'right', render: (v) => <Text style={{ color: '#10b981' }}>₹{moneyINR(v)}</Text> },
            { title: 'Expense',  dataIndex: 'expense',  align: 'right', render: (v) => <Text style={{ color: '#ef4444' }}>₹{moneyINR(v)}</Text> },
            { title: 'Closing',  dataIndex: 'closing',  align: 'right',
              render: (v) => <Text strong style={{ color: v >= 0 ? '#10b981' : '#ef4444' }}>₹{moneyINR(Math.abs(v))}{v < 0 ? ' (Cr)' : ''}</Text> },
          ]}
          summary={(rows) => {
            const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell><Text strong>Totals</Text></Table.Summary.Cell>
                <Table.Summary.Cell />
                <Table.Summary.Cell align="right"><Text strong>₹{moneyINR(sum('opening'))}</Text></Table.Summary.Cell>
                <Table.Summary.Cell align="right"><Text strong style={{ color: '#10b981' }}>₹{moneyINR(sum('income'))}</Text></Table.Summary.Cell>
                <Table.Summary.Cell align="right"><Text strong style={{ color: '#ef4444' }}>₹{moneyINR(sum('expense'))}</Text></Table.Summary.Cell>
                <Table.Summary.Cell align="right"><Text strong>₹{moneyINR(sum('closing'))}</Text></Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Card>
    );
  };

  const renderLedger = () => {
    if (loading || !ledger) return <Skeleton active paragraph={{ rows: 8 }} />;
    const account = accounts.find(a => a.id === ledgerAccount);
    return (
      <>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card><Statistic title="Opening balance" value={ledger.opening_balance} prefix="₹" precision={2} /></Card>
          </Col>
          <Col xs={24} md={8}>
            <Card><Statistic title="Movements" value={ledger.lines.length} suffix="lines" /></Card>
          </Col>
          <Col xs={24} md={8}>
            <Card><Statistic title="Closing balance" value={ledger.closing_balance} prefix="₹" precision={2}
              valueStyle={{ color: ledger.closing_balance >= 0 ? '#10b981' : '#ef4444' }} /></Card>
          </Col>
        </Row>
        <Card title={<Space><BankOutlined />{account?.name || 'Account'} ledger</Space>}>
          <Table
            size="small"
            dataSource={ledger.lines}
            rowKey="id"
            pagination={{ pageSize: 50 }}
            columns={[
              { title: 'Date', dataIndex: 'txn_date', width: 110, render: (v) => dayjs(v).format('DD MMM YYYY') },
              { title: 'Description', dataIndex: 'description', ellipsis: true, render: (v) => v || <Text type="secondary">—</Text> },
              { title: 'Category', dataIndex: ['category', 'name'], width: 160 },
              { title: 'Debit',   dataIndex: 'amount', width: 130, align: 'right',
                render: (_, r) => r.type === 'income'  ? <Text style={{ color: '#10b981' }}>₹{moneyINR(r.amount)}</Text> : '' },
              { title: 'Credit',  dataIndex: 'amount', width: 130, align: 'right',
                render: (_, r) => r.type === 'expense' ? <Text style={{ color: '#ef4444' }}>₹{moneyINR(r.amount)}</Text> : '' },
              { title: 'Running balance', dataIndex: 'running_balance', width: 160, align: 'right',
                render: (v) => <Text strong style={{ color: v >= 0 ? '#10b981' : '#ef4444' }}>₹{moneyINR(Math.abs(v))}</Text> },
            ]}
          />
        </Card>
      </>
    );
  };

  const renderCategoryLedger = () => {
    if (loading || !categoryLedger) return <Skeleton active paragraph={{ rows: 6 }} />;
    return (
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col><Card><Statistic title="Total" value={categoryLedger.total} prefix="₹" precision={2} /></Card></Col>
          <Col><Card><Statistic title="Lines" value={categoryLedger.lines.length} /></Card></Col>
        </Row>
        <Card>
          <Table
            size="small"
            dataSource={categoryLedger.lines}
            rowKey="id"
            pagination={{ pageSize: 50 }}
            columns={[
              { title: 'Date', dataIndex: 'txn_date', width: 110, render: (v) => dayjs(v).format('DD MMM YYYY') },
              { title: 'Account', dataIndex: ['account', 'name'], width: 160 },
              { title: 'Description', dataIndex: 'description', ellipsis: true, render: (v) => v || <Text type="secondary">—</Text> },
              { title: 'Amount', dataIndex: 'amount', width: 140, align: 'right',
                render: (v, r) => <Text strong style={{ color: r.type === 'income' ? '#10b981' : '#ef4444' }}>{r.type === 'income' ? '+' : '−'}₹{moneyINR(v)}</Text> },
            ]}
          />
        </Card>
      </>
    );
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ margin: 0 }}>Reports</Title>
            <Text type="secondary">Profit & Loss · Monthly breakdown · Trial balance · Account & category ledgers.</Text>
          </Col>
          <Col>
            <Space wrap>
              <RangePicker value={range} onChange={(v) => v && setRange(v)} allowClear={false} format="DD MMM YYYY"
                ranges={{
                  'This month':  [dayjs().startOf('month'), dayjs().endOf('month')],
                  'Last month':  [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
                  'This quarter':[dayjs().startOf('quarter'), dayjs().endOf('quarter')],
                  'This FY':     [
                    dayjs().month() < 3 ? dayjs().subtract(1, 'year').month(3).startOf('month') : dayjs().month(3).startOf('month'),
                    dayjs().month() < 3 ? dayjs().month(2).endOf('month') : dayjs().add(1, 'year').month(2).endOf('month'),
                  ],
                  'YTD':         [dayjs().startOf('year'), dayjs()],
                }}
              />
              {(tab === 'pnl' || tab === 'monthly') && (
                <Segmented
                  options={[
                    { label: 'No compare', value: 'none' },
                    { label: 'Prev period', value: 'prev_period' },
                    { label: 'Prev year',   value: 'prev_year'   },
                  ]}
                  value={compare}
                  onChange={setCompare}
                />
              )}
              <Tooltip title="Refresh"><Button icon={<ReloadOutlined />} loading={loading} onClick={refresh} /></Tooltip>
              <Button icon={<FilePdfOutlined />} onClick={async () => {
                try {
                  if (tab === 'pnl')      await printPnL          ({ schoolCode, startDate, endDate, schoolName, userId, userRole: role });
                  else if (tab === 'trial')  await printTrialBalance({ schoolCode, startDate, endDate, schoolName, userId, userRole: role });
                  else if (tab === 'ledger' && ledgerAccount) {
                    const acc = accounts.find(a => a.id === ledgerAccount);
                    await printAccountLedger({ schoolCode, accountId: ledgerAccount, accountName: acc?.name || 'Account', startDate, endDate, schoolName, userId, userRole: role });
                  } else {
                    await printSummaryReport({ schoolCode, startDate, endDate, schoolName, userId, userRole: role });
                  }
                } catch (e) { message.error(e.message); }
              }}>Print</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'pnl',      label: <Space><ProfileOutlined />P&L</Space>,                    children: renderPnL() },
            { key: 'monthly',  label: <Space><BarChartOutlined />Monthly</Space>,               children: renderMonthly() },
            { key: 'trial',    label: <Space><AccountBookOutlined />Trial balance</Space>,      children: renderTrial() },
            { key: 'ledger',   label: <Space><BankOutlined />Account ledger</Space>,
              children: (
                <>
                  <Card style={{ marginBottom: 16 }}>
                    <Space>
                      <Text strong>Account:</Text>
                      <Select
                        value={ledgerAccount} onChange={setLedgerAccount}
                        showSearch optionFilterProp="label" style={{ minWidth: 280 }}
                        options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.type})` }))}
                      />
                    </Space>
                  </Card>
                  {renderLedger()}
                </>
              ) },
            { key: 'category', label: <Space><AppstoreOutlined />Category ledger</Space>,
              children: (
                <>
                  <Card style={{ marginBottom: 16 }}>
                    <Space>
                      <Text strong>Category:</Text>
                      <Select
                        value={categoryFilter} onChange={setCategoryFilter}
                        showSearch optionFilterProp="label" style={{ minWidth: 280 }}
                        options={categories.map(c => ({ value: c.id, label: `${c.name} (${c.type})` }))}
                      />
                    </Space>
                  </Card>
                  {renderCategoryLedger()}
                </>
              ) },
          ]}
        />
      </Card>
    </div>
  );
}
