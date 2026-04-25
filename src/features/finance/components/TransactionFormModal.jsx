import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, Form, InputNumber, Input, DatePicker, Select, Radio, Space, Button,
  Alert, Typography, Divider, App, Tag,
} from 'antd';
import { PlusOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  financeTransactionsService,
  financeAccountsService,
  financeCategoriesService,
} from '../services/financeService';

const { Text } = Typography;

/**
 * Single-row create / edit modal. Used as the primary entry path in the txn
 * ledger and in the FAB on every page. For multi-line spreadsheet entry see
 * MultiLineEntryDrawer.
 *
 * Mode: 'create' or 'edit'. In edit mode the modal pre-fills from `txn` and
 * blocks edits to fee-derived rows (those go through readonly drawer instead).
 */
export default function TransactionFormModal({
  open, onClose, onSuccess, mode = 'create', txn = null,
  schoolCode, userId, userRole, defaultType = 'expense',
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [accounts, setAccounts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [type, setType]             = useState(defaultType);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !schoolCode) return;
    Promise.all([
      financeAccountsService.list(schoolCode),
      financeCategoriesService.list(schoolCode),
    ]).then(([acc, cat]) => {
      setAccounts(acc);
      setCategories(cat);
    }).catch(err => message.error(err.message || 'Failed to load reference data'));
  }, [open, schoolCode, message]);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && txn) {
      setType(txn.type);
      form.setFieldsValue({
        type: txn.type,
        txn_date: dayjs(txn.txn_date),
        amount: Number(txn.amount),
        category_id: txn.category_id,
        account_id: txn.account_id,
        description: txn.description || '',
      });
    } else {
      setType(defaultType);
      form.setFieldsValue({
        type: defaultType,
        txn_date: dayjs(),
        amount: undefined,
        category_id: undefined,
        account_id: undefined,
        description: '',
      });
    }
  }, [open, mode, txn, defaultType, form]);

  const filteredCategories = useMemo(
    () => categories.filter(c => c.type === type),
    [categories, type],
  );

  // If type changes and the current category is the wrong type, clear it.
  useEffect(() => {
    const cur = form.getFieldValue('category_id');
    if (cur && !filteredCategories.find(c => c.id === cur)) {
      form.setFieldValue('category_id', undefined);
    }
  }, [type, filteredCategories, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        schoolCode,
        userId,
        userRole,
        txnDate: values.txn_date.format('YYYY-MM-DD'),
        amount: Number(values.amount),
        type: values.type,
        categoryId: values.category_id,
        accountId: values.account_id,
        description: values.description || '',
      };
      if (mode === 'edit' && txn) {
        await financeTransactionsService.update({
          id: txn.id, schoolCode, userId, userRole,
          patch: {
            txn_date:    payload.txnDate,
            amount:      payload.amount,
            type:        payload.type,
            category_id: payload.categoryId,
            account_id:  payload.accountId,
            description: payload.description,
          },
        });
        message.success('Transaction updated');
      } else {
        await financeTransactionsService.create({
          ...payload,
          sourceType: 'manual',
        });
        message.success(`${values.type === 'income' ? 'Income' : 'Expense'} recorded`);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      if (err?.errorFields) return; // form validation
      message.error(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const liveAmount  = Form.useWatch('amount', form);
  const liveType    = Form.useWatch('type',   form) || type;
  const liveCatId   = Form.useWatch('category_id', form);
  const liveAccId   = Form.useWatch('account_id',  form);
  const liveCat     = categories.find(c => c.id === liveCatId);
  const liveAcc     = accounts.find(a   => a.id === liveAccId);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={mode === 'edit' ? 'Edit Transaction' : 'New Transaction'}
      width={560}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose} icon={<CloseOutlined />}>Cancel</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit} icon={<SaveOutlined />}>
          {mode === 'edit' ? 'Save changes' : 'Post transaction'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Radio.Group
            buttonStyle="solid"
            disabled={mode === 'edit'}
            onChange={(e) => setType(e.target.value)}
          >
            <Radio.Button value="expense">Expense</Radio.Button>
            <Radio.Button value="income">Income</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Space.Compact block>
          <Form.Item name="txn_date" label="Date" rules={[{ required: true, message: 'Date required' }]} style={{ flex: 1, marginRight: 8 }}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount (₹)"
            rules={[
              { required: true, message: 'Amount required' },
              { type: 'number', min: 0.01, message: 'Must be > 0' },
            ]}
            style={{ flex: 1 }}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              step={0.01}
              precision={2}
              placeholder="0.00"
              formatter={(v) => v ? Number(v).toLocaleString('en-IN') : ''}
              parser={(v) => v?.replace(/[^\d.]/g, '') || ''}
            />
          </Form.Item>
        </Space.Compact>

        <Form.Item
          name="category_id"
          label={`Category (${type})`}
          rules={[{ required: true, message: 'Pick a category' }]}
          extra={filteredCategories.length === 0 ? `No ${type} categories yet — add one in Accounts & Categories.` : null}
        >
          <Select
            placeholder={`Select a ${type} category`}
            options={filteredCategories.map(c => ({ value: c.id, label: c.name }))}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item name="account_id" label="Account" rules={[{ required: true, message: 'Pick an account' }]}>
          <Select
            placeholder="Select an account (Cash / Bank / UPI…)"
            options={accounts.map(a => ({
              value: a.id,
              label: <span>{a.name} <Tag color={a.type === 'cash' ? 'green' : a.type === 'bank' ? 'blue' : 'purple'} style={{ marginLeft: 6 }}>{a.type}</Tag></span>,
            }))}
            showSearch
            optionFilterProp="value"
            filterOption={(input, opt) => {
              const a = accounts.find(x => x.id === opt.value);
              return a?.name?.toLowerCase().includes(input.toLowerCase());
            }}
          />
        </Form.Item>

        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea rows={2} maxLength={500} placeholder="Optional note (vendor, invoice #, purpose…)" />
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        <Alert
          type={liveType === 'income' ? 'success' : 'warning'}
          showIcon
          message={
            <Space size="small" wrap>
              <Text strong>{liveType === 'income' ? 'Will increase' : 'Will decrease'}</Text>
              <Text>{liveAcc ? liveAcc.name : 'selected account'}</Text>
              <Text>by</Text>
              <Text strong style={{ color: liveType === 'income' ? '#10b981' : '#ef4444' }}>
                ₹{Number(liveAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              {liveCat && (
                <Text type="secondary">· logged under <Text strong>{liveCat.name}</Text></Text>
              )}
            </Space>
          }
        />
      </Form>
    </Modal>
  );
}
