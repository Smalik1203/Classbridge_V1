import React from 'react';
import { Form, Input, Select, Switch } from 'antd';
import { FormModal, validators } from '../../../shared/components/forms';
import { financeAccountsService } from '../services/financeService';

export default function AccountFormModal({
  open, onClose, onSuccess, mode = 'create', account = null,
  schoolCode, userId, userRole,
}) {
  const isEdit = mode === 'edit' && !!account;

  const getInitialValues = () => isEdit ? {
    name: account.name,
    type: account.type,
    is_active: account.is_active,
  } : {
    name: '',
    type: 'cash',
    is_active: true,
  };

  const handleSubmit = async (values) => {
    if (isEdit) {
      return financeAccountsService.update({
        id: account.id, schoolCode, userId, userRole,
        name: values.name, type: values.type, isActive: values.is_active,
      });
    }
    return financeAccountsService.create({
      schoolCode, userId, userRole,
      name: values.name, type: values.type,
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Account' : 'New Account'}
      okText={isEdit ? 'Save changes' : 'Create account'}
      requiredMark={false}
      editing={isEdit ? account : null}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onSuccess}
      successMessage={isEdit ? 'Account updated' : 'Account created'}
      errorMessage="Failed to save account"
    >
      {() => (<>
        <Form.Item name="name" label="Name" rules={[validators.required('Name')]}>
          <Input placeholder="e.g. SBI Current A/C 1234" maxLength={120} />
        </Form.Item>
        <Form.Item name="type" label="Type" rules={[validators.required('Type')]}>
          <Select
            options={[
              { value: 'cash',    label: 'Cash (physical drawer / petty cash)' },
              { value: 'bank',    label: 'Bank (current / savings / cheque)' },
              { value: 'virtual', label: 'Virtual (UPI / wallet / online gateway)' },
            ]}
          />
        </Form.Item>
        {isEdit && (
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </>)}
    </FormModal>
  );
}
