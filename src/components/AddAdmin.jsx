import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Typography,
  Space,
  Row,
  Col,
  Table,
  Tag,
  Modal,
  Popconfirm,
} from 'antd';
import {
  UserAddOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  UserOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';

const { Title } = Typography;

const AddAdmin = () => {
  const { user } = useAuth();
  const { school_code, super_admin_code } = user.user_metadata || {};

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const fetchAdmins = async () => {
    setAdminLoading(true);
    const { data, error } = await supabase
      .from('admin')
      .select('id, full_name, email, phone, role, admin_code, super_admin_code')
      .eq('school_code', school_code)
      .eq('role', 'admin');

    if (error) {
      message.error('Failed to load admins');
    } else {
      setAdminList(data || []);
    }
    setAdminLoading(false);
  };

  useEffect(() => {
    if (school_code) fetchAdmins();
  }, [school_code]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        message.error('Not authenticated. Please log in.');
        setLoading(false);
        return;
      }

      const response = await fetch(
        'https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/create-admin',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: values.full_name,
            email: values.email,
            password: values.password,
            phone: values.phone,
            role: 'admin',
            admin_code: values.admin_code,
            school_code,
            super_admin_code,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        message.error(result.error || `Failed to create admin. Status: ${response.status}`);
      } else {
        message.success('Admin created successfully!');
        form.resetFields();
        fetchAdmins();
      }
    } catch (err) {
      message.error('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingAdmin(record);
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    const values = await editForm.validateFields();

    const { error } = await supabase
      .from('admin')
      .update({
        full_name: values.full_name,
        phone: values.phone,
        admin_code: values.admin_code,
      })
      .eq('id', editingAdmin.id); // ✅ Corrected here

    if (error) {
      message.error('Update failed');
    } else {
      message.success('Admin updated');
      setEditModalVisible(false);
      setEditingAdmin(null);
      fetchAdmins();
    }
  };

  const handleDelete = async (user_id) => {
    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data.session?.access_token;

    const res = await fetch(
      'https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/delete-admin',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id }),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      message.error(result.error || 'Failed to delete admin');
    } else {
      message.success('Admin deleted successfully');
      fetchAdmins();
    }
  };

  const columns = [
    { title: 'Full Name', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Admin Code', dataIndex: 'admin_code', key: 'admin_code' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => <Tag color="blue">{role}</Tag>,
    },
    { title: 'Created By', dataIndex: 'super_admin_code', key: 'super_admin_code' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<Pencil size={16} />} onClick={() => handleEdit(record)} type="link" />
          <Popconfirm
            title="Are you sure to delete this admin?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<Trash2 size={16} />} type="link" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', padding: '24px', background: '#f8fafc' }}>
      <div className="max-w-3xl mx-auto">
        <Card
          title={
            <Space>
              <UserAddOutlined />
              <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>
                Add School Administrator
              </Title>
            </Space>
          }
          style={{
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            background: '#ffffff',
          }}
          headStyle={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            size="large"
            initialValues={{
              role: 'admin',
              admin_code: 'A',
            }}
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="full_name"
                  label="Full Name"
                  rules={[{ required: true, message: 'Please enter full name' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="Enter full name" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="email"
                  label="Email Address"
                  rules={[
                    { required: true, message: 'Please enter email' },
                    { type: 'email', message: 'Please enter a valid email' },
                  ]}
                >
                  <Input prefix={<MailOutlined />} placeholder="Enter email address" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    { required: true, message: 'Please enter password' },
                    { min: 6, message: 'Password must be at least 6 characters' },
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="Enter password" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="phone"
                  label="Phone Number"
                  rules={[
                    { required: true, message: 'Please enter phone number' },
                    {
                      pattern: /^[0-9+\-\s()]+$/,
                      message: 'Please enter a valid phone number',
                    },
                  ]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="Enter phone number" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="role" label="Role">
                  <Input value="admin" disabled style={{ backgroundColor: '#f5f5f5' }} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="admin_code"
                  label="Admin Code"
                  rules={[{ required: true, message: 'Please enter admin code' }]}
                >
                  <Input prefix={<IdcardOutlined />} placeholder="Enter admin code" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  style={{
                    background: '#6366f1',
                    borderColor: '#6366f1',
                    borderRadius: '8px',
                    fontWeight: 500,
                  }}
                >
                  {loading ? 'Adding Admin...' : 'Add Admin'}
                </Button>
                <Button size="large" onClick={() => form.resetFields()}>
                  Reset Form
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {/* Admin list section */}
          <div style={{ marginTop: '40px' }}>
            <Title level={4}>Existing Admins</Title>
            <Table
              columns={columns}
              dataSource={adminList}
              loading={adminLoading}
              rowKey={(record) => record.id}
              pagination={{ pageSize: 25 }}
            />
          </div>
        </Card>

        {/* Edit Modal */}
        <Modal
          open={editModalVisible}
          title="Edit Admin"
          onCancel={() => setEditModalVisible(false)}
          onOk={handleEditSave}
          okText="Save Changes"
        >
          <Form form={editForm} layout="vertical">
            <Form.Item
              name="full_name"
              label="Full Name"
              rules={[{ required: true, message: 'Please enter full name' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Phone Number"
              rules={[{ required: true, message: 'Please enter phone number' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="admin_code"
              label="Admin Code"
              rules={[{ required: true, message: 'Please enter admin code' }]}
            >
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default AddAdmin;
