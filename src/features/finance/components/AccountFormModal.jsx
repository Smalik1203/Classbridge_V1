import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Switch, App } from 'antd';
import { financeAccountsService } from '../services/financeService';

export default function AccountFormModal({
  open, onClose, onSuccess, mode = 'create', account = null,
  schoolCode, userId, userRole,
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && account) {
      form.setFieldsValue({
        name: account.name,
        type: account.type,
        is_active: account.is_active,
      });
    } else {
      form.setFieldsValue({ name: '', type: 'cash', is_active: true });
    }
  }, [open, mode, account, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (mode === 'edit' && account) {
        await financeAccountsService.update({
          id: account.id, schoolCode, userId, userRole,
          name: values.name, type: values.type, isActive: values.is_active,
        });
        message.success('Account updated');
      } else {
        await financeAccountsService.create({
          schoolCode, userId, userRole,
          name: values.name, type: values.type,
        });
        message.success('Account created');
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.message || 'Failed to save account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={mode === 'edit' ? 'Edit Account' : 'New Account'}
      okText={mode === 'edit' ? 'Save changes' : 'Create account'}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name required' }]}>
          <Input placeholder="e.g. SBI Current A/C 1234" maxLength={120} />
        </Form.Item>
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'cash',    label: 'Cash (physical drawer / petty cash)' },
              { value: 'bank',    label: 'Bank (current / savings / cheque)' },
              { value: 'virtual', label: 'Virtual (UPI / wallet / online gateway)' },
            ]}
          />
        </Form.Item>
        {mode === 'edit' && (
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
