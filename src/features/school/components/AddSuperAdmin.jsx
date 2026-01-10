import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Typography,
  Space,
  message,
  Row,
  Col,
  Table,
  Tag,
  Spin,
  Alert,
  Divider,
  Popconfirm,
  Modal,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  LockOutlined,
  ApartmentOutlined,
  TeamOutlined,
  ReloadOutlined,
  CrownOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const AddSuperAdmin = () => {
  const [form] = Form.useForm();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [loadingSuperAdmins, setLoadingSuperAdmins] = useState(true);
  const [editingSuperAdmin, setEditingSuperAdmin] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();

  useEffect(() => {
    fetchSchools();
    fetchSuperAdmins();
  }, []);

  const fetchSchools = async () => {
    const { data, error } = await supabase
      .from('schools')
      .select('id, school_name, school_code');
    if (error) {
      message.error('Failed to fetch schools: ' + error.message);
    } else {
      setSchools(data || []);
    }
  };

  const fetchSuperAdmins = async () => {
    setLoadingSuperAdmins(true);
    let allSuperAdmins = [];
    let hasError = false;
    let errorMessage = '';

    try {
      // Use the helper function (bypasses RLS by checking auth.users directly)
      const { data: functionData, error: functionError } = await supabase
        .rpc('get_all_super_admins');

      if (!functionError && functionData) {
        allSuperAdmins = functionData;
        setSuperAdmins(allSuperAdmins);
        setLoadingSuperAdmins(false);
        return;
      } else if (functionError) {
        errorMessage = functionError.message || 'Failed to fetch super admins';
        hasError = true;
        message.error(errorMessage);
      }
    } catch (err) {
      hasError = true;
      errorMessage = err.message || 'Unexpected error';
      message.error(errorMessage);
    }

    setSuperAdmins(allSuperAdmins);
    setLoadingSuperAdmins(false);
  };

  // Handle edit super admin
  const handleEditSuperAdmin = (superAdmin) => {
    setEditingSuperAdmin(superAdmin);
    editForm.setFieldsValue({
      full_name: superAdmin.full_name,
      email: superAdmin.email,
      phone: superAdmin.phone,
      super_admin_code: superAdmin.super_admin_code,
      school_code: superAdmin.school_code,
    });
    setEditModalVisible(true);
  };

  const handleEditSuperAdminSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      
      // Update in super_admin table
      const { error: superAdminError } = await supabase
        .from('super_admin')
        .update({
          full_name: values.full_name,
          phone: values.phone,
          super_admin_code: values.super_admin_code,
        })
        .eq('auth_user_id', editingSuperAdmin.auth_user_id || editingSuperAdmin.id);

      if (superAdminError) {
        console.error('Error updating super_admin table:', superAdminError);
      }

      // Also update in users table if it exists
      if (editingSuperAdmin.id) {
        const { error: usersError } = await supabase
          .from('users')
          .update({
            full_name: values.full_name,
            phone: values.phone,
          })
          .eq('id', editingSuperAdmin.id);

        if (usersError) {
          console.error('Error updating users table:', usersError);
        }
      }

      message.success('Super Admin updated successfully');
      setEditModalVisible(false);
      setEditingSuperAdmin(null);
      editForm.resetFields();
      fetchSuperAdmins();
    } catch (err) {
      if (err.errorFields) {
        return;
      }
      message.error('Failed to update super admin: ' + err.message);
    }
  };

  // Handle delete super admin
  const handleDeleteSuperAdmin = async (superAdmin) => {
    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        message.error('Not authenticated. Please log in.');
        return;
      }

      // Use the delete-admin edge function (it works for super admins too)
      // Or we need a delete-super-admin function
      // For now, let's delete directly from the table
      const authUserId = superAdmin.auth_user_id || superAdmin.id;
      
      // Delete from super_admin table
      const { error: deleteError } = await supabase
        .from('super_admin')
        .delete()
        .eq('auth_user_id', authUserId);

      if (deleteError) {
        message.error('Failed to delete super admin: ' + deleteError.message);
        return;
      }

      // Delete from users table
      if (superAdmin.id) {
        const { error: usersDeleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', superAdmin.id);

        if (usersDeleteError) {
          console.error('Error deleting from users table:', usersDeleteError);
        }
      }

      message.success('Super Admin deleted successfully');
      fetchSuperAdmins();
    } catch (err) {
      message.error('Failed to delete super admin: ' + err.message);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        message.error("Not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      const selectedSchool = schools.find(
        (school) => school.school_code === values.school_code
      );

      const response = await fetch(
        "https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/create-super-admin",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            full_name: values.full_name,
            phone: values.phone,
            role: 'superadmin',
            super_admin_code: values.super_admin_code,
            school_code: values.school_code,
            school_name: selectedSchool?.school_name || '',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        message.error(result.error || "Failed to create Super Admin");
      } else {
        message.success("Super Admin created successfully!");
        form.resetFields();
        // Refresh the super admins list
        fetchSuperAdmins();
      }
    } catch (err) {
      message.error("Unexpected error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '24px', 
      background: '#f8fafc' 
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        width: '100%'
      }}>
        <Card
          title={
            <Space>
              <TeamOutlined />
              <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>
                Add Super Admin
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
          >
            <Row gutter={16}>
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
                  name="phone"
                  label="Phone Number"
                  rules={[
                    { required: true, message: 'Please enter phone number' },
                    { pattern: /^[0-9+\-\s()]+$/, message: 'Please enter a valid phone number' },
                  ]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="Enter phone number" />
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
                  name="super_admin_code"
                  label="Super Admin Code"
                  initialValue="SA"
                  rules={[{ required: true, message: 'Please enter super admin code' }]}
                >
                  <Input placeholder="Enter Super Admin Code" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="school_code"
                  label="Select School"
                  rules={[{ required: true, message: 'Please select a school' }]}
                >
                  <Select
                    placeholder="Select school by code"
                    showSearch
                    optionFilterProp="children"
                    suffixIcon={<ApartmentOutlined />}
                  >
                    {schools.map((school) => (
                      <Option key={school.id} value={school.school_code}>
                        {school.school_name} ({school.school_code})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                style={{
                  background: '#8B5CF6',
                  borderColor: '#8B5CF6',
                  borderRadius: '8px',
                  fontWeight: 500,
                  height: '48px',
                }}
                block
              >
                {loading ? 'Creating...' : 'Add Super Admin'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Existing Super Admins Table */}
        <Card
          title={
            <Space>
              <CrownOutlined />
              <Title level={4} style={{ margin: 0 }}>
                Existing Super Admins
              </Title>
              <Tag color="gold">{superAdmins.length} Total</Tag>
            </Space>
          }
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchSuperAdmins}
              loading={loadingSuperAdmins}
            >
              Refresh
            </Button>
          }
          style={{
            marginTop: '24px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            background: '#ffffff',
          }}
          headStyle={{ borderBottom: '1px solid #e2e8f0' }}
        >
          {loadingSuperAdmins ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>
                <Text>Loading super admins...</Text>
              </div>
            </div>
          ) : superAdmins.length === 0 ? (
            <Alert
              message="No Super Admins Found"
              description={
                <div>
                  <p style={{ marginBottom: '8px' }}>No super admins were found. This could be due to:</p>
                  <ul style={{ marginBottom: '8px', paddingLeft: '20px' }}>
                    <li>No super admins have been created yet</li>
                    <li>Permission issue - Your app_metadata.role must be "cb_admin"</li>
                  </ul>
                  <p style={{ marginBottom: 0, fontSize: '12px', color: '#666' }}>
                    Check the browser console (F12) for detailed error messages.
                  </p>
                </div>
              }
              type="warning"
              showIcon
              action={
                <Button size="small" onClick={fetchSuperAdmins}>
                  Retry
                </Button>
              }
            />
          ) : (
            <Table
              dataSource={superAdmins}
              rowKey={(record) => record.id || record.email}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} super admins`,
              }}
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'full_name',
                  key: 'full_name',
                  render: (text) => (
                    <Space>
                      <UserOutlined />
                      <Text strong>{text || 'N/A'}</Text>
                    </Space>
                  ),
                },
                {
                  title: 'Email',
                  dataIndex: 'email',
                  key: 'email',
                  render: (text) => (
                    <Space>
                      <MailOutlined />
                      <Text>{text}</Text>
                    </Space>
                  ),
                },
                {
                  title: 'Phone',
                  dataIndex: 'phone',
                  key: 'phone',
                  render: (text) => (
                    <Space>
                      <PhoneOutlined />
                      <Text>{text || 'N/A'}</Text>
                    </Space>
                  ),
                },
                {
                  title: 'School Code',
                  dataIndex: 'school_code',
                  key: 'school_code',
                  render: (text) => (
                    <Tag color="blue">{text || 'N/A'}</Tag>
                  ),
                },
                {
                  title: 'School Name',
                  dataIndex: 'school_name',
                  key: 'school_name',
                  render: (text) => <Text>{text || 'N/A'}</Text>,
                },
                {
                  title: 'Super Admin Code',
                  dataIndex: 'super_admin_code',
                  key: 'super_admin_code',
                  render: (text) => (
                    <Tag color="gold">{text || 'N/A'}</Tag>
                  ),
                },
                {
                  title: 'Created At',
                  dataIndex: 'created_at',
                  key: 'created_at',
                  render: (date) => (
                    <Text type="secondary">
                      {date ? new Date(date).toLocaleDateString() : 'N/A'}
                    </Text>
                  ),
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  width: 150,
                  fixed: 'right',
                  render: (_, record) => (
                    <Space>
                      <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditSuperAdmin(record)}
                        size="small"
                      >
                        Edit
                      </Button>
                      <Popconfirm
                        title="Delete this super admin?"
                        description="This will permanently delete the super admin. This action cannot be undone."
                        onConfirm={() => handleDeleteSuperAdmin(record)}
                        okText="Yes, Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Card>

        {/* Edit Super Admin Modal */}
        <Modal
          title="Edit Super Admin"
          open={editModalVisible}
          onOk={handleEditSuperAdminSubmit}
          onCancel={() => {
            setEditModalVisible(false);
            setEditingSuperAdmin(null);
            editForm.resetFields();
          }}
          okText="Update"
          cancelText="Cancel"
          width={600}
        >
          <Form
            form={editForm}
            layout="vertical"
          >
            <Form.Item
              name="full_name"
              label="Full Name"
              rules={[{ required: true, message: 'Please enter full name' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Enter full name" />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="Enter email" disabled />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Phone"
              rules={[{ required: true, message: 'Please enter phone number' }]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="Enter phone number" />
            </Form.Item>
            <Form.Item
              name="super_admin_code"
              label="Super Admin Code"
              rules={[{ required: true, message: 'Please enter super admin code' }]}
            >
              <Input placeholder="Enter Super Admin Code" />
            </Form.Item>
            <Form.Item
              name="school_code"
              label="School Code"
            >
              <Input placeholder="School Code" disabled />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default AddSuperAdmin;
