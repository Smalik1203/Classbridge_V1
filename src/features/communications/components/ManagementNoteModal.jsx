import React, { useEffect, useState } from 'react';
import { Form, Select, Input, Radio, Checkbox, App } from 'antd';
import { FormModal, validators } from '../../../shared/components/forms';
import { feedbackService, MANAGEMENT_NOTE_CATEGORIES, CATEGORY_LABELS } from '../services/communicationsService';

const { TextArea } = Input;

export default function ManagementNoteModal({ open, onClose, onSaved, schoolCode, fromUserId }) {
  const { message } = App.useApp();
  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    if (!open) return;
    feedbackService.listRecipients(schoolCode)
      .then((r) => setRecipients(r.filter((u) => u.role === 'admin' || u.role === 'teacher')))
      .catch((e) => message.error(e.message || 'Failed to load recipients'));
  }, [open, schoolCode, message]);

  const handleSubmit = async (v) => {
    return feedbackService.addManagementNote({
      from_user_id: fromUserId,
      to_user_id: v.to_user_id,
      category: v.category,
      content: v.content,
      requires_acknowledgement: !!v.requires_acknowledgement,
      school_code: schoolCode,
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Add Management Note"
      okText="Send note"
      width={600}
      requiredMark="optional"
      getInitialValues={() => ({ category: 'observation' })}
      onSubmit={handleSubmit}
      onSaved={onSaved}
      successMessage="Management note sent"
      errorMessage="Failed to send note"
    >
      {() => (<>
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
        <Form.Item label="Category" name="category" rules={[validators.required('Category')]}>
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
      </>)}
    </FormModal>
  );
}
