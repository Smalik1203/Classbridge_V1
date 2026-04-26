import React, { useState } from 'react';
import { Form, Radio, InputNumber, Input, Space, Typography, Alert } from 'antd';
import { PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons';
import { FormDrawer, validators } from '../../../shared/components/forms';
import { inventoryItemsService } from '../services/inventoryService';

const { Text } = Typography;

const REASONS = [
  { label: 'Restock / purchase', value: 'restock' },
  { label: 'Damage / breakage',  value: 'damage' },
  { label: 'Loss / theft',       value: 'loss' },
  { label: 'Manual correction',  value: 'correction' },
  { label: 'Opening balance',    value: 'opening' },
];

/**
 * Web-native stock adjustment surface (mobile has no equivalent — only inline
 * "current_quantity" edits via item form). Lets a manager add, subtract, or
 * directly set stock with a reason note appended to internal_notes for audit.
 */
export default function StockAdjustmentDrawer({
  open, onClose, schoolCode, item, onAdjusted,
}) {
  if (!item) return null;

  const current = Number(item.current_quantity ?? 0);

  const computeNewQty = (mode, amount) => mode === 'add'
    ? current + Number(amount || 0)
    : mode === 'subtract'
      ? current - Number(amount || 0)
      : Number(amount || 0);

  const handleSubmit = async (values, mode) => {
    const newQty = computeNewQty(mode, values.amount);
    if (newQty < 0) throw new Error('Resulting quantity cannot be negative');

    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const reasonLabel = REASONS.find(r => r.value === values.reason)?.label || values.reason;
    const action = mode === 'add' ? `+${values.amount}` : mode === 'subtract' ? `−${values.amount}` : `set→${values.amount}`;
    const auditLine = `[${stamp}] Stock ${action} (${reasonLabel})${values.notes ? `: ${values.notes.trim()}` : ''}`;
    const updatedNotes = item.internal_notes ? `${item.internal_notes}\n${auditLine}` : auditLine;

    return inventoryItemsService.update(item.id, schoolCode, {
      current_quantity: newQty,
      internal_notes: updatedNotes,
    });
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Adjust Stock"
      okText="Apply"
      width={480}
      getInitialValues={() => ({ amount: 1, reason: 'restock' })}
      onSubmit={(values) => handleSubmit(values, values._mode || 'add')}
      onSaved={onAdjusted}
      successMessage="Stock adjusted"
      errorMessage="Failed to adjust stock"
    >
      {(form) => <StockAdjustmentBody form={form} item={item} current={current} computeNewQty={computeNewQty} />}
    </FormDrawer>
  );
}

function StockAdjustmentBody({ form, item, current, computeNewQty }) {
  const [mode, setMode] = useState('add');
  const amount = Form.useWatch('amount', form) ?? 0;

  // Stash mode in the form state so submit picks it up.
  React.useEffect(() => {
    form.setFieldValue('_mode', mode);
  }, [mode, form]);

  const newQty = computeNewQty(mode, amount);
  const invalid = newQty < 0;

  return (
    <>
      <div style={{ background: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <Text strong>{item.name}</Text>
        <div><Text type="secondary">{item.category}</Text></div>
        <div style={{ marginTop: 8 }}>
          <Text>Current stock: </Text>
          <Text strong>{current}</Text>
        </div>
      </div>

      <Form.Item label="Action">
        <Radio.Group
          value={mode}
          onChange={e => setMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          options={[
            { label: <><PlusOutlined /> Add</>, value: 'add' },
            { label: <><MinusOutlined /> Subtract</>, value: 'subtract' },
            { label: <><EditOutlined /> Set to</>, value: 'set' },
          ]}
        />
      </Form.Item>

      <Form.Item
        label={mode === 'set' ? 'New stock quantity' : 'Amount'}
        name="amount"
        rules={[validators.required('Amount')]}
      >
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item label="Reason" name="reason" rules={[{ required: true, message: 'Pick a reason' }]}>
        <Radio.Group options={REASONS} optionType="button" />
      </Form.Item>

      <Form.Item label="Notes (optional)" name="notes">
        <Input.TextArea rows={2} placeholder="Optional context — appended to the item's audit trail" />
      </Form.Item>

      <Alert
        type={invalid ? 'error' : 'info'}
        showIcon
        message={
          <Space>
            <Text>Stock will become</Text>
            <Text strong style={{ color: invalid ? '#ef4444' : '#10b981' }}>{newQty}</Text>
          </Space>
        }
        description={invalid ? 'Resulting quantity cannot be negative.' : 'A timestamped entry will be appended to the item’s internal notes.'}
      />
    </>
  );
}
