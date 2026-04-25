import React, { useEffect, useState } from 'react';
import {
  Modal, Table, Form, Input, InputNumber, Switch, Select, Button, Space, App, Popconfirm, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { hrService } from '../services/hrService';

export default function LeaveTypesModal({ open, onClose, schoolCode }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      setTypes(await hrService.listLeaveTypes(schoolCode));
    } catch (e) {
      message.error(e.message || 'Failed to load leave types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, schoolCode]);

  const openEditor = (lt) => {
    setEditing(lt);
    if (lt) {
      form.setFieldsValue(lt);
    } else {
      form.resetFields();
      form.setFieldsValue({ is_active: true, is_paid: true, requires_approval: true, is_carry_forwardable: false });
    }
    setEditorOpen(true);
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      const payload = { ...v, school_code: schoolCode };
      if (editing) {
        await hrService.updateLeaveType(editing.id, payload);
        message.success('Leave type updated');
      } else {
        await hrService.createLeaveType(payload);
        message.success('Leave type created');
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed');
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Leave Types" width={760} destroyOnClose>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>Add Type</Button>
      </Space>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={types}
        pagination={false}
        columns={[
          { title: 'Code', dataIndex: 'code' },
          { title: 'Name', dataIndex: 'name' },
          { title: 'Quota', dataIndex: 'annual_quota', align: 'right' },
          { title: 'Paid', dataIndex: 'is_paid', render: (v) => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
          { title: 'Carry Fwd', dataIndex: 'is_carry_forwardable', render: (v, r) => v ? `Up to ${r.max_carry_forward ?? '∞'}` : '—' },
          { title: 'Active', dataIndex: 'is_active', render: (v) => v ? <Tag color="blue">Active</Tag> : <Tag>Inactive</Tag> },
          { title: '', key: 'edit', render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(r)} /> },
        ]}
      />

      <Modal
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={submit}
        title={editing ? `Edit ${editing.name}` : 'New Leave Type'}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input placeholder="CL / SL / PL" style={{ textTransform: 'uppercase' }} /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="annual_quota" label="Annual Quota (days)" rules={[{ required: true, type: 'number', min: 0 }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="is_paid" label="Paid Leave" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="requires_approval" label="Requires Approval" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="is_carry_forwardable" label="Can Carry Forward" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="max_carry_forward" label="Max Carry Forward (days)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="gender_restricted_to" label="Gender Restricted To">
            <Select allowClear options={[{ value: 'male', label: 'Male only' }, { value: 'female', label: 'Female only' }, { value: 'other', label: 'Other only' }]} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
}
