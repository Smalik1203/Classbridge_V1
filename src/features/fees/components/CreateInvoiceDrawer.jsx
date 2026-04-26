import React, { useMemo, useState } from 'react';
import {
  Form, Select, DatePicker, Input, InputNumber, Button, Space, Alert, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormDrawer, validators, fromDayjs, DATE_DISPLAY } from '../../../shared/components/forms';
import { createInvoice, listStudents } from '../services/feesService';
import { billingPeriodFor } from '../services/invoiceHelpers';
import { fmtRupees } from '../utils/money';

/**
 * Single-student invoice creator. For bulk class invoicing use
 * GenerateInvoicesDrawer instead.
 */
export default function CreateInvoiceDrawer({
  open, onClose, classes = [], academicYear, schoolCode, onCreated,
}) {
  const billingPeriod = useMemo(
    () => academicYear ? billingPeriodFor(academicYear) : '',
    [academicYear],
  );

  const getInitialValues = () => ({
    billing_period: billingPeriod,
    due_date: dayjs().add(1, 'month'),
    items: [{ label: 'Tuition', amount: 5000 }],
  });

  const handleSubmit = async (v) => {
    if (!academicYear?.id) throw new Error('No active academic year found');
    const items = (v.items || []).filter((it) => it && it.label && it.amount > 0);
    if (!items.length) throw new Error('Add at least one line item');
    return createInvoice({
      school_code: schoolCode,
      student_id: v.student_id,
      billing_period: v.billing_period,
      academic_year_id: academicYear.id,
      due_date: fromDayjs(v.due_date),
      items: items.map((it) => ({ label: it.label, amount: Number(it.amount) })),
      notes: v.notes || null,
    });
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="New invoice"
      okText="Create invoice"
      width={620}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onCreated}
      successMessage="Invoice created"
      errorMessage="Failed to create invoice"
    >
      {(form) => <CreateInvoiceBody form={form} classes={classes} schoolCode={schoolCode} />}
    </FormDrawer>
  );
}

function CreateInvoiceBody({ form, classes, schoolCode }) {
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [classId, setClassId] = useState(null);

  const onPickClass = async (val) => {
    setClassId(val);
    form.setFieldsValue({ student_id: undefined });
    if (!val) { setStudents([]); return; }
    setLoadingStudents(true);
    try {
      const rows = await listStudents(schoolCode, val);
      setStudents(rows);
    } finally {
      setLoadingStudents(false);
    }
  };

  return (
    <>
      <Form.Item label="Class" required>
        <Select
          placeholder="Select class"
          value={classId || undefined}
          onChange={onPickClass}
          options={(classes || []).map((c) => ({
            value: c.id,
            label: `Grade ${c.grade ?? '-'}${c.section ? ` ${c.section}` : ''}`,
          }))}
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>

      <Form.Item
        name="student_id"
        label="Student"
        rules={[{ required: true, message: 'Pick a student' }]}
      >
        <Select
          placeholder={classId ? 'Select student' : 'Pick class first'}
          disabled={!classId}
          loading={loadingStudents}
          options={students.map((s) => ({
            value: s.id,
            label: `${s.full_name}${s.student_code ? ` · ${s.student_code}` : ''}`,
          }))}
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>

      <Space.Compact style={{ width: '100%' }}>
        <Form.Item name="billing_period" label="Billing period" rules={[validators.required('Billing period')]} style={{ flex: 1, marginRight: 8 }}>
          <Input placeholder="e.g. 2024-2025" />
        </Form.Item>
        <Form.Item name="due_date" label="Due date" rules={[validators.required('Due date')]} style={{ flex: 1 }}>
          <DatePicker style={{ width: '100%' }} format={DATE_DISPLAY} />
        </Form.Item>
      </Space.Compact>

      <Form.Item name="notes" label="Notes (optional)">
        <Input.TextArea rows={2} maxLength={300} showCount />
      </Form.Item>

      <Divider orientation="left">Line items</Divider>

      <Form.List name="items">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item
                  {...field}
                  name={[field.name, 'label']}
                  rules={[{ required: true, message: 'Label required' }]}
                  style={{ marginBottom: 0, width: 280 }}
                >
                  <Input placeholder="Item description" />
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

      <Form.Item shouldUpdate noStyle>
        {() => {
          const items = form.getFieldValue('items') || [];
          const total = items.reduce((s, it) => s + Number(it?.amount || 0), 0);
          return (
            <Alert type="info" style={{ marginTop: 12 }} message={`Invoice total: ${fmtRupees(total)}`} />
          );
        }}
      </Form.Item>
    </>
  );
}
