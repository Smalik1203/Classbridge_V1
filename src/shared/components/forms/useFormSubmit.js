import { useState, useCallback } from 'react';
import { App } from 'antd';

/**
 * Standard submit pipeline for AntD forms: validateFields -> action -> toast.
 *
 *   const { submit, saving } = useFormSubmit(form, async (values) => {
 *     return await myService.create(values);
 *   }, { successMessage: 'Saved', onSuccess, onClose });
 *
 *   <Modal onOk={submit} confirmLoading={saving} ... />
 *
 * - Calls form.validateFields() and short-circuits on validation errors
 *   (AntD already renders them inline).
 * - Catches everything else and shows message.error(err.message).
 * - Toggles `saving` so callers don't re-implement the loading flag.
 * - On success: shows the success toast (if provided), then onSuccess(result),
 *   then onClose. Order matters — onSuccess runs before close so callers can
 *   refresh their list while the modal is still mounted.
 */
export default function useFormSubmit(form, action, options = {}) {
  const {
    successMessage,
    errorMessage = 'Failed to save',
    onSuccess,
    onClose,
  } = options;
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const submit = useCallback(async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch (e) {
      if (e?.errorFields) return; // inline validation errors, nothing to do
      message.error(e.message || errorMessage);
      return;
    }

    setSaving(true);
    try {
      const result = await action(values);
      if (successMessage) message.success(successMessage);
      onSuccess?.(result);
      onClose?.();
    } catch (e) {
      message.error(e?.message || errorMessage);
    } finally {
      setSaving(false);
    }
  }, [form, action, successMessage, errorMessage, onSuccess, onClose, message]);

  return { submit, saving, setSaving };
}
