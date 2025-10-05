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
  Upload,
  Divider,
  Alert,
  Progress,
} from 'antd';
import {
  UserAddOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  UserOutlined,
  IdcardOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import * as XLSX from 'xlsx';
import { getSchoolCode, getSuperAdminCode } from '../utils/metadata';

const { Title } = Typography;

const AddAdmin = () => {
  const { user } = useAuth();
  // Use centralized metadata utilities
  const school_code = getSchoolCode(user);
  const super_admin_code = getSuperAdminCode(user);
  
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  
  // Ensure adminList is always an array
  const safeAdminList = Array.isArray(adminList) ? adminList : 
    (typeof adminList === 'string' ? JSON.parse(adminList) : []);

  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Bulk import states
  const [bulkImportVisible, setBulkImportVisible] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, failed: 0, errors: [] });

  const fetchAdmins = async () => {
    setAdminLoading(true);
    try {
      // First, let's try a simple query without filters to see if we can access the admin table at all
      const { data: testData, error: testError } = await supabase
        .from('admin')
        .select('id, email, role, school_code')
        .limit(3);
      
      // Now try the actual query on admin table (where the data actually exists)
      const { data: adminData, error: adminError } = await supabase
        .from('admin')
        .select('id, full_name, email, phone, role, admin_code, school_code, school_name, created_at')
        .eq('school_code', school_code)
        .eq('role', 'admin');


      if (adminError) {
        
        // Try users table as fallback
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, email, phone, role, admin_code, school_code, school_name, created_at')
          .eq('school_code', school_code)
          .eq('role', 'admin');


        if (usersError) {
          setAdminList([]);
        } else {
          setAdminList(usersData || []);
        }
      } else {
        setAdminList(adminData || []);
      }
    } catch (err) {
      message.error('Unexpected error loading admins: ' + err.message);
      setAdminList([]);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (school_code) {
      fetchAdmins();
    } else {
      // Set empty admin list when no school_code
      setAdminList([]);
    }
  }, [school_code, user, refreshTrigger]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        message.error('Not authenticated. Please log in.');
        setLoading(false);
        setRefreshTrigger(prev => prev + 1); // Refresh data even on error
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
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        message.error(result.error || result.details || `Failed to create admin. Status: ${response.status}`);
        setRefreshTrigger(prev => prev + 1); // Refresh data even on error
      } else {
        message.success('Admin created successfully!');
        form.resetFields();
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      message.error('Unexpected error: ' + err.message);
      setRefreshTrigger(prev => prev + 1); // Refresh data even on error
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

    try {
      // First try to update in admin table
      const { error: adminError } = await supabase
        .from('admin')
        .update({
          full_name: values.full_name,
          phone: values.phone,
          admin_code: values.admin_code,
        })
        .eq('id', editingAdmin.id);

      if (adminError) {
        
        // If admin table update fails, try users table
        const { error: usersError } = await supabase
          .from('users')
          .update({
            full_name: values.full_name,
            phone: values.phone,
            admin_code: values.admin_code,
          })
          .eq('id', editingAdmin.id);

        if (usersError) {
          message.error('Update failed: ' + usersError.message);
          return;
        }
      }

      message.success('Admin updated successfully');
      setEditModalVisible(false);
      setEditingAdmin(null);
      
      // Trigger refresh by updating the refresh trigger
      setRefreshTrigger(prev => prev + 1);
      
    } catch (err) {
      message.error('Update failed: ' + err.message);
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
      setRefreshTrigger(prev => prev + 1);
    }
  };

  // Bulk import functions
  const downloadTemplate = (format = 'excel') => {
    const templateData = [
      {
        'Full Name': 'John Doe',
        'Email': 'john.doe@example.com',
        'Phone': '+1234567890',
        'Admin Code': 'A001',
        'Password': 'password123'
      },
      {
        'Full Name': 'Jane Smith',
        'Email': 'jane.smith@example.com',
        'Phone': '+1234567891',
        'Admin Code': 'A002',
        'Password': 'password123'
      }
    ];

    if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(templateData[0]);
      const csvContent = [
        headers.join(','),
        ...templateData.map(row => headers.map(header => `"${row[header]}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'admin_import_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Excel format
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Admins');
      XLSX.writeFile(wb, 'admin_import_template.xlsx');
    }
  };

  const handleBulkImport = async (file) => {
    setBulkImportLoading(true);
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0, errors: [] });

    try {
      let jsonData = [];
      const fileExtension = file.name.split('.').pop().toLowerCase();

      if (fileExtension === 'csv') {
        // Handle CSV files
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          message.error('CSV file must have at least a header row and one data row');
          setBulkImportLoading(false);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          jsonData.push(row);
        }
      } else {
        // Handle Excel files
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
      }

      if (jsonData.length === 0) {
        message.error('No data found in the file');
        setBulkImportLoading(false);
        return;
      }

      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        message.error('Not authenticated. Please log in.');
        setBulkImportLoading(false);
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      const errors = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const progress = Math.round(((i + 1) / jsonData.length) * 100);
        setImportProgress(progress);

        try {
          // Validate required fields
          if (!row['Full Name'] || !row['Email'] || !row['Phone'] || !row['Admin Code'] || !row['Password']) {
            errors.push(`Row ${i + 1}: Missing required fields`);
            failedCount++;
            continue;
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
                email: row['Email'],
                password: row['Password'],
                full_name: row['Full Name'],
                phone: row['Phone'],
                role: 'admin',
                admin_code: row['Admin Code'],
                school_code: school_code,
                school_name: user?.raw_app_meta_data?.school_name || user?.user_metadata?.school_name || 'School',
              }),
            }
          );

          const result = await response.json();

          if (!response.ok) {
            errors.push(`Row ${i + 1}: ${result.error || 'Failed to create admin'}`);
            failedCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err.message}`);
          failedCount++;
        }
      }

      setImportResults({ success: successCount, failed: failedCount, errors });
      
      if (successCount > 0) {
        message.success(`Successfully imported ${successCount} admins`);
        setRefreshTrigger(prev => prev + 1); // Refresh the admin list
      }
      
      if (failedCount > 0) {
        message.error(`Failed to import ${failedCount} admins. Check the details below.`);
      }

    } catch (err) {
      message.error('Error processing file: ' + err.message);
    } finally {
      setBulkImportLoading(false);
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
    { title: 'School', dataIndex: 'school_name', key: 'school_name' },
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
          styles={{ header: { borderBottom: '1px solid #e2e8f0' } }}
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
                    background: '#8B5CF6',
                    borderColor: '#8B5CF6',
                    borderRadius: '8px',
                    fontWeight: 500,
                  }}
                >
                  {loading ? 'Adding Admin...' : 'Add Admin'}
                </Button>
                <Button size="large" onClick={() => form.resetFields()}>
                  Reset Form
                </Button>
                <Button 
                  size="large" 
                  icon={<UploadOutlined />}
                  onClick={() => setBulkImportVisible(true)}
                  style={{
                    background: '#10b981',
                    borderColor: '#10b981',
                    color: 'white',
                  }}
                >
                  Bulk Import
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {/* Admin list section */}
          <div style={{ marginTop: '40px' }}>
            <Title level={4}>Existing Admins</Title>
            {!school_code ? (
              <Alert
                message="School Code Missing"
                description="No school code found in your user profile. Please contact your administrator to assign a school code to your account."
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            ) : safeAdminList.length === 0 && !adminLoading ? (
              <Alert
                message="No Admins Found"
                description={`No admins have been created for school ${school_code} yet. Use the form above to create your first admin.`}
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            ) : null}
            <Table
              columns={columns}
              dataSource={safeAdminList}
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

        {/* Bulk Import Modal */}
        <Modal
          open={bulkImportVisible}
          title={
            <Space>
              <FileExcelOutlined />
              <span>Bulk Import Admins</span>
            </Space>
          }
          onCancel={() => {
            setBulkImportVisible(false);
            setImportProgress(0);
            setImportResults({ success: 0, failed: 0, errors: [] });
          }}
          footer={null}
          width={600}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="Import Instructions"
              description={
                <div>
                  <p>1. Download the template file (Excel or CSV) to see the required format</p>
                  <p>2. Fill in the admin details in the file</p>
                  <p>3. Upload the completed file to import admins</p>
                  <p><strong>Required columns:</strong> Full Name, Email, Phone, Admin Code, Password</p>
                  <p><strong>Supported formats:</strong> .xlsx, .xls, .csv</p>
                </div>
              }
              type="info"
              showIcon
            />

            <div style={{ textAlign: 'center' }}>
              <Space>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => downloadTemplate('excel')}
                >
                  Download Excel Template
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => downloadTemplate('csv')}
                >
                  Download CSV Template
                </Button>
              </Space>
            </div>

            <Divider>Upload File</Divider>

            <Upload.Dragger
              accept=".xlsx,.xls,.csv"
              beforeUpload={(file) => {
                handleBulkImport(file);
                return false; // Prevent auto upload
              }}
              showUploadList={false}
              disabled={bulkImportLoading}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">
                Click or drag file to this area to upload
              </p>
              <p className="ant-upload-hint">
                Support for .xlsx, .xls, and .csv files
              </p>
            </Upload.Dragger>

            {bulkImportLoading && (
              <div>
                <Progress percent={importProgress} status="active" />
                <p style={{ textAlign: 'center', marginTop: '8px' }}>
                  Importing admins... {importProgress}%
                </p>
              </div>
            )}

            {importResults.success > 0 || importResults.failed > 0 ? (
              <div>
                <Alert
                  message={`Import Complete: ${importResults.success} successful, ${importResults.failed} failed`}
                  type={importResults.failed > 0 ? 'warning' : 'success'}
                  showIcon
                />
                
                {importResults.errors.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <Title level={5}>Import Errors:</Title>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                      {importResults.errors.map((error, index) => (
                        <div key={index} style={{ marginBottom: '4px', fontSize: '12px', color: '#ff4d4f' }}>
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </Space>
        </Modal>
      </div>
    </div>
  );
};

export default AddAdmin;
