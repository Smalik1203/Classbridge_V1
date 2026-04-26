import React from 'react';
import { Form, Input, Select, DatePicker, Switch, Row, Col } from 'antd';
import { FormModal, validators, toDayjs, fromDayjs } from '../../../shared/components/forms';
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
  const isEdit = !!employee?.id;

  const getInitialValues = (editing) => editing ? {
    ...editing,
    date_of_birth: toDayjs(editing.date_of_birth),
    join_date: toDayjs(editing.join_date),
    confirmation_date: toDayjs(editing.confirmation_date),
    relieving_date: toDayjs(editing.relieving_date),
  } : {
    status: 'active',
    employment_type: 'permanent',
    is_tds_applicable: true,
  };

  const handleSubmit = async (v) => {
    const payload = {
      ...v,
      school_code: schoolCode,
      date_of_birth: fromDayjs(v.date_of_birth),
      join_date: fromDayjs(v.join_date),
      confirmation_date: fromDayjs(v.confirmation_date),
      relieving_date: fromDayjs(v.relieving_date),
    };
    return isEdit
      ? hrService.updateEmployee(employee.id, payload)
      : hrService.createEmployee(payload);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit · ${employee?.full_name}` : 'Add New Employee'}
      okText={isEdit ? 'Save Changes' : 'Create Employee'}
      width={760}
      requiredMark
      editing={employee}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onSaved}
      successMessage={isEdit ? 'Employee updated' : 'Employee created'}
    >
      {() => (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="employee_code" label="Employee Code" rules={[validators.required('Employee code')]}>
              <Input placeholder="EMP001" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="full_name" label="Full Name" rules={[validators.required('Full name')]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="department" label="Department" rules={[validators.required('Department')]}>
              <Input placeholder="e.g. Mathematics" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="designation" label="Designation" rules={[validators.required('Designation')]}>
              <Input placeholder="e.g. Senior Teacher" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="employment_type" label="Employment Type" rules={[validators.required('Employment type')]}>
              <Select options={EMPLOYMENT_TYPES} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="Status" rules={[validators.required('Status')]}>
              <Select options={STATUSES} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="gender" label="Gender">
              <Select options={GENDERS} allowClear />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="join_date" label="Join Date" rules={[validators.required('Join date')]}>
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
            <Form.Item name="email" label="Email" rules={[validators.email()]}>
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
      )}
    </FormModal>
  );
}
