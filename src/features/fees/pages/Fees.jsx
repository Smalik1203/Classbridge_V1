import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Tabs, Select, Button, Space, Tag, Empty, message, Typography,
  Segmented, Divider, Tooltip,
} from 'antd';
import {
  BankOutlined, PlusOutlined, ThunderboltOutlined, MailOutlined, ReloadOutlined,
  DownloadOutlined, BellOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getUserRole, getSchoolCode } from '@/shared/utils/metadata';
import { FeesProvider, useFees } from '../context/FeesContext';
import {
  getByClass, getAllForSchool, summariseInvoices, ageReceivables, sendPaymentReminder,
} from '../services/feesService';
import { fmtRupees, fmtRupeesCompact } from '../utils/money';
import { kpiTone, TONES } from '@/shared/components/kpiTone';
import InvoiceTable from '../components/InvoiceTable';
import InvoiceDetailDrawer from '../components/InvoiceDetailDrawer';
import PaymentDrawer from '../components/PaymentDrawer';
import GenerateInvoicesDrawer from '../components/GenerateInvoicesDrawer';
import CreateInvoiceDrawer from '../components/CreateInvoiceDrawer';
import InvoiceDocumentViewer from '../components/InvoiceDocumentViewer';
import BulkRemindersDrawer from '../components/BulkRemindersDrawer';
import StudentFees from '../components/StudentFees';
import FeeAnalytics from '../components/FeeAnalytics';

const { Title, Text } = Typography;

