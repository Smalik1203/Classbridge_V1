// src/components/ExamManagement.jsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Alert,
  Popconfirm,
  message,
  Spin,
  Empty,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  BookOutlined,
  CalendarOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { getExams, createExam, updateExam, deleteExam } from '../services/resultsService';
import { getClassInstances } from '../services/schoolService';
import { getSubjects } from '../services/subjectService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ExamManagement = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [form] = Form.useForm();
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  const schoolCode = user?.user_metadata?.school_code;

  // Add loading states for different operations
  const [examsLoading, setExamsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);

  const fetchExams = async () => {
    setExamsLoading(true);
    try {
      const data = await getExams(schoolCode);
      setExams(data);
    } catch (error) {
      message.error('Failed to fetch exams');
      console.error('Error fetching exams:', error);
    } finally {
      setExamsLoading(false);
    }
  };

  const fetchClasses = async () => {
    setClassesLoading(true);
    try {
      const data = await getClassInstances(schoolCode);
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setClassesLoading(false);
    }
  };

  const fetchSubjects = async () => {
    setSubjectsLoading(true);
    try {
      const data = await getSubjects(schoolCode);
      setSubjects(data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setSubjectsLoading(false);
    }
  };

  const handleCreateExam = () => {
    setEditingExam(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditExam = (exam) => {
    setEditingExam(exam);
    form.setFieldsValue({
      ...exam,
      exam_date: exam.exam_date ? new Date(exam.exam_date) : null,
      subjects: exam.exam_subjects?.map(es => ({
        subject_id: es.subject_id,
        max_marks: es.max_marks,
        passing_marks: es.passing_marks,
        weightage: es.weightage
      })) || []
    });
    setModalVisible(true);
  };

  const handleDeleteExam = async (examId) => {
    try {
      await deleteExam(examId);
      message.success('Exam deleted successfully');
      fetchExams();
    } catch (error) {
      message.error('Failed to delete exam');
      console.error('Error deleting exam:', error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const examData = {
        ...values,
        school_code: schoolCode,
        created_by: user.id,
        exam_date: values.exam_date?.toISOString().split('T')[0]
      };

      if (editingExam) {
        await updateExam(editingExam.id, examData);
        message.success('Exam updated successfully');
      } else {
        await createExam(examData);
        message.success('Exam created successfully');
      }

      setModalVisible(false);
      fetchExams();
    } catch (error) {
      message.error(editingExam ? 'Failed to update exam' : 'Failed to create exam');
      console.error('Error saving exam:', error);
    }
  };

  const getExamTypeColor = (type) => {
    const colors = {
      unit_test: 'blue',
      monthly_test: 'green',
      mid_term: 'orange',
      final_exam: 'red',
      assignment: 'purple',
      project: 'cyan'
    };
    return colors[type] || 'default';
  };

  const getExamTypeLabel = (type) => {
    const labels = {
      unit_test: 'Unit Test',
      monthly_test: 'Monthly Test',
      mid_term: 'Mid Term',
      final_exam: 'Final Exam',
      assignment: 'Assignment',
      project: 'Project'
    };
    return labels[type] || type;
  };

  const columns = [
    {
      title: 'Exam Name',
      dataIndex: 'exam_name',
      key: 'exam_name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.class_instance?.grade} - {record.class_instance?.section}
          </Text>
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: 'exam_type',
      key: 'exam_type',
      render: (type) => (
        <Tag color={getExamTypeColor(type)}>
          {getExamTypeLabel(type)}
        </Tag>
      )
    },
    {
      title: 'Date',
      dataIndex: 'exam_date',
      key: 'exam_date',
      render: (date) => new Date(date).toLocaleDateString('en-IN')
    },
    {
      title: 'Total Marks',
      dataIndex: 'total_marks',
      key: 'total_marks',
      align: 'center'
    },
    {
      title: 'Subjects',
      key: 'subjects',
      render: (_, record) => (
        <div>
          {record.exam_subjects?.map((es, index) => (
            <Tag key={index} size="small">
                                              {es.subject?.subject_name} ({es.max_marks})
            </Tag>
          ))}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => console.log('View exam:', record.id)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditExam(record)}
          />
          <Popconfirm
            title="Delete Exam"
            description="Are you sure you want to delete this exam? This action cannot be undone."
            onConfirm={() => handleDeleteExam(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okType="danger"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: antdTheme.token.colorText }}>
            Exam Management
          </Title>
          <Text type="secondary" style={{ color: antdTheme.token.colorTextSecondary }}>
            Create and manage exams for different classes
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              type="primary"
              onClick={() => {
                fetchExams();
                fetchClasses();
                fetchSubjects();
              }}
              loading={examsLoading || classesLoading || subjectsLoading}
            >
              {examsLoading || classesLoading || subjectsLoading ? 'Loading...' : 'Load Data'}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateExam}
            >
              Create Exam
            </Button>
          </Space>
        </Col>
      </Row>

             {/* Statistics */}
       {exams.length === 0 && !examsLoading ? (
         <Card style={{ marginBottom: '16px' }}>
           <Empty
             description="Click 'Load Data' to fetch exams and class information"
             image={Empty.PRESENTED_IMAGE_SIMPLE}
           />
         </Card>
       ) : (
         <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <BookOutlined style={{ fontSize: '24px', color: antdTheme.token.colorPrimary }} />
              <div style={{ marginTop: '8px' }}>
                <Text strong style={{ fontSize: '18px' }}>
                  {exams.length}
                </Text>
                <br />
                <Text type="secondary">Total Exams</Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <CalendarOutlined style={{ fontSize: '24px', color: antdTheme.token.colorSuccess }} />
              <div style={{ marginTop: '8px' }}>
                <Text strong style={{ fontSize: '18px' }}>
                  {exams.filter(e => e.is_active).length}
                </Text>
                <br />
                <Text type="secondary">Active Exams</Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <TrophyOutlined style={{ fontSize: '24px', color: antdTheme.token.colorWarning }} />
              <div style={{ marginTop: '8px' }}>
                <Text strong style={{ fontSize: '18px' }}>
                  {exams.filter(e => e.exam_type === 'final_exam').length}
                </Text>
                <br />
                <Text type="secondary">Final Exams</Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <BookOutlined style={{ fontSize: '24px', color: antdTheme.token.colorInfo }} />
              <div style={{ marginTop: '8px' }}>
                <Text strong style={{ fontSize: '18px' }}>
                  {exams.filter(e => e.exam_type === 'unit_test').length}
                </Text>
                <br />
                <Text type="secondary">Unit Tests</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
        )}

      {/* Exams Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={exams}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} exams`
          }}
          locale={{
            emptyText: (
              <Empty
                description="No exams found"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          }}
        />
      </Card>

      {/* Create/Edit Exam Modal */}
      <Modal
        title={editingExam ? 'Edit Exam' : 'Create New Exam'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            exam_type: 'unit_test',
            is_active: true,
            subjects: []
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="exam_name"
                label="Exam Name"
                rules={[{ required: true, message: 'Please enter exam name' }]}
              >
                <Input placeholder="e.g., Unit Test 1 - Mathematics" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="exam_type"
                label="Exam Type"
                rules={[{ required: true, message: 'Please select exam type' }]}
              >
                <Select placeholder="Select exam type">
                  <Option value="unit_test">Unit Test</Option>
                  <Option value="monthly_test">Monthly Test</Option>
                  <Option value="mid_term">Mid Term</Option>
                  <Option value="final_exam">Final Exam</Option>
                  <Option value="assignment">Assignment</Option>
                  <Option value="project">Project</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="class_instance_id"
                label="Class"
                rules={[{ required: true, message: 'Please select class' }]}
              >
                <Select placeholder="Select class">
                  {classes.map(cls => (
                    <Option key={cls.id} value={cls.id}>
                      {cls.grade} - {cls.section}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="exam_date"
                label="Exam Date"
                rules={[{ required: true, message: 'Please select exam date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="total_marks"
                label="Total Marks"
                rules={[{ required: true, message: 'Please enter total marks' }]}
              >
                <InputNumber
                  min={1}
                  max={1000}
                  style={{ width: '100%' }}
                  placeholder="e.g., 100"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="passing_marks"
                label="Passing Marks"
                rules={[{ required: true, message: 'Please enter passing marks' }]}
              >
                <InputNumber
                  min={1}
                  max={1000}
                  style={{ width: '100%' }}
                  placeholder="e.g., 35"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="duration_minutes"
                label="Duration (minutes)"
              >
                <InputNumber
                  min={1}
                  max={480}
                  style={{ width: '100%' }}
                  placeholder="e.g., 120"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="instructions"
            label="Instructions"
          >
            <TextArea
              rows={3}
              placeholder="Enter exam instructions for students..."
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Status"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>Active</Option>
              <Option value={false}>Inactive</Option>
            </Select>
          </Form.Item>

          <Divider>Exam Subjects</Divider>

          <Form.List name="subjects">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={16} key={key} style={{ marginBottom: '16px' }}>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'subject_id']}
                        label="Subject"
                        rules={[{ required: true, message: 'Please select subject' }]}
                      >
                        <Select placeholder="Select subject">
                          {subjects.map(subject => (
                            <Option key={subject.id} value={subject.id}>
                              {subject.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'max_marks']}
                        label="Max Marks"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber
                          min={1}
                          max={1000}
                          style={{ width: '100%' }}
                          placeholder="Marks"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'passing_marks']}
                        label="Passing Marks"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber
                          min={1}
                          max={1000}
                          style={{ width: '100%' }}
                          placeholder="Pass"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Form.Item
                        {...restField}
                        name={[name, 'weightage']}
                        label="Weightage"
                        initialValue={1.00}
                      >
                        <InputNumber
                          min={0.1}
                          max={10}
                          step={0.1}
                          style={{ width: '100%' }}
                          placeholder="1.0"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={1}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                        style={{ marginTop: '32px' }}
                      />
                    </Col>
                  </Row>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    Add Subject
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item style={{ marginTop: '24px', textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingExam ? 'Update Exam' : 'Create Exam'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExamManagement;
