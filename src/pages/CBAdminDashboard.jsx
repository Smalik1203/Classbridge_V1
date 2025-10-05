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
  Modal,
  Form,
  Input,
  message,
  Tooltip,
} from 'antd';
import {
  BankOutlined,
  UserOutlined,
  BookOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { updateSchoolName } from '../services/schoolService';

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm] = Form.useForm();
  const [stats, setStats] = useState({
    totalSchools: 0,
    totalSuperAdmins: 0,
    totalStudents: 0,
    totalClasses: 0
  });
  const [error, setError] = useState(null);

  const userName = user?.user_metadata?.full_name || 'CB Admin';
  const userMetadataRole = user?.user_metadata?.role;
  const isCbAdmin = userMetadataRole === 'cb_admin';

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

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchSchools(),
        fetchSuperAdmins(),
        fetchGlobalStats()
      ]);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setSchools(data || []);
    } catch (err) {
      throw err;
    }
  };

  const openEditModal = (schoolRecord) => {
    setEditingSchool(schoolRecord);
    editForm.setFieldsValue({ school_name: schoolRecord.school_name });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingSchool(null);
    editForm.resetFields();
  };

  const handleSubmitEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setIsSavingEdit(true);
      await updateSchoolName(editingSchool.id, values.school_name);
      message.success('School name updated');
      handleCloseEditModal();
      await fetchSchools();
    } catch (err) {
      if (err?.error?.message) {
        message.error(err.error.message);
      } else if (err?.message) {
        message.error(err.message);
      } else {
        message.error('Failed to update school name');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const fetchSuperAdmins = async () => {
    let allSuperAdmins = [];
    
    try {
      // 1. Try super_admin table first (dedicated table for super admins)
      const { data: superAdminData, error: superAdminError } = await supabase
        .from('super_admin')
        .select('*')
        .order('created_at', { ascending: false });

      if (superAdminError) {
        // Silently handle permission errors - these are expected due to RLS policies
        if (superAdminError.code !== '42501' && superAdminError.code !== 'PGRST116') {
        }
      } else if (superAdminData && superAdminData.length > 0) {
        allSuperAdmins = [...allSuperAdmins, ...superAdminData];
      }
    } catch (err) {
    }

    try {
      // 2. Try users table with role = 'superadmin'
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'superadmin')
        .order('created_at', { ascending: false });

      if (usersError) {
        // Silently handle permission errors - these are expected due to RLS policies
        if (usersError.code !== '42501' && usersError.code !== 'PGRST116') {
        }
      } else if (usersData && usersData.length > 0) {
        allSuperAdmins = [...allSuperAdmins, ...usersData];
      }
    } catch (err) {
    }

    // Remove duplicates based on email (since both tables might have the same super admin)
    const uniqueSuperAdmins = allSuperAdmins.filter((admin, index, self) => 
      index === self.findIndex(a => a.email === admin.email)
    );

    setSuperAdmins(uniqueSuperAdmins);
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
        totalSchools: schools.length,
        totalSuperAdmins: superAdmins.length,
        totalStudents: studentsResult.count || 0,
        totalClasses: classesResult.count || 0
      }));
    } catch (err) {
      throw err;
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
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit school name">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            >
              Edit
            </Button>
          </Tooltip>
        </Space>
      )
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
        <Modal
          title="Edit School Name"
          open={isEditModalOpen}
          onOk={handleSubmitEdit}
          onCancel={handleCloseEditModal}
          okButtonProps={{ loading: isSavingEdit }}
          destroyOnClose
        >
          <Form form={editForm} layout="vertical" preserve={false}>
            <Form.Item
              label="School Name"
              name="school_name"
              rules={[
                { required: true, message: 'Please enter a school name' },
                { max: 200, message: 'Name is too long' },
              ]}
            >
              <Input placeholder="Enter new school name" autoFocus />
            </Form.Item>
          </Form>
        </Modal>
      </Spin>

    </Content>
  );
};

export default CBAdminDashboard;