function FeesHub() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const { schoolCode, academicYear, classes, refresh: refreshContext } = useFees();

  const [scope, setScope] = useState('all'); // 'all' | 'class'
  const [classId, setClassId] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('invoices');

  const [selectedKeys, setSelectedKeys] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [docInvoiceId, setDocInvoiceId] = useState(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkRemindersOpen, setBulkRemindersOpen] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!schoolCode) return;
    setLoading(true);
    try {
      let rows;
      if (scope === 'class' && classId) {
        rows = await getByClass(classId, schoolCode, academicYear?.id);
      } else {
        rows = await getAllForSchool(schoolCode, academicYear?.id);
      }
      setInvoices(rows || []);
    } catch (err) {
      message.error(err?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [schoolCode, scope, classId, academicYear?.id]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const summary = useMemo(() => summariseInvoices(invoices), [invoices]);
  const aging = useMemo(() => ageReceivables(invoices), [invoices]);

  const selectedInvoices = useMemo(
    () => (invoices || []).filter((inv) => selectedKeys.includes(inv.id)),
    [invoices, selectedKeys],
  );

  const overdueInvoices = useMemo(
    () => (invoices || []).filter((inv) => {
      const balance = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
      return balance > 0 && inv.due_date && dayjs(inv.due_date).isBefore(dayjs(), 'day');
    }),
    [invoices],
  );

  const handleExportCsv = () => {
    if (!invoices.length) {
      message.info('Nothing to export');
      return;
    }
    const rows = invoices.map((inv) => {
      const balance = Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0));
      return {
        Student: inv.student?.full_name || '',
        'Student code': inv.student?.student_code || '',
        Period: inv.billing_period || '',
        'Due date': inv.due_date || '',
        Total: Number(inv.total_amount || 0),
        Paid: Number(inv.paid_amount || 0),
        Balance: balance,
        Status: inv.status || '',
        'Created at': inv.created_at || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `fee_invoices_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const handleQuickReminder = async (invoice) => {
    try {
      await sendPaymentReminder(invoice.id);
      message.success(`Reminder sent to ${invoice.student?.full_name || 'student'}`);
    } catch (err) {
      message.error(err?.message || 'Failed to send reminder');
    }
  };

  const refreshAll = () => {
    setSelectedKeys([]);
    loadInvoices();
  };

  if (!schoolCode) {
    return <Empty description="No school context. Please re-login." />;
  }

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={4} style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BankOutlined /> Fee Management
            </Title>
            {academicYear && (
              <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
                Academic Year {academicYear.year_start}–{academicYear.year_end}
              </Text>
            )}
          </div>
          <Space wrap>
            <Button icon={<PlusOutlined />} type="default" onClick={() => setCreateOpen(true)}>
              New invoice
            </Button>
            <Button icon={<ThunderboltOutlined />} type="primary" onClick={() => setGenerateOpen(true)}>
              Generate for class
            </Button>
          </Space>
        </div>
      </Card>

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Invoices" value={summary.invoiceCount} />
            <Text type="secondary">
              {summary.paidCount} paid · {summary.partialCount} partial · {summary.dueCount} pending
            </Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Total billed" value={fmtRupeesCompact(summary.total)} />
            <Text type="secondary">{fmtRupees(summary.total)}</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Collected"
              value={fmtRupeesCompact(summary.collected)}
              valueStyle={{ color: '#3f8600' }}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>{summary.collectionRate.toFixed(1)}%</Text>}
            />
            <Text type="secondary">{fmtRupees(summary.collected)}</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Outstanding"
              value={fmtRupeesCompact(summary.outstanding)}
              // Outstanding only colors when it's actually owed AND overdue.
              // A non-zero balance with zero overdue invoices is just normal billing in flight.
              valueStyle={{ color: kpiTone(summary.overdueCount, () => 'critical') }}
            />
            <Text type="secondary">{summary.overdueCount} overdue</Text>
          </Card>
        </Col>
      </Row>

      {/* Aged-receivables card */}
      <Card size="small" style={{ marginBottom: 16 }} title="Aged receivables">
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} md={4}>
            <Statistic title="Not yet due" value={fmtRupeesCompact(aging.current)} />
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Statistic title="0–30 days overdue" value={fmtRupeesCompact(aging.b0_30)}
              valueStyle={{ color: kpiTone(aging.b0_30, TONES.agingBucket('0-30')) }} />
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Statistic title="31–60 days" value={fmtRupeesCompact(aging.b31_60)}
              valueStyle={{ color: kpiTone(aging.b31_60, TONES.agingBucket('31-60')) }} />
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Statistic title="61–90 days" value={fmtRupeesCompact(aging.b61_90)}
              valueStyle={{ color: kpiTone(aging.b61_90, TONES.agingBucket('61-90')) }} />
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Statistic title="90+ days" value={fmtRupeesCompact(aging.b90_plus)}
              valueStyle={{ color: kpiTone(aging.b90_plus, TONES.agingBucket('90+')) }} />
          </Col>
        </Row>
      </Card>

      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Segmented
            value={scope}
            onChange={(v) => { setScope(v); if (v === 'all') setClassId(null); }}
            options={[{ value: 'all', label: 'All classes' }, { value: 'class', label: 'By class' }]}
          />
          {scope === 'class' && (
            <Select
              placeholder="Select class"
              style={{ width: 280 }}
              value={classId || undefined}
              onChange={setClassId}
              allowClear
              showSearch
              optionFilterProp="label"
              options={(classes || []).map((c) => ({
                value: c.id,
                label: `Grade ${c.grade ?? '-'}${c.section ? ` ${c.section}` : ''}`,
              }))}
            />
          )}
          <Button icon={<ReloadOutlined />} onClick={() => { refreshContext(); loadInvoices(); }}>Refresh</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>Export</Button>
          <Tooltip title="Pick rows in the table to enable">
            <Button
              icon={<MailOutlined />}
              disabled={selectedInvoices.length === 0}
              onClick={() => setBulkRemindersOpen(true)}
            >
              {selectedInvoices.length > 0 ? `Bulk reminders (${selectedInvoices.length})` : 'Bulk reminders'}
            </Button>
          </Tooltip>
          {overdueInvoices.length > 0 && (
            <Button
              danger
              icon={<BellOutlined />}
              onClick={() => {
                setSelectedKeys(overdueInvoices.map((i) => i.id));
                setBulkRemindersOpen(true);
              }}
            >
              Remind all overdue ({overdueInvoices.length})
            </Button>
          )}
        </Space>

        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'invoices',
              label: 'Invoices',
              children: (
                <InvoiceTable
                  data={invoices}
                  loading={loading}
                  selectedKeys={selectedKeys}
                  onSelectChange={setSelectedKeys}
                  onOpenDetail={(r) => setDetailId(r.id)}
                  onRecordPayment={(r) => setPaymentInvoice(r)}
                  onViewDocument={(r) => setDocInvoiceId(r.id)}
                  onSendReminder={handleQuickReminder}
                />
              ),
            },
            {
              key: 'analytics',
              label: 'Analytics',
              children: <FeeAnalytics invoices={invoices} />,
            },
          ]}
        />
      </Card>

      <InvoiceDetailDrawer
        open={!!detailId}
        invoiceId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={refreshAll}
      />
      <PaymentDrawer
        open={!!paymentInvoice}
        invoice={paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        onPaymentRecorded={refreshAll}
      />
      <InvoiceDocumentViewer
        open={!!docInvoiceId}
        invoiceId={docInvoiceId}
        onClose={() => setDocInvoiceId(null)}
      />
      <GenerateInvoicesDrawer
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        classes={classes}
        academicYear={academicYear}
        schoolCode={schoolCode}
        defaultClassId={scope === 'class' ? classId : null}
        onGenerated={refreshAll}
      />
      <CreateInvoiceDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        classes={classes}
        academicYear={academicYear}
        schoolCode={schoolCode}
        onCreated={refreshAll}
      />
      <BulkRemindersDrawer
        open={bulkRemindersOpen}
        onClose={() => setBulkRemindersOpen(false)}
        invoices={selectedInvoices.length ? selectedInvoices : overdueInvoices}
      />
    </div>
  );
}

export default function Fees() {
  const { user } = useAuth();
  const role = getUserRole(user);
  if (role === 'student') {
    return <StudentFees />;
  }
  return (
    <FeesProvider>
      <FeesHub />
    </FeesProvider>
  );
}
