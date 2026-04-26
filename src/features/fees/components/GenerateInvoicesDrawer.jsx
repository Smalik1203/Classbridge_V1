import React, { useMemo, useState } from 'react';
import {
  Form, Select, DatePicker, Input, InputNumber, Button, Space, Alert, App,
  Divider, Tag, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormDrawer, validators, fromDayjs, DATE_DISPLAY } from '../../../shared/components/forms';
import { generateForClass, listStudents } from '../services/feesService';
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
 * Bulk-create invoices for a whole class (or pre-selected students).
 * Single due_date for all invoices. Skips students already invoiced this period.
 */
export default function GenerateInvoicesDrawer({
  open, onClose, classes = [], academicYear, schoolCode, onGenerated, defaultClassId = null,
}) {
  const { message } = App.useApp();

  const billingPeriod = useMemo(
    () => academicYear ? billingPeriodFor(academicYear) : '',
    [academicYear],
  );

  const getInitialValues = () => ({
    class_instance_id: defaultClassId,
    due_date: dayjs().add(1, 'month'),
    billing_period: billingPeriod,
    items: [{ label: 'Tuition', amount: 5000 }],
  });

  const handleSubmit = async (v) => {
    if (!academicYear?.id) throw new Error('No active academic year found');
    const items = (v.items || []).filter((it) => it && it.label && it.amount > 0);
    if (!items.length) throw new Error('Add at least one line item');
    const result = await generateForClass({
      classInstanceId: v.class_instance_id,
      schoolCode,
      billingPeriod: v.billing_period,
      items: items.map((it) => ({ label: it.label, amount: Number(it.amount) })),
      academicYearId: academicYear.id,
      dueDate: fromDayjs(v.due_date),
    });
    const parts = [`Created ${result.created} invoice${result.created !== 1 ? 's' : ''}`];
    if (result.merged) parts.push(`merged items into ${result.merged} existing`);
    if (result.skipped) parts.push(`${result.skipped} skipped`);
    message.success(parts.join(' · '));
    return result;
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Generate fee invoices for class"
      okText="Generate invoices"
      width={680}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onGenerated}
      successMessage={null}
      errorMessage="Failed to generate invoices"
    >
      {(form) => (
        <GenerateInvoicesBody
          form={form}
          classes={classes}
          schoolCode={schoolCode}
          defaultClassId={defaultClassId}
          billingPeriod={billingPeriod}
        />
      )}
    </FormDrawer>
  );
}

function GenerateInvoicesBody({ form, classes, schoolCode, defaultClassId, billingPeriod }) {
  const [studentCount, setStudentCount] = useState(null);

  // Fire once on mount (drawer is destroyOnClose so this is per-open).
  React.useEffect(() => {
    if (defaultClassId) loadStudentCount(defaultClassId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStudentCount = async (classInstanceId) => {
    if (!classInstanceId || !schoolCode) { setStudentCount(null); return; }
    try {
      const students = await listStudents(schoolCode, classInstanceId);
      setStudentCount(students.length);
    } catch {
      setStudentCount(null);
    }
  };

  return (
    <>
      <Form.Item
        name="class_instance_id"
        label="Class"
        rules={[{ required: true, message: 'Select a class' }]}
      >
        <Select
          placeholder="Select class"
          options={(classes || []).map((c) => ({
            value: c.id,
            label: `Grade ${c.grade ?? '-'}${c.section ? ` ${c.section}` : ''}` +
              (c.academic_years?.year_start ? ` (${c.academic_years.year_start}-${c.academic_years.year_end})` : ''),
          }))}
          onChange={loadStudentCount}
          showSearch
          optionFilterProp="label"
        />
      </Form.Item>

      {studentCount !== null && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`This class has ${studentCount} student${studentCount === 1 ? '' : 's'}. Students who already have an invoice for this billing period will have these line items merged into the existing invoice.`}
        />
      )}

      <Space.Compact style={{ width: '100%' }}>
        <Form.Item
          name="billing_period"
          label="Billing period"
          rules={[validators.required('Billing period')]}
          style={{ flex: 1, marginRight: 8 }}
        >
          <Input placeholder="e.g. 2024-2025" disabled={!!billingPeriod} />
        </Form.Item>
        <Form.Item
          name="due_date"
          label="Due date"
          rules={[{ required: true, message: 'Pick a due date' }]}
          style={{ flex: 1 }}
        >
          <DatePicker style={{ width: '100%' }} format={DATE_DISPLAY} />
        </Form.Item>
      </Space.Compact>

      <Divider orientation="left">Line items (applied to every student)</Divider>

      <Space wrap style={{ marginBottom: 8 }}>
        {QUICK_ITEMS.map((qi) => (
          <Tooltip key={qi.label} title={`Add ${qi.label} · ${fmtRupees(qi.amount)}`}>
            <Tag
              color="blue"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const items = form.getFieldValue('items') || [];
                form.setFieldsValue({ items: [...items, qi] });
              }}
            >
              + {qi.label}
            </Tag>
          </Tooltip>
        ))}
      </Space>

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
                  style={{ marginBottom: 0, width: 180 }}
                >
                  <InputNumber placeholder="Amount ₹" min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
                <Button danger icon={<DeleteOutlined />} type="text" onClick={() => remove(field.name)} />
              </Space>
            ))}
            <Button icon={<PlusOutlined />} onClick={() => add({})} type="dashed" size="small">
              Add row
            </Button>
          </>
        )}
      </Form.List>

      <Form.Item shouldUpdate noStyle>
        {() => {
          const items = form.getFieldValue('items') || [];
          const total = items.reduce((s, it) => s + Number(it?.amount || 0), 0);
          return (
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Tag color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>
                Per-student total: {fmtRupees(total)}
              </Tag>
            </div>
          );
        }}
      </Form.Item>
    </>
  );
}
