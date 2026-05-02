import React, { useEffect, useMemo, useState } from 'react';
import { Input, Empty, Spin, Tag, Button, message } from 'antd';
import {
  SearchOutlined, UserOutlined, FilePdfOutlined, ArrowLeftOutlined, MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fmtRupees } from '../utils/money';
import PaymentPanel from './PaymentPanel';
import InvoiceDocumentViewer from './InvoiceDocumentViewer';
import { sendPaymentReminder } from '../services/feesService';

const STATUS_TONE = {
  paid:    { bg: '#dcfce7', fg: '#15803d', label: 'PAID'    },
  partial: { bg: '#fef3c7', fg: '#b45309', label: 'PARTIAL' },
  pending: { bg: '#fee2e2', fg: '#b91c1c', label: 'PENDING' },
  overdue: { bg: '#fed7aa', fg: '#c2410c', label: 'OVERDUE' },
};

function statusOf(inv) {
  const t = Number(inv.total_amount || 0);
  const p = Number(inv.paid_amount || 0);
  if (p >= t && t > 0) return 'paid';
  if (p > 0) return 'partial';
  if (inv.due_date && dayjs(inv.due_date).isBefore(dayjs(), 'day')) return 'overdue';
  return 'pending';
}

function StatusChip({ status }) {
  const tone = STATUS_TONE[status] || STATUS_TONE.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: tone.bg, color: tone.fg,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
    }}>{tone.label}</span>
  );
}

/**
 * Collect mode — parent walks in, admin types name → finds student → records
 * payment instantly. Search-first, no class filtering required.
 */
export default function CollectMode({ invoices = [], loading, onChanged }) {
  const [query, setQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [docInvoiceId, setDocInvoiceId] = useState(null);

  // Group by student. Only include students who have invoices.
  const studentsWithInvoices = useMemo(() => {
    const byStudent = new Map();
    for (const inv of invoices || []) {
      const s = inv.student;
      if (!s?.id) continue;
      if (!byStudent.has(s.id)) {
        byStudent.set(s.id, {
          id: s.id, full_name: s.full_name, student_code: s.student_code,
          invoices: [], total: 0, paid: 0, balance: 0,
        });
      }
      const rec = byStudent.get(s.id);
      rec.invoices.push(inv);
      const t = Number(inv.total_amount || 0);
      const p = Number(inv.paid_amount || 0);
      rec.total += t;
      rec.paid += p;
      rec.balance += Math.max(0, t - p);
    }
    return Array.from(byStudent.values()).sort((a, b) => b.balance - a.balance);
  }, [invoices]);

  // Search filter
  const filteredStudents = useMemo(() => {
    if (!query.trim()) {
      // Default: show students with outstanding balance
      return studentsWithInvoices.filter((s) => s.balance > 0).slice(0, 50);
    }
    const q = query.trim().toLowerCase();
    return studentsWithInvoices.filter((s) =>
      s.full_name?.toLowerCase().includes(q) ||
      s.student_code?.toLowerCase().includes(q),
    ).slice(0, 50);
  }, [studentsWithInvoices, query]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return studentsWithInvoices.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, studentsWithInvoices]);

  const handlePaid = async () => {
    if (selectedInvoice?.id) setDocInvoiceId(selectedInvoice.id);
    setSelectedInvoice(null);
    onChanged?.();
  };

  const handleReminder = async (inv) => {
    try {
      const r = await sendPaymentReminder(inv.id);
      if (r?.notified > 0) message.success('Reminder sent');
      else message.warning(r?.message || 'Could not deliver — student has no app account or push token');
    } catch (err) {
      message.error(err?.message || 'Failed');
    }
  };

  // ─── Selected invoice view (full payment flow) ───
  if (selectedInvoice) {
    const balance = Math.max(0, Number(selectedInvoice.total_amount || 0) - Number(selectedInvoice.paid_amount || 0));
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedInvoice(null)}
            type="text"
            style={{ alignSelf: 'flex-start', color: '#64748b' }}
          >
            Back to {selectedStudent?.full_name || 'student'}
          </Button>

          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)',
            color: 'white', padding: '24px 28px', borderRadius: 16,
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85 }}>
              Collecting from
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              {selectedInvoice.student?.full_name}
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>
              {[
                selectedInvoice.student?.student_code,
                `Period ${selectedInvoice.billing_period}`,
                selectedInvoice.due_date && `Due ${dayjs(selectedInvoice.due_date).format('DD MMM YYYY')}`,
              ].filter(Boolean).join(' · ')}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
              <MiniStat label="Total" value={fmtRupees(selectedInvoice.total_amount)} />
              <MiniStat label="Paid" value={fmtRupees(selectedInvoice.paid_amount)} />
              <MiniStat label="Balance" value={fmtRupees(balance)} highlight />
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
            <PaymentPanel invoice={selectedInvoice} onPaid={handlePaid} />
          </div>

          <Button icon={<FilePdfOutlined />} onClick={() => setDocInvoiceId(selectedInvoice.id)}>
            View invoice document
          </Button>
        </div>

        <InvoiceDocumentViewer
          open={!!docInvoiceId}
          invoiceId={docInvoiceId}
          onClose={() => setDocInvoiceId(null)}
        />
      </>
    );
  }

  // ─── Selected student view (list of their invoices) ───
  if (selectedStudent) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedStudentId(null)}
            type="text"
            style={{ alignSelf: 'flex-start', color: '#64748b' }}
          >
            Back to search
          </Button>

          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)',
            color: 'white', padding: '24px 28px', borderRadius: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700,
              }}>
                {selectedStudent.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedStudent.full_name}</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{selectedStudent.student_code}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
              <MiniStat label="Total billed" value={fmtRupees(selectedStudent.total)} />
              <MiniStat label="Paid" value={fmtRupees(selectedStudent.paid)} />
              <MiniStat label="Outstanding" value={fmtRupees(selectedStudent.balance)} highlight />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedStudent.invoices.map((inv) => {
              const balance = Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0));
              const status = statusOf(inv);
              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    padding: 18,
                    cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{inv.billing_period}</span>
                      <StatusChip status={status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {inv.due_date ? `Due ${dayjs(inv.due_date).format('DD MMM YYYY')}` : 'No due date'}
                      {' · '}
                      {fmtRupees(inv.paid_amount)} paid of {fmtRupees(inv.total_amount)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 20, fontWeight: 700,
                      color: balance > 0 ? '#dc2626' : '#16a34a',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmtRupees(balance)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {balance > 0 ? 'balance' : 'cleared'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <InvoiceDocumentViewer
          open={!!docInvoiceId}
          invoiceId={docInvoiceId}
          onClose={() => setDocInvoiceId(null)}
        />
      </>
    );
  }

  // ─── Search view (default) ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: 4,
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
      }}>
        <Input
          autoFocus
          size="large"
          prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 18 }} />}
          placeholder="Search student by name or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          variant="borderless"
          style={{ fontSize: 16, padding: '10px 12px' }}
        />
      </div>

      {!query.trim() && filteredStudents.length > 0 && (
        <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 4 }}>
          Showing students with outstanding balance — type to search all
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
      ) : filteredStudents.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 60, textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={query.trim() ? `No students matching "${query}"` : 'No outstanding fees'}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredStudents.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedStudentId(s.id)}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.background = '#fff';
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                color: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700,
              }}>
                {s.full_name?.charAt(0)?.toUpperCase() || <UserOutlined />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.full_name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {s.student_code} · {s.invoices.length} invoice{s.invoices.length === 1 ? '' : 's'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: s.balance > 0 ? '#dc2626' : '#16a34a',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtRupees(s.balance)}
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {s.balance > 0 ? 'outstanding' : 'all paid'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, highlight }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
        opacity: 0.75, fontWeight: 600,
      }}>{label}</div>
      <div style={{
        fontSize: highlight ? 20 : 16, fontWeight: highlight ? 700 : 600,
        marginTop: 2, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}
