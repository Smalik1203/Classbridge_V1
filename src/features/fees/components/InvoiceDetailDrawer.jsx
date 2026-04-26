import React, { useEffect, useMemo, useState } from 'react';
import {
  Drawer, Descriptions, Tag, Table, Button, Space, Form, Input, InputNumber, DatePicker,
  Popconfirm, Divider, Empty, Alert, message, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, FileTextOutlined,
  DollarOutlined, MailOutlined, SaveOutlined, ReloadOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getDetail, addItems, updateItem, removeItems, updateInvoice,
  deleteInvoice, sendPaymentReminder,
} from '../services/feesService';
import { fmtRupees } from '../utils/money';
import PaymentDrawer from './PaymentDrawer';
import InvoiceDocumentViewer from './InvoiceDocumentViewer';

const STATUS_COLORS = { paid: 'green', partial: 'gold', pending: 'red', overdue: 'volcano' };

function statusOf(invoice) {
  const t = Number(invoice?.total_amount || 0);
  const p = Number(invoice?.paid_amount || 0);
  if (p >= t && t > 0) return 'paid';
  if (p > 0) return 'partial';
  if (invoice?.due_date && dayjs(invoice.due_date).isBefore(dayjs(), 'day')) return 'overdue';
  return 'pending';
}

export default function InvoiceDetailDrawer({
  open, invoiceId, onClose, onChanged, canManage = true, canRecordPayment = true,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm] = Form.useForm();
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [editInvoiceOpen, setEditInvoiceOpen] = useState(false);
  const [invoiceForm] = Form.useForm();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

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

  useEffect(() => {
    if (open && invoiceId) load();
  }, [open, invoiceId]);

  const status = detail ? statusOf(detail) : 'pending';
  const balance = useMemo(() => {
    if (!detail) return 0;
    return Math.max(0, Number(detail.total_amount || 0) - Number(detail.paid_amount || 0));
  }, [detail]);

  const refreshAll = async () => {
    await load();
    onChanged?.();
  };

  // ── Item edit ────────────────────────────────────────────────────────────
  const startEditItem = (item) => {
    setEditingItemId(item.id);
    editForm.setFieldsValue({ label: item.label, amount: Number(item.amount) });
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
      message.error(err?.message || 'Failed to update item');
    }
  };
  const removeItem = async (itemId) => {
    try {
      await removeItems(invoiceId, [itemId]);
      message.success('Item removed');
      await refreshAll();
    } catch (err) {
      message.error(err?.message || 'Failed to remove item');
    }
  };

  // ── Add multiple new items ───────────────────────────────────────────────
  const submitAddItems = async () => {
    try {
      const v = await addForm.validateFields();
      const rows = (v.items || []).filter((it) => it && it.label && it.amount !== undefined && it.amount !== null);
      if (!rows.length) {
        message.error('Add at least one row');
        return;
      }
      await addItems(invoiceId, rows.map((r) => ({ label: r.label, amount: Number(r.amount) })));
      message.success(`Added ${rows.length} item${rows.length > 1 ? 's' : ''}`);
      setAddItemsOpen(false);
      addForm.resetFields();
      await refreshAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed to add items');
    }
  };

  // ── Edit invoice (due date / notes) ──────────────────────────────────────
  const openEditInvoice = () => {
    invoiceForm.setFieldsValue({
      due_date: detail?.due_date ? dayjs(detail.due_date) : null,
      notes: detail?.notes || '',
    });
    setEditInvoiceOpen(true);
  };
  const saveEditInvoice = async () => {
    try {
      const v = await invoiceForm.validateFields();
      await updateInvoice(invoiceId, {
        due_date: v.due_date ? v.due_date.format('YYYY-MM-DD') : null,
        notes: v.notes || null,
      });
      message.success('Invoice updated');
      setEditInvoiceOpen(false);
      await refreshAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed to update invoice');
    }
  };

  // ── Delete invoice ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      await deleteInvoice(invoiceId);
      message.success('Invoice deleted');
      onChanged?.();
      onClose?.();
    } catch (err) {
      message.error(err?.message || 'Failed to delete invoice');
    }
  };

  // ── Send reminder ────────────────────────────────────────────────────────
  const handleReminder = async () => {
    try {
      await sendPaymentReminder(invoiceId);
      message.success('Reminder sent');
    } catch (err) {
      message.error(err?.message || 'Failed to send reminder');
    }
  };

  const itemColumns = [
    {
      title: 'Description',
      dataIndex: 'label',
      render: (val, item) =>
        editingItemId === item.id ? (
          <Form.Item name="label" rules={[{ required: true }]} style={{ margin: 0 }}>
            <Input size="small" />
          </Form.Item>
        ) : val,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 160,
      align: 'right',
      render: (val, item) =>
        editingItemId === item.id ? (
          <Form.Item name="amount" rules={[{ required: true }]} style={{ margin: 0 }}>
            <InputNumber size="small" precision={2} style={{ width: '100%' }} />
          </Form.Item>
        ) : (
          <span style={{ color: Number(val) < 0 ? '#cf1322' : undefined }}>{fmtRupees(val)}</span>
        ),
    },
    canManage && {
      title: '',
      width: 90,
      align: 'right',
      render: (_, item) => editingItemId === item.id ? (
        <Space size={4}>
          <Button size="small" type="primary" icon={<SaveOutlined />} onClick={saveEditItem} />
          <Button size="small" onClick={() => setEditingItemId(null)}>Cancel</Button>
        </Space>
      ) : (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => startEditItem(item)} /></Tooltip>
          <Popconfirm title="Remove this line item?" onConfirm={() => removeItem(item.id)} okText="Remove" okButtonProps={{ danger: true }}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ].filter(Boolean);

  const paymentColumns = [
    { title: 'Date', dataIndex: 'payment_date', width: 110, render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Amount', dataIndex: 'amount_inr', align: 'right', render: (v) => fmtRupees(v) },
    { title: 'Method', dataIndex: 'payment_method', render: (v) => <Tag>{v?.replace('_', ' ')}</Tag> },
    { title: 'Receipt #', dataIndex: 'receipt_number', render: (v) => v || '—' },
    { title: 'Recorded by', dataIndex: 'recorded_by_name', render: (v) => v || '—' },
    { title: 'Remarks', dataIndex: 'remarks', render: (v) => v || '' },
  ];

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={
          <Space>
            <span>Invoice detail</span>
            {detail && <Tag color={STATUS_COLORS[status]}>{status.toUpperCase()}</Tag>}
          </Space>
        }
        width={820}
        destroyOnClose
        loading={loading && !detail}
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            <Button icon={<FilePdfOutlined />} onClick={() => setDocOpen(true)}>View document</Button>
            {canManage && <Button icon={<MailOutlined />} onClick={handleReminder}>Send reminder</Button>}
          </Space>
        }
      >
        {!detail ? (
          <Empty description="No invoice selected" />
        ) : (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Student" span={2}>
                {detail.student?.full_name}{detail.student?.student_code ? ` · ${detail.student.student_code}` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Billing period">{detail.billing_period}</Descriptions.Item>
              <Descriptions.Item label="Due date">{detail.due_date ? dayjs(detail.due_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Total">{fmtRupees(detail.total_amount)}</Descriptions.Item>
              <Descriptions.Item label="Paid">{fmtRupees(detail.paid_amount)}</Descriptions.Item>
              <Descriptions.Item label="Balance" span={2}>
                <Tag color={balance > 0 ? 'orange' : 'green'} style={{ fontSize: 14 }}>
                  {fmtRupees(balance)}
                </Tag>
                {' '}
                <span style={{ color: '#888' }}>
                  Total {fmtRupees(detail.total_amount)} − Paid {fmtRupees(detail.paid_amount)}
                </span>
              </Descriptions.Item>
              {detail.notes && (
                <Descriptions.Item label="Notes" span={2}>{detail.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <Space style={{ marginTop: 12 }} wrap>
              {canRecordPayment && balance > 0 && (
                <Button type="primary" icon={<DollarOutlined />} onClick={() => setPaymentOpen(true)}>
                  Record payment
                </Button>
              )}
              {canManage && (
                <>
                  <Button icon={<EditOutlined />} onClick={openEditInvoice}>Edit due / notes</Button>
                  <Popconfirm
                    title="Delete this invoice?"
                    description="This is permanent. Invoices with payments cannot be deleted."
                    onConfirm={handleDelete}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<DeleteOutlined />}>Delete</Button>
                  </Popconfirm>
                </>
              )}
            </Space>

            <Divider orientation="left">Line items</Divider>
            <Form form={editForm} component={false}>
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.items || []}
                columns={itemColumns}
                summary={(rows) => {
                  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
                  return (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}><b>Total</b></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right"><b>{fmtRupees(total)}</b></Table.Summary.Cell>
                      {canManage && <Table.Summary.Cell index={2} />}
                    </Table.Summary.Row>
                  );
                }}
              />
            </Form>

            {canManage && !addItemsOpen && (
              <Button icon={<PlusOutlined />} type="dashed" block style={{ marginTop: 8 }} onClick={() => setAddItemsOpen(true)}>
                Add line items
              </Button>
            )}
            {addItemsOpen && (
              <div style={{ background: '#fafafa', padding: 12, marginTop: 8, borderRadius: 6 }}>
                <Form form={addForm} layout="vertical" autoComplete="off" initialValues={{ items: [{}] }}>
                  <Form.List name="items">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field) => (
                          <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item
                              {...field}
                              name={[field.name, 'label']}
                              rules={[{ required: true, message: 'Label required' }]}
                              style={{ marginBottom: 0, width: 320 }}
                            >
                              <Input placeholder="e.g. Term 1 tuition" />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'amount']}
                              rules={[{ required: true, message: 'Amount required' }]}
                              style={{ marginBottom: 0, width: 160 }}
                            >
                              <InputNumber placeholder="Amount ₹" precision={2} style={{ width: '100%' }} />
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
                  <Button type="primary" onClick={submitAddItems}>Save items</Button>
                  <Button onClick={() => { setAddItemsOpen(false); addForm.resetFields(); }}>Cancel</Button>
                </Space>
              </div>
            )}

            <Divider orientation="left">Payment history</Divider>
            {(detail.payments || []).length === 0 ? (
              <Empty description="No payments yet" />
            ) : (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.payments}
                columns={paymentColumns}
              />
            )}
          </>
        )}

        {/* Edit invoice modal-style inline form, kept simple */}
        <Drawer
          open={editInvoiceOpen}
          onClose={() => setEditInvoiceOpen(false)}
          title="Edit invoice"
          width={420}
          destroyOnClose
          footer={
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setEditInvoiceOpen(false)}>Cancel</Button>
              <Button type="primary" onClick={saveEditInvoice}>Save</Button>
            </Space>
          }
        >
          <Form form={invoiceForm} layout="vertical">
            <Form.Item name="due_date" label="Due date">
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={3} maxLength={500} showCount />
            </Form.Item>
            <Alert
              type="info"
              showIcon
              message="Editing the due date here flows to the next overdue check. Totals always recompute from line items."
            />
          </Form>
        </Drawer>
      </Drawer>

      <PaymentDrawer
        open={paymentOpen}
        invoice={detail}
        onClose={() => setPaymentOpen(false)}
        onPaymentRecorded={refreshAll}
      />
      <InvoiceDocumentViewer open={docOpen} invoiceId={invoiceId} onClose={() => setDocOpen(false)} />
    </>
  );
}
