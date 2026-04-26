import React, { useMemo } from 'react';
import {
  Form, Input, InputNumber, Switch, Radio, Divider, Typography, Alert, Collapse,
} from 'antd';
import { FormDrawer, validators } from '../../../shared/components/forms';
import { inventoryItemsService, ISSUE_TO_OPTIONS, CHARGE_TYPES, FEE_CATEGORIES } from '../services/inventoryService';

const { Text, Title } = Typography;
const { TextArea } = Input;

/**
 * Web-native single-form drawer (vs mobile's 5-step wizard).
 * All settings live on one scrollable surface. Conditional sections appear
 * based on toggles, mirroring mobile validation.
 */
export default function InventoryItemFormDrawer({
  open, onClose, schoolCode, userId, editing, onSaved,
}) {
  const isEdit = !!editing;

  const getInitialValues = (editing) => editing ? {
    name: editing.name,
    category: editing.category,
    description: editing.description || undefined,
    track_quantity: !!editing.track_quantity,
    current_quantity: editing.current_quantity ?? undefined,
    low_stock_threshold: editing.low_stock_threshold ?? undefined,
    track_serially: !!editing.track_serially,
    can_be_issued: !!editing.can_be_issued,
    issue_to: editing.issue_to || undefined,
    must_be_returned: !!editing.must_be_returned,
    return_duration_days: editing.return_duration_days ?? undefined,
    is_chargeable: !!editing.is_chargeable,
    charge_type: editing.charge_type || undefined,
    charge_amount: editing.charge_amount ?? undefined,
    auto_add_to_fees: !!editing.auto_add_to_fees,
    fee_category: editing.fee_category || undefined,
    unit_cost: editing.unit_cost ?? undefined,
    allow_price_override: !!editing.allow_price_override,
    internal_notes: editing.internal_notes || undefined,
  } : {
    track_quantity: true,
    track_serially: false,
    can_be_issued: false,
    must_be_returned: false,
    is_chargeable: false,
    auto_add_to_fees: false,
    allow_price_override: false,
  };

  const handleSubmit = async (values) => {
    const payload = {
      name: values.name?.trim(),
      category: values.category?.trim(),
      description: values.description?.trim() || null,
      track_quantity: !!values.track_quantity,
      current_quantity: values.track_quantity && values.current_quantity != null ? Number(values.current_quantity) : null,
      low_stock_threshold: values.track_quantity && values.low_stock_threshold != null ? Number(values.low_stock_threshold) : null,
      track_serially: !!values.track_serially,
      can_be_issued: !!values.can_be_issued,
      issue_to: values.can_be_issued ? values.issue_to : null,
      must_be_returned: !!values.must_be_returned,
      return_duration_days: values.must_be_returned && values.return_duration_days != null ? Number(values.return_duration_days) : null,
      is_chargeable: !!values.is_chargeable,
      charge_type: values.is_chargeable ? values.charge_type : null,
      charge_amount: values.is_chargeable && values.charge_amount != null ? Number(values.charge_amount) : null,
      auto_add_to_fees: !!values.auto_add_to_fees,
      fee_category: values.auto_add_to_fees ? values.fee_category : null,
      unit_cost: values.unit_cost != null ? Number(values.unit_cost) : null,
      allow_price_override: !!values.allow_price_override,
      internal_notes: values.internal_notes?.trim() || null,
      is_active: true,
    };

    return isEdit
      ? inventoryItemsService.update(editing.id, schoolCode, payload)
      : inventoryItemsService.create(schoolCode, userId, payload);
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Inventory Item' : 'Create Inventory Item'}
      okText={isEdit ? 'Save' : 'Create Item'}
      editing={editing}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onSaved}
      successMessage={isEdit ? 'Item updated' : 'Item created'}
      errorMessage="Failed to save item"
    >
      {(form) => <InventoryItemFormBody form={form} isEdit={isEdit} />}
    </FormDrawer>
  );
}

function InventoryItemFormBody({ form, isEdit }) {
  const trackQuantity   = Form.useWatch('track_quantity',   form);
  const canBeIssued     = Form.useWatch('can_be_issued',    form);
  const mustBeReturned  = Form.useWatch('must_be_returned', form);
  const isChargeable    = Form.useWatch('is_chargeable',    form);
  const autoAddToFees   = Form.useWatch('auto_add_to_fees', form);
  const chargeType      = Form.useWatch('charge_type',      form);
  const chargeAmount    = Form.useWatch('charge_amount',    form);
  const currentQuantity = Form.useWatch('current_quantity', form);

  const exampleFee = useMemo(() => {
    if (!isChargeable || !chargeAmount) return null;
    const qty = Number(currentQuantity) || 1;
    return { perItem: chargeAmount, total: chargeAmount * qty };
  }, [isChargeable, chargeAmount, currentQuantity]);

  return (
    <>
      {/* ── Basics ── */}
      <Title level={5} style={{ marginTop: 0 }}>1. Basics</Title>
      <Form.Item label="Item Name" name="name" rules={[validators.required('Item name')]}>
        <Input placeholder="e.g., Mathematics Textbook Grade 5" />
      </Form.Item>

      <Form.Item label="Category" name="category" rules={[validators.required('Category')]}>
        <Input placeholder="e.g., Books, Uniform, Devices, Sports" />
      </Form.Item>

      <Form.Item label="Description" name="description">
        <TextArea rows={2} placeholder="Optional description" />
      </Form.Item>

      <Divider />

      {/* ── Tracking ── */}
      <Title level={5}>2. Tracking</Title>
      <Form.Item
        name="track_quantity"
        valuePropName="checked"
        label="Track quantity"
        tooltip="Monitor how many of this item are available"
      >
        <Switch />
      </Form.Item>

      {trackQuantity && (
        <>
          <Form.Item label="Current Quantity" name="current_quantity">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item
            label="Low Stock Alert Threshold"
            name="low_stock_threshold"
            tooltip="Items at or below this number will be flagged as low stock"
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 10" />
          </Form.Item>
          <Form.Item
            name="track_serially"
            valuePropName="checked"
            label="Track each unit individually (serial numbers)"
            tooltip="Use for devices, books with unique IDs, etc."
          >
            <Switch />
          </Form.Item>
        </>
      )}

      <Divider />

      {/* ── Issuance ── */}
      <Title level={5}>3. Issuance</Title>
      <Form.Item name="can_be_issued" valuePropName="checked" label="Can be issued to students or staff">
        <Switch />
      </Form.Item>

      {canBeIssued && (
        <>
          <Form.Item
            label="Issue To"
            name="issue_to"
            rules={[{ required: canBeIssued, message: 'Select who can receive this item' }]}
          >
            <Radio.Group optionType="button" buttonStyle="solid" options={ISSUE_TO_OPTIONS} />
          </Form.Item>

          <Form.Item name="must_be_returned" valuePropName="checked" label="Must be returned (e.g. library books, devices)">
            <Switch />
          </Form.Item>

          {mustBeReturned && (
            <Form.Item
              label="Return Duration (days)"
              name="return_duration_days"
              rules={[{ required: mustBeReturned, message: 'Required when item must be returned' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 7" />
            </Form.Item>
          )}
        </>
      )}

      <Divider />

      {/* ── Fees ── */}
      <Title level={5}>4. Fees</Title>
      <Form.Item name="is_chargeable" valuePropName="checked" label="This item is chargeable">
        <Switch />
      </Form.Item>

      {!isChargeable && (
        <Alert type="info" showIcon message="No fee will be added when this item is issued." style={{ marginBottom: 12 }} />
      )}

      {isChargeable && (
        <>
          <Form.Item
            label="Charge Type"
            name="charge_type"
            rules={[{ required: isChargeable, message: 'Select charge type' }]}
          >
            <Radio.Group optionType="button" buttonStyle="solid" options={CHARGE_TYPES} />
          </Form.Item>

          <Form.Item
            label="Amount (₹)"
            name="charge_amount"
            rules={[{ required: isChargeable, message: 'Amount is required' }]}
          >
            <InputNumber min={0} step={50} style={{ width: '100%' }} placeholder="0.00" prefix="₹" />
          </Form.Item>

          {mustBeReturned && chargeType === 'one_time' && (
            <Alert
              type="warning"
              showIcon
              message="One-time charge with returnable items may confuse families. Consider a refundable deposit instead."
              style={{ marginBottom: 12 }}
            />
          )}

          {exampleFee && (
            <Alert
              type="success"
              showIcon
              message={`Example: issuing ${Number(currentQuantity) || 1} unit${(Number(currentQuantity) || 1) === 1 ? '' : 's'} → ₹${exampleFee.total.toFixed(2)} added to fees${chargeType === 'deposit' ? ' (refundable on return)' : ''}`}
              style={{ marginBottom: 12 }}
            />
          )}

          <Form.Item
            name="auto_add_to_fees"
            valuePropName="checked"
            label="Add to student fee invoice automatically when issued"
          >
            <Switch />
          </Form.Item>

          {autoAddToFees && (
            <Form.Item
              label="Fee Category"
              name="fee_category"
              rules={[{ required: autoAddToFees, message: 'Select a fee category' }]}
            >
              <Radio.Group optionType="button" buttonStyle="solid" options={FEE_CATEGORIES} />
            </Form.Item>
          )}
        </>
      )}

      <Divider />

      {/* ── Advanced ── */}
      <Collapse
        ghost
        items={[{
          key: 'adv',
          label: <Title level={5} style={{ margin: 0 }}>5. Advanced (internal)</Title>,
          children: (
            <>
              <Form.Item label="Unit Cost (internal — not shown to families)" name="unit_cost">
                <InputNumber min={0} step={10} style={{ width: '100%' }} placeholder="0.00" prefix="₹" />
              </Form.Item>
              <Form.Item name="allow_price_override" valuePropName="checked" label="Allow price override at issue time">
                <Switch />
              </Form.Item>
              <Form.Item label="Internal Notes" name="internal_notes">
                <TextArea rows={3} placeholder="Internal notes — not visible to families" />
              </Form.Item>
            </>
          ),
        }]}
      />

      <div style={{ height: 12 }} />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {isEdit ? 'Changes apply immediately. Existing issuance records are not affected.' :
          'New items default to active. You can soft-delete or edit later.'}
      </Text>
    </>
  );
}
