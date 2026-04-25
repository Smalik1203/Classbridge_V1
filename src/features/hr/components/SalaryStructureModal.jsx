import React, { useEffect, useState } from 'react';
import {
  Modal, Form, InputNumber, DatePicker, Table, Typography, App, Empty, Tag, Space, Button,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { hrService, formatINR } from '../services/hrService';
import SalaryComponentForm from './SalaryComponentForm';

const { Text } = Typography;

export default function SalaryStructureModal({ open, onClose, schoolCode, employee, onSaved }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [components, setComponents] = useState([]);
  const [lineAmounts, setLineAmounts] = useState({}); // component_id -> amount
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addCompOpen, setAddCompOpen] = useState(false);

  const reloadComponents = async () => {
    try {
      const comps = await hrService.listSalaryComponents(schoolCode);
      setComponents(comps);
    } catch (e) {
      message.error(e.message || 'Failed to reload components');
    }
  };

  useEffect(() => {
    if (!open || !schoolCode || !employee) return;
    (async () => {
      try {
        setLoading(true);
        const comps = await hrService.listSalaryComponents(schoolCode);
        setComponents(comps);
        const active = await hrService.getActiveSalaryStructure(employee.id);
        if (active) {
          form.setFieldsValue({
            ctc: active.structure.ctc,
            effective_from: dayjs(),
          });
          const map = {};
          active.lines.forEach((l) => { map[l.component_id] = Number(l.monthly_amount); });
          setLineAmounts(map);
        } else {
          form.resetFields();
          form.setFieldsValue({ effective_from: dayjs() });
          setLineAmounts({});
        }
      } catch (e) {
        message.error(e.message || 'Failed to load salary data');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [open, schoolCode, employee?.id]);

  const totalEarnings = components
    .filter((c) => c.type === 'earning')
    .reduce((s, c) => s + (Number(lineAmounts[c.id]) || 0), 0);
  const totalDeductions = components
    .filter((c) => c.type === 'deduction')
    .reduce((s, c) => s + (Number(lineAmounts[c.id]) || 0), 0);
  const monthlyNet = totalEarnings - totalDeductions;

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      const lines = components
        .map((c) => ({ component_id: c.id, monthly_amount: Number(lineAmounts[c.id]) || 0 }))
        .filter((l) => l.monthly_amount > 0);
      await hrService.setSalaryStructure({
        school_code: schoolCode,
        employee_id: employee.id,
        effective_from: v.effective_from.format('YYYY-MM-DD'),
        ctc: v.ctc,
        lines,
      });
      message.success('Salary structure updated');
      onSaved?.();
      onClose();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to save salary structure');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Component',
      key: 'name',
      render: (_, c) => (
        <Space>
          <Text>{c.name}</Text>
          <Tag color={c.type === 'earning' ? 'green' : c.type === 'deduction' ? 'red' : 'blue'}>{c.type}</Tag>
        </Space>
      ),
    },
    {
      title: 'Monthly Amount (₹)',
      key: 'amount',
      width: 200,
      render: (_, c) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={lineAmounts[c.id] ?? 0}
          onChange={(v) => setLineAmounts((p) => ({ ...p, [c.id]: v ?? 0 }))}
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Save Structure"
      title={`Salary Structure · ${employee?.full_name ?? ''}`}
      confirmLoading={saving}
      width={760}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Space size={16} style={{ marginBottom: 16 }}>
          <Form.Item name="ctc" label="Annual CTC (₹)" rules={[{ required: true, type: 'number', min: 1 }]} style={{ marginBottom: 0 }}>
            <InputNumber min={0} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="effective_from" label="Effective From" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
            <DatePicker />
          </Form.Item>
        </Space>

        <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{components.length} component{components.length === 1 ? '' : 's'} available</Text>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAddCompOpen(true)}>Add Component</Button>
        </Space>

        {components.length === 0 ? (
          <Empty description="No salary components defined for this school" />
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={loading}
            dataSource={components}
            columns={columns}
            pagination={false}
            summary={() => (
              <>
                <Table.Summary.Row>
                  <Table.Summary.Cell><Text strong>Total Earnings</Text></Table.Summary.Cell>
                  <Table.Summary.Cell><Text strong style={{ color: '#10B981' }}>{formatINR(totalEarnings)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell><Text strong>Total Deductions</Text></Table.Summary.Cell>
                  <Table.Summary.Cell><Text strong style={{ color: '#EF4444' }}>{formatINR(totalDeductions)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell><Text strong>Net (Monthly)</Text></Table.Summary.Cell>
                  <Table.Summary.Cell><Text strong>{formatINR(monthlyNet)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              </>
            )}
          />
        )}
      </Form>

      <SalaryComponentForm
        open={addCompOpen}
        onClose={() => setAddCompOpen(false)}
        schoolCode={schoolCode}
        component={null}
        onSaved={reloadComponents}
      />
    </Modal>
  );
}
