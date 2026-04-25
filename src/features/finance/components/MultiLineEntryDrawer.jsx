import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Drawer, Table, DatePicker, Select, InputNumber, Input, Button, Space, App,
  Typography, Statistic, Row, Col, Alert, Divider, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ThunderboltOutlined, SaveOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  financeTransactionsService,
  financeAccountsService,
  financeCategoriesService,
} from '../services/financeService';

const { Text } = Typography;

const newRow = (defaults = {}) => ({
  key: typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random()}`,
  txn_date: dayjs(),
  type: 'expense',
  amount: undefined,
  category_id: undefined,
  account_id: undefined,
  description: '',
  ...defaults,
});

/**
 * Spreadsheet-style multi-line entry. Web-native enhancement (mobile only
 * had a single-row modal). Each row writes through the same single-create
 * path so every safety guarantee carries over.
 *
 * Keyboard shortcuts:
 *  - Ctrl/Cmd+Shift+N → add a new row
 *  - Ctrl/Cmd+S       → post all rows
 *  - Esc              → close
 */
export default function MultiLineEntryDrawer({
  open, onClose, onSuccess, schoolCode, userId, userRole,
}) {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState([newRow()]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!open || !schoolCode) return;
    Promise.all([
      financeAccountsService.list(schoolCode),
      financeCategoriesService.list(schoolCode),
    ]).then(([acc, cat]) => {
      setAccounts(acc);
      setCategories(cat);
    });
  }, [open, schoolCode]);

  useEffect(() => {
    if (open) setRows([newRow()]);
  }, [open]);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, newRow({
      txn_date: prev[prev.length - 1]?.txn_date || dayjs(),
      type:     prev[prev.length - 1]?.type || 'expense',
      account_id: prev[prev.length - 1]?.account_id,
    })]);
  }, []);

  const removeRow = (key) => setRows(prev => prev.length === 1 ? prev : prev.filter(r => r.key !== key));

  const updateRow = (key, patch) => setRows(prev => prev.map(r => {
    if (r.key !== key) return r;
    const next = { ...r, ...patch };
    // Clear category if type changes and it no longer matches.
    if (patch.type !== undefined) {
      const cat = categories.find(c => c.id === next.category_id);
      if (cat && cat.type !== patch.type) next.category_id = undefined;
    }
    return next;
  }));

  const totals = useMemo(() => {
    let income = 0, expense = 0, count = 0;
    rows.forEach(r => {
      const amt = Number(r.amount || 0);
      if (!Number.isFinite(amt) || amt <= 0) return;
      count++;
      if (r.type === 'income') income += amt; else expense += amt;
    });
    return { income, expense, net: income - expense, count };
  }, [rows]);

  const validate = () => {
    const issues = [];
    rows.forEach((r, i) => {
      if (!r.txn_date)    issues.push(`Row ${i + 1}: date is required`);
      if (!r.amount || Number(r.amount) <= 0) issues.push(`Row ${i + 1}: amount must be > 0`);
      if (!r.category_id) issues.push(`Row ${i + 1}: category is required`);
      if (!r.account_id)  issues.push(`Row ${i + 1}: account is required`);
    });
    return issues;
  };

  const handlePostAll = async () => {
    const issues = validate();
    if (issues.length) {
      modal.error({
        title: 'Cannot post — please fix:',
        content: <ul style={{ paddingLeft: 18, margin: 0 }}>{issues.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}{issues.length > 8 ? <li>…and {issues.length - 8} more</li> : null}</ul>,
      });
      return;
    }
    modal.confirm({
      title: 'Post all rows?',
      content: `${totals.count} transactions will be created — ₹${totals.income.toLocaleString('en-IN')} income and ₹${totals.expense.toLocaleString('en-IN')} expense.`,
      okText: 'Post all',
      onOk: async () => {
        setSubmitting(true);
        setProgress({ done: 0, total: rows.length });
        try {
          const payload = rows.map(r => ({
            txn_date: r.txn_date.format('YYYY-MM-DD'),
            amount: Number(r.amount),
            type: r.type,
            category_id: r.category_id,
            account_id: r.account_id,
            description: r.description,
          }));
          const result = await financeTransactionsService.bulkCreate({
            schoolCode, rows: payload, userId, userRole,
            onProgress: (done, total) => setProgress({ done, total }),
          });
          if (result.failed === 0) {
            message.success(`Posted ${result.ok} transactions`);
            onSuccess?.();
            onClose?.();
          } else {
            modal.warning({
              title: `Posted ${result.ok}, failed ${result.failed}`,
              content: (
                <div>
                  <p>Failed rows:</p>
                  <ul style={{ paddingLeft: 18 }}>{result.errors.slice(0, 10).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>
                </div>
              ),
            });
            onSuccess?.();
          }
        } catch (err) {
          message.error(err.message || 'Failed to post');
        } finally {
          setSubmitting(false);
          setProgress(null);
        }
      },
    });
  };

  // Keyboard shortcuts.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const isCmd = e.ctrlKey || e.metaKey;
      if (isCmd && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); addRow(); }
      else if (isCmd && e.key.toLowerCase() === 's')          { e.preventDefault(); handlePostAll(); }
      else if (e.key === 'Escape')                            { onClose?.(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, addRow]); // eslint-disable-line react-hooks/exhaustive-deps

  const accountOptions = accounts.map(a => ({
    value: a.id,
    label: `${a.name} (${a.type})`,
  }));

  const columns = [
    {
      title: 'Date', dataIndex: 'txn_date', width: 140, fixed: 'left',
      render: (v, r) => (
        <DatePicker
          value={v} format="DD MMM YYYY" allowClear={false}
          onChange={(d) => updateRow(r.key, { txn_date: d })}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Type', dataIndex: 'type', width: 110,
      render: (v, r) => (
        <Select
          value={v}
          onChange={(val) => updateRow(r.key, { type: val })}
          style={{ width: '100%' }}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income',  label: 'Income'  },
          ]}
        />
      ),
    },
    {
      title: 'Category', dataIndex: 'category_id', width: 180,
      render: (v, r) => {
        const opts = categories.filter(c => c.type === r.type).map(c => ({ value: c.id, label: c.name }));
        return (
          <Select
            value={v}
            onChange={(val) => updateRow(r.key, { category_id: val })}
            placeholder="Pick…"
            style={{ width: '100%' }}
            showSearch optionFilterProp="label"
            options={opts}
          />
        );
      },
    },
    {
      title: 'Account', dataIndex: 'account_id', width: 180,
      render: (v, r) => (
        <Select
          value={v}
          onChange={(val) => updateRow(r.key, { account_id: val })}
          placeholder="Pick…"
          style={{ width: '100%' }}
          showSearch optionFilterProp="label"
          options={accountOptions}
        />
      ),
    },
    {
      title: 'Amount (₹)', dataIndex: 'amount', width: 140,
      render: (v, r) => (
        <InputNumber
          value={v}
          onChange={(val) => updateRow(r.key, { amount: val })}
          min={0.01} step={0.01} precision={2}
          style={{ width: '100%' }}
          placeholder="0.00"
        />
      ),
    },
    {
      title: 'Description', dataIndex: 'description',
      render: (v, r) => (
        <Input
          value={v}
          onChange={(e) => updateRow(r.key, { description: e.target.value })}
          placeholder="Optional"
          maxLength={500}
        />
      ),
    },
    {
      title: '', width: 50, fixed: 'right',
      render: (_, r) => (
        <Tooltip title="Remove row">
          <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeRow(r.key)} disabled={rows.length === 1} />
        </Tooltip>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <Space>
          <ThunderboltOutlined /> Multi-line entry
          <Tag color="blue">web-native</Tag>
        </Space>
      }
      width={Math.min(1200, typeof window !== 'undefined' ? window.innerWidth - 100 : 1100)}
      destroyOnClose
      extra={
        <Space>
          <Button icon={<PlusOutlined />} onClick={addRow}>Add row <Text type="secondary" style={{ fontSize: 11 }}>⌘⇧N</Text></Button>
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handlePostAll}>
            Post all <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>⌘S</Text>
          </Button>
        </Space>
      }
    >
      <Alert
        type="info" showIcon icon={<InfoCircleOutlined />}
        message="Each row becomes one finance_transactions row — same validation, same audit trail as single-row entry."
        description="Press ⌘⇧N to add a row · ⌘S to post · Esc to close"
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Statistic title="Rows" value={totals.count} suffix={`/ ${rows.length}`} /></Col>
        <Col xs={12} md={6}><Statistic title="Total Income"  value={totals.income}  prefix="₹" precision={2} valueStyle={{ color: '#10b981' }} /></Col>
        <Col xs={12} md={6}><Statistic title="Total Expense" value={totals.expense} prefix="₹" precision={2} valueStyle={{ color: '#ef4444' }} /></Col>
        <Col xs={12} md={6}><Statistic title="Net" value={totals.net} prefix="₹" precision={2}
          valueStyle={{ color: totals.net >= 0 ? '#10b981' : '#ef4444' }} /></Col>
      </Row>

      <Divider style={{ margin: '8px 0' }} />

      <Table
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={false}
        rowKey="key"
        scroll={{ x: 1100, y: 'calc(100vh - 380px)' }}
        bordered
      />

      {progress && progress.total > 1 && (
        <div style={{ marginTop: 12 }}>
          <Text>Posting {progress.done} / {progress.total}…</Text>
        </div>
      )}
    </Drawer>
  );
}
