import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Modal, Form, Input, Select, DatePicker, message, Space, Typography, Row, Col, Statistic, Tag, Tooltip, Dropdown, Switch, Alert, Empty, Spin, Pagination, Upload, Tabs } from 'antd';
import dayjs from 'dayjs';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  BookOutlined,
  UserOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  UploadOutlined,
  MoreOutlined,
  FilterOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  FileExcelOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { getSchoolCode } from '../utils/metadata';
import { 
  getTests, 
  createTest, 
  updateTest, 
  deleteTest, 
  getClassInstances, 
  getSubjects 
} from '../services/testService';
import { useErrorHandler } from '../hooks/useErrorHandler';
import QuestionBuilder from '../components/QuestionBuilder';
import TestImportModal from '../components/TestImportModal';
import PreviewQuestionsModal from '../components/PreviewQuestionsModal';
import OfflineTestMarksManager from '../components/OfflineTestMarksManagerCorrect';
// import OfflineMarksPanel from '../components/OfflineMarksPanel'; // Deprecated - use OfflineTestMarksManager instead
import TestAnalytics from './TestAnalytics';

const { Title, Text } = Typography;

const UnifiedTestManagement = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  const { showError, showSuccess } = useErrorHandler();
  
  const [activeTab, setActiveTab] = useState('online');
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState([]);
  const [classInstances, setClassInstances] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [questionBuilderVisible, setQuestionBuilderVisible] = useState(false);
  const [testImportVisible, setTestImportVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [marksManagerVisible, setMarksManagerVisible] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [marksModalOpen, setMarksModalOpen] = useState(false);
  const [currentTestId, setCurrentTestId] = useState(null);
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
      const schoolCode = getSchoolCode(user);
      
      if (!schoolCode) {
        showError('School code not found. Please contact support.');
        return;
      }
      
      const [testsData, classInstancesData, subjectsData] = await Promise.all([
        getTests(schoolCode),
        getClassInstances(schoolCode),
        getSubjects(schoolCode)
      ]);
      
      setTests(testsData || []);
      setClassInstances(classInstancesData || []);
      setSubjects(subjectsData || []);
    } catch (error) {
      showError('Failed to fetch data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = async (values) => {
    try {
      setLoading(true);
      const schoolCode = getSchoolCode(user);
      const testData = {
        ...values,
        test_date: values.test_date ? dayjs(values.test_date).format('YYYY-MM-DD') : null,
        status: values.status || 'active',
        created_by: user.id,
        school_code: schoolCode,
        test_type: values.test_type // User-defined test type
      };

      await createTest(testData);
      showSuccess('Test created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      console.error('Create test error:', error);
      showError('Failed to create test: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTest = async (values) => {
    try {
      setLoading(true);
      
      const testData = {
        ...values,
        test_date: values.test_date ? dayjs(values.test_date).format('YYYY-MM-DD') : null,
        status: values.status || 'active',
        test_type: values.test_type // User-defined test type
      };

        await updateTest(editingTest.id, testData);
      showSuccess('Test updated successfully');
      setEditModalVisible(false);
      setEditingTest(null);
      form.resetFields();
      fetchData();
    } catch (error) {
      console.error('Update test error:', error);
      showError('Failed to update test: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTest = async (testId) => {
    try {
      await deleteTest(testId);
      showSuccess('Test deleted successfully');
      fetchData();
    } catch (error) {
      showError('Failed to delete test');
    }
  };

  const handleManageQuestions = (test) => {
    if (test.test_mode === 'offline') {
      setSelectedTest(test);
      setMarksManagerVisible(true);
    } else {
    setSelectedTest(test);
    setQuestionBuilderVisible(true);
    }
  };

  const handlePreviewQuestions = (test) => {
    if (test.test_mode === 'offline') {
      message.info('Offline tests don\'t have questions to preview');
      return;
    }
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

  const handleMarksManagerClose = () => {
    setMarksManagerVisible(false);
    setSelectedTest(null);
    fetchData();
  };

  const handleToggleMarksPanel = (test) => {
    setCurrentTestId(test.id);
    setMarksModalOpen(true);
  };

  const handleCloseMarksPanel = () => {
    setMarksModalOpen(false);
    setCurrentTestId(null);
  };

  const handleMarksUpdate = () => {
    fetchData(); // Refresh the test list to update marks counts
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
      test_mode: test.test_mode,
      test_type: test.test_type,
      test_date: test.test_date ? dayjs(test.test_date).startOf('day') : null,
      time_limit_seconds: test.time_limit_seconds,
      allow_reattempts: test.allow_reattempts,
      status: test.status || 'active'
    });
    setEditModalVisible(true);
  };

  const getFilteredTests = () => {
    let filteredTests = tests;
    
    // Filter by class if not 'all'
    if (selectedClassId !== 'all') {
      filteredTests = filteredTests.filter(test => test.class_instance_id === selectedClassId);
    }
    
    // Filter by test mode based on active tab
    switch (activeTab) {
      case 'online':
        return filteredTests.filter(test => test.test_mode === 'online');
      case 'offline':
        return filteredTests.filter(test => test.test_mode === 'offline');
      default:
        return filteredTests;
    }
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
            <Tag 
              color={record.test_mode === 'online' ? 'blue' : 'orange'} 
              style={{ marginLeft: '8px' }}
            >
              {record.test_mode === 'online' ? 'Online' : 'Offline'}
            </Tag>
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
      title: 'Type',
      dataIndex: 'test_mode',
      key: 'test_mode',
      width: 100,
      render: (mode, record) => {
        if (mode === 'online') {
          return (
            <Space>
              <QuestionCircleOutlined />
              <Text>{record.question_count || 0} questions</Text>
            </Space>
          );
    } else {
          const marksUploaded = record.marks_uploaded || 0;
          const totalStudents = record.total_students || 0;
          return (
            <Space>
              <FileExcelOutlined />
              <Text>{marksUploaded}/{totalStudents} marks</Text>
            </Space>
          );
        }
      },
    },
    {
      title: 'Test Date',
      dataIndex: 'test_date',
      key: 'test_date',
      width: 120,
      render: (date) => (
        <Space>
          <ClockCircleOutlined />
          {date ? dayjs(date).format('DD MMM, YYYY') : 'Not set'}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const status = record.status || 'active';
        return (
          <Tag color={status === 'active' ? 'green' : 'red'}>
            {status === 'active' ? 'Active' : 'Inactive'}
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
            onClick: () => handlePreviewQuestions(record),
            disabled: record.test_mode === 'offline'
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
                title: 'Delete Test',
                content: 'Are you sure you want to delete this test? This action cannot be undone.',
                onOk: () => handleDeleteTest(record.id)
              });
            }
          }
  ];

  return (
          <Space>
            {record.test_mode === 'online' ? (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleManageQuestions(record)}
              >
                Manage Questions
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => handleToggleMarksPanel(record)}
                style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
              >
                Upload Marks
              </Button>
            )}
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

  const tabItems = [
    {
      key: 'online',
      label: (
        <Space>
          <PlayCircleOutlined />
          Online Tests
        </Space>
      ),
      children: (
          <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              Online Tests ({getFilteredTests().length})
            </Title>
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={handleImportTests}
            >
              Import Tests
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                Create Online Test
            </Button>
          </Space>
        </div>

          <Table
            columns={columns}
            dataSource={getFilteredTests()}
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
                  </div>
      )
    },
    {
      key: 'offline',
      label: (
        <Space>
          <FileExcelOutlined />
          Offline Tests
        </Space>
      ),
      children: (
                <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              Offline Tests ({getFilteredTests().length})
          </Title>
            <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                Create Offline Test
            </Button>
          </Space>
        </div>

          <Table
            columns={columns}
            dataSource={getFilteredTests()}
            rowKey="id"
            loading={loading}
            expandable={false}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} offline tests`
            }}
            scroll={{ x: 1000 }}
          />
                  </div>
      )
    },
    {
      key: 'analytics',
      label: (
        <Space>
          <BarChartOutlined />
          Analytics
        </Space>
      ),
      children: <TestAnalytics />
    }
  ];

  const totalTests = tests.length;
  const onlineTests = tests.filter(test => test.test_mode === 'online').length;
  const offlineTests = tests.filter(test => test.test_mode === 'offline').length;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Test Management
            </Title>
            <Text type="secondary">
              Manage both online and offline tests
                  </Text>
                </div>
          <Space>
                      <Select
              value={selectedClassId}
              onChange={setSelectedClassId}
              style={{ width: 200 }}
              placeholder="Filter by class"
            >
              <Select.Option value="all">All Classes</Select.Option>
                        {classInstances.map(cls => (
                          <Select.Option key={cls.id} value={cls.id}>
                            Grade {cls.grade} {cls.section}
                          </Select.Option>
                        ))}
                      </Select>
                        <Button 
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
            >
              Refresh All
                        </Button>
          </Space>
                  </div>
                </div>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Tests"
              value={totalTests}
              prefix={<TrophyOutlined />}
            />
            </Card>
          </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Online Tests"
              value={onlineTests}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            </Card>
          </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Offline Tests"
              value={offlineTests}
              prefix={<FileExcelOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
            </Card>
          </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Active Tests"
              value={tests.filter(test => test.is_active).length}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            </Card>
          </Col>
        </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>

      {/* Create Test Modal */}
      <Modal
        title="Create Test"
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
            <Input placeholder="e.g., Math Quiz 1, Science Test" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Optional description of the test" />
          </Form.Item>

              <Form.Item
            name="test_mode"
            label="Test Mode"
            rules={[{ required: true, message: 'Please select test mode' }]}
          >
            <Select placeholder="Select test mode">
              <Select.Option value="online">Online Test</Select.Option>
              <Select.Option value="offline">Offline Test</Select.Option>
                      </Select>
              </Form.Item>

          <Form.Item
            name="test_type"
            label="Test Type"
            rules={[{ required: true, message: 'Please enter test type' }]}
          >
            <Input 
              placeholder="Enter test type (e.g., Unit Test, Mid-Term, Final Exam, Quiz, etc.)" 
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="subject_id"
            label="Subject"
            rules={[{ required: true, message: 'Please select subject' }]}
          >
            <Select placeholder="Select subject">
                        {subjects.map(subject => (
                          <Select.Option key={subject.id} value={subject.id}>
                            {subject.subject_name}
                          </Select.Option>
                        ))}
                      </Select>
          </Form.Item>

              <Form.Item
                name="class_instance_id"
                label="Class"
                rules={[{ required: true, message: 'Please select class' }]}
              >
            <Select placeholder="Select class">
                  {classInstances.map(cls => (
                    <Select.Option key={cls.id} value={cls.id}>
                      Grade {cls.grade} {cls.section}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

          <Form.Item
            name="test_date"
            label="Test Date"
            rules={[{ required: false, message: 'Please select test date' }]}
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="DD-MM-YYYY"
              placeholder="Select test date (optional)"
              showToday
              allowClear
              changeOnBlur={false}
            />
          </Form.Item>

          <Form.Item
            name="time_limit_seconds"
            label="Time Limit (minutes)"
          >
            <Input type="number" placeholder="60" />
          </Form.Item>

          <Form.Item
            name="allow_reattempts"
            label="Allow Reattempts"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            initialValue="active"
          >
            <Select>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="inactive">Inactive</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Create Test
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Test Modal */}
      <Modal
        title="Edit Test"
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
            <Input placeholder="e.g., Math Quiz 1, Science Test" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Optional description of the test" />
          </Form.Item>

              <Form.Item
            name="test_mode"
            label="Test Mode"
            rules={[{ required: true, message: 'Please select test mode' }]}
          >
            <Select placeholder="Select test mode">
              <Select.Option value="online">Online Test</Select.Option>
              <Select.Option value="offline">Offline Test</Select.Option>
                </Select>
              </Form.Item>

          <Form.Item
            name="test_type"
            label="Test Type"
            rules={[{ required: true, message: 'Please enter test type' }]}
          >
            <Input 
              placeholder="Enter test type (e.g., Unit Test, Mid-Term, Final Exam, Quiz, etc.)" 
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="subject_id"
            label="Subject"
            rules={[{ required: true, message: 'Please select subject' }]}
          >
            <Select placeholder="Select subject">
              {subjects.map(subject => (
                <Select.Option key={subject.id} value={subject.id}>
                  {subject.subject_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="class_instance_id"
            label="Class"
            rules={[{ required: true, message: 'Please select class' }]}
          >
            <Select placeholder="Select class">
              {classInstances.map(cls => (
                <Select.Option key={cls.id} value={cls.id}>
                  Grade {cls.grade} {cls.section}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="test_date"
            label="Test Date"
            rules={[{ required: false, message: 'Please select test date' }]}
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="DD-MM-YYYY"
              placeholder="Select test date (optional)"
              showToday
              allowClear
              changeOnBlur={false}
            />
          </Form.Item>

              <Form.Item
                name="time_limit_seconds"
            label="Time Limit (minutes)"
          >
            <Input type="number" placeholder="60" />
              </Form.Item>

              <Form.Item
                name="allow_reattempts"
                label="Allow Reattempts"
                valuePropName="checked"
              >
            <Switch />
              </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setEditModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Update Test
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Question Builder Modal */}
      {selectedTest && selectedTest.test_mode === 'online' && (
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
        schoolCode={getSchoolCode(user)}
        userId={user?.id}
      />

      {/* Preview Questions Modal */}
      {selectedTest && selectedTest.test_mode === 'online' && (
      <PreviewQuestionsModal
          visible={previewVisible}
          onClose={handlePreviewClose}
        test={selectedTest}
      />
      )}

      {/* Marks Manager Modal */}
      {selectedTest && selectedTest.test_mode === 'offline' && (
        <OfflineTestMarksManager
          visible={marksManagerVisible}
          onClose={handleMarksManagerClose}
          test={selectedTest}
        />
      )}

      {/* Offline Test Marks Modal */}
      {currentTestId && (
        <OfflineTestMarksManager
          open={marksModalOpen}
          onClose={handleCloseMarksPanel}
          testId={currentTestId}
          onSaved={(count) => {
            handleMarksUpdate();
            handleCloseMarksPanel();
          }}
        />
      )}
    </div>
  );
};

export default UnifiedTestManagement;