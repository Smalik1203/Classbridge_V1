import React, { useEffect, useMemo, useState } from 'react';
import {
  Form, InputNumber, Input, DatePicker, Select, Radio, Space,
  Alert, Typography, Divider, App, Tag,
} from 'antd';
import dayjs from 'dayjs';
import { FormModal, validators, fromDayjs, DATE_DISPLAY } from '../../../shared/components/forms';
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
  const [accounts,   setAccounts]   = useState([]);
  const [categories, setCategories] = useState([]);

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

  const isEdit = mode === 'edit' && !!txn;

  const getInitialValues = () => isEdit ? {
    type: txn.type,
    txn_date: dayjs(txn.txn_date),
    amount: Number(txn.amount),
    category_id: txn.category_id,
    account_id: txn.account_id,
    description: txn.description || '',
  } : {
    type: defaultType,
    txn_date: dayjs(),
    amount: undefined,
    category_id: undefined,
    account_id: undefined,
    description: '',
  };

  const handleSubmit = async (values) => {
    const payload = {
      schoolCode,
      userId,
      userRole,
      txnDate: fromDayjs(values.txn_date),
      amount: Number(values.amount),
      type: values.type,
      categoryId: values.category_id,
      accountId: values.account_id,
      description: values.description || '',
    };
    if (isEdit) {
      return financeTransactionsService.update({
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
    }
    return financeTransactionsService.create({ ...payload, sourceType: 'manual' });
  };

  // For create, the success toast wording depends on the submitted type
  // (income vs expense), so we fire it inside onSubmit instead of letting
  // the wrapper show successMessage.
  const successMessage = isEdit ? 'Transaction updated' : null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Transaction' : 'New Transaction'}
      okText={isEdit ? 'Save changes' : 'Post transaction'}
      width={560}
      requiredMark={false}
      editing={isEdit ? txn : null}
      getInitialValues={getInitialValues}
      onSubmit={async (values) => {
        const result = await handleSubmit(values);
        if (!isEdit) {
          message.success(`${values.type === 'income' ? 'Income' : 'Expense'} recorded`);
        }
        return result;
      }}
      onSaved={onSuccess}
      successMessage={successMessage}
      errorMessage="Failed to save"
    >
      {(form) => (
        <TransactionFormBody
          form={form}
          mode={mode}
          accounts={accounts}
          categories={categories}
          defaultType={defaultType}
        />
      )}
    </FormModal>
  );
}

function TransactionFormBody({ form, mode, accounts, categories, defaultType }) {
  const liveType   = Form.useWatch('type',        form) || defaultType;
  const liveAmount = Form.useWatch('amount',      form);
  const liveCatId  = Form.useWatch('category_id', form);
  const liveAccId  = Form.useWatch('account_id',  form);

  const filteredCategories = useMemo(
    () => categories.filter(c => c.type === liveType),
    [categories, liveType],
  );

  // If type changes and the current category is the wrong type, clear it.
  useEffect(() => {
    const cur = form.getFieldValue('category_id');
    if (cur && !filteredCategories.find(c => c.id === cur)) {
      form.setFieldValue('category_id', undefined);
    }
  }, [liveType, filteredCategories, form]);

  const liveCat = categories.find(c => c.id === liveCatId);
  const liveAcc = accounts.find(a   => a.id === liveAccId);

  return (
    <>
      <Form.Item name="type" label="Type" rules={[validators.required('Type')]}>
        <Radio.Group buttonStyle="solid" disabled={mode === 'edit'}>
          <Radio.Button value="expense">Expense</Radio.Button>
          <Radio.Button value="income">Income</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Space.Compact block>
        <Form.Item
          name="txn_date"
          label="Date"
          rules={[{ required: true, message: 'Date required' }]}
          style={{ flex: 1, marginRight: 8 }}
        >
          <DatePicker style={{ width: '100%' }} format={DATE_DISPLAY} allowClear={false} />
        </Form.Item>
        <Form.Item
          name="amount"
          label="Amount (₹)"
          rules={[
            { required: true, message: 'Amount required' },
            validators.positiveNumber('Amount'),
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
        label={`Category (${liveType})`}
        rules={[{ required: true, message: 'Pick a category' }]}
        extra={filteredCategories.length === 0 ? `No ${liveType} categories yet — add one in Accounts & Categories.` : null}
      >
        <Select
          placeholder={`Select a ${liveType} category`}
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
    </>
  );
}
