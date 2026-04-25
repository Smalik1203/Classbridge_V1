import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Radio, Row, Col, DatePicker, App } from 'antd';
import dayjs from 'dayjs';
import { admissionsService, SOURCES, PRIORITIES, RELATIONSHIPS, GENDERS } from '../services/admissionsService';

const { TextArea } = Input;

/**
 * Create or edit an admission enquiry. Mobile only supports create; web extends
 * this to full edit (mirror of the edit-any-field service method).
 */
export default function EnquiryFormModal({ open, onClose, schoolCode, editing, onSaved }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [saving, setSaving] = React.useState(false);

  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        student_name: editing.student_name,
        date_of_birth: editing.date_of_birth ? dayjs(editing.date_of_birth) : null,
        gender: editing.gender || undefined,
        class_applying_for: editing.class_applying_for,
        parent_name: editing.parent_name,
        parent_phone: editing.parent_phone,
        parent_email: editing.parent_email || undefined,
        parent_relationship: editing.parent_relationship || 'parent',
        address: editing.address || undefined,
        source: editing.source || 'walk_in',
        priority: editing.priority || 'medium',
        notes: editing.notes || undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        source: 'walk_in',
        priority: 'medium',
        parent_relationship: 'parent',
      });
    }
  }, [open, editing, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        student_name: values.student_name.trim(),
        class_applying_for: values.class_applying_for.trim(),
        parent_name: values.parent_name.trim(),
        parent_phone: values.parent_phone.trim(),
        parent_email: values.parent_email?.trim() || undefined,
        parent_relationship: values.parent_relationship,
        gender: values.gender,
        date_of_birth: values.date_of_birth ? values.date_of_birth.format('YYYY-MM-DD') : undefined,
        address: values.address?.trim() || undefined,
        source: values.source,
        priority: values.priority,
        notes: values.notes?.trim() || undefined,
      };
      if (isEdit) {
        await admissionsService.update(editing.id, payload);
        message.success('Enquiry updated');
      } else {
        await admissionsService.create(schoolCode, payload);
        message.success('Enquiry logged');
      }
      onSaved?.();
      onClose();
    } catch (e) {
      if (e?.errorFields) return; // form validation
      message.error(e.message || 'Failed to save enquiry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Enquiry' : 'New Enquiry'}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      okText={isEdit ? 'Save Changes' : 'Log Enquiry'}
      confirmLoading={saving}
      width={680}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <div style={{ fontWeight: 600, marginBottom: 8, color: '#6B7280', fontSize: 12, letterSpacing: 0.4 }}>
          STUDENT
        </div>
        <Row gutter={12}>
          <Col xs={24} md={14}>
            <Form.Item
              name="student_name"
              label="Full Name"
              rules={[{ required: true, message: 'Student name is required' }]}
            >
              <Input placeholder="Student full name" autoComplete="off" />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item
              name="class_applying_for"
              label="Applying for Class"
              rules={[{ required: true, message: 'Class is required' }]}
            >
              <Input placeholder="e.g. 5, LKG, Class 10" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={12} md={8}>
            <Form.Item name="date_of_birth" label="Date of Birth">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="gender" label="Gender">
              <Select placeholder="Select" allowClear options={GENDERS} />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ fontWeight: 600, margin: '8px 0 8px', color: '#6B7280', fontSize: 12, letterSpacing: 0.4 }}>
          PARENT / GUARDIAN
        </div>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item
              name="parent_name"
              label="Name"
              rules={[{ required: true, message: 'Parent name is required' }]}
            >
              <Input placeholder="Parent full name" />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="parent_relationship" label="Relationship">
              <Select options={RELATIONSHIPS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item
              name="parent_phone"
              label="Phone"
              rules={[{ required: true, message: 'Phone is required' }]}
            >
              <Input placeholder="Mobile number" inputMode="tel" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="parent_email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
              <Input placeholder="Optional" inputMode="email" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="address" label="Address">
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ fontWeight: 600, margin: '8px 0 8px', color: '#6B7280', fontSize: 12, letterSpacing: 0.4 }}>
          SOURCE & PRIORITY
        </div>
        <Form.Item name="source" label="Source">
          <Radio.Group optionType="button" buttonStyle="solid" options={SOURCES} />
        </Form.Item>
        <Form.Item name="priority" label="Priority">
          <Radio.Group optionType="button" buttonStyle="solid" options={PRIORITIES.map(p => ({ label: p.label, value: p.value }))} />
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <TextArea placeholder="Any additional context (optional)" rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
