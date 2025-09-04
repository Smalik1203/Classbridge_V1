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
import { supabase } from '../config/supabaseClient';

const { Title } = Typography;
const { Option } = Select;

const AddSpecificClass = () => {
  const { user } = useAuth();
  const { school_id, school_code, school_name, super_admin_code } = user.user_metadata || {};

  const [form] = Form.useForm();
  const [academicYears, setAcademicYears] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingYear, setAddingYear] = useState(false);
  const [classInstances, setClassInstances] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignRecord, setAssignRecord] = useState(null);
  const [assignForm] = Form.useForm();

  useEffect(() => {
    fetchAcademicYears();
    fetchAdmins();
    fetchClassInstances();
  }, [school_code, super_admin_code]);

  const fetchAcademicYears = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_code', school_code)
      .order('year_start', { ascending: false });
    if (!error) setAcademicYears(data || []);
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

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      let academicYearId = values.academic_year_id;

      if (values.academic_year_id === 'add_new') {
        const start = parseInt(values.year_start);
        const end = parseInt(values.year_end);
        if (!start || !end || end !== start + 1) {
          message.error('End year should be exactly one year after start year.');
          setLoading(false);
          return;
        }
        const { data: yearData, error: yearError } = await supabase
          .from('academic_years')
          .insert({
            school_id,
            school_code,
            school_name,
            year_start: start,
            year_end: end,
            is_active: true,
          })
          .select();
        if (yearError) {
          message.error(yearError.message);
          setLoading(false);
          return;
        }
        academicYearId = yearData[0].id;
        await fetchAcademicYears();
      }

      let classId;
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
          setLoading(false);
          return;
        }
        classId = newClass[0].id;
      }

      const { data: existingInstance } = await supabase
        .from('class_instances')
        .select('id')
        .eq('class_id', classId)
        .eq('academic_year_id', academicYearId)
        .eq('school_code', school_code);
      if (existingInstance && existingInstance.length > 0) {
        message.error('Class already exists for this academic year');
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('class_instances')
        .insert({
          class_id: classId,
          academic_year_id: academicYearId,
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
        form.resetFields();
        setAddingYear(false);
        fetchClassInstances(); // Refresh after insert
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
        <Button size="small" onClick={() => {
          setAssignRecord(record);
          assignForm.setFieldsValue({ class_teacher_id: record?.class_teacher_id || undefined });
          setAssignOpen(true);
        }}>
          Assign Admin
        </Button>
      )
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', padding: '24px', background: '#f8fafc' }}>
      <div className="max-w-5xl mx-auto">
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
          headStyle={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="academic_year_id"
                  label="Academic Year"
                  rules={[{ required: true, message: 'Please select academic year' }]}
                >
                  <Select
                    placeholder="Select Academic Year"
                    onChange={(val) => setAddingYear(val === 'add_new')}
                  >
                    {academicYears.map((year) => (
                      <Option key={year.id} value={year.id}>
                        {year.year_start} - {year.year_end}
                      </Option>
                    ))}
                    <Option value="add_new">+ Add New Academic Year</Option>
                  </Select>
                </Form.Item>
              </Col>
              {addingYear && (
                <>
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
                </>
              )}
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
                style={{
                  background: '#6366f1',
                  borderColor: '#6366f1',
                  borderRadius: '8px',
                  fontWeight: 500,
                }}
              >
                {loading ? 'Creating...' : 'Create Class'}
              </Button>
              <Button
                size="large"
                onClick={() => {
                  form.resetFields();
                  setAddingYear(false);
                }}
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
    </div>
  );
};

export default AddSpecificClass;
