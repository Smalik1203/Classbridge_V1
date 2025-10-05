import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, message, Typography, Space, Row, Col, Table, Tag, Modal, Popconfirm, Upload, Progress, Alert, Divider } from 'antd';
import { UserAddOutlined, MailOutlined, LockOutlined, PhoneOutlined, UserOutlined, IdcardOutlined, BookOutlined, UploadOutlined, FileTextOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { getSchoolCode, getSuperAdminCode } from '../utils/metadata';
import { supabase } from '../config/supabaseClient';
import EmptyState from '../ui/EmptyState';

const { Title, Text } = Typography;
const { Option } = Select;
const AddStudent = () => {
  const { user } = useAuth();
  
  // Use comprehensive metadata extraction
  const school_code = getSchoolCode(user);
  const super_admin_code = getSuperAdminCode(user);
  
  // Debug logging (only when needed)

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [classInstances, setClassInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [studentList, setStudentList] = useState([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  // Import states
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, failed: 0, errors: [] });
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState('');

  const fetchStudents = async () => {
    setStudentLoading(true);
    const { data, error } = await supabase
      .from('student')
      .select(`
        id, 
        full_name, 
        email, 
        phone, 
        student_code, 
        class_instance_id,
        class_instances!inner(grade, section)
      `)
      .eq('school_code', school_code);

    if (error) {
      message.error('Failed to load students');
    } else {
      setStudentList(data || []);
    }
    setStudentLoading(false);
  };

  useEffect(() => {
    const fetchClassInstances = async () => {
      
      // BACKEND INTEGRATION: Replace with comprehensive query above
      const { data, error } = await supabase
        .from('class_instances')
        .select(`
          id,
          class:classes (grade, section),
          academic_years:academic_years (year_start, year_end)
        `)
        .eq('school_code', school_code);

      if (error) {
        message.error('Failed to load classes: ' + error.message);
        setClassInstances([]);
      } else {
        setClassInstances(data || []);
        
        // Clear any existing form values when classes are loaded
        if (form) {
          form.setFieldsValue({
            class_instance_id: undefined
          });
        }
      }
    };

    if (school_code && super_admin_code) {
      fetchClassInstances();
      fetchStudents();
    }
  }, [school_code, super_admin_code, form]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // AUTHENTICATION: Validate current user session
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        message.error('Not authenticated. Please log in.');
        setLoading(false);
        fetchStudents(); // Refresh data even on error
        return;
      }

  
      const response = await fetch('https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/create-student', {
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
          student_code: values.student_code,
          class_instance_id: values.class_instance_id,
        
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // ERROR HANDLING: Display specific error messages
        message.error(result.error || `Failed to create student. Status: ${response.status}`);
        fetchStudents(); // Refresh data even on error
      } else {
        // SUCCESS HANDLING: User feedback and form reset
        message.success('Student created successfully!');
        form.resetFields();
        form.setFieldsValue({ 
          student_code: 'S',
          class_instance_id: undefined
        });
        fetchStudents();
      }
    } catch (err) {
      // GENERAL ERROR HANDLING: Network and unexpected errors
      message.error('Unexpected error: ' + err.message);
      fetchStudents(); // Refresh data even on error
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingStudent(record);
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    const values = await editForm.validateFields();


    // First, let's check if the student exists and get current data
    const { data: currentStudent, error: fetchError } = await supabase
      .from('student')
      .select('*')
      .eq('id', editingStudent.id)
      .single();


    // Also test if we can query any students at all
    const { data: testStudents, error: testQueryError } = await supabase
      .from('student')
      .select('id, full_name, school_code')
      .limit(1);

    if (fetchError) {
      message.error('Failed to fetch student data: ' + fetchError.message);
      return;
    }

    if (!currentStudent) {
      message.error('Student not found');
      return;
    }

    // Compare current data with new data

    // Check if data is actually different
    const isDataDifferent = 
      currentStudent.class_instance_id !== values.class_instance_id ||
      currentStudent.full_name !== values.full_name ||
      currentStudent.phone !== values.phone ||
      currentStudent.student_code !== values.student_code;


    if (!isDataDifferent) {
      message.info('No changes detected. The data is identical to the current values.');
      return;
    }

    // Test if we can update at all (try a simple update first)
    const { data: testData, error: testError } = await supabase
      .from('student')
      .update({
        full_name: currentStudent.full_name + ' (Test)'
      })
      .eq('id', editingStudent.id)
      .select();


    if (testError) {
      message.error('Permission denied: ' + testError.message);
      return;
    }

    if (!testData || testData.length === 0) {
      message.error('Permission denied: You do not have permission to update this student.');
      return;
    }


    // Now try the actual update
    const { data, error } = await supabase
      .from('student')
      .update({
        full_name: values.full_name,
        phone: values.phone,
        student_code: values.student_code,
        class_instance_id: values.class_instance_id,
      })
      .eq('id', editingStudent.id)
      .select();


    if (error) {
      message.error('Update failed: ' + error.message);
    } else {
      if (data && data.length > 0) {
        message.success('Student updated successfully');
        setEditModalVisible(false);
        setEditingStudent(null);
        fetchStudents();
      } else {
        message.warning('No rows were updated. The data might be the same or you may not have permission.');
      }
    }
  };

  const handleDelete = async (user_id) => {
    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data.session?.access_token;

    if (!token) {
      message.error('Not authenticated. Please log in.');
      return;
    }

    const res = await fetch(
      'https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/delete-student',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ student_id: user_id }),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      message.error(result.error || 'Failed to delete student');
    } else {
      message.success('Student deleted successfully');
      fetchStudents();
    }
  };

  // CSV parsing function
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['full_name', 'email', 'password', 'phone', 'student_code', 'class'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1} has ${values.length} columns but expected ${headers.length}`);
      }

      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      // Validate required fields
      if (!row.full_name || !row.email || !row.password || !row.phone || !row.student_code || !row.class) {
        throw new Error(`Row ${i + 1} is missing required data`);
      }

      // Find matching class instance
      const classMatch = classInstances.find(ci => 
        `${ci.class.grade}-${ci.class.section}` === row.class
      );

      if (!classMatch) {
        throw new Error(`Row ${i + 1}: Class "${row.class}" not found. Available classes: ${classInstances.map(ci => `${ci.class.grade}-${ci.class.section}`).join(', ')}`);
      }

      data.push({
        full_name: row.full_name,
        email: row.email,
        password: row.password,
        phone: row.phone,
        student_code: row.student_code,
        class_instance_id: classMatch.id,
        class_display: row.class
      });
    }

    return data;
  };

  // Handle file upload
  const handleFileUpload = (info) => {
    const { file } = info;
    
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      message.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const parsedData = parseCSV(csvText);
        setImportData(parsedData);
        message.success(`Successfully parsed ${parsedData.length} students from CSV`);
      } catch (error) {
        message.error(`CSV parsing error: ${error.message}`);
        setImportData([]);
      }
    };
    reader.readAsText(file);
  };

  // Generate and download sample CSV template
  const downloadSampleTemplate = () => {
    // Get available classes for sample data
    const availableClasses = classInstances.map(ci => `${ci.class.grade}-${ci.class.section}`);
    
    // Use actual available classes in sample data, or fallback to examples
    const sampleClasses = availableClasses.length > 0 
      ? availableClasses.slice(0, 3) 
      : ['10-A', '10-B', '11-A'];

    const sampleData = [
      ['full_name', 'email', 'password', 'phone', 'student_code', 'class'],
      ['John Doe', 'john.doe@example.com', 'password123', '1234567890', 'S001', sampleClasses[0] || '10-A'],
      ['Jane Smith', 'jane.smith@example.com', 'password456', '0987654321', 'S002', sampleClasses[1] || '10-B'],
      ['Mike Johnson', 'mike.johnson@example.com', 'password789', '1122334455', 'S003', sampleClasses[2] || '11-A']
    ];

    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'student_import_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Bulk import students
  const handleBulkImport = async () => {
    if (importData.length === 0) {
      message.error('No data to import');
      return;
    }

    setImportLoading(true);
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0, errors: [] });

    const results = { success: 0, failed: 0, errors: [] };

    for (let i = 0; i < importData.length; i++) {
      const student = importData[i];
      setImportProgress(Math.round(((i + 1) / importData.length) * 100));

      try {
        const sessionResult = await supabase.auth.getSession();
        const token = sessionResult.data.session?.access_token;

        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(
          'https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/create-student',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              full_name: student.full_name,
              email: student.email,
              password: student.password,
              phone: student.phone,
              student_code: student.student_code,
              class_instance_id: student.class_instance_id,
              school_code: school_code,
              super_admin_code: super_admin_code,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create student');
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          student: student.full_name,
          error: error.message
        });
      }
    }

    setImportResults(results);
    setImportLoading(false);

    if (results.success > 0) {
      message.success(`Successfully imported ${results.success} students`);
      fetchStudents(); // Refresh the student list
    }

    if (results.failed > 0) {
      message.error(`Failed to import ${results.failed} students. Check the error details below.`);
    }
  };

  // Get unique classes for filters
  const uniqueClasses = [...new Set(classInstances.map(ci => `${ci.class.grade}-${ci.class.section}`))].sort();

  // Filter students based on class filter only (search is handled by table)
  const filteredStudents = studentList.filter(student => {
    const matchesClass = !selectedClass || 
      `${student.class_instances?.grade}-${student.class_instances?.section}` === selectedClass;

    return matchesClass;
  });

  const columns = [
    { 
      title: 'Full Name', 
      dataIndex: 'full_name', 
      key: 'full_name',
      sorter: (a, b) => a.full_name.localeCompare(b.full_name),
      filterable: true,
      filterSearch: true,
      onFilter: (value, record) => 
        record.full_name?.toLowerCase().includes(value.toLowerCase()) ||
        record.email?.toLowerCase().includes(value.toLowerCase()) ||
        record.student_code?.toLowerCase().includes(value.toLowerCase()) ||
        String(record.phone || '').includes(value)
    },
    { 
      title: 'Email', 
      dataIndex: 'email', 
      key: 'email',
      sorter: (a, b) => a.email.localeCompare(b.email)
    },
    { 
      title: 'Phone', 
      dataIndex: 'phone', 
      key: 'phone'
    },
    { 
      title: 'Student Code', 
      dataIndex: 'student_code', 
      key: 'student_code',
      sorter: (a, b) => a.student_code.localeCompare(b.student_code)
    },
    { 
      title: 'Class', 
      key: 'class',
      render: (_, record) => (
        <span>
          Grade {record.class_instances?.grade} - {record.class_instances?.section}
        </span>
      ),
      sorter: (a, b) => {
        const aClass = `${a.class_instances?.grade}-${a.class_instances?.section}`;
        const bClass = `${b.class_instances?.grade}-${b.class_instances?.section}`;
        return aClass.localeCompare(bClass);
      }
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => <Tag color="green">{role || 'student'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<Pencil size={16} />} onClick={() => handleEdit(record)} type="link" />
          <Popconfirm
            title="Are you sure to delete this student?"
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#8c8c8c' }}>
                <span>Home</span>
                <span>/</span>
                <span>Add Student</span>
              </div>
            </div>
          }
          style={{
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            background: '#ffffff'
          }}
          headStyle={{ borderBottom: '1px solid #e2e8f0' }}
        >

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            size="large"
            initialValues={{
              student_code: 'S',
              class_instance_id: undefined // Ensure no default class is selected
            }}
            preserve={false} // Don't preserve form values when component unmounts
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="full_name"
                  label="Full Name"
                  rules={[{ required: true, message: 'Please enter full name' }]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="Enter student's full name"
                  />
                </Form.Item>
              </Col>
              
              <Col xs={24} md={12}>
                <Form.Item
                  name="email"
                  label="Email Address"
                  rules={[
                    { required: true, message: 'Please enter email' },
                    { type: 'email', message: 'Please enter a valid email' }
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="Enter email address"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    { required: true, message: 'Please enter password' },
                    { min: 6, message: 'Password must be at least 6 characters' }
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Enter password"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="phone"
                  label="Phone Number"
                  rules={[
                    { required: true, message: 'Please enter phone number' },
                    { pattern: /^[0-9+\-\s()]+$/, message: 'Please enter a valid phone number' }
                  ]}
                >
                  <Input
                    prefix={<PhoneOutlined />}
                    placeholder="Enter phone number"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="student_code"
                  label="Student Code"
                  rules={[{ required: true, message: 'Please enter student code' }]}
                >
                  <Input
                    prefix={<IdcardOutlined />}
                    placeholder="Enter student code"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>

                <Form.Item
                  name="class_instance_id"
                  label="Class"
                  rules={[{ required: true, message: 'Please select a class' }]}
                >
                  <Select
                    placeholder={classInstances.length === 0 ? "Loading classes..." : "Select class"}
                    showSearch
                    optionFilterProp="children"
                    suffixIcon={<BookOutlined />}
                    allowClear
                    loading={classInstances.length === 0}
                    notFoundContent={classInstances.length === 0 ? "No classes available" : "No classes found"}
                    style={{ width: '100%' }}
                    disabled={classInstances.length === 0}
                  >
                    {classInstances.map((instance) => (
                      <Option key={instance.id} value={instance.id}>
                        Grade {instance.class?.grade || 'N/A'} - {instance.class?.section || 'N/A'} | 
                        AY {instance.academic_years?.year_start || 'N/A'} - {instance.academic_years?.year_end || 'N/A'}
                      </Option>
                    ))}
                  </Select>
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
                    fontWeight: 500
                  }}
                >
                  {loading ? 'Adding Student...' : 'Add Student'}
                </Button>
                <Button
                  size="large"
                  onClick={() => {
                    form.resetFields();
                    form.setFieldsValue({
                      student_code: 'S',
                      class_instance_id: undefined
                    });
                  }}
                >
                  Reset Form
                </Button>
                <Button
                  size="large"
                  icon={<UploadOutlined />}
                  onClick={() => setImportModalVisible(true)}
                  style={{
                    background: '#10b981',
                    borderColor: '#10b981',
                    color: 'white'
                  }}
                >
                  Import Students
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {/* Student list section */}
          <div style={{ marginTop: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <Title level={4} style={{ margin: 0 }}>
                Existing Students ({filteredStudents.length} of {studentList.length})
              </Title>
              <Select
                placeholder="Filter by Class"
                value={selectedClass}
                onChange={setSelectedClass}
                allowClear
                style={{ width: 200 }}
              >
                {uniqueClasses.map(classItem => (
                  <Option key={classItem} value={classItem}>
                    Grade {classItem}
                  </Option>
                ))}
              </Select>
            </div>

            <Table
              columns={columns}
              dataSource={filteredStudents}
              loading={studentLoading}
              rowKey={(record) => record.id}
              pagination={{ 
                pageSize: 25,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`
              }}
              scroll={{ x: 1200 }}
              locale={{
                emptyText: (
                  <EmptyState
                    type="students"
                    onAction={() => {
                      // Scroll to the form at the top
                      document.querySelector('.ant-form')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                )
              }}
            />
          </div>
        </Card>

        {/* Edit Modal */}
        <Modal
          open={editModalVisible}
          title="Edit Student"
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
              name="student_code"
              label="Student Code"
              rules={[{ required: true, message: 'Please enter student code' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="class_instance_id"
              label="Class"
              rules={[{ required: true, message: 'Please select a class' }]}
            >
              <Select
                placeholder="Select class"
                showSearch
                optionFilterProp="children"
              >
                {classInstances.map((instance) => (
                  <Option key={instance.id} value={instance.id}>
                    Grade {instance.class.grade} - {instance.class.section} | 
                    AY {instance.academic_years.year_start} - {instance.academic_years.year_end}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        {/* Import Modal */}
        <Modal
          open={importModalVisible}
          title="Import Students"
          onCancel={() => {
            setImportModalVisible(false);
            setImportData([]);
            setImportResults({ success: 0, failed: 0, errors: [] });
            setImportProgress(0);
          }}
          footer={null}
          width={800}
        >
          <div style={{ padding: '16px 0' }}>
            {/* Instructions */}
            <Alert
              message="CSV Import Instructions"
              description={
                <div>
                  <p>Your CSV file must have the following columns:</p>
                  <ul style={{ marginBottom: '16px' }}>
                    <li><strong>full_name</strong> - Student's full name</li>
                    <li><strong>email</strong> - Student's email address</li>
                    <li><strong>password</strong> - Student's password (min 6 characters)</li>
                    <li><strong>phone</strong> - Student's phone number</li>
                    <li><strong>student_code</strong> - Unique student code</li>
                    <li><strong>class</strong> - Class in format "Grade-Section" (e.g., "10-A")</li>
                  </ul>
                  <p><strong>Available classes:</strong> {classInstances.map(ci => `${ci.class.grade}-${ci.class.section}`).join(', ')}</p>
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Button
                      type="dashed"
                      icon={<FileTextOutlined />}
                      onClick={downloadSampleTemplate}
                      style={{
                        borderColor: '#1890ff',
                        color: '#1890ff'
                      }}
                    >
                      Download Sample Template
                    </Button>
                  </div>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            {/* File Upload */}
            <div style={{ marginBottom: '24px' }}>
              <Text strong>Upload CSV File:</Text>
              <Upload.Dragger
                name="file"
                accept=".csv"
                beforeUpload={() => false}
                onChange={handleFileUpload}
                style={{ marginTop: '8px' }}
              >
                <p className="ant-upload-drag-icon">
                  <FileTextOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text">Click or drag CSV file to this area to upload</p>
                <p className="ant-upload-hint">
                  Support for CSV files only. Make sure your file follows the required format.
                </p>
              </Upload.Dragger>
            </div>

            {/* Preview Data */}
            {importData.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Text strong>Preview ({importData.length} students):</Text>
                <Table
                  dataSource={importData.slice(0, 5)}
                  columns={[
                    { title: 'Name', dataIndex: 'full_name', key: 'full_name' },
                    { title: 'Email', dataIndex: 'email', key: 'email' },
                    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
                    { title: 'Student Code', dataIndex: 'student_code', key: 'student_code' },
                    { title: 'Class', dataIndex: 'class_display', key: 'class_display' },
                  ]}
                  pagination={false}
                  size="small"
                  style={{ marginTop: '8px' }}
                />
                {importData.length > 5 && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Showing first 5 rows. Total: {importData.length} students
                  </Text>
                )}
              </div>
            )}

            {/* Import Progress */}
            {importLoading && (
              <div style={{ marginBottom: '24px' }}>
                <Text strong>Importing students...</Text>
                <Progress percent={importProgress} status="active" style={{ marginTop: '8px' }} />
              </div>
            )}

            {/* Import Results */}
            {importResults.success > 0 || importResults.failed > 0 ? (
              <div style={{ marginBottom: '24px' }}>
                <Divider />
                <Text strong>Import Results:</Text>
                <div style={{ marginTop: '8px' }}>
                  <Space>
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      Success: {importResults.success}
                    </Tag>
                    <Tag color="red" icon={<ExclamationCircleOutlined />}>
                      Failed: {importResults.failed}
                    </Tag>
                  </Space>
                </div>
                
                {importResults.errors.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong>Errors:</Text>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
                      {importResults.errors.map((error, index) => (
                        <Alert
                          key={index}
                          message={`Row ${error.row}: ${error.student}`}
                          description={error.error}
                          type="error"
                          size="small"
                          style={{ marginBottom: '8px' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Action Buttons */}
            <div style={{ textAlign: 'right', marginTop: '24px' }}>
              <Space>
                <Button
                  onClick={() => {
                    setImportModalVisible(false);
                    setImportData([]);
                    setImportResults({ success: 0, failed: 0, errors: [] });
                    setImportProgress(0);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  onClick={handleBulkImport}
                  loading={importLoading}
                  disabled={importData.length === 0}
                  style={{
                    background: '#10b981',
                    borderColor: '#10b981'
                  }}
                >
                  {importLoading ? 'Importing...' : `Import ${importData.length} Students`}
                </Button>
              </Space>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AddStudent;