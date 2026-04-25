import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Typography, Table, App, Empty, Tag, Skeleton, Input, Segmented,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, ReloadOutlined, EditOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { hrService } from '../services/hrService';
import SalaryComponentForm from '../components/SalaryComponentForm';

const { Title, Text } = Typography;

const TYPE_COLOR = { earning: 'green', deduction: 'red', employer_contribution: 'blue' };

export default function SalaryComponents() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await hrService.listSalaryComponents(schoolCode);
      setComponents(data);
    } catch (e) {
      message.error(e.message || 'Failed to load components');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const q = search.trim().toLowerCase();
  const filtered = components.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (q && !`${c.name} ${c.formula ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  if (loading && components.length === 0) return <Skeleton active paragraph={{ rows: 8 }} />;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr')}>HR Hub</Button>
      </Space>

      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Salary Components</Title>
            <Text type="secondary">Define earnings, deductions, and employer contributions used in salary structures.</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setEditorOpen(true); }}>
              Add Component
            </Button>
          </Space>
        </Space>

        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search by name or formula"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <Segmented
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: `All (${components.length})`, value: 'all' },
              { label: `Earnings (${components.filter((c) => c.type === 'earning').length})`, value: 'earning' },
              { label: `Deductions (${components.filter((c) => c.type === 'deduction').length})`, value: 'deduction' },
              { label: `Employer (${components.filter((c) => c.type === 'employer_contribution').length})`, value: 'employer_contribution' },
            ]}
          />
        </Space>

        <Table
          rowKey="id"
          dataSource={filtered}
          loading={loading}
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: <Empty description={components.length === 0 ? 'No components yet — add the first one' : 'No matches'} /> }}
          columns={[
            { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
            { title: 'Type', dataIndex: 'type', render: (t) => <Tag color={TYPE_COLOR[t] || 'default'}>{t}</Tag>, filters: Object.keys(TYPE_COLOR).map((k) => ({ text: k, value: k })), onFilter: (v, r) => r.type === v },
            { title: 'Order', dataIndex: 'display_order', align: 'right', width: 80 },
            { title: 'Fixed', dataIndex: 'is_fixed', render: (v) => v ? 'Yes' : 'No', width: 80 },
            { title: 'Formula', dataIndex: 'formula', render: (v) => v || <Text type="secondary">—</Text> },
            { title: 'Taxable', dataIndex: 'is_taxable', render: (v) => v ? <Tag color="orange">Tax</Tag> : '—' },
            { title: 'PT Basis', dataIndex: 'is_pt_basis', render: (v) => v ? <Tag color="purple">PT</Tag> : '—' },
            { title: 'Active', dataIndex: 'is_active', render: (v) => v ? <Tag color="blue">Active</Tag> : <Tag>Inactive</Tag> },
            {
              title: '',
              key: 'edit',
              render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); setEditorOpen(true); }} />,
            },
          ]}
        />
      </Card>

      <SalaryComponentForm
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        schoolCode={schoolCode}
        component={editing}
        onSaved={load}
      />
    </div>
  );
}
