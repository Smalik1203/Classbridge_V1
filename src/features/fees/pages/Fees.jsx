import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Empty, Button, Spin, message, Tabs, Modal, Progress, Tag, List, Select,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DownloadOutlined, BellOutlined, MailOutlined,
  WalletOutlined, FileTextOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getUserRole } from '@/shared/utils/metadata';
import { FeesProvider, useFees } from '../context/FeesContext';
import {
  getAllForSchool, summariseInvoices, sendPaymentReminder,
} from '../services/feesService';
import { supabase } from '@/config/supabaseClient';
import { fmtRupees, fmtRupeesCompact } from '../utils/money';

import InvoiceTable from '../components/InvoiceTable';
import InvoiceSidePanel from '../components/InvoiceSidePanel';
import NewInvoicePanel from '../components/NewInvoicePanel';
import CollectMode from '../components/CollectMode';
import StudentFees from '../components/StudentFees';

/* ─── Tiny KPI tile ─────────────────────────────────────────────────────── */
function KpiTile({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      flex: 1,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      minWidth: 180,
    }}>
      {icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: accent ? `${accent}15` : '#eff6ff',
          color: accent || '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>{icon}</div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: '#94a3b8', fontWeight: 600,
        }}>{label}</div>
        <div style={{
          fontSize: 20, fontWeight: 700, color: '#0f172a',
          fontVariantNumeric: 'tabular-nums', marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{value}</div>
        {sub && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Main hub ──────────────────────────────────────────────────────────── */
function FeesHub() {
  const {
    schoolCode, academicYear, classes, refresh: refreshContext,
    academicYears, selectedAcademicYearId, setSelectedAcademicYearId,
    activeAcademicYear,
  } = useFees();

  const [invoices, setInvoices] = useState([]);
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('collect');

  const [selectedKeys, setSelectedKeys] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkRemindersOpen, setBulkRemindersOpen] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!schoolCode) return;
    setLoading(true);
    try {
      const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
      const [rows, mtd] = await Promise.all([
        getAllForSchool(schoolCode, selectedAcademicYearId || null),
        supabase
          .from('fee_payments')
          .select('amount_inr')
          .eq('school_code', schoolCode)
          .gte('payment_date', monthStart),
      ]);
      setInvoices(rows || []);
      const sum = (mtd?.data || []).reduce((s, p) => s + Number(p.amount_inr || 0), 0);
      setCollectedThisMonth(sum);
    } catch (err) {
      message.error(err?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [schoolCode, selectedAcademicYearId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const summary = useMemo(() => summariseInvoices(invoices), [invoices]);

  const overdueInvoices = useMemo(
    () => (invoices || []).filter((inv) => {
      const balance = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
      return balance > 0 && inv.due_date && dayjs(inv.due_date).isBefore(dayjs(), 'day');
    }),
    [invoices],
  );

  const studentsWithDues = useMemo(() => {
    const set = new Set();
    for (const inv of invoices || []) {
      const balance = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
      if (balance > 0 && inv.student?.id) set.add(inv.student.id);
    }
    return set.size;
  }, [invoices]);

  const selectedInvoices = useMemo(
    () => (invoices || []).filter((inv) => selectedKeys.includes(inv.id)),
    [invoices, selectedKeys],
  );

  const handleExportCsv = () => {
    if (!invoices.length) { message.info('Nothing to export'); return; }
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

  const handleQuickReminder = async (inv) => {
    try {
      const result = await sendPaymentReminder(inv.id);
      const name = inv.student?.full_name || 'student';
      if (result?.notified > 0) {
        message.success(`Reminder sent to ${name}`);
      } else {
        message.warning(result?.message || `Couldn't reach ${name} — no app account or push token`);
      }
    } catch (err) {
      message.error(err?.message || 'Failed');
    }
  };

  const refreshAll = () => { setSelectedKeys([]); loadInvoices(); };

  if (!schoolCode) return <Empty description="No school context. Please re-login." />;

  return (
    <div style={{ padding: '24px 28px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Page header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
            color: '#64748b', fontWeight: 600, marginBottom: 4,
          }}>
            School operations
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Fees
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select
          value={selectedAcademicYearId ?? '__all__'}
          onChange={(v) => setSelectedAcademicYearId(v === '__all__' ? null : v)}
          style={{ minWidth: 200 }}
          options={[
            { value: '__all__', label: 'All academic years' },
            ...academicYears.map((ay) => ({
              value: ay.id,
              label: `${ay.year_start}–${ay.year_end}${ay.is_active ? ' · Active' : ''}`,
            })),
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => { refreshContext(); loadInvoices(); }}>
          Refresh
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
            border: 'none', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            fontWeight: 600,
          }}
        >
          New invoice
        </Button>
        </div>
      </div>

      {/* KPI strip — 4 ops numbers, no analytics */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiTile
          label="Outstanding"
          value={fmtRupeesCompact(summary.outstanding)}
          sub={fmtRupees(summary.outstanding)}
          accent={summary.outstanding > 0 ? '#dc2626' : '#16a34a'}
          icon={<WalletOutlined />}
        />
        <KpiTile
          label="Collected this month"
          value={fmtRupeesCompact(collectedThisMonth)}
          sub={`${dayjs().format('MMM YYYY')}`}
          accent="#16a34a"
          icon="₹"
        />
        <KpiTile
          label="Overdue invoices"
          value={overdueInvoices.length}
          sub={`of ${summary.invoiceCount} total`}
          accent={overdueInvoices.length > 0 ? '#dc2626' : '#16a34a'}
          icon={<BellOutlined />}
        />
        <KpiTile
          label="Students with dues"
          value={studentsWithDues}
          sub={`${summary.collectionRate.toFixed(0)}% collected`}
          accent="#2563eb"
          icon={<FileTextOutlined />}
        />
      </div>

      {/* Tabs */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          tabBarStyle={{
            margin: 0,
            padding: '0 20px',
            borderBottom: '1px solid #e2e8f0',
          }}
          items={[
            {
              key: 'collect',
              label: <span style={{ fontWeight: 600, fontSize: 14 }}>💰 Collect</span>,
              children: (
                <div style={{ padding: 20 }}>
                  <CollectMode
                    invoices={invoices}
                    loading={loading}
                    onChanged={refreshAll}
                  />
                </div>
              ),
            },
            {
              key: 'invoices',
              label: <span style={{ fontWeight: 600, fontSize: 14 }}>📄 Invoices ({summary.invoiceCount})</span>,
              children: (
                <div style={{ padding: 20 }}>
                  {/* Action bar */}
                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14,
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    alignItems: 'center',
                  }}>
                    <Button size="small" icon={<DownloadOutlined />} onClick={handleExportCsv}>
                      Export
                    </Button>
                    <Button
                      size="small"
                      icon={<MailOutlined />}
                      disabled={selectedInvoices.length === 0}
                      onClick={() => setBulkRemindersOpen(true)}
                    >
                      {selectedInvoices.length > 0
                        ? `Remind selected (${selectedInvoices.length})`
                        : 'Bulk reminders'}
                    </Button>
                    {overdueInvoices.length > 0 && (
                      <Button
                        size="small"
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
                    <div style={{ flex: 1 }} />
                    {selectedInvoices.length > 0 && (
                      <Tag style={{ background: '#eff6ff', color: '#2563eb', border: 'none', fontWeight: 600 }}>
                        {selectedInvoices.length} selected
                      </Tag>
                    )}
                  </div>

                  <InvoiceTable
                    data={invoices}
                    loading={loading}
                    classes={classes}
                    selectedKeys={selectedKeys}
                    onSelectChange={setSelectedKeys}
                    onOpenDetail={(r) => setDetailId(r.id)}
                    onRecordPayment={(r) => setDetailId(r.id)}
                    onViewDocument={(r) => setDetailId(r.id)}
                    onSendReminder={handleQuickReminder}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Side panels & modals */}
      <InvoiceSidePanel
        open={!!detailId}
        invoiceId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={refreshAll}
      />
      <NewInvoicePanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        classes={classes}
        academicYear={academicYear}
        schoolCode={schoolCode}
        onCreated={refreshAll}
      />
      <BulkRemindersModal
        open={bulkRemindersOpen}
        onClose={() => setBulkRemindersOpen(false)}
        invoices={selectedInvoices.length ? selectedInvoices : overdueInvoices}
      />
    </div>
  );
}

/* ─── Inline bulk reminders modal (replaces drawer) ─────────────────────── */
function BulkRemindersModal({ open, onClose, invoices = [] }) {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => { if (open) { setProgress(0); setResults([]); setRunning(false); } }, [open]);

  const handleSend = async () => {
    if (!invoices.length) { message.info('No invoices selected'); return; }
    setRunning(true);
    setResults([]);
    setProgress(0);

    const out = [];
    for (let i = 0; i < invoices.length; i += 1) {
      const inv = invoices[i];
      try {
        const r = await sendPaymentReminder(inv.id);
        if (r?.notified > 0) {
          out.push({ id: inv.id, label: inv.student?.full_name || inv.id, status: 'sent' });
        } else {
          out.push({ id: inv.id, label: inv.student?.full_name || inv.id, status: 'skipped', reason: r?.message || 'no account / no push token' });
        }
      } catch (err) {
        out.push({ id: inv.id, label: inv.student?.full_name || inv.id, status: 'failed', reason: err?.message || 'failed' });
      }
      setProgress(Math.round(((i + 1) / invoices.length) * 100));
      setResults([...out]);
    }
    const sent = out.filter((r) => r.status === 'sent').length;
    const skipped = out.filter((r) => r.status === 'skipped').length;
    const failed = out.filter((r) => r.status === 'failed').length;
    const parts = [`${sent} sent`];
    if (skipped) parts.push(`${skipped} skipped`);
    if (failed) parts.push(`${failed} failed`);
    if (sent > 0) message.success(parts.join(' · '));
    else message.warning(parts.join(' · '));
    setRunning(false);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', fontWeight: 600 }}>
            Bulk action
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
            Send {invoices.length} reminder{invoices.length === 1 ? '' : 's'}
          </div>
        </div>
      }
      width={520}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={running}>Close</Button>,
        <Button
          key="send"
          type="primary"
          icon={<MailOutlined />}
          loading={running}
          disabled={!invoices.length}
          onClick={handleSend}
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
            border: 'none', fontWeight: 600,
          }}
        >
          Send {invoices.length}
        </Button>,
      ]}
    >
      {running && <Progress percent={progress} status="active" />}
      {results.length > 0 && (
        <List
          style={{ marginTop: 16, maxHeight: 320, overflow: 'auto' }}
          size="small"
          dataSource={results}
          renderItem={(r) => {
            const tone = r.status === 'sent' ? 'green' : r.status === 'skipped' ? 'orange' : 'red';
            return (
              <List.Item style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <Tag color={tone} style={{ margin: 0 }}>{r.status}</Tag>
                  <span style={{ flex: 1 }}>{r.label}</span>
                  {r.reason && <span style={{ color: '#64748b', fontSize: 12 }}>{r.reason}</span>}
                </div>
              </List.Item>
            );
          }}
        />
      )}
      {!running && results.length === 0 && (
        <div style={{ color: '#64748b', fontSize: 13 }}>
          Reminders are sent to parent contacts via the school's notification channel.
        </div>
      )}
    </Modal>
  );
}

/* ─── Entry ─────────────────────────────────────────────────────────────── */
export default function Fees() {
  const { user } = useAuth();
  const role = getUserRole(user);
  if (role === 'student') return <StudentFees />;
  return (
    <FeesProvider>
      <FeesHub />
    </FeesProvider>
  );
}
