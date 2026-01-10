import React, { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  Row,
  Col,
  Table,
  Statistic,
  Typography,
  Space,
  Button,
  Alert,
  Spin,
  Tag,
  Popconfirm,
  Modal,
  Form,
  Input,
  message,
  Switch,
} from 'antd';
import {
  BankOutlined,
  UserOutlined,
  BookOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useAuth } from '@/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/config/supabaseClient';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text } = Typography;

const CBAdminDashboard = () => {
  const { user } = useAuth();
  const { antdTheme } = useTheme();
  const navigate = useNavigate();

  // Fallback theme values in case antdTheme is undefined
  const theme = antdTheme || {
    token: {
      marginLG: 24,
      colorText: '#000000',
      colorTextSecondary: '#666666',
      colorPrimary: '#1890ff',
      colorBorder: '#d9d9d9',
      boxShadowSecondary: '0 2px 8px rgba(0,0,0,0.1)',
      borderRadiusLG: 8,
      colorBgContainer: '#ffffff'
    }
  };

  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [stats, setStats] = useState({
    totalSchools: 0,
    totalSuperAdmins: 0,
    totalStudents: 0,
    totalClasses: 0
  });
  const [error, setError] = useState(null);
  const [editingSchool, setEditingSchool] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();


  const userName = user?.user_metadata?.full_name || 'CB Admin';

  // Check for cb_admin role in both app_metadata and user_metadata
  // Also check for cb_admin_code for backward compatibility
  const appMetadataRole = user?.app_metadata?.role;
  const userMetadataRole = user?.user_metadata?.role;
  const hasCbAdminCode = user?.user_metadata?.cb_admin_code;

  const isCbAdmin = appMetadataRole === 'cb_admin' ||
    userMetadataRole === 'cb_admin' ||
    hasCbAdminCode;


  // Redirect if not CB Admin
  useEffect(() => {
    if (!isCbAdmin) {
      navigate('/dashboard');
    }
  }, [isCbAdmin, navigate]);

  // Fetch data
  useEffect(() => {
    if (isCbAdmin) {
      fetchDashboardData();
    }
  }, [isCbAdmin]);

  // Update stats when schools or superAdmins change
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      totalSchools: schools.length,
      totalSuperAdmins: superAdmins.length
    }));
  }, [schools.length, superAdmins.length]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch schools and super admins first
      await Promise.all([
        fetchSchools(),
        fetchSuperAdmins()
      ]);
      // Then calculate stats (after data is loaded)
      fetchGlobalStats();
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      // Try helper function first (bypasses RLS)
      const { data: functionData, error: functionError } = await supabase
        .rpc('get_all_schools');

      if (!functionError && functionData) {
        setSchools(functionData);
        setStats(prev => ({
          ...prev,
          totalSchools: functionData.length
        }));
        return;
      }

      if (functionError) {
        message.error('Failed to fetch schools: ' + functionError.message);
        throw functionError;
      }
    } catch (err) {
      message.error('Failed to fetch schools');
      throw err;
    }
  };

  const fetchSuperAdmins = async () => {
    let allSuperAdmins = [];

    try {
      // Use helper function (bypasses RLS by checking auth.users directly)
      const { data: functionData, error: functionError } = await supabase
        .rpc('get_all_super_admins');

      if (!functionError && functionData) {
        setSuperAdmins(functionData);
        setStats(prev => ({
          ...prev,
          totalSuperAdmins: functionData.length
        }));
        return;
      } else if (functionError) {
        message.error('Failed to fetch super admins: ' + functionError.message);
      }
    } catch (err) {
      message.error('Failed to fetch super admins');
    }

    setSuperAdmins([]);
  };


  const fetchGlobalStats = async () => {
    try {
      // Get total students and classes across all schools
      const [studentsResult, classesResult] = await Promise.all([
        supabase.from('student').select('*', { count: 'exact', head: true }),
        supabase.from('class_instances').select('*', { count: 'exact', head: true })
      ]);

      setStats(prev => ({
        ...prev,
        totalStudents: studentsResult.count || 0,
        totalClasses: classesResult.count || 0
      }));
    } catch (err) {
      // Silently fail - don't overwrite existing stats
    }
  };

  // Handle edit school
  const handleEditSchool = (school) => {
    setEditingSchool(school);
    editForm.setFieldsValue({
      school_name: school.school_name,
      school_email: school.school_email,
      school_phone: school.school_phone,
      school_address: school.school_address,
      is_active: school.is_active,
    });
    setEditModalVisible(true);
  };

  const handleEditSchoolSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      const { error } = await supabase
        .from('schools')
        .update({
          school_name: values.school_name,
          school_email: values.school_email,
          school_phone: values.school_phone,
          school_address: values.school_address,
          is_active: values.is_active,
        })
        .eq('id', editingSchool.id);

      if (error) {
        message.error('Failed to update school: ' + error.message);
      } else {
        message.success('School updated successfully');
        setEditModalVisible(false);
        setEditingSchool(null);
        editForm.resetFields();
        fetchDashboardData();
      }
    } catch (err) {
      if (err.errorFields) {
        // Form validation errors
        return;
      }
      message.error('Failed to update school: ' + err.message);
    }
  };

  // Handle delete school
  const handleDeleteSchool = async (schoolId) => {
    try {
      const { error } = await supabase
        .from('schools')
        .delete()
        .eq('id', schoolId);

      if (error) {
        message.error('Failed to delete school: ' + error.message);
      } else {
        message.success('School deleted successfully');
        fetchDashboardData();
      }
    } catch (err) {
      message.error('Failed to delete school: ' + err.message);
    }
  };

  // Only show schools in the table (super admins are shown in the "School Super Admin" column)
  const tableData = schools.map(school => ({
    ...school,
    display_name: school.school_name,
    display_email: school.school_email,
    display_phone: school.school_phone,
    display_status: school.is_active ? 'Active' : 'Inactive'
  }));

  // Unified table columns in requested order
  const unifiedColumns = [
    {
      title: 'School Name',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'School Super Admin',
      dataIndex: 'super_admin_name',
      key: 'super_admin_name',
      render: (text, record) => {
        // Find the super admin assigned to this school
        const schoolSuperAdmin = superAdmins.find(admin => admin.school_code === record.school_code);
        return schoolSuperAdmin ? (
          <Text>{schoolSuperAdmin.full_name}</Text>
        ) : (
          <Text type="secondary">No Super Admin</Text>
        );
      }
    },
    {
      title: 'Email',
      dataIndex: 'display_email',
      key: 'display_email'
    },
    {
      title: 'Phone',
      dataIndex: 'display_phone',
      key: 'display_phone'
    },
    {
      title: 'Status',
      dataIndex: 'display_status',
      key: 'display_status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>
          {status}
        </Tag>
      )
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Created By',
      dataIndex: 'created_by',
      key: 'created_by',
      render: (createdBy, record) => {
        // This would need to be added to your database schema
        // For now, showing a placeholder
        return createdBy ? (
          <Text>{createdBy}</Text>
        ) : (
          <Text type="secondary">System</Text>
        );
      }
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
            onClick={() => handleEditSchool(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this school?"
            description="This will permanently delete the school and all associated data. This action cannot be undone."
            onConfirm={() => handleDeleteSchool(record.id)}
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
  ];

  if (!isCbAdmin) {
    return (
      <Content style={{ padding: '24px' }}>
        <Alert
          message="Access Denied"
          description="This page is only accessible to CB Admins."
          type="error"
          showIcon
        />
      </Content>
    );
  }

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ marginBottom: theme.token.marginLG }}>
        <Title level={2} style={{ margin: 0, color: theme.token.colorText }}>
          CB Admin Dashboard
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Welcome back, {userName}! Manage schools and super admins.
        </Text>
      </div>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: theme.token.marginLG }}
        />
      )}

      <Spin spinning={loading}>
        {/* Statistics Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: theme.token.marginLG }}>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                borderRadius: theme.token.borderRadiusLG,
                height: '100%',
                border: `1px solid ${theme.token.colorBorder}`,
                boxShadow: theme.token.boxShadowSecondary,
                background: theme.token.colorBgContainer,
              }}
            >
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  fontSize: '48px',
                  color: '#3b82f6',
                  marginBottom: theme.token.margin
                }}>
                  <BankOutlined />
                </div>
                <Statistic
                  title="Total Schools"
                  value={stats.totalSchools}
                  valueStyle={{ color: '#3b82f6' }}
                  titleStyle={{ color: theme.token.colorTextSecondary, fontWeight: 500 }}
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                borderRadius: theme.token.borderRadiusLG,
                height: '100%',
                border: `1px solid ${theme.token.colorBorder}`,
                boxShadow: theme.token.boxShadowSecondary,
                background: theme.token.colorBgContainer,
              }}
            >
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  fontSize: '48px',
                  color: '#faad14',
                  marginBottom: theme.token.margin
                }}>
                  <UserOutlined />
                </div>
                <Statistic
                  title="Super Admins"
                  value={stats.totalSuperAdmins}
                  valueStyle={{ color: '#faad14' }}
                  titleStyle={{ color: theme.token.colorTextSecondary, fontWeight: 500 }}
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                borderRadius: theme.token.borderRadiusLG,
                height: '100%',
                border: `1px solid ${theme.token.colorBorder}`,
                boxShadow: theme.token.boxShadowSecondary,
                background: theme.token.colorBgContainer,
              }}
            >
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  fontSize: '48px',
                  color: '#52c41a',
                  marginBottom: theme.token.margin
                }}>
                  <UserOutlined />
                </div>
                <Statistic
                  title="Total Students"
                  value={stats.totalStudents}
                  valueStyle={{ color: '#52c41a' }}
                  titleStyle={{ color: theme.token.colorTextSecondary, fontWeight: 500 }}
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                borderRadius: theme.token.borderRadiusLG,
                height: '100%',
                border: `1px solid ${theme.token.colorBorder}`,
                boxShadow: theme.token.boxShadowSecondary,
                background: theme.token.colorBgContainer,
              }}
            >
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  fontSize: '48px',
                  color: '#06b6d4',
                  marginBottom: theme.token.margin
                }}>
                  <BookOutlined />
                </div>
                <Statistic
                  title="Total Classes"
                  value={stats.totalClasses}
                  valueStyle={{ color: '#06b6d4' }}
                  titleStyle={{ color: theme.token.colorTextSecondary, fontWeight: 500 }}
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* Action Buttons */}
        <Row gutter={[16, 16]} style={{ marginBottom: theme.token.marginLG }}>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/add-schools')}
              size="large"
            >
              Add School
            </Button>
          </Col>
          <Col>
            <Button
              type="default"
              icon={<PlusOutlined />}
              onClick={() => navigate('/add-super-admin')}
              size="large"
            >
              Add Super Admin
            </Button>
          </Col>
          <Col>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={fetchDashboardData}
              loading={loading}
              size="large"
            >
              Refresh Data
            </Button>
          </Col>
        </Row>

        {/* Unified Management Table */}
        <Card
          title={
            <Space>
              <BankOutlined />
              <span>School Management</span>
              <Tag color="blue">{schools.length} Schools</Tag>
              <Tag color="gold">{superAdmins.length} Super Admins</Tag>
            </Space>
          }
          style={{
            borderRadius: theme.token.borderRadiusLG,
            border: `1px solid ${theme.token.colorBorder}`,
            boxShadow: theme.token.boxShadowSecondary,
          }}
        >
          <Table
            columns={unifiedColumns}
            dataSource={tableData}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} schools`
            }}
            size="small"
            scroll={{ x: 1000 }}
          />
        </Card>

        {/* Edit School Modal */}
        <Modal
          title="Edit School"
          open={editModalVisible}
          onOk={handleEditSchoolSubmit}
          onCancel={() => {
            setEditModalVisible(false);
            setEditingSchool(null);
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
              name="school_name"
              label="School Name"
              rules={[{ required: true, message: 'Please enter school name' }]}
            >
              <Input placeholder="Enter school name" />
            </Form.Item>
            <Form.Item
              name="school_email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input placeholder="Enter email" />
            </Form.Item>
            <Form.Item
              name="school_phone"
              label="Phone"
              rules={[{ required: true, message: 'Please enter phone number' }]}
            >
              <Input placeholder="Enter phone number" />
            </Form.Item>
            <Form.Item
              name="school_address"
              label="Address"
            >
              <Input.TextArea rows={3} placeholder="Enter school address" />
            </Form.Item>
            <Form.Item
              name="is_active"
              label="Status"
              valuePropName="checked"
            >
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Form>
        </Modal>
      </Spin>

    </Content>
  );
};

export default CBAdminDashboard;
