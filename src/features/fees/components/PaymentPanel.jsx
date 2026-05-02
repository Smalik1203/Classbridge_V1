import React, { useMemo, useState } from 'react';
import { InputNumber, Input, Radio, Button, message, Tag } from 'antd';
import { MoneyCollectOutlined, CheckCircleFilled } from '@ant-design/icons';
import { recordPayment } from '../services/feesService';
import { fmtRupees } from '../utils/money';

const MANUAL_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'card',          label: 'Card' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank' },
  { value: 'other',         label: 'Other' },
];

/**
 * Inline payment panel — embedded in the invoice side panel or collect mode.
 * Manual recording only (cash/upi/card/cheque/bank/other).
 */
export default function PaymentPanel({ invoice, onPaid }) {
  const remaining = useMemo(() => {
    if (!invoice) return 0;
    return Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));
  }, [invoice]);

  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState('cash');
  const [customMethod, setCustomMethod] = useState('');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => { setAmount(remaining); }, [remaining]);

  const validate = () => {
    if (!(amount > 0)) { message.error('Enter an amount greater than 0'); return false; }
    if (amount > remaining + 0.001) { message.error(`Amount exceeds balance of ${fmtRupees(remaining)}`); return false; }
    if (method === 'other' && !customMethod.trim()) {
      message.error('Enter the custom payment method');
      return false;
    }
    return true;
  };

  const handleManual = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const finalRemarks = method === 'other'
        ? [customMethod.trim(), remarks].filter(Boolean).join(' — ')
        : (remarks || null);
      const result = await recordPayment({
        invoice_id: invoice.id,
        amount: Number(amount),
        method,
        receipt_number: reference || null,
        remarks: finalRemarks || null,
      });
      message.success('Payment recorded');
      onPaid?.(result);
    } catch (err) {
      message.error(err?.message || 'Failed to record payment');
    } finally {
      setBusy(false);
    }
  };

  if (remaining <= 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        border: '1px solid #6ee7b7',
        borderRadius: 12,
        color: '#065f46',
      }}>
        <CheckCircleFilled style={{ fontSize: 22, color: '#10b981' }} />
        <div style={{ fontWeight: 600 }}>This invoice is fully paid</div>
      </div>
    );
  }

  const activeLabel = MANUAL_METHODS.find((m) => m.value === method)?.label || 'Payment';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Amount strip */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
            Collect amount
          </div>
          <InputNumber
            value={amount}
            onChange={setAmount}
            min={0}
            max={remaining}
            precision={2}
            size="large"
            style={{ width: '100%', fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            prefix={<span style={{ color: '#0f172a', fontWeight: 700, fontSize: 18 }}>₹</span>}
            placeholder="0.00"
          />
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
            Balance ₹{fmtRupees(remaining)} — type any amount up to that.
          </div>
        </div>
        <Button size="small" onClick={() => setAmount(remaining)}>Full</Button>
      </div>

      {/* Method picker */}
      <div style={{
        padding: 14,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
      }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', fontWeight: 600, marginBottom: 8 }}>
          Payment method
        </div>
        <Radio.Group
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={MANUAL_METHODS}
          optionType="button"
          buttonStyle="solid"
          size="middle"
          style={{ width: '100%' }}
        />
        {method === 'other' && (
          <Input
            placeholder="Custom method (e.g., Demand Draft, Wallet)"
            value={customMethod}
            onChange={(e) => setCustomMethod(e.target.value)}
            style={{ marginTop: 10 }}
            allowClear
          />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <Input
            placeholder="Receipt / reference (optional)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            allowClear
          />
          <Input
            placeholder="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {/* Single CTA */}
      <Button
        size="large"
        type="primary"
        icon={<MoneyCollectOutlined />}
        loading={busy}
        onClick={handleManual}
        style={{
          height: 52,
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 12,
        }}
      >
        Record {activeLabel} payment of {fmtRupees(amount || 0)}
      </Button>

      <Tag color="blue" style={{ alignSelf: 'flex-start', fontWeight: 500 }}>
        Receipt opens automatically after success
      </Tag>
    </div>
  );
}
