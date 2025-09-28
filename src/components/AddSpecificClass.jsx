import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Space,
  Row,
  Col,
  message,
  Table,
  Tag,
  Modal
} from 'antd';
import {
  CalendarOutlined,
  BookOutlined,
  UserOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { getSchoolId, getSchoolCode, getSchoolName, getSuperAdminCode } from '../utils/metadata';
import { supabase } from '../config/supabaseClient';

const { Title, Text } = Typography;
const { Option } = Select;

const AddSpecificClass = () => {
  const { user } = useAuth();
  
  // Debug user data structure (commented out for production)
  // console.log('=== USER DATA DEBUG ===');
  // console.log('Full user object:', user);
  // console.log('user.user_metadata:', user?.user_metadata);
  // console.log('user.app_metadata:', user?.app_metadata);
  // console.log('user.raw_app_meta_data:', user?.raw_app_meta_data);
  
  // Use comprehensive metadata extraction
  const school_id = getSchoolId(user);
  const school_code = getSchoolCode(user);
  const school_name = getSchoolName(user);
  const super_admin_code = getSuperAdminCode(user);
  
  // console.log('Extracted values:');
  // console.log('school_id:', school_id);
  // console.log('school_code:', school_code);
  // console.log('school_name:', school_name);
  // console.log('super_admin_code:', super_admin_code);

  // Separate forms for academic year and class creation
  const [academicYearForm] = Form.useForm();
  const [classForm] = Form.useForm();
  
  const [academicYears, setAcademicYears] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [yearLoading, setYearLoading] = useState(false);
  const [classInstances, setClassInstances] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignRecord, setAssignRecord] = useState(null);
  const [assignForm] = Form.useForm();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [editForm] = Form.useForm();

  useEffect(() => {
    fetchAcademicYears();
    fetchAdmins();
    fetchClassInstances();
  }, [school_code, super_admin_code]);

  const fetchAcademicYears = async () => {
    try {
      console.log('Fetching academic years for school_code:', school_code);
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_code', school_code)
        .order('year_start', { ascending: false });
      
      if (error) {
        console.error('Error fetching academic years:', error);
        message.error('Failed to fetch academic years: ' + error.message);
      } else {
        console.log('Academic years fetched successfully:', data);
        setAcademicYears(data || []);
      }
    } catch (err) {
      console.error('Exception in fetchAcademicYears:', err);
      message.error('Failed to fetch academic years');
    }
  };

  const fetchAdmins = async () => {
    const { data, error } = await supabase
      .from('admin')
      .select('id, full_name')
      .eq('school_code', school_code);
    if (!error) setAdmins(data || []);
  };

  const fetchClassInstances = async () => {
    setTableLoading(true);
    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        id,
        grade,
        section,
        class_teacher_id,
        created_at,
        class:classes (grade, section),
        year:academic_years (year_start, year_end),
        teacher:admin (full_name)
      `)
      .eq('school_code', school_code)
      .order('grade', { ascending: false })
      .order('section');

    if (error) {
      message.error('Error fetching classes');
    } else {
      setClassInstances(data || []);
    }
    setTableLoading(false);
  };

  // Separate handler for academic year creation
  const handleAcademicYearSubmit = async (values) => {
    setYearLoading(true);
    try {
      // Validate school data first
      if (!school_code || !school_name) {
        message.error('School information not found. Please ensure you are properly logged in.');
        console.error('Missing school data - school_code:', school_code, 'school_name:', school_name);
        return;
      }

      const start = parseInt(values.year_start);
      const end = parseInt(values.year_end);
      
      if (!start || !end || end !== start + 1) {
        message.error('End year should be exactly one year after start year.');
        return;
      }

      // Check if academic year already exists
      const { data: existingYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_code', school_code)
        .eq('year_start', start)
        .eq('year_end', end);

      if (existingYear && existingYear.length > 0) {
        message.error('Academic year already exists for this period.');
        return;
      }

      const insertData = {
        school_id,
        school_code,
        school_name,
        year_start: start,
        year_end: end,
        is_active: true,
      };
      
      console.log('Creating academic year with data:', insertData);
      
      const { data: yearData, error: yearError } = await supabase
        .from('academic_years')
        .insert(insertData)
        .select();

      if (yearError) {
        console.error('Error creating academic year:', yearError);
        message.error(yearError.message);
      } else {
        console.log('Academic year created successfully:', yearData);
        message.success('Academic year created successfully');
        academicYearForm.resetFields();
        
        // Force refresh the academic years list
        console.log('Refreshing academic years list...');
        await fetchAcademicYears();
        
        // Also refresh the class instances to show any new data
        fetchClassInstances();
      }
    } finally {
      setYearLoading(false);
    }
  };

  // Separate handler for class creation
  const handleClassSubmit = async (values) => {
    setLoading(true);
    try {
      // Validate school data first
      if (!school_code || !school_name || !super_admin_code) {
        message.error('School information not found. Please ensure you are properly logged in.');
        console.error('Missing school data - school_code:', school_code, 'school_name:', school_name, 'super_admin_code:', super_admin_code);
        return;
      }

      let classId;
      
      // Check if class already exists
      const { data: existingClass } = await supabase
        .from('classes')
        .select('*')
        .eq('grade', values.grade)
        .eq('section', values.section)
        .eq('school_code', school_code)
        .eq('created_by', super_admin_code);
        
      if (existingClass && existingClass.length > 0) {
        classId = existingClass[0].id;
      } else {
        // Create new class
        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert({
            grade: values.grade,
            section: values.section,
            school_name,
            school_code,
            created_by: super_admin_code,
          })
          .select();
          
        if (classError) {
          message.error(classError.message);
          return;
        }
        classId = newClass[0].id;
      }

      // Check if class instance already exists for this academic year
      const { data: existingInstance } = await supabase
        .from('class_instances')
        .select('id')
        .eq('class_id', classId)
        .eq('academic_year_id', values.academic_year_id)
        .eq('school_code', school_code);
        
      if (existingInstance && existingInstance.length > 0) {
        message.error('Class already exists for this academic year');
        return;
      }

      // Create class instance
      const { error: insertError } = await supabase
        .from('class_instances')
        .insert({
          class_id: classId,
          academic_year_id: values.academic_year_id,
          class_teacher_id: values.class_teacher_id,
          school_code,
          created_by: super_admin_code,
          grade: values.grade,
          section: values.section,
        });

      if (insertError) {
        message.error(insertError.message);
      } else {
        message.success('Class created successfully');
        classForm.resetFields();
        fetchClassInstances();
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Grade',
      dataIndex: ['grade'],
      key: 'grade',
      render: (_, record) => record.class?.grade || record.grade,
    },
    {
      title: 'Section',
      dataIndex: ['section'],
      key: 'section',
      render: (_, record) => record.class?.section || record.section,
    },
    {
      title: 'Academic Year',
      dataIndex: 'year',
      key: 'year',
      render: (year) => `${year?.year_start} - ${year?.year_end}`,
    },
    {
      title: 'Class Admin',
      dataIndex: 'teacher',
      key: 'teacher',
      render: (teacher) => teacher?.full_name || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => {
            setAssignRecord(record);
            assignForm.setFieldsValue({ class_teacher_id: record?.class_teacher_id || undefined });
            setAssignOpen(true);
          }}>
            Assign Admin
          </Button>
          <Button size="small" type="primary" onClick={() => handleEditClass(record)}>
            Edit
          </Button>
          <Button size="small" danger onClick={() => handleDeleteClass(record.id)}>
            Delete
          </Button>
        </Space>
      )
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
    },
  ];

  const handleDeleteClass = async (classId) => {
    try {
      const { error } = await supabase
        .from('class_instances')
        .delete()
        .eq('id', classId);
      
      if (error) throw error;
      
      message.success('Class deleted successfully');
      fetchClassInstances();
    } catch (error) {
      message.error(error.message || 'Failed to delete class');
    }
  };

  const handleEditClass = (classRecord) => {
    setEditingClass(classRecord);
    editForm.setFieldsValue({
      grade: classRecord.grade,
      section: classRecord.section,
      class_teacher_id: classRecord.class_teacher_id
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async (values) => {
    try {
      const { error } = await supabase
        .from('class_instances')
        .update({
          grade: values.grade,
          section: values.section,
          class_teacher_id: values.class_teacher_id
        })
        .eq('id', editingClass.id);
      
      if (error) throw error;
      
      message.success('Class updated successfully');
      setEditModalVisible(false);
      setEditingClass(null);
      editForm.resetFields();
      fetchClassInstances();
    } catch (error) {
      message.error(error.message || 'Failed to update class');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '24px', 
      background: '#f8fafc' 
    }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Academic Year Creation Form */}
        <Card
          title={
            <Space>
              <CalendarOutlined />
              <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>
                Add Academic Year
              </Title>
            </Space>
          }
          style={{
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            background: '#ffffff',
            marginBottom: '24px',
          }}
          styles={{ header: { borderBottom: '1px solid #e2e8f0' } }}
        >
          <Form form={academicYearForm} layout="vertical" onFinish={handleAcademicYearSubmit} size="large">
            <Row gutter={[16, 0]}>
              <Col xs={12} md={6}>
                <Form.Item
                  name="year_start"
                  label="Start Year"
                  rules={[
                    { required: true, message: 'Enter start year' },
                    { pattern: /^[0-9]{4}$/, message: 'Enter a valid 4-digit year' },
                  ]}
                >
                  <Input placeholder="e.g., 2025" type="number" />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item
                  name="year_end"
                  label="End Year"
                  rules={[
                    { required: true, message: 'Enter end year' },
                    { pattern: /^[0-9]{4}$/, message: 'Enter a valid 4-digit year' },
                  ]}
                >
                  <Input placeholder="e.g., 2026" type="number" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={yearLoading}
                icon={<PlusOutlined />}
                size="large"
                style={{
                  background: '#10b981',
                  borderColor: '#10b981',
                  borderRadius: '8px',
                  fontWeight: 500,
                }}
              >
                {yearLoading ? 'Creating...' : 'Create Academic Year'}
              </Button>
              <Button
                size="large"
                onClick={() => academicYearForm.resetFields()}
                style={{ marginLeft: 12 }}
              >
                Reset
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Helpful guidance text */}
        <div style={{ 
          textAlign: 'center', 
          margin: '24px 0',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            💡 <strong>Tip:</strong> First create an academic year above, then use it to create classes below. 
            Each class must be associated with an academic year.
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px', color: '#666' }}>
            📊 Available academic years: {academicYears.length}
          </Text>
        </div>

        {/* Class Creation Form */}
        <Card
          title={
            <Space>
              <BookOutlined />
              <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>
                Add Class
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
          <Form form={classForm} layout="vertical" onFinish={handleClassSubmit} size="large">
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="academic_year_id"
                  label="Academic Year"
                  rules={[{ required: true, message: 'Please select academic year' }]}
                >
                  <Select
                    key={`academic-years-${academicYears.length}`}
                    placeholder={academicYears.length === 0 ? "No academic years available - create one above first" : "Select Academic Year"}
                    showSearch
                    optionFilterProp="children"
                    disabled={academicYears.length === 0}
                    notFoundContent={academicYears.length === 0 ? "Create an academic year above first" : "No academic years found"}
                  >
                    {academicYears.map((year) => (
                      <Option key={year.id} value={year.id}>
                        {year.year_start} - {year.year_end}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item
                  name="grade"
                  label="Grade"
                  rules={[
                    { required: true, message: 'Please enter grade' },
                    { pattern: /^[0-9]+$/, message: 'Grade must be a number' },
                  ]}
                >
                  <Input prefix={<BookOutlined />} placeholder="Enter grade (e.g., 10)" type="number" />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item
                  name="section"
                  label="Section"
                  rules={[{ required: true, message: 'Please enter section' }]}
                >
                  <Input prefix={<BookOutlined />} placeholder="Enter section (e.g., A)" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="class_teacher_id"
                  label="Class Admin"
                  rules={[{ required: true, message: 'Please select class admin' }]}
                >
                  <Select
                    placeholder="Select Class Admin"
                    showSearch
                    optionFilterProp="children"
                    suffixIcon={<UserOutlined />}
                  >
                    {admins.map((admin) => (
                      <Option key={admin.id} value={admin.id}>
                        {admin.full_name}
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
                icon={<PlusOutlined />}
                size="large"
                disabled={academicYears.length === 0}
                style={{
                  background: academicYears.length === 0 ? '#d1d5db' : '#6366f1',
                  borderColor: academicYears.length === 0 ? '#d1d5db' : '#6366f1',
                  borderRadius: '8px',
                  fontWeight: 500,
                }}
              >
                {loading ? 'Creating...' : academicYears.length === 0 ? 'Create Academic Year First' : 'Create Class'}
              </Button>
              <Button
                size="large"
                onClick={() => classForm.resetFields()}
                style={{ marginLeft: 12 }}
              >
                Reset
              </Button>
            </Form.Item>
          </Form>

          {/* Display Classes */}
          <div style={{ marginTop: '40px' }}>
            <Title level={4}>Existing Classes</Title>
            <Table
              dataSource={classInstances}
              columns={columns}
              loading={tableLoading}
              rowKey="id"
              pagination={{ pageSize: 25 }}
            />
          </div>
        </Card>
      </div>
      {/* Assign/Change Admin Modal */}
      <Modal
        title="Assign Class Admin"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={async () => {
          try {
            const v = await assignForm.validateFields();
            if (!assignRecord?.id) return;
            setAssignBusy(true);
            const { error } = await supabase
              .from('class_instances')
              .update({ class_teacher_id: v.class_teacher_id })
              .eq('id', assignRecord.id);
            if (error) throw error;
            message.success('Assigned admin to class');
            setAssignOpen(false);
            setAssignRecord(null);
            assignForm.resetFields();
            fetchClassInstances();
          } catch (e) {
            if (e?.errorFields) return;
            message.error(e?.message || 'Failed to assign admin');
          } finally { setAssignBusy(false); }
        }}
        confirmLoading={assignBusy}
        okText="Save"
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            name="class_teacher_id"
            label="Class Admin"
            rules={[{ required: true, message: 'Please select class admin' }]}
          >
            <Select
              placeholder="Select Class Admin"
              showSearch
              optionFilterProp="children"
              suffixIcon={<UserOutlined />}
            >
              {admins.map((admin) => (
                <Option key={admin.id} value={admin.id}>
                  {admin.full_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Class Modal */}
      <Modal
        title="Edit Class"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingClass(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        okText="Update"
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="grade"
            label="Grade"
            rules={[{ required: true, message: 'Please enter grade' }]}
          >
            <Input placeholder="Enter grade" />
          </Form.Item>
          <Form.Item
            name="section"
            label="Section"
            rules={[{ required: true, message: 'Please enter section' }]}
          >
            <Input placeholder="Enter section" />
          </Form.Item>
          <Form.Item
            name="class_teacher_id"
            label="Class Admin"
            rules={[{ required: true, message: 'Please select class admin' }]}
          >
            <Select
              placeholder="Select Class Admin"
              showSearch
              optionFilterProp="children"
              suffixIcon={<UserOutlined />}
            >
              {admins.map((admin) => (
                <Option key={admin.id} value={admin.id}>
                  {admin.full_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AddSpecificClass;

