import React from 'react';
import { Form, Input, InputNumber, Select, Switch } from 'antd';
import { FormModal, validators } from '../../../shared/components/forms';
import { hrService } from '../services/hrService';

const TYPES = [
  { value: 'earning',               label: 'Earning' },
  { value: 'deduction',             label: 'Deduction' },
  { value: 'employer_contribution', label: 'Employer Contribution' },
];

export default function SalaryComponentForm({ open, onClose, schoolCode, component, onSaved }) {
  const isEdit = !!component?.id;

  const getInitialValues = (editing) => editing ? { ...editing } : {
    type: 'earning',
    is_taxable: true,
    is_pt_basis: false,
    is_fixed: true,
    is_active: true,
    display_order: 0,
  };

  // Mobile parity note: there is no update RPC for salary components — both
  // create and "edit" go through createSalaryComponent. Edits effectively
  // create a new record, matching mobile behaviour.
  const handleSubmit = async (v) => {
    return hrService.createSalaryComponent({ ...v, school_code: schoolCode });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit · ${component?.name}` : 'New Salary Component'}
      okText={isEdit ? 'Save' : 'Create'}
      editing={component}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onSaved}
      successMessage={isEdit
        ? 'Saved (note: schema may treat this as a new record)'
        : 'Component created'}
      errorMessage="Failed"
    >
      {() => (<>
        <Form.Item name="name" label="Name" rules={[validators.required('Name')]}>
          <Input placeholder="e.g. Basic, HRA, PF, ESI" />
        </Form.Item>
        <Form.Item name="type" label="Type" rules={[validators.required('Type')]}>
          <Select options={TYPES} />
        </Form.Item>
        <Form.Item name="display_order" label="Display Order">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="formula" label="Formula (optional)" tooltip="e.g. basic * 0.4">
          <Input />
        </Form.Item>
        <Form.Item name="is_fixed" label="Fixed amount (vs computed by formula)" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="is_taxable" label="Taxable" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="is_pt_basis" label="Counts toward Professional Tax basis" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="is_active" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </>)}
    </FormModal>
  );
}
