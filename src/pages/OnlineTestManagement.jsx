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
  message,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  Tooltip,
  Dropdown,
  Switch,
  Alert,
  Empty,
  Spin,
  Pagination,
  Upload
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ImportOutlined,
  MoreOutlined,
  CalendarOutlined,
  UserOutlined,
  BookOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import dayjs from 'dayjs';
import { useTheme } from '../contexts/ThemeContext';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { 
  getTests, 
  createTest, 
  updateTest, 
  deleteTest,
  getClassInstances,
  getSubjects
} from '../services/testService';
import QuestionBuilder from '../components/QuestionBuilder';
import TestImportModal from '../components/TestImportModal';
import PreviewQuestionsModal from '../components/PreviewQuestionsModal';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const OnlineTestManagement = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  const { showError, showSuccess } = useErrorHandler();
  
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState([]);
  const [classInstances, setClassInstances] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [questionBuilderVisible, setQuestionBuilderVisible] = useState(false);
  const [testImportVisible, setTestImportVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [testsData, classInstancesData, subjectsData] = await Promise.all([
        getTests(),
        getClassInstances(user?.school_code),
        getSubjects(user?.school_code)
      ]);
      
      // Filter only online tests
      const onlineTests = testsData.filter(test => test.test_mode === 'online');
      setTests(onlineTests);
      setClassInstances(classInstancesData || []);
      setSubjects(subjectsData || []);
    } catch (error) {
      showError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = async (values) => {
    try {
      setLoading(true);
      const testData = {
        ...values,
        test_mode: 'online',
        created_by: user.id,
        school_code: user.school_code,
        test_date: values.test_date ? dayjs(values.test_date).format('YYYY-MM-DD') : null
      };
      
      await createTest(testData);
      showSuccess('Online test created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      showError('Failed to create online test');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTest = async (values) => {
    try {
      setLoading(true);
      await updateTest(editingTest.id, {
        ...values,
        test_date: values.test_date ? dayjs(values.test_date).format('YYYY-MM-DD') : null
      });
      showSuccess('Online test updated successfully');
      setEditModalVisible(false);
      setEditingTest(null);
      form.resetFields();
      fetchData();
    } catch (error) {
      showError('Failed to update online test');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTest = async (testId) => {
    try {
      await deleteTest(testId);
      showSuccess('Online test deleted successfully');
      fetchData();
    } catch (error) {
      showError('Failed to delete online test');
    }
  };

  const handleManageQuestions = (test) => {
    setSelectedTest(test);
    setQuestionBuilderVisible(true);
  };

  const handlePreviewQuestions = (test) => {
    setSelectedTest(test);
    setPreviewVisible(true);
  };

  const handleImportTests = () => {
    setTestImportVisible(true);
  };

  const handleQuestionBuilderClose = () => {
    setQuestionBuilderVisible(false);
    setSelectedTest(null);
    fetchData();
  };

  const handlePreviewClose = () => {
    setPreviewVisible(false);
    setSelectedTest(null);
  };

  const handleImportClose = () => {
    setTestImportVisible(false);
    fetchData();
  };

  const handleEdit = (test) => {
    setEditingTest(test);
    form.setFieldsValue({
      title: test.title,
      description: test.description,
      subject_id: test.subject_id,
      class_instance_id: test.class_instance_id,
      academic_year_id: test.academic_year_id,
      test_date: test.test_date ? dayjs(test.test_date).startOf('day') : null,
      time_limit_seconds: test.time_limit_seconds,
      max_attempts: test.max_attempts
    });
    setEditModalVisible(true);
  };

  const columns = [
    {
      title: 'Test Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: '500', marginBottom: '4px' }}>
            {text}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description}
          </Text>
        </div>
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subject_name',
      key: 'subject',
      width: 120,
      render: (text) => (
        <Tag color="blue" icon={<BookOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Class',
      dataIndex: 'class_name',
      key: 'class',
      width: 120,
      render: (text) => (
        <Tag color="green" icon={<UserOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Questions',
      dataIndex: 'question_count',
      key: 'questions',
      width: 100,
      render: (count) => (
        <Space>
          <QuestionCircleOutlined />
          <Text strong>{count || 0}</Text>
        </Space>
      ),
    },
    {
      title: 'Time Limit',
      dataIndex: 'time_limit_seconds',
      key: 'time_limit',
      width: 120,
      render: (seconds) => {
        if (!seconds) return <Text type="secondary">No limit</Text>;
        const minutes = Math.floor(seconds / 60);
        return (
          <Space>
            <ClockCircleOutlined />
            <Text>{minutes} min</Text>
          </Space>
        );
      },
    },
    {
      title: 'Test Date',
      dataIndex: 'test_date',
      key: 'test_date',
      width: 120,
      render: (date) => (
        <Space>
          <CalendarOutlined />
          {date ? dayjs(date).format('DD MMM, YYYY') : 'Not set'}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const isActive = record.is_active;
        return (
          <Tag color={isActive ? 'green' : 'red'}>
            {isActive ? 'Active' : 'Inactive'}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        const menuItems = [
          {
            key: 'preview',
            label: 'Preview Questions',
            icon: <EyeOutlined />,
            onClick: () => handlePreviewQuestions(record)
          },
          {
            key: 'edit',
            label: 'Edit Test',
            icon: <EditOutlined />,
            onClick: () => handleEdit(record)
          },
          {
            key: 'delete',
            label: 'Delete Test',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: 'Delete Online Test',
                content: 'Are you sure you want to delete this online test? This action cannot be undone.',
                onOk: () => handleDeleteTest(record.id)
              });
            }
          }
        ];

        return (
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleManageQuestions(record)}
            >
              Manage Questions
            </Button>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
            >
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const totalTests = tests.length;
  const activeTests = tests.filter(test => test.is_active).length;
  const totalQuestions = tests.reduce((sum, test) => sum + (test.question_count || 0), 0);
  const averageQuestions = totalTests > 0 ? (totalQuestions / totalTests).toFixed(1) : 0;

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              💻 Online Test Management
            </Title>
            <Text type="secondary">
              Create and manage digital tests with questions, time limits, and automated scoring
            </Text>
          </div>
          <Space>
            <Button
              icon={<ImportOutlined />}
              onClick={handleImportTests}
              size="large"
            >
              Import Online Tests
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
              size="large"
            >
              Create Online Test
            </Button>
          </Space>
        </div>

        {/* Info Alert */}
        <Alert
          message="Online Test Management"
          description="Create digital tests with multiple choice, true/false, and other question types. Students can take these tests online with automated scoring."
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />

        {/* Statistics */}
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Total Online Tests"
                value={totalTests}
                prefix={<PlayCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Active Tests"
                value={activeTests}
                suffix={`/ ${totalTests}`}
                prefix={<PlayCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Total Questions"
                value={totalQuestions}
                prefix={<QuestionCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Avg Questions/Test"
                value={averageQuestions}
                prefix={<QuestionCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Tests Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={tests}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} online tests`
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Create Test Modal */}
      <Modal
        title="Create Online Test"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTest}
        >
          <Form.Item
            name="title"
            label="Test Title"
            rules={[{ required: true, message: 'Please enter test title' }]}
          >
            <Input placeholder="e.g., Math Quiz 1, Science Test, English Assessment" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Optional description of the test" />
          </Form.Item>

          <Form.Item
            name="subject_id"
            label="Subject"
            rules={[{ required: true, message: 'Please select subject' }]}
          >
            <Select placeholder="Select subject">
              {/* This would be populated from your subjects data */}
            </Select>
          </Form.Item>

          <Form.Item
            name="class_instance_id"
            label="Class"
            rules={[{ required: true, message: 'Please select class' }]}
          >
            <Select placeholder="Select class">
              {/* This would be populated from your classes data */}
            </Select>
          </Form.Item>

          <Form.Item
            name="test_date"
            label="Test Date"
          >
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item
            name="time_limit_seconds"
            label="Time Limit (minutes)"
          >
            <Input type="number" placeholder="60" />
          </Form.Item>

          <Form.Item
            name="max_attempts"
            label="Maximum Attempts"
          >
            <Input type="number" placeholder="1" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Create Online Test
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Test Modal */}
      <Modal
        title="Edit Online Test"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingTest(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditTest}
        >
          <Form.Item
            name="title"
            label="Test Title"
            rules={[{ required: true, message: 'Please enter test title' }]}
          >
            <Input placeholder="e.g., Math Quiz 1, Science Test, English Assessment" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Optional description of the test" />
          </Form.Item>

          <Form.Item
            name="subject_id"
            label="Subject"
            rules={[{ required: true, message: 'Please select subject' }]}
          >
            <Select placeholder="Select subject">
              {/* This would be populated from your subjects data */}
            </Select>
          </Form.Item>

          <Form.Item
            name="class_instance_id"
            label="Class"
            rules={[{ required: true, message: 'Please select class' }]}
          >
            <Select placeholder="Select class">
              {/* This would be populated from your classes data */}
            </Select>
          </Form.Item>

          <Form.Item
            name="test_date"
            label="Test Date"
          >
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item
            name="time_limit_seconds"
            label="Time Limit (minutes)"
          >
            <Input type="number" placeholder="60" />
          </Form.Item>

          <Form.Item
            name="max_attempts"
            label="Maximum Attempts"
          >
            <Input type="number" placeholder="1" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setEditModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Update Online Test
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Question Builder Modal */}
      {selectedTest && (
        <QuestionBuilder
          visible={questionBuilderVisible}
          onClose={handleQuestionBuilderClose}
          test={selectedTest}
        />
      )}

      {/* Test Import Modal */}
      <TestImportModal
        visible={testImportVisible}
        onClose={handleImportClose}
        classInstances={classInstances}
        subjects={subjects}
        schoolCode={user?.school_code}
        userId={user?.id}
      />

      {/* Preview Questions Modal */}
      {selectedTest && (
        <PreviewQuestionsModal
          visible={previewVisible}
          onClose={handlePreviewClose}
          test={selectedTest}
        />
      )}
    </div>
  );
};

export default OnlineTestManagement;
