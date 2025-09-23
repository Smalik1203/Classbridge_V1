import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  message,
  Empty,
  Spin,
  Pagination,
  Dropdown
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UploadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { getTests, createTest, updateTest, deleteTest } from '../services/testService';
import QuestionBuilder from '../components/QuestionBuilder';
import PreviewQuestionsModal from '../components/PreviewQuestionsModal';
import TestImportModal from '../components/TestImportModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const UnifiedTestManagement = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [questionBuilderVisible, setQuestionBuilderVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  // Filter and pagination state
  const [filters, setFilters] = useState({
    testType: null,
    class: null,
    subject: null
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Data for dropdowns
  const [classInstances, setClassInstances] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);

  const schoolCode = user?.user_metadata?.school_code;
  const userRole = user?.app_metadata?.role || 'student';
  const canEdit = ['superadmin', 'admin'].includes(userRole);

  useEffect(() => {
    if (schoolCode) {
      fetchData();
    }
  }, [schoolCode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [testsData, classesData, subjectsData] = await Promise.all([
        getTests(schoolCode),
        fetchClassInstances(),
        fetchSubjects()
      ]);
      
      setTests(testsData);
      setClassInstances(classesData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchClassInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching classes:', error);
      return [];
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, subject_name')
        .eq('school_code', schoolCode)
        .order('subject_name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching subjects:', error);
      return [];
    }
  };

  const loadChapters = async (classId, subjectId) => {
    try {
      // This would load chapters from syllabus
      // For now, we'll just set empty array
      setChapters([]);
    } catch (error) {
      console.error('Error loading chapters:', error);
    }
  };

  const handleCreateTest = async (values) => {
    setConfirmLoading(true);
    try {
      const testData = {
        ...values,
        school_code: schoolCode,
        created_by: user.id
      };

      if (editingTest) {
        await updateTest(editingTest.id, testData);
        message.success('Test updated successfully');
      } else {
        await createTest(testData);
        message.success('Test created successfully');
      }

      setModalVisible(false);
      setEditingTest(null);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error(editingTest ? 'Failed to update test' : 'Failed to create test');
      console.error('Error saving test:', error);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleEditTest = (test) => {
    setEditingTest(test);
    form.setFieldsValue({
      title: test.title,
      description: test.description,
      test_type: test.test_type,
      class_instance_id: test.class_instance_id,
      subject_id: test.subject_id,
      chapter_id: test.chapter_id,
      time_limit_seconds: test.time_limit_seconds,
      allow_reattempts: test.allow_reattempts
    });
    setModalVisible(true);
  };

  const handleDeleteTest = async (testId) => {
    try {
      await deleteTest(testId);
      message.success('Test deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete test');
      console.error('Error deleting test:', error);
    }
  };

  const handleManageQuestions = (test) => {
    setSelectedTest(test);
    setQuestionBuilderVisible(true);
  };

  const handlePreviewQuestions = (test) => {
    setSelectedTest(test);
    setPreviewModalVisible(true);
  };

  const handleImportTests = () => {
    setImportModalVisible(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ testType: null, class: null, subject: null });
    setCurrentPage(1);
  };

  const getTestTypeColor = (type) => {
    const colors = {
      quiz: 'primary',
      unit_test: 'success',
      exam: 'warning',
      assignment: 'info',
      practice: 'default'
    };
    return colors[type] || 'default';
  };

  const getTestTypeIcon = (type) => {
    const icons = {
      quiz: '❓',
      unit_test: '📝',
      exam: '🎓',
      assignment: '📋',
      practice: '🎯'
    };
    return icons[type] || '📄';
  };

  const formatTimeLimit = (seconds) => {
    if (!seconds) return 'No limit';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const testTypeOptions = [
    { value: 'quiz', label: 'Quiz' },
    { value: 'unit_test', label: 'Unit Test' },
    { value: 'assignment', label: 'Assignment' },
    { value: 'exam', label: 'Exam' },
    { value: 'practice', label: 'Practice' }
  ];

  // Apply filters
  const filteredTests = tests.filter(test => {
    if (filters.testType && test.test_type !== filters.testType) return false;
    if (filters.class && test.class_instance_id !== filters.class) return false;
    if (filters.subject && test.subject_id !== filters.subject) return false;
    return true;
  });

  // Calculate stats
  const totalTests = tests.length;
  const totalQuestions = tests.reduce((sum, test) => sum + (test.question_count || 0), 0);
  const quizCount = tests.filter(t => t.test_type === 'quiz').length;
  const examCount = tests.filter(t => t.test_type === 'exam').length;

  // Pagination
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTests = filteredTests.slice(startIndex, startIndex + pageSize);

  const handleQuestionBuilderClose = () => {
    setQuestionBuilderVisible(false);
    setSelectedTest(null);
  };

  const handlePreviewModalClose = () => {
    setPreviewModalVisible(false);
    setSelectedTest(null);
  };

  const handleImportModalClose = () => {
    setImportModalVisible(false);
  };

  const handleImportComplete = () => {
    fetchData();
    setImportModalVisible(false);
  };

  return (
    <div style={{ padding: '24px', background: antdTheme.token.colorBgLayout, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '16px'
        }}>
          <div>
            <Title level={2} style={{ 
              margin: 0, 
              fontSize: '24px', 
              fontWeight: '600',
              color: antdTheme.token.colorText,
              marginBottom: '4px'
            }}>
              Test Management
            </Title>
            <Text style={{ 
              fontSize: '14px', 
              color: antdTheme.token.colorTextSecondary
            }}>
              Create, manage, and organize tests and assessments
            </Text>
          </div>
          
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={handleImportTests}
              size="large"
              style={{
                borderRadius: '8px',
                height: '40px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Import Tests
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
              size="large"
              style={{
                borderRadius: '8px',
                height: '40px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Create Test
            </Button>
          </Space>
        </div>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Total Tests"
                value={totalTests}
                valueStyle={{ fontSize: '20px', fontWeight: '600' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Questions"
                value={totalQuestions}
                valueStyle={{ fontSize: '20px', fontWeight: '600' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Quizzes"
                value={quizCount}
                valueStyle={{ fontSize: '20px', fontWeight: '600' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Exams"
                value={examCount}
                valueStyle={{ fontSize: '20px', fontWeight: '600' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Filters */}
      {canEdit && (
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={16} align="middle">
            <Col>
              <Text strong>Filters: </Text>
            </Col>
            <Col>
              <Select
                placeholder="Test Type"
                value={filters.testType}
                onChange={(value) => handleFilterChange('testType', value)}
                style={{ width: 120 }}
                allowClear
              >
                {testTypeOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col>
              <Select
                placeholder="Class"
                value={filters.class}
                onChange={(value) => handleFilterChange('class', value)}
                style={{ width: 150 }}
                allowClear
              >
                {classInstances.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    Grade {cls.grade} {cls.section}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col>
              <Select
                placeholder="Subject"
                value={filters.subject}
                onChange={(value) => handleFilterChange('subject', value)}
                style={{ width: 150 }}
                allowClear
              >
                {subjects.map(subject => (
                  <Option key={subject.id} value={subject.id}>
                    {subject.subject_name}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col>
              <Button onClick={clearFilters}>Clear All</Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* Test Grid */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '20px' }}>Loading tests...</div>
          </div>
        ) : filteredTests.length === 0 ? (
          <Empty
            description={canEdit ? "No tests created yet" : "No tests available"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {canEdit && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
              >
                Create First Test
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {paginatedTests.map((test) => (
                <Col xs={24} sm={12} lg={8} xl={6} key={test.id}>
                  <Card
                    hoverable
                    style={{ height: '100%' }}
                    actions={canEdit ? [
                      <Button
                        type="text"
                        icon={<SettingOutlined />}
                        onClick={() => handleManageQuestions(test)}
                      >
                        Questions
                      </Button>,
                      <Button
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={() => handlePreviewQuestions(test)}
                      >
                        Preview
                      </Button>,
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'edit',
                              label: 'Edit',
                              icon: <EditOutlined />,
                              onClick: () => handleEditTest(test)
                            },
                            {
                              key: 'delete',
                              label: 'Delete',
                              icon: <DeleteOutlined />,
                              danger: true,
                              onClick: () => {
                                Modal.confirm({
                                  title: 'Delete Test',
                                  content: 'Are you sure you want to delete this test?',
                                  onOk: () => handleDeleteTest(test.id)
                                });
                              }
                            }
                          ]
                        }}
                      >
                        <Button type="text" icon={<SettingOutlined />} />
                      </Dropdown>
                    ] : [
                      <Button
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={() => handlePreviewQuestions(test)}
                      >
                        View
                      </Button>
                    ]}
                  >
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '20px' }}>
                          {getTestTypeIcon(test.test_type)}
                        </span>
                        <Tag color={getTestTypeColor(test.test_type)}>
                          {test.test_type.replace('_', ' ').toUpperCase()}
                        </Tag>
                      </div>
                      
                      <Title level={5} style={{ margin: 0, marginBottom: '8px' }}>
                        {test.title}
                      </Title>
                      
                      {test.description && (
                        <Text type="secondary" style={{ 
                          fontSize: '12px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {test.description}
                        </Text>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: antdTheme.token.colorTextSecondary }}>
                      <div>Class: {test.class_instances?.grade} {test.class_instances?.section}</div>
                      <div>Subject: {test.subjects?.subject_name}</div>
                      <div>Questions: {test.question_count || 0}</div>
                      <div>Time: {formatTimeLimit(test.time_limit_seconds)}</div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            {/* Pagination */}
            {filteredTests.length > pageSize && (
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={filteredTests.length}
                  onChange={(page, size) => {
                    setCurrentPage(page);
                    setPageSize(size);
                  }}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(total, range) => 
                    `${range[0]}-${range[1]} of ${total} tests`
                  }
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Create/Edit Test Modal */}
      <Modal
        title={editingTest ? 'Edit Test' : 'Create New Test'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTest(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTest}
          initialValues={{
            test_type: 'quiz',
            allow_reattempts: false
          }}
        >
          <Form.Item
            name="title"
            label="Test Title"
            rules={[{ required: true, message: 'Please enter test title' }]}
          >
            <Input placeholder="Enter test title" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              rows={3}
              placeholder="Enter test description"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="test_type"
                label="Test Type"
                rules={[{ required: true, message: 'Please select test type' }]}
              >
                <Select placeholder="Select test type">
                  {testTypeOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="class_instance_id"
                label="Class"
                rules={[{ required: true, message: 'Please select class' }]}
              >
                <Select
                  placeholder="Select class"
                  onChange={(value) => {
                    const subjectId = form.getFieldValue('subject_id');
                    if (subjectId) {
                      loadChapters(value, subjectId);
                    }
                  }}
                >
                  {classInstances.map(cls => (
                    <Option key={cls.id} value={cls.id}>
                      Grade {cls.grade} {cls.section}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="subject_id"
                label="Subject"
                rules={[{ required: true, message: 'Please select subject' }]}
              >
                <Select
                  placeholder="Select subject"
                  onChange={(value) => {
                    const classId = form.getFieldValue('class_instance_id');
                    if (classId) {
                      loadChapters(classId, value);
                    }
                  }}
                >
                  {subjects.map(subject => (
                    <Option key={subject.id} value={subject.id}>
                      {subject.subject_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="chapter_id"
                label="Chapter (Optional)"
              >
                <Select
                  placeholder="Select chapter"
                  allowClear
                  disabled={!chapters.length}
                >
                  {chapters.map(chapter => (
                    <Option key={chapter.id} value={chapter.id}>
                      Ch {chapter.chapter_no}: {chapter.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="time_limit_seconds"
                label="Time Limit (seconds)"
              >
                <Input
                  type="number"
                  placeholder="Enter time limit"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="allow_reattempts"
                label="Allow Reattempts"
                valuePropName="checked"
              >
                <Select>
                  <Option value={false}>No</Option>
                  <Option value={true}>Yes</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingTest(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={confirmLoading}
              >
                {editingTest ? 'Update Test' : 'Create Test'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Question Builder Modal */}
      <QuestionBuilder
        visible={questionBuilderVisible}
        onClose={handleQuestionBuilderClose}
        test={selectedTest}
      />

      {/* Preview Questions Modal */}
      <PreviewQuestionsModal
        visible={previewModalVisible}
        onClose={handlePreviewModalClose}
        test={selectedTest}
      />

      {/* Test Import Modal */}
      <TestImportModal
        visible={importModalVisible}
        onClose={handleImportModalClose}
        onImportComplete={handleImportComplete}
        classInstances={classInstances}
        subjects={subjects}
        schoolCode={schoolCode}
        userId={user.id}
      />
    </div>
  );
};

export default UnifiedTestManagement;