import React, { useMemo } from 'react';
import {
  Form, InputNumber, Radio, Input, Alert, Descriptions, Tag, Divider,
} from 'antd';
import { FormDrawer, validators } from '../../../shared/components/forms';
import { recordPayment } from '../services/feesService';
import { fmtRupees } from '../utils/money';

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'card',          label: 'Card' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'online',        label: 'Online' },
];

export default function PaymentDrawer({ open, invoice, onClose, onPaymentRecorded }) {
  const remaining = useMemo(() => {
    if (!invoice) return 0;
    return Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));
  }, [invoice]);

  if (!invoice) return null;

  const getInitialValues = () => ({ amount: remaining, method: 'cash' });

  const handleSubmit = async (values) => {
    if (values.amount <= 0) throw new Error('Amount must be greater than 0');
    if (values.amount > remaining + 0.001) {
      throw new Error(`Amount exceeds remaining balance of ${fmtRupees(remaining)}`);
    }
    return recordPayment({
      invoice_id: invoice.id,
      amount: Number(values.amount),
      method: values.method,
      receipt_number: values.receipt_number || null,
      remarks: values.remarks || null,
    });
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Record payment"
      okText="Record payment"
      width={520}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onPaymentRecorded}
      successMessage="Payment recorded"
      errorMessage="Failed to record payment"
    >
      {(form) => (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Student">{invoice.student?.full_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Billing period">{invoice.billing_period}</Descriptions.Item>
            <Descriptions.Item label="Total">{fmtRupees(invoice.total_amount)}</Descriptions.Item>
            <Descriptions.Item label="Paid so far">{fmtRupees(invoice.paid_amount)}</Descriptions.Item>
            <Descriptions.Item label="Remaining">
              <Tag color={remaining > 0 ? 'orange' : 'green'}>{fmtRupees(remaining)}</Tag>
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          {remaining <= 0 ? (
            <Alert type="success" showIcon message="This invoice is already fully paid." />
          ) : (
            <>
              <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true, message: 'Enter amount' }]}>
                <InputNumber
                  min={0}
                  max={remaining}
                  precision={2}
                  style={{ width: '100%' }}
                  addonAfter={<a onClick={() => form.setFieldsValue({ amount: remaining })}>Full</a>}
                />
              </Form.Item>

              <Form.Item name="method" label="Payment method" rules={[validators.required('Payment method')]}>
                <Radio.Group options={PAYMENT_METHODS} optionType="button" buttonStyle="solid" />
              </Form.Item>

              <Form.Item name="receipt_number" label="Receipt / reference number (optional)">
                <Input placeholder="e.g. RCT-2025-0001" />
              </Form.Item>

              <Form.Item name="remarks" label="Remarks (optional)">
                <Input.TextArea rows={2} maxLength={300} showCount />
              </Form.Item>

              <Alert
                type="info"
                showIcon
                message="The recorded payment is auto-posted to the school finance ledger (income → Fees) when collected by a super admin, matching the mobile flow."
              />
            </>
          )}
        </>
      )}
    </FormDrawer>
  );
}
