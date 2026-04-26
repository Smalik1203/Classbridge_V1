import React, { useEffect } from 'react';
import { Modal, Form } from 'antd';
import useFormSubmit from './useFormSubmit';

/**
 * Standardised create/edit modal. Owns the AntD Form instance, the saving
 * state, the submit pipeline, and the open/close reset behaviour.
 *
 *   <FormModal
 *     open={open}
 *     onClose={onClose}
 *     title={editing ? 'Edit X' : 'New X'}
 *     okText={editing ? 'Save Changes' : 'Create'}
 *     editing={editing}
 *     getInitialValues={(editing) => ({ ... })}
 *     onSubmit={async (values) => editing
 *       ? await svc.update(editing.id, toPayload(values))
 *       : await svc.create(toPayload(values))}
 *     successMessage={editing ? 'Updated' : 'Created'}
 *     onSaved={refresh}
 *   >
 *     {(form) => (<>
 *       <Form.Item name="name" label="Name" rules={[required('Name')]}>
 *         <Input />
 *       </Form.Item>
 *     </>)}
 *   </FormModal>
 *
 * `children` is a render function that receives the form instance, so callers
 * can use Form.useWatch / form.setFieldValue without us re-exporting them.
 */
export default function FormModal({
  open,
  onClose,
  title,
  okText,
  cancelText,
  width = 680,
  modalProps,            // escape hatch for any other antd Modal prop
  formProps,             // escape hatch for any other antd Form prop
  layout = 'vertical',
  requiredMark = 'optional',
  editing = null,
  getInitialValues,      // (editing) => values
  onSubmit,              // async (values) => result
  onSaved,               // (result) => void  — called after successful submit
  successMessage,
  errorMessage,
  children,
}) {
  const [form] = Form.useForm();

  // Re-prefill whenever we open. If `editing` is null we reset to the values
  // returned for the create case (or just resetFields if none provided).
  useEffect(() => {
    if (!open) return;
    const initial = getInitialValues ? getInitialValues(editing) : null;
    form.resetFields();
    if (initial) form.setFieldsValue(initial);
    // We intentionally re-run only on `open` / `editing` flip — getInitialValues
    // is allowed to be a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const { submit, saving } = useFormSubmit(form, onSubmit, {
    successMessage,
    errorMessage,
    onSuccess: onSaved,
    onClose,
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      title={title}
      okText={okText}
      cancelText={cancelText}
      confirmLoading={saving}
      width={width}
      destroyOnClose
      {...modalProps}
    >
      <Form form={form} layout={layout} requiredMark={requiredMark} {...formProps}>
        {typeof children === 'function' ? children(form) : children}
      </Form>
    </Modal>
  );
}
