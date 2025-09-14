import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, message, Typography, Space, Row, Col, Table, Tag, Modal, Popconfirm } from 'antd';
import { UserAddOutlined, MailOutlined, LockOutlined, PhoneOutlined, UserOutlined, IdcardOutlined, BookOutlined } from '@ant-design/icons';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { supabase } from '../config/supabaseClient';

const { Title, Text } = Typography;
const { Option } = Select;
const AddStudent = () => {
  const { user } = useAuth();
  
  // Try both locations for school_code
  const school_code = user?.school_code || user?.user_metadata?.school_code;
  const super_admin_code = user?.super_admin_code || user?.user_metadata?.super_admin_code;
  
  console.log('=== ADD STUDENT COMPONENT DEBUG ===');
  console.log('User:', user);
  console.log('User role (direct):', user?.role);
  console.log('User role (app_metadata):', user?.app_metadata?.role);
  console.log('User role (user_metadata):', user?.user_metadata?.role);
  console.log('User app_metadata:', user?.app_metadata);
  console.log('User user_metadata:', user?.user_metadata);
  console.log('School code (direct):', user?.school_code);
  console.log('School code (metadata):', user?.user_metadata?.school_code);
  console.log('Final school code:', school_code);
  console.log('Super admin code:', super_admin_code);
  
  // Check what the JWT contains
  console.log('JWT token:', user?.jwt);
  if (user?.jwt) {
    try {
      const jwtPayload = JSON.parse(atob(user.jwt.split('.')[1]));
      console.log('JWT payload:', jwtPayload);
      console.log('JWT user_metadata:', jwtPayload.user_metadata);
      console.log('JWT app_metadata:', jwtPayload.app_metadata);
    } catch (e) {
      console.log('Could not parse JWT:', e);
    }
  }

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [classInstances, setClassInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [studentList, setStudentList] = useState([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  
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
      console.log('=== FETCH CLASS INSTANCES DEBUG ===');
      console.log('School code:', school_code);
      console.log('Super admin code:', super_admin_code);
      
      // BACKEND INTEGRATION: Replace with comprehensive query above
      const { data, error } = await supabase
        .from('class_instances')
        .select(`
          id,
          class:classes (grade, section),
          academic_years:academic_years (year_start, year_end)
        `)
        .eq('school_code', school_code);

      console.log('Class instances query result:', { data, error });

      if (error) {
        console.error('Class instances error:', error);
        message.error('Failed to load classes: ' + error.message);
      } else {
        console.log('Class instances loaded:', data?.length || 0);
        setClassInstances(data || []);
      }
    };

    if (school_code && super_admin_code) {
      fetchClassInstances();
      fetchStudents();
    }
  }, [school_code, super_admin_code]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // AUTHENTICATION: Validate current user session
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        message.error('Not authenticated. Please log in.');
        setLoading(false);
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
      } else {
        // SUCCESS HANDLING: User feedback and form reset
        message.success('Student created successfully!');
        form.resetFields();
        fetchStudents();
      }
    } catch (err) {
      // GENERAL ERROR HANDLING: Network and unexpected errors
      message.error('Unexpected error: ' + err.message);
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

    console.log('=== STUDENT UPDATE DEBUG ===');
    console.log('Editing student ID:', editingStudent.id);
    console.log('Update values:', values);
    console.log('Class instance ID:', values.class_instance_id);

    // First, let's check if the student exists and get current data
    console.log('Fetching current student data...');
    const { data: currentStudent, error: fetchError } = await supabase
      .from('student')
      .select('*')
      .eq('id', editingStudent.id)
      .single();

    console.log('Current student data:', { currentStudent, fetchError });

    // Also test if we can query any students at all
    console.log('Testing general student query...');
    const { data: testStudents, error: testQueryError } = await supabase
      .from('student')
      .select('id, full_name, school_code')
      .limit(1);

    console.log('General student query result:', { testStudents, testQueryError });

    if (fetchError) {
      console.error('Error fetching current student:', fetchError);
      message.error('Failed to fetch student data: ' + fetchError.message);
      return;
    }

    if (!currentStudent) {
      message.error('Student not found');
      return;
    }

    // Compare current data with new data
    console.log('=== DATA COMPARISON ===');
    console.log('Current class_instance_id:', currentStudent.class_instance_id);
    console.log('New class_instance_id:', values.class_instance_id);
    console.log('Current full_name:', currentStudent.full_name);
    console.log('New full_name:', values.full_name);
    console.log('Current phone:', currentStudent.phone);
    console.log('New phone:', values.phone);
    console.log('Current student_code:', currentStudent.student_code);
    console.log('New student_code:', values.student_code);

    // Check if data is actually different
    const isDataDifferent = 
      currentStudent.class_instance_id !== values.class_instance_id ||
      currentStudent.full_name !== values.full_name ||
      currentStudent.phone !== values.phone ||
      currentStudent.student_code !== values.student_code;

    console.log('Is data different?', isDataDifferent);

    if (!isDataDifferent) {
      message.info('No changes detected. The data is identical to the current values.');
      return;
    }

    // Test if we can update at all (try a simple update first)
    console.log('Testing simple update...');
    const { data: testData, error: testError } = await supabase
      .from('student')
      .update({
        full_name: currentStudent.full_name + ' (Test)'
      })
      .eq('id', editingStudent.id)
      .select();

    console.log('Test update result:', { testData, testError });

    if (testError) {
      console.error('Test update failed - RLS or permission issue:', testError);
      message.error('Permission denied: ' + testError.message);
      return;
    }

    if (!testData || testData.length === 0) {
      console.error('Test update returned no rows - RLS blocking update');
      message.error('Permission denied: You do not have permission to update this student.');
      return;
    }

    console.log('Test update successful, proceeding with actual update...');

    // Now try the actual update
    console.log('Attempting actual update...');
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

    console.log('Update result:', { data, error });

    if (error) {
      console.error('Update error details:', error);
      message.error('Update failed: ' + error.message);
    } else {
      console.log('Update successful, updated rows:', data?.length || 0);
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

    const res = await fetch(
      'https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/delete-student',
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
      message.error(result.error || 'Failed to delete student');
    } else {
      message.success('Student deleted successfully');
      fetchStudents();
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
    <div style={{ minHeight: '100vh', padding: '24px', background: '#f8fafc' }}>
      <div className="max-w-3xl mx-auto">
        <Card
          title={
            <Space>
              <UserAddOutlined />
              <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>Add New Student</Title>
            </Space>
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
              student_code: 'S'
            }}
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
                    placeholder="Select class"
                    showSearch
                    optionFilterProp="children"
                    suffixIcon={<BookOutlined />}
                  >
                    {classInstances.map((instance) => (
                      <Option key={instance.id} value={instance.id}>
                        Grade {instance.class.grade} - {instance.class.section} | 
                        AY {instance.academic_years.year_start} - {instance.academic_years.year_end}
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
                    background: '#6366f1',
                    borderColor: '#6366f1',
                    borderRadius: '8px',
                    fontWeight: 500
                  }}
                >
                  {loading ? 'Adding Student...' : 'Add Student'}
                </Button>
                <Button
                  size="large"
                  onClick={() => form.resetFields()}
                >
                  Reset Form
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
      </div>
    </div>
  );
};

export default AddStudent;