import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, Segmented, Select, DatePicker, Input, InputNumber, Button, Space, Alert, Tag,
  message, Form, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined, UserOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createInvoice, generateForClass, listStudents } from '../services/feesService';
import { billingPeriodFor } from '../services/invoiceHelpers';
import { fmtRupees } from '../utils/money';

const QUICK_ITEMS = [
  { label: 'Tuition',   amount: 5000 },
  { label: 'Transport', amount: 1500 },
  { label: 'Books',     amount: 1000 },
  { label: 'Activity',  amount: 500 },
  { label: 'Lab',       amount: 800 },
  { label: 'Exam',      amount: 1200 },
];

/**
 * Unified invoice creator — handles both single-student and bulk-class flows
 * via a Segmented switch at the top.
 */
export default function NewInvoicePanel({
  open, onClose, classes = [], academicYear, schoolCode, onCreated, defaultClassId = null,
}) {
  const [mode, setMode] = useState(defaultClassId ? 'bulk' : 'single');
  const [classId, setClassId] = useState(defaultClassId || null);
  const [studentId, setStudentId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentCount, setStudentCount] = useState(null);

  const billingPeriod = useMemo(() => academicYear ? billingPeriodFor(academicYear) : '', [academicYear]);
  const [period, setPeriod] = useState(billingPeriod);
  const [dueDate, setDueDate] = useState(dayjs().add(1, 'month'));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ label: 'Tuition', amount: 5000 }]);
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMode(defaultClassId ? 'bulk' : 'single');
      setClassId(defaultClassId || null);
      setStudentId(null);
      setStudents([]);
      setStudentCount(null);
      setPeriod(billingPeriod);
      setDueDate(dayjs().add(1, 'month'));
      setNotes('');
      setItems([{ label: 'Tuition', amount: 5000 }]);
    }
  }, [open, defaultClassId, billingPeriod]);

  // Class change → load students for single mode + count for bulk
  useEffect(() => {
    if (!classId || !schoolCode) { setStudents([]); setStudentCount(null); return; }
    let alive = true;
    (async () => {
      setLoadingStudents(true);
      try {
        const rows = await listStudents(schoolCode, classId);
        if (!alive) return;
        setStudents(rows || []);
        setStudentCount((rows || []).length);
      } catch {
        if (alive) { setStudents([]); setStudentCount(null); }
      } finally {
        if (alive) setLoadingStudents(false);
      }
    })();
    return () => { alive = false; };
  }, [classId, schoolCode]);

  const total = items.reduce((s, it) => s + Number(it?.amount || 0), 0);

  const updateItem = (idx, patch) => {
    setItems((arr) => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const removeItem = (idx) => setItems((arr) => arr.filter((_, i) => i !== idx));
  const addItem = (preset) => setItems((arr) => [...arr, preset || { label: '', amount: 0 }]);

  const handleSubmit = async () => {
    if (!academicYear?.id) { message.error('No active academic year'); return; }
    if (!classId) { message.error('Pick a class'); return; }
    if (mode === 'single' && !studentId) { message.error('Pick a student'); return; }
    const cleanItems = items.filter((it) => it && it.label?.trim() && Number(it.amount) > 0);
    if (!cleanItems.length) { message.error('Add at least one item'); return; }
    if (!dueDate) { message.error('Pick a due date'); return; }
    if (!period?.trim()) { message.error('Billing period is required'); return; }

    setSubmitting(true);
    try {
      if (mode === 'single') {
        await createInvoice({
          school_code: schoolCode,
          student_id: studentId,
          billing_period: period,
          academic_year_id: academicYear.id,
          due_date: dueDate.format('YYYY-MM-DD'),
          items: cleanItems.map((it) => ({ label: it.label, amount: Number(it.amount) })),
          notes: notes || null,
        });
        message.success('Invoice created');
      } else {
        const result = await generateForClass({
          classInstanceId: classId,
          schoolCode,
          billingPeriod: period,
          items: cleanItems.map((it) => ({ label: it.label, amount: Number(it.amount) })),
          academicYearId: academicYear.id,
          dueDate: dueDate.format('YYYY-MM-DD'),
        });
        const parts = [`Created ${result.created || 0}`];
        if (result.merged) parts.push(`merged ${result.merged}`);
        if (result.skipped) parts.push(`${result.skipped} skipped`);
        message.success(parts.join(' · '));
      }
      onCreated?.();
      onClose?.();
    } catch (err) {
      message.error(err?.message || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const classOptions = (classes || []).map((c) => ({
    value: c.id,
    label: `Grade ${c.grade ?? '-'}${c.section ? ` ${c.section}` : ''}`,
  }));

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={680}
      footer={null}
      closable={false}
      destroyOnClose
      styles={{ body: { padding: 0 }, content: { padding: 0, overflow: 'hidden', borderRadius: 16 } }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)',
        color: 'white', padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85 }}>
            New
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Create Invoice</div>
        </div>
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} style={{ color: 'white' }} />
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Segmented
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: 'single', label: <Space><UserOutlined /> Single student</Space> },
            { value: 'bulk', label: <Space><ThunderboltOutlined /> Whole class</Space> },
          ]}
        />

        {/* Class + student row */}
        <div style={{ display: 'grid', gridTemplateColumns: mode === 'single' ? '1fr 1fr' : '1fr', gap: 12 }}>
          <div>
            <Label>Class</Label>
            <Select
              placeholder="Select class"
              value={classId || undefined}
              onChange={(v) => { setClassId(v); setStudentId(null); }}
              options={classOptions}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </div>
          {mode === 'single' && (
            <div>
              <Label>Student</Label>
              <Select
                placeholder={classId ? 'Select student' : 'Pick class first'}
                disabled={!classId}
                loading={loadingStudents}
                value={studentId || undefined}
                onChange={setStudentId}
                options={students.map((s) => ({
                  value: s.id,
                  label: `${s.full_name}${s.student_code ? ` · ${s.student_code}` : ''}`,
                }))}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>

        {mode === 'bulk' && studentCount !== null && classId && (
          <Alert
            type="info"
            showIcon
            message={`This class has ${studentCount} student${studentCount === 1 ? '' : 's'}. Existing invoices for this period will have items merged in.`}
            style={{ borderRadius: 10 }}
          />
        )}

        {/* Period + due date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>Billing period</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2025-2026" />
          </div>
          <div>
            <Label>Due date</Label>
            <DatePicker value={dueDate} onChange={setDueDate} format="DD MMM YYYY" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Quick chips */}
        <div>
          <Label>Quick add</Label>
          <Space wrap>
            {QUICK_ITEMS.map((qi) => (
              <Tooltip key={qi.label} title={`+ ${qi.label} · ${fmtRupees(qi.amount)}`}>
                <Tag
                  style={{
                    cursor: 'pointer', padding: '4px 12px', borderRadius: 999,
                    background: '#eff6ff', color: '#2563eb', border: 'none',
                    fontWeight: 600, fontSize: 12,
                  }}
                  onClick={() => addItem(qi)}
                >
                  + {qi.label}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        </div>

        {/* Items list */}
        <div>
          <Label>Line items</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input
                  placeholder="Description"
                  value={it.label}
                  onChange={(e) => updateItem(idx, { label: e.target.value })}
                  style={{ flex: 1 }}
                />
                <InputNumber
                  placeholder="Amount"
                  value={it.amount}
                  onChange={(v) => updateItem(idx, { amount: v ?? 0 })}
                  min={0}
                  precision={2}
                  prefix="₹"
                  style={{ width: 160 }}
                />
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeItem(idx)} disabled={items.length === 1} />
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => addItem()} block size="small">
              Add row
            </Button>
          </div>
        </div>

        {mode === 'single' && (
          <div>
            <Label>Notes (optional)</Label>
            <Input.TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} showCount />
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 4, padding: '14px 16px',
          background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0',
        }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', fontWeight: 600 }}>
              {mode === 'single' ? 'Invoice total' : 'Per-student total'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
              {fmtRupees(total)}
            </div>
          </div>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={handleSubmit}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                border: 'none', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                fontWeight: 600,
              }}
            >
              {mode === 'single' ? 'Create invoice' : `Generate for ${studentCount ?? 'class'}`}
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
      color: '#64748b', fontWeight: 600, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}
