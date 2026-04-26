import React, { useEffect } from 'react';
import { Drawer, Form, Button, Space } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import useFormSubmit from './useFormSubmit';

/**
 * Drawer counterpart to FormModal. Same contract: render-prop children,
 * automatic prefill on open, standardised submit pipeline.
 *
 * Custom footer buttons live in the Drawer `extra` slot (top-right) — that's
 * what the existing inventory drawer already does, so we keep that pattern.
 */
export default function FormDrawer({
  open,
  onClose,
  title,
  okText = 'Save',
  cancelText = 'Cancel',
  width,
  drawerProps,
  formProps,
  layout = 'vertical',
  requiredMark = false,
  editing = null,
  getInitialValues,
  onSubmit,
  onSaved,
  successMessage,
  errorMessage,
  children,
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    const initial = getInitialValues ? getInitialValues(editing) : null;
    form.resetFields();
    if (initial) form.setFieldsValue(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const { submit, saving } = useFormSubmit(form, onSubmit, {
    successMessage,
    errorMessage,
    onSuccess: onSaved,
    onClose,
  });

  const computedWidth = width ?? Math.min(640, (typeof window !== 'undefined' ? window.innerWidth : 720) - 24);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      width={computedWidth}
      destroyOnClose
      extra={
        <Space>
          <Button icon={<CloseOutlined />} onClick={onClose} disabled={saving}>{cancelText}</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={submit} loading={saving}>
            {okText}
          </Button>
        </Space>
      }
      {...drawerProps}
    >
      <Form form={form} layout={layout} requiredMark={requiredMark} {...formProps}>
        {typeof children === 'function' ? children(form) : children}
      </Form>
    </Drawer>
  );
}
