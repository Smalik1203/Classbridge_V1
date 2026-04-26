import React from 'react';
import { Form, Input, Select, Radio, Row, Col, DatePicker } from 'antd';
import { FormModal, validators, toDayjs, fromDayjs } from '../../../shared/components/forms';
import { admissionsService, SOURCES, PRIORITIES, RELATIONSHIPS, GENDERS } from '../services/admissionsService';

const { TextArea } = Input;

/**
 * Create or edit an admission enquiry. Mobile only supports create; web extends
 * this to full edit (mirror of the edit-any-field service method).
 */
export default function EnquiryFormModal({ open, onClose, schoolCode, editing, onSaved }) {
  const isEdit = !!editing;

  const getInitialValues = (editing) => editing ? {
    student_name: editing.student_name,
    date_of_birth: toDayjs(editing.date_of_birth),
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
  } : {
    source: 'walk_in',
    priority: 'medium',
    parent_relationship: 'parent',
  };

  const handleSubmit = async (values) => {
    const payload = {
      student_name: values.student_name.trim(),
      class_applying_for: values.class_applying_for.trim(),
      parent_name: values.parent_name.trim(),
      parent_phone: values.parent_phone.trim(),
      parent_email: values.parent_email?.trim() || undefined,
      parent_relationship: values.parent_relationship,
      gender: values.gender,
      date_of_birth: fromDayjs(values.date_of_birth) || undefined,
      address: values.address?.trim() || undefined,
      source: values.source,
      priority: values.priority,
      notes: values.notes?.trim() || undefined,
    };
    return isEdit
      ? admissionsService.update(editing.id, payload)
      : admissionsService.create(schoolCode, payload);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Enquiry' : 'New Enquiry'}
      okText={isEdit ? 'Save Changes' : 'Log Enquiry'}
      width={680}
      editing={editing}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onSaved}
      successMessage={isEdit ? 'Enquiry updated' : 'Enquiry logged'}
      errorMessage="Failed to save enquiry"
    >
      {() => (<>
        <div style={{ fontWeight: 600, marginBottom: 8, color: '#6B7280', fontSize: 12, letterSpacing: 0.4 }}>
          STUDENT
        </div>
        <Row gutter={12}>
          <Col xs={24} md={14}>
            <Form.Item name="student_name" label="Full Name" rules={[validators.required('Student name')]}>
              <Input placeholder="Student full name" autoComplete="off" />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item name="class_applying_for" label="Applying for Class" rules={[validators.required('Class')]}>
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
            <Form.Item name="parent_name" label="Name" rules={[validators.required('Parent name')]}>
              <Input placeholder="Parent full name" />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="parent_relationship" label="Relationship">
              <Select options={RELATIONSHIPS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="parent_phone" label="Phone" rules={[validators.required('Phone')]}>
              <Input placeholder="Mobile number" inputMode="tel" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="parent_email" label="Email" rules={[validators.email()]}>
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
      </>)}
    </FormModal>
  );
}
