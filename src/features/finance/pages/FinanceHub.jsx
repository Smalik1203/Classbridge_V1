import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Statistic, Button, Space, Typography, Tag, Table, Empty,
  DatePicker, Skeleton, Alert, Segmented, Tooltip, App, Result,
} from 'antd';
import {
  PlusOutlined, ThunderboltOutlined, AccountBookOutlined, FilePdfOutlined,
  FileExcelOutlined, BarChartOutlined, WarningOutlined, ReloadOutlined,
  RiseOutlined, FallOutlined, BankOutlined, AppstoreOutlined, ImportOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import { useAuth } from '@/AuthProvider';
import { getUserRole, getSchoolName } from '@/shared/utils/metadata';
import {
  resolveSchoolCode, financeReportsService, financeTransactionsService,
  financeAuditService,
} from '../services/financeService';
import {
  exportTransactionsCSV, exportTransactionsXLSX, printSummaryReport,
} from '../services/financeExportService';
import TransactionFormModal      from '../components/TransactionFormModal';
import MultiLineEntryDrawer      from '../components/MultiLineEntryDrawer';
import TransactionDetailDrawer   from '../components/TransactionDetailDrawer';
import ImportDrawer              from '../components/ImportDrawer';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function moneyINR(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function FinanceHub() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const userId = user?.id;
  const schoolName = getSchoolName(user);
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [schoolCode, setSchoolCode] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [range, setRange]        = useState([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [chartMode, setChartMode] = useState('area');
  const [loading, setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary]    = useState(null);
  const [series, setSeries]      = useState([]);
  const [recent, setRecent]      = useState([]);
  const [inconsistencyCount, setInconsistencyCount] = useState(null);

  const [showCreate, setShowCreate]   = useState(false);
  const [showMulti, setShowMulti]     = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [detail, setDetail]           = useState(null);
  const [editTxn, setEditTxn]         = useState(null);

  const isReadOnly = role !== 'superadmin';
  const startDate = range[0].format('YYYY-MM-DD');
  const endDate   = range[1].format('YYYY-MM-DD');

  useEffect(() => {
    resolveSchoolCode(user)
      .then(setSchoolCode)
      .catch(err => setAccessError(err.message || 'Could not determine school'));
  }, [user]);

  const refresh = async () => {
    if (!schoolCode) return;
    setRefreshing(true);
    try {
      const [sm, sr, tx, inc] = await Promise.all([
        financeReportsService.incomeVsExpense({ schoolCode, startDate, endDate }),
        financeReportsService.dailySeries({ schoolCode, startDate, endDate }),
        financeTransactionsService.list({ schoolCode, startDate, endDate, limit: 8 }),
        financeAuditService.detectInconsistencies({ schoolCode, startDate, endDate }).catch(() => []),
      ]);
      setSummary(sm);
      setSeries(sr);
      setRecent(tx.data);
      setInconsistencyCount(inc.reduce((s, i) => s + Number(i.affected_count || 0), 0));
    } catch (err) {
      message.error(err.message || 'Failed to load finance data');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [schoolCode, startDate, endDate]);

  const recentColumns = useMemo(() => ([
    { title: 'Date', dataIndex: 'txn_date', width: 110, render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Type', dataIndex: 'type', width: 90,
      render: (v) => v === 'income' ? <Tag color="green">income</Tag> : <Tag color="red">expense</Tag> },
    { title: 'Category', dataIndex: ['category', 'name'], render: (v) => v || '—' },
    { title: 'Account', dataIndex: ['account', 'name'], render: (v) => v || '—' },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: (v) => v || <Text type="secondary">—</Text> },
    { title: 'Amount', dataIndex: 'amount', align: 'right', width: 130,
      render: (v, r) => (
        <Text strong style={{ color: r.type === 'income' ? '#10b981' : '#ef4444' }}>
          {r.type === 'income' ? '+' : '−'} ₹{moneyINR(v)}
        </Text>
      ) },
  ]), []);

  if (accessError) {
    return <Result status="warning" title="Cannot load Finance" subTitle={accessError}
             extra={<Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>} />;
  }

  if (loading && !summary) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Space direction="vertical" size={0}>
              <Title level={3} style={{ margin: 0 }}><AccountBookOutlined /> Finance</Title>
              <Text type="secondary">School general ledger — accounts, categories, transactions, reports.</Text>
            </Space>
          </Col>
          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space wrap>
              <RangePicker
                value={range}
                onChange={(v) => v && setRange(v)}
                allowClear={false}
                format="DD MMM YYYY"
                ranges={{
                  'This month':   [dayjs().startOf('month'), dayjs().endOf('month')],
                  'Last month':   [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
                  'Last 30 days': [dayjs().subtract(30, 'day'), dayjs()],
                  'This quarter': [dayjs().startOf('quarter'), dayjs().endOf('quarter')],
                  'This FY (Apr–Mar)': [
                    dayjs().month() < 3 ? dayjs().subtract(1, 'year').month(3).startOf('month') : dayjs().month(3).startOf('month'),
                    dayjs().month() < 3 ? dayjs().month(2).endOf('month') : dayjs().add(1, 'year').month(2).endOf('month'),
                  ],
                  'YTD':          [dayjs().startOf('year'), dayjs()],
                }}
              />
              <Tooltip title="Refresh">
                <Button icon={<ReloadOutlined />} loading={refreshing} onClick={refresh} />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {isReadOnly && (
        <Alert
          type="info" showIcon
          message="Read-only access — only super admins can post or edit finance transactions."
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total income" prefix="₹" precision={2}
              value={summary?.total_income || 0}
              valueStyle={{ color: '#10b981' }} />
            <Text type="secondary"><RiseOutlined /> {dayjs(startDate).format('DD MMM')} – {dayjs(endDate).format('DD MMM YYYY')}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total expense" prefix="₹" precision={2}
              value={summary?.total_expense || 0}
              valueStyle={{ color: '#ef4444' }} />
            <Text type="secondary"><FallOutlined /> in selected period</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Net" prefix="₹" precision={2}
              value={summary?.net_income || 0}
              valueStyle={{ color: (summary?.net_income || 0) >= 0 ? '#10b981' : '#ef4444' }} />
            <Text type="secondary">income minus expense</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => navigate('/finance/inconsistencies')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="Inconsistencies"
              value={inconsistencyCount ?? 0}
              valueStyle={{ color: (inconsistencyCount || 0) > 0 ? '#ef4444' : '#10b981' }}
              prefix={<WarningOutlined />} />
            <Text type="secondary">{(inconsistencyCount || 0) > 0 ? 'Click to review' : 'All clean'}</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title="Daily activity"
            extra={
              <Segmented
                options={[
                  { label: 'Trend', value: 'area' },
                  { label: 'Bars',  value: 'bar'  },
                ]}
                value={chartMode}
                onChange={setChartMode}
              />
            }
          >
            {series.length === 0 ? (
              <Empty description="No transactions in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                {chartMode === 'area' ? (
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('DD MMM')} />
                    <YAxis />
                    <RTooltip
                      formatter={(v) => `₹${moneyINR(v)}`}
                      labelFormatter={(l) => dayjs(l).format('DD MMM YYYY')}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="income"  name="Income"  stroke="#10b981" fill="url(#incomeFill)" />
                    <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="url(#expenseFill)" />
                  </AreaChart>
                ) : (
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('DD MMM')} />
                    <YAxis />
                    <RTooltip formatter={(v) => `₹${moneyINR(v)}`}
                      labelFormatter={(l) => dayjs(l).format('DD MMM YYYY')} />
                    <Legend />
                    <Bar dataKey="income"  name="Income"  fill="#10b981" />
                    <Bar dataKey="expense" name="Expense" fill="#ef4444" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Quick actions">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Button block type="primary" size="large" icon={<PlusOutlined />}
                disabled={isReadOnly} onClick={() => setShowCreate(true)}>
                New transaction
              </Button>
              <Button block size="large" icon={<ThunderboltOutlined />}
                disabled={isReadOnly} onClick={() => setShowMulti(true)}>
                Multi-line entry
              </Button>
              <Button block icon={<ImportOutlined />} disabled={isReadOnly}
                onClick={() => setShowImport(true)}>
                Import (CSV / XLSX)
              </Button>
              <Button block icon={<FileExcelOutlined />} onClick={async () => {
                try {
                  const res = await exportTransactionsXLSX({
                    schoolCode, startDate, endDate, userId, userRole: role,
                  });
                  message.success(`Exported ${res.count} rows`);
                } catch (err) { message.error(err.message); }
              }}>Export XLSX</Button>
              <Button block icon={<FileExcelOutlined />} onClick={async () => {
                try {
                  const res = await exportTransactionsCSV({
                    schoolCode, startDate, endDate, userId, userRole: role,
                  });
                  message.success(`Exported ${res.count} rows`);
                } catch (err) { message.error(err.message); }
              }}>Export CSV</Button>
              <Button block icon={<FilePdfOutlined />} onClick={async () => {
                try {
                  await printSummaryReport({
                    schoolCode, startDate, endDate, schoolName,
                    userId, userRole: role,
                  });
                } catch (err) { message.error(err.message); }
              }}>Print summary report</Button>
              <Button block icon={<BarChartOutlined />} onClick={() => navigate('/finance/reports')}>
                Open reports
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card hoverable onClick={() => navigate('/finance/transactions')}>
            <Space>
              <AppstoreOutlined style={{ fontSize: 22, color: '#6366f1' }} />
              <div>
                <Text strong>Transactions ledger</Text>
                <div><Text type="secondary">Search, filter, edit, void</Text></div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable onClick={() => navigate('/finance/accounts')}>
            <Space>
              <BankOutlined style={{ fontSize: 22, color: '#0ea5e9' }} />
              <div>
                <Text strong>Accounts & categories</Text>
                <div><Text type="secondary">Cash / bank / virtual + income/expense buckets</Text></div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable onClick={() => navigate('/finance/reports')}>
            <Space>
              <BarChartOutlined style={{ fontSize: 22, color: '#10b981' }} />
              <div>
                <Text strong>Reports</Text>
                <div><Text type="secondary">P&L · Trial balance · Account ledger · Monthly</Text></div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title="Recent activity"
        extra={<Link to="/finance/transactions">View all →</Link>}
      >
        {recent.length === 0 ? (
          <Empty description="No transactions yet" />
        ) : (
          <Table
            size="small"
            dataSource={recent}
            columns={recentColumns}
            rowKey="id"
            pagination={false}
            onRow={(r) => ({ onClick: () => setDetail(r), style: { cursor: 'pointer' } })}
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
