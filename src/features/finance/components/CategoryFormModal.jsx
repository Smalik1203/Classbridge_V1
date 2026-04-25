import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Radio, Switch, App } from 'antd';
import { financeCategoriesService } from '../services/financeService';

export default function CategoryFormModal({
  open, onClose, onSuccess, mode = 'create', category = null,
  schoolCode, userId, userRole, defaultType = 'expense',
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && category) {
      form.setFieldsValue({
        name: category.name,
        type: category.type,
        is_active: category.is_active,
      });
    } else {
      form.setFieldsValue({ name: '', type: defaultType, is_active: true });
    }
  }, [open, mode, category, defaultType, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (mode === 'edit' && category) {
        await financeCategoriesService.update({
          id: category.id, schoolCode, userId, userRole,
          name: values.name, type: values.type, isActive: values.is_active,
        });
        message.success('Category updated');
      } else {
        await financeCategoriesService.create({
          schoolCode, userId, userRole,
          name: values.name, type: values.type,
        });
        message.success('Category created');
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={mode === 'edit' ? 'Edit Category' : 'New Category'}
      okText={mode === 'edit' ? 'Save changes' : 'Create category'}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Radio.Group buttonStyle="solid" disabled={mode === 'edit'}>
            <Radio.Button value="expense">Expense</Radio.Button>
            <Radio.Button value="income">Income</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name required' }]}>
          <Input placeholder="e.g. Salaries / Utilities / Tuition Fees" maxLength={120} />
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
