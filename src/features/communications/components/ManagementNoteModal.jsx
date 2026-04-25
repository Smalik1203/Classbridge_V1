import React, { useEffect, useState } from 'react';
import { Modal, Form, Select, Input, Radio, Checkbox, App } from 'antd';
import { feedbackService, MANAGEMENT_NOTE_CATEGORIES, CATEGORY_LABELS } from '../services/communicationsService';

const { TextArea } = Input;

export default function ManagementNoteModal({ open, onClose, onSaved, schoolCode, fromUserId }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [recipients, setRecipients] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    feedbackService.listRecipients(schoolCode)
      .then((r) => setRecipients(r.filter((u) => u.role === 'admin' || u.role === 'teacher')))
      .catch((e) => message.error(e.message || 'Failed to load recipients'));
    // eslint-disable-next-line
  }, [open]);

  const submit = async () => {
    let v;
    try { v = await form.validateFields(); } catch { return; }
    try {
      setSubmitting(true);
      await feedbackService.addManagementNote({
        from_user_id: fromUserId,
        to_user_id: v.to_user_id,
        category: v.category,
        content: v.content,
        requires_acknowledgement: !!v.requires_acknowledgement,
        school_code: schoolCode,
      });
      message.success('Management note sent');
      onSaved?.();
      onClose?.();
    } catch (e) {
      message.error(e.message || 'Failed to send note');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      title="Add Management Note"
      onCancel={submitting ? undefined : onClose}
      onOk={submit}
      okText="Send note"
      confirmLoading={submitting}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ category: 'observation' }}>
        <Form.Item label="Recipient" name="to_user_id" rules={[{ required: true, message: 'Select a recipient' }]}>
          <Select
            showSearch
            placeholder="Choose teacher or admin"
            optionFilterProp="label"
            options={recipients.map((u) => ({
              value: u.id,
              label: `${u.full_name} (${u.role})`,
            }))}
          />
        </Form.Item>
        <Form.Item label="Category" name="category" rules={[{ required: true }]}>
          <Radio.Group buttonStyle="solid" optionType="button">
            {MANAGEMENT_NOTE_CATEGORIES.map((c) => (
              <Radio.Button key={c} value={c}>{CATEGORY_LABELS[c]}</Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>
        <Form.Item label="Note" name="content" rules={[{ required: true, whitespace: true }]}>
          <TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="Share an observation, feedback or expectation…" />
        </Form.Item>
        <Form.Item name="requires_acknowledgement" valuePropName="checked">
          <Checkbox>Require recipient acknowledgement</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
