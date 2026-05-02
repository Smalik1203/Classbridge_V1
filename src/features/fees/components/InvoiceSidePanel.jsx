import React, { useEffect, useMemo, useState } from 'react';
import {
  Drawer, Button, Tag, Table, Empty, Form, Input, InputNumber, Space, Popconfirm,
  message, Tooltip, DatePicker, Alert, Divider,
} from 'antd';
import {
  CloseOutlined, FilePdfOutlined, MailOutlined, ReloadOutlined, EditOutlined,
  DeleteOutlined, PlusOutlined, SaveOutlined, MoneyCollectOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getDetail, addItems, updateItem, removeItems, updateInvoice, deleteInvoice,
  sendPaymentReminder,
} from '../services/feesService';
import { fmtRupees } from '../utils/money';
import PaymentPanel from './PaymentPanel';
import InvoiceDocumentViewer from './InvoiceDocumentViewer';

const STATUS_TONE = {
  paid:    { bg: '#dcfce7', fg: '#15803d', label: 'PAID'    },
  partial: { bg: '#fef3c7', fg: '#b45309', label: 'PARTIAL' },
  pending: { bg: '#fee2e2', fg: '#b91c1c', label: 'PENDING' },
  overdue: { bg: '#fed7aa', fg: '#c2410c', label: 'OVERDUE' },
};

function statusOf(inv) {
  const t = Number(inv?.total_amount || 0);
  const p = Number(inv?.paid_amount || 0);
  if (p >= t && t > 0) return 'paid';
  if (p > 0) return 'partial';
  if (inv?.due_date && dayjs(inv.due_date).isBefore(dayjs(), 'day')) return 'overdue';
  return 'pending';
}

function StatusChip({ status }) {
  const tone = STATUS_TONE[status] || STATUS_TONE.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: tone.bg, color: tone.fg,
      padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    }}>{tone.label}</span>
  );
}

function Stat({ label, value, accent, prominent }) {
  return (
    <div style={{
      flex: prominent ? 1.4 : 1,
      padding: prominent ? '14px 18px' : '10px 14px',
      background: prominent ? '#f0fdf4' : '#f8fafc',
      borderRadius: 10,
      border: `1px solid ${prominent ? '#86efac' : '#e2e8f0'}`,
    }}>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: prominent ? '#15803d' : '#94a3b8', fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: prominent ? 24 : 18, fontWeight: 700,
        color: accent || '#0f172a', marginTop: 2, fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.15,
      }}>
        {value}
      </div>
    </div>
  );
}

