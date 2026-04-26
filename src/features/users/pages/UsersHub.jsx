import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Input, Space, Button, Tag, Typography, App, Select, Popconfirm,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, TeamOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/AuthProvider';

dayjs.extend(relativeTime);
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { usersService, ROLE_LABELS, ROLE_COLORS, invitableRoles } from '../services/usersService';
import AddUserModal from '../components/AddUserModal';

const { Title, Text } = Typography;
const { Option } = Select;

export default function UsersHub() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const myRole = getUserRole(user);
  const { message } = App.useApp();

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const canAdd = invitableRoles(myRole).length > 0;
  const canDelete = myRole === 'superadmin' || myRole === 'cb_admin';

  const load = async () => {
    try {
      setLoading(true);
      const data = await usersService.listAllUsers({
        schoolCode: myRole === 'cb_admin' ? undefined : schoolCode,
      });
      setUsers(data);
    } catch (e) {
      message.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode) return;
    usersService.listClassInstances(schoolCode)
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [schoolCode]);

  const classLookup = useMemo(() => {
    const map = new Map();
    for (const ci of classes) {
      map.set(ci.id, `${ci.class?.grade}-${ci.class?.section}`);
    }
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (classFilter !== 'all' && u.class_instance_id !== classFilter) return false;
      if (!q) return true;
      const blob = `${u.full_name ?? ''} ${u.email ?? ''} ${u.phone ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [users, search, roleFilter, classFilter]);

  const handleDelete = async (record) => {
    setDeletingId(record.id);
    try {
      if (record.role === 'student') {
        await usersService.deleteStudent(record.id);
      } else {
        await usersService.deleteAdmin(record.id);
      }
      message.success(`${record.full_name || 'User'} deleted`);
      load();
    } catch (e) {
      message.error(e.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      sorter: (a, b) => (a.full_name || '').localeCompare(b.full_name || ''),
      render: (text) => <Text strong>{text || '—'}</Text>,
    },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (v) => v || '—' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (v) => v || '—' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (r) => <Tag color={ROLE_COLORS[r] || 'default'}>{ROLE_LABELS[r] || r}</Tag>,
    },
    {
      title: 'Class',
      dataIndex: 'class_instance_id',
      key: 'class',
      render: (id) => id
        ? <Tag>{classLookup.get(id) || 'Unknown'}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v) => v === false
        ? <Tag color="default">Inactive</Tag>
        : <Tag color="success">Active</Tag>,
    },
    {
      title: 'Last sign-in',
      key: 'last_sign_in_at',
      render: (_, r) => {
        if (r.last_sign_in_at) {
          return (
            <span title={dayjs(r.last_sign_in_at).format('DD MMM YYYY, HH:mm')}>
              {dayjs(r.last_sign_in_at).fromNow()}
            </span>
          );
        }
        if (r.never_signed_in) return <Tag color="orange">Never</Tag>;
        return <Text type="secondary">—</Text>;
      },
      sorter: (a, b) => {
        const av = a.last_sign_in_at ? dayjs(a.last_sign_in_at).valueOf() : 0;
        const bv = b.last_sign_in_at ? dayjs(b.last_sign_in_at).valueOf() : 0;
        return av - bv;
      },
    },
    {
      title: 'Joined',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
      sorter: (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
    },
    ...(canDelete ? [{
      title: 'Actions',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title="Delete this user?"
          description="This permanently removes their account. This cannot be undone."
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={() => handleDelete(record)}
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            loading={deletingId === record.id}
          />
        </Popconfirm>
      ),
    }] : []),
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} align="center">
        <Title level={3} style={{ margin: 0 }}><TeamOutlined /> Users</Title>
        <Text type="secondary">Who's using the app in your school</Text>
      </Space>

      <Card>
        <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search name, email, phone…"
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
            />
            <Select value={roleFilter} onChange={setRoleFilter} style={{ width: 160 }}>
              <Option value="all">All roles</Option>
              <Option value="superadmin">Super Admin</Option>
              <Option value="admin">Admin</Option>
              <Option value="student">Student</Option>
            </Select>
            <Select
              value={classFilter}
              onChange={setClassFilter}
              style={{ width: 180 }}
              showSearch
              optionFilterProp="children"
            >
              <Option value="all">All classes</Option>
              {classes.map((ci) => (
                <Option key={ci.id} value={ci.id}>
                  Grade {ci.class?.grade}-{ci.class?.section}
                </Option>
              ))}
            </Select>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
            {canAdd && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
                Add User
              </Button>
            )}
          </Space>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 25, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        />
      </Card>

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); load(); }}
        myRole={myRole}
      />
    </div>
  );
}
