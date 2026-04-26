import React from 'react';
import { Form, Input, Radio, Switch } from 'antd';
import { FormModal, validators } from '../../../shared/components/forms';
import { financeCategoriesService } from '../services/financeService';

export default function CategoryFormModal({
  open, onClose, onSuccess, mode = 'create', category = null,
  schoolCode, userId, userRole, defaultType = 'expense',
}) {
  const isEdit = mode === 'edit' && !!category;

  const getInitialValues = () => isEdit ? {
    name: category.name,
    type: category.type,
    is_active: category.is_active,
  } : {
    name: '',
    type: defaultType,
    is_active: true,
  };

  const handleSubmit = async (values) => {
    if (isEdit) {
      return financeCategoriesService.update({
        id: category.id, schoolCode, userId, userRole,
        name: values.name, type: values.type, isActive: values.is_active,
      });
    }
    return financeCategoriesService.create({
      schoolCode, userId, userRole,
      name: values.name, type: values.type,
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Category' : 'New Category'}
      okText={isEdit ? 'Save changes' : 'Create category'}
      requiredMark={false}
      editing={isEdit ? category : null}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onSuccess}
      successMessage={isEdit ? 'Category updated' : 'Category created'}
      errorMessage="Failed to save category"
    >
      {() => (<>
        <Form.Item name="type" label="Type" rules={[validators.required('Type')]}>
          <Radio.Group buttonStyle="solid" disabled={isEdit}>
            <Radio.Button value="expense">Expense</Radio.Button>
            <Radio.Button value="income">Income</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="name" label="Name" rules={[validators.required('Name')]}>
          <Input placeholder="e.g. Salaries / Utilities / Tuition Fees" maxLength={120} />
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
