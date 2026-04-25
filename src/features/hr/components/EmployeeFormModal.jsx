import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, Select, DatePicker, Switch, Row, Col, App,
} from 'antd';
import dayjs from 'dayjs';
import { hrService } from '../services/hrService';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const EMPLOYMENT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'probation', label: 'Probation' },
  { value: 'part_time', label: 'Part-time' },
];

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_notice', label: 'On Notice' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Terminated' },
];

export default function EmployeeFormModal({ open, onClose, schoolCode, employee, onSaved }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  const isEdit = !!employee?.id;

  useEffect(() => {
    if (open) {
      if (employee) {
        form.setFieldsValue({
          ...employee,
          date_of_birth: employee.date_of_birth ? dayjs(employee.date_of_birth) : null,
          join_date: employee.join_date ? dayjs(employee.join_date) : null,
          confirmation_date: employee.confirmation_date ? dayjs(employee.confirmation_date) : null,
          relieving_date: employee.relieving_date ? dayjs(employee.relieving_date) : null,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status: 'active', employment_type: 'permanent', is_tds_applicable: true });
      }
    }
  }, [open, employee, form]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      const payload = {
        ...v,
        school_code: schoolCode,
        date_of_birth: v.date_of_birth ? v.date_of_birth.format('YYYY-MM-DD') : null,
        join_date: v.join_date ? v.join_date.format('YYYY-MM-DD') : null,
        confirmation_date: v.confirmation_date ? v.confirmation_date.format('YYYY-MM-DD') : null,
        relieving_date: v.relieving_date ? v.relieving_date.format('YYYY-MM-DD') : null,
      };
      const saved = isEdit
        ? await hrService.updateEmployee(employee.id, payload)
        : await hrService.createEmployee(payload);
      message.success(isEdit ? 'Employee updated' : 'Employee created');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e?.errorFields) return; // validation error already shown by AntD
      message.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText={isEdit ? 'Save Changes' : 'Create Employee'}
      title={isEdit ? `Edit · ${employee?.full_name}` : 'Add New Employee'}
      confirmLoading={saving}
      width={760}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="employee_code" label="Employee Code" rules={[{ required: true }]}>
              <Input placeholder="EMP001" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="department" label="Department" rules={[{ required: true }]}>
              <Input placeholder="e.g. Mathematics" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="designation" label="Designation" rules={[{ required: true }]}>
              <Input placeholder="e.g. Senior Teacher" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="employment_type" label="Employment Type" rules={[{ required: true }]}>
              <Select options={EMPLOYMENT_TYPES} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select options={STATUSES} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="gender" label="Gender">
              <Select options={GENDERS} allowClear />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="join_date" label="Join Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="confirmation_date" label="Confirmation Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="relieving_date" label="Relieving Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="Email">
              <Input type="email" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="address" label="Address">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="date_of_birth" label="Date of Birth">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="pan_number" label="PAN Number">
              <Input style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="bank_account_number" label="Bank Account #">
              <Input />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="bank_ifsc" label="IFSC">
              <Input style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="bank_name" label="Bank Name">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="is_tds_applicable" label="TDS Applicable" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
