import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Input, Segmented, Space, Button, Tag, Avatar, Card, Typography, App, Empty, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, UserOutlined, MailOutlined, PhoneOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { hrService } from '../services/hrService';
import EmployeeFormModal from '../components/EmployeeFormModal';

const { Title, Text } = Typography;

const STATUS_COLORS = {
  active: 'green',
  on_notice: 'orange',
  inactive: 'default',
  terminated: 'red',
};

const STATUS_LABELS = {
  active: 'Active',
  on_notice: 'On Notice',
  inactive: 'Inactive',
  terminated: 'Terminated',
};

export default function StaffDirectory() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await hrService.listEmployees(schoolCode);
      setEmployees(data);
    } catch (e) {
      message.error(e.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (departmentFilter !== 'all' && e.department !== departmentFilter) return false;
      if (q) {
        const blob = `${e.full_name} ${e.employee_code} ${e.designation} ${e.department} ${e.phone ?? ''} ${e.email ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [employees, search, statusFilter, departmentFilter]);

  const counts = useMemo(() => ({
    all: employees.length,
    active: employees.filter((e) => e.status === 'active').length,
    on_notice: employees.filter((e) => e.status === 'on_notice').length,
    inactive: employees.filter((e) => e.status === 'inactive').length,
  }), [employees]);

  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => (
        <Space>
          <Avatar src={r.photo_url} icon={<UserOutlined />} />
          <div>
            <div><Text strong>{r.full_name}</Text></div>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.employee_code}</Text>
          </div>
        </Space>
      ),
      sorter: (a, b) => a.full_name.localeCompare(b.full_name),
    },
    { title: 'Department', dataIndex: 'department', sorter: (a, b) => (a.department || '').localeCompare(b.department || '') },
    { title: 'Designation', dataIndex: 'designation' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s) => <Tag color={STATUS_COLORS[s] || 'default'}>{STATUS_LABELS[s] || s}</Tag>,
      filters: Object.keys(STATUS_LABELS).map((k) => ({ text: STATUS_LABELS[k], value: k })),
      onFilter: (v, r) => r.status === v,
    },
    {
      title: 'Joined',
      dataIndex: 'join_date',
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
      sorter: (a, b) => (a.join_date || '').localeCompare(b.join_date || ''),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, r) => (
        <Space size={4}>
          {r.phone && <Tooltip title={r.phone}><a href={`tel:${r.phone}`}><PhoneOutlined /></a></Tooltip>}
          {r.email && <Tooltip title={r.email}><a href={`mailto:${r.email}`}><MailOutlined /></a></Tooltip>}
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={(e) => { e.stopPropagation(); setEditing(r); setModalOpen(true); }}>Edit</Button>
          <Button size="small" type="link" onClick={() => navigate(`/hr/staff/${r.id}`)}>Open</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr')}>HR Hub</Button>
      </Space>

      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Staff Directory</Title>
            <Text type="secondary">{filtered.length} of {employees.length} staff</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
              Add Employee
            </Button>
          </Space>
        </Space>

        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search name / code / designation / phone / email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 360 }}
          />
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: `All (${counts.all})`, value: 'all' },
              { label: `Active (${counts.active})`, value: 'active' },
              { label: `On Notice (${counts.on_notice})`, value: 'on_notice' },
              { label: `Inactive (${counts.inactive})`, value: 'inactive' },
            ]}
          />
        </Space>

        <Space wrap style={{ marginBottom: 16 }}>
          {departments.map((d) => (
            <Tag.CheckableTag key={d} checked={departmentFilter === d} onChange={() => setDepartmentFilter(d)}>
              {d === 'all' ? 'All departments' : d}
            </Tag.CheckableTag>
          ))}
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          locale={{ emptyText: <Empty description={employees.length === 0 ? 'No staff yet — add your first employee' : 'No matches'} /> }}
          onRow={(r) => ({
            onClick: () => navigate(`/hr/staff/${r.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <EmployeeFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        schoolCode={schoolCode}
        employee={editing}
        onSaved={() => load()}
      />
    </div>
  );
}