export default function InvoiceSidePanel({ open, invoiceId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm] = Form.useForm();
  const [addingItem, setAddingItem] = useState(false);
  const [addForm] = Form.useForm();
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm] = Form.useForm();

  const load = async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const data = await getDetail(invoiceId);
      setDetail(data);
    } catch (err) {
      message.error(err?.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open && invoiceId) load(); }, [open, invoiceId]);

  const status = detail ? statusOf(detail) : 'pending';
  const balance = useMemo(() => detail
    ? Math.max(0, Number(detail.total_amount || 0) - Number(detail.paid_amount || 0))
    : 0,
    [detail],
  );

  const refreshAll = async () => {
    await load();
    onChanged?.();
  };

  const handlePaid = async () => {
    await refreshAll();
    setTimeout(() => setDocOpen(true), 200);
  };

  const handleReminder = async () => {
    try {
      const r = await sendPaymentReminder(invoiceId);
      if (r?.notified > 0) message.success('Reminder sent');
      else message.warning(r?.message || 'Could not deliver — student has no app account or push token');
    } catch (err) {
      message.error(err?.message || 'Failed to send reminder');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice(invoiceId);
      message.success('Invoice deleted');
      onChanged?.();
      onClose?.();
    } catch (err) {
      message.error(err?.message || 'Failed to delete');
    }
  };

  const startEditItem = (it) => {
    setEditingItemId(it.id);
    editForm.setFieldsValue({ label: it.label, amount: Number(it.amount) });
  };
  const saveEditItem = async () => {
    try {
      const v = await editForm.validateFields();
      await updateItem(editingItemId, { label: v.label, amount: v.amount });
      message.success('Item updated');
      setEditingItemId(null);
      await refreshAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed');
    }
  };
  const removeOne = async (id) => {
    try { await removeItems(invoiceId, [id]); message.success('Removed'); await refreshAll(); }
    catch (err) { message.error(err?.message || 'Failed'); }
  };

  const submitAddItems = async () => {
    try {
      const v = await addForm.validateFields();
      const rows = (v.items || []).filter((it) => it && it.label && it.amount !== undefined && it.amount !== null);
      if (!rows.length) { message.error('Add at least one row'); return; }
      await addItems(invoiceId, rows.map((r) => ({ label: r.label, amount: Number(r.amount) })));
      message.success(`Added ${rows.length} item${rows.length > 1 ? 's' : ''}`);
      setAddingItem(false);
      addForm.resetFields();
      await refreshAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed');
    }
  };

  const openEditMeta = () => {
    metaForm.setFieldsValue({
      due_date: detail?.due_date ? dayjs(detail.due_date) : null,
      notes: detail?.notes || '',
    });
    setEditingMeta(true);
  };
  const saveMeta = async () => {
    try {
      const v = await metaForm.validateFields();
      await updateInvoice(invoiceId, {
        due_date: v.due_date ? v.due_date.format('YYYY-MM-DD') : null,
        notes: v.notes || null,
      });
      message.success('Updated');
      setEditingMeta(false);
      await refreshAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed');
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width={720}
        closable={false}
        destroyOnClose
        styles={{ body: { padding: 0, background: '#f8fafc' }, header: { display: 'none' } }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)',
          color: 'white',
          padding: '24px 28px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, marginBottom: 4 }}>
              Invoice
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {detail?.student?.full_name || (loading ? 'Loading…' : '—')}
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>
              {[detail?.student?.student_code, detail?.billing_period].filter(Boolean).join(' · ')}
              {detail?.due_date && ` · Due ${dayjs(detail.due_date).format('DD MMM YYYY')}`}
            </div>
            <div style={{ marginTop: 12 }}><StatusChip status={status} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Tooltip title="Refresh">
              <Button type="text" icon={<ReloadOutlined />} onClick={load} style={{ color: 'white' }} />
            </Tooltip>
            <Tooltip title="Close">
              <Button type="text" icon={<CloseOutlined />} onClick={onClose} style={{ color: 'white' }} />
            </Tooltip>
          </div>
        </div>

        {!detail && !loading ? (
          <div style={{ padding: 40 }}><Empty description="No invoice selected" /></div>
        ) : detail ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Stat label="Paid" value={fmtRupees(detail.paid_amount)} accent="#15803d" prominent />
              <Stat label="Total" value={fmtRupees(detail.total_amount)} />
              <Stat label="Balance" value={fmtRupees(balance)} accent={balance > 0 ? '#dc2626' : '#16a34a'} />
            </div>

            {/* Payment panel */}
            <div style={{
              background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0',
            }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700, marginBottom: 14 }}>
                Collect Payment
              </div>
              <PaymentPanel invoice={detail} onPaid={handlePaid} />
            </div>

            {/* Action bar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button icon={<FilePdfOutlined />} onClick={() => setDocOpen(true)}>View document</Button>
              <Button icon={<MailOutlined />} onClick={handleReminder} disabled={balance <= 0}>Send reminder</Button>
              <Button icon={<EditOutlined />} onClick={openEditMeta}>Edit due / notes</Button>
              <Popconfirm
                title="Delete this invoice?"
                description="This is permanent. Invoices with payments cannot be deleted."
                onConfirm={handleDelete}
                okText="Delete"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />}>Delete</Button>
              </Popconfirm>
            </div>

            {/* Items */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 12,
              }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700 }}>
                  Line items
                </div>
                {!addingItem && (
                  <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setAddingItem(true)}>
                    Add items
                  </Button>
                )}
              </div>
              <Form form={editForm} component={false}>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  showHeader={false}
                  dataSource={detail.items || []}
                  locale={{ emptyText: 'No items' }}
                  columns={[
                    {
                      title: 'Description',
                      dataIndex: 'label',
                      render: (val, item) => editingItemId === item.id ? (
                        <Form.Item name="label" rules={[{ required: true }]} style={{ margin: 0 }}>
                          <Input size="small" />
                        </Form.Item>
                      ) : <span style={{ color: '#0f172a' }}>{val}</span>,
                    },
                    {
                      title: 'Amount',
                      dataIndex: 'amount',
                      width: 160,
                      align: 'right',
                      render: (val, item) => editingItemId === item.id ? (
                        <Form.Item name="amount" rules={[{ required: true }]} style={{ margin: 0 }}>
                          <InputNumber size="small" precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                      ) : (
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: Number(val) < 0 ? '#dc2626' : '#0f172a' }}>
                          {fmtRupees(val)}
                        </span>
                      ),
                    },
                    {
                      title: '',
                      width: 80,
                      align: 'right',
                      render: (_, item) => editingItemId === item.id ? (
                        <Space size={4}>
                          <Button size="small" type="primary" icon={<SaveOutlined />} onClick={saveEditItem} />
                          <Button size="small" onClick={() => setEditingItemId(null)}>Cancel</Button>
                        </Space>
                      ) : (
                        <Space size={4}>
                          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => startEditItem(item)} />
                          <Popconfirm title="Remove?" onConfirm={() => removeOne(item.id)} okButtonProps={{ danger: true }}>
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                  summary={(rows) => {
                    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
                    return (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0}><b>Total</b></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtRupees(total)}</b>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} />
                      </Table.Summary.Row>
                    );
                  }}
                />
              </Form>

              {addingItem && (
                <div style={{
                  marginTop: 12, padding: 12,
                  background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0',
                }}>
                  <Form form={addForm} layout="vertical" autoComplete="off" initialValues={{ items: [{}] }}>
                    <Form.List name="items">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map((field) => (
                            <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                              <Form.Item {...field} name={[field.name, 'label']} rules={[{ required: true }]} style={{ marginBottom: 0, width: 280 }}>
                                <Input placeholder="Description" />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, 'amount']} rules={[{ required: true }]} style={{ marginBottom: 0, width: 160 }}>
                                <InputNumber placeholder="Amount" precision={2} style={{ width: '100%' }} />
                              </Form.Item>
                              <Button danger icon={<DeleteOutlined />} type="text" onClick={() => remove(field.name)} />
                            </Space>
                          ))}
                          <Button icon={<PlusOutlined />} onClick={() => add({})} type="dashed" size="small">Add row</Button>
                        </>
                      )}
                    </Form.List>
                  </Form>
                  <Space style={{ marginTop: 12 }}>
                    <Button type="primary" onClick={submitAddItems}>Save</Button>
                    <Button onClick={() => { setAddingItem(false); addForm.resetFields(); }}>Cancel</Button>
                  </Space>
                </div>
              )}
            </div>

            {/* Edit meta inline */}
            {editingMeta && (
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700, marginBottom: 12 }}>
                  Edit invoice
                </div>
                <Form form={metaForm} layout="vertical">
                  <Form.Item name="due_date" label="Due date">
                    <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                  </Form.Item>
                  <Form.Item name="notes" label="Notes">
                    <Input.TextArea rows={3} maxLength={500} showCount />
                  </Form.Item>
                </Form>
                <Space>
                  <Button type="primary" onClick={saveMeta}>Save</Button>
                  <Button onClick={() => setEditingMeta(false)}>Cancel</Button>
                </Space>
              </div>
            )}

            {/* Payment history */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700, marginBottom: 12 }}>
                Payment history
              </div>
              {(detail.payments || []).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No payments yet" />
              ) : (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={detail.payments}
                  columns={[
                    { title: 'Date', dataIndex: 'payment_date', width: 110, render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
                    { title: 'Amount', dataIndex: 'amount_inr', align: 'right', width: 130,
                      render: (v) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtRupees(v)}</span>,
                    },
                    { title: 'Method', dataIndex: 'payment_method', render: (v) => (
                      <Tag style={{ background: '#eff6ff', color: '#2563eb', border: 'none', fontWeight: 600 }}>
                        {v?.replace('_', ' ')}
                      </Tag>
                    ) },
                    { title: 'Reference', dataIndex: 'receipt_number', render: (v) => (
                      <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11.5, color: '#64748b' }}>
                        {v || '—'}
                      </span>
                    ) },
                  ]}
                />
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      <InvoiceDocumentViewer open={docOpen} invoiceId={invoiceId} onClose={() => setDocOpen(false)} />
    </>
  );
}
