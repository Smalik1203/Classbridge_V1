import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  message,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  Tooltip,
  Tabs,
  Empty,
  Spin,
  Pagination,
  Dropdown,
  Menu,
  Switch
} from 'antd';
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
  ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { 
  getTests, 
  createTest, 
  updateTest, 
  deleteTest, 
  getClassInstances, 
  getSubjects 
} from '../services/testService';
import { chapterService } from '../services/chapterService';
import QuestionBuilder from '../components/QuestionBuilder';
import PreviewQuestionsModal from '../components/PreviewQuestionsModal';
import TestImportModal from '../components/TestImportModal';
import { supabase } from '../config/supabaseClient';
import { getSchoolCode } from '../utils/metadata';
import EmptyState from '../ui/EmptyState';
import { useErrorHandler } from '../hooks/useErrorHandler.jsx';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

const UnifiedTestManagement = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  const { showError, showSuccess } = useErrorHandler();
  const [tests, setTests] = useState([]);
  const [classInstances, setClassInstances] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  // Question management states
  const [questionBuilderVisible, setQuestionBuilderVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  
  // Import states
  const [importModalVisible, setImportModalVisible] = useState(false);
  
  // Filtering states
  const [filteredTests, setFilteredTests] = useState([]);
  const [filters, setFilters] = useState({
    school: null,
    class: null,
    subject: null,
    testType: null
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [form] = Form.useForm();

  // Use comprehensive metadata extraction
  const schoolCode = getSchoolCode(user);

  useEffect(() => {
    if (schoolCode) {
      fetchData();
    }
  }, [schoolCode]);

  useEffect(() => {
    applyFilters();
  }, [tests, filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [testsData, classesData, subjectsData] = await Promise.all([
        getTests(schoolCode),
        getClassInstances(schoolCode),
        getSubjects(schoolCode)
      ]);
      
      setTests(testsData || []);
      setClassInstances(classesData || []);
      setSubjects(subjectsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showError(error, {
        useNotification: true,
        context: {
          item: 'test data',
          resource: 'test management data'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Load chapters for selected class and subject
  const loadChapters = async (classInstanceId, subjectId) => {
    if (!classInstanceId || !subjectId) {
      setChapters([]);
      return;
    }

    try {
      const chaptersData = await chapterService.getChaptersForClassSubject(classInstanceId, subjectId);
      setChapters(chaptersData || []);
    } catch (error) {
      console.error('Error loading chapters:', error);
      setChapters([]);
    }
  };

  const applyFilters = () => {
    let filtered = [...tests];

    if (filters.class) {
      filtered = filtered.filter(test => {
        const classInstanceId = test.class_instance_id || test.class_instances?.id;
        return classInstanceId === filters.class;
      });
    }

    if (filters.subject) {
      filtered = filtered.filter(test => {
        const subjectId = test.subject_id || test.subjects?.id;
        return subjectId === filters.subject;
      });
    }

    if (filters.testType) {
      filtered = filtered.filter(test => 
        test.test_type && test.test_type.toLowerCase().includes(filters.testType.toLowerCase())
      );
    }

    setFilteredTests(filtered);
    setCurrentPage(1); // Reset to first page when filters change
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
      console.error('Error saving test:', error);
      showError(error, {
        useNotification: true,
        context: {
          item: 'test',
          resource: 'test record',
          action: 'save'
        }
      });
      fetchData(); // Refresh data even on error
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleEditTest = async (test) => {
    setEditingTest(test);
    form.setFieldsValue({
      title: test.title,
      description: test.description,
      test_type: test.test_type,
      class_instance_id: test.class_instance_id,
      subject_id: test.subject_id,
      chapter_id: test.chapter_id || null,
      time_limit_seconds: test.time_limit_seconds,
      allow_reattempts: test.allow_reattempts || false,
      // passing_score removed - using correct answers instead
    });
    
    // Load chapters for the test's class and subject
    if (test.class_instance_id && test.subject_id) {
      await loadChapters(test.class_instance_id, test.subject_id);
    }
    
    setModalVisible(true);
  };

  const handleDeleteTest = async (testId) => {
    try {
      await deleteTest(testId);
      message.success('Test deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting test:', error);
      showError(error, {
        useNotification: true,
        context: {
          item: 'test',
          resource: 'test record',
          action: 'delete'
        }
      });
      fetchData(); // Refresh data even on error
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

  const handleQuestionBuilderClose = () => {
    setQuestionBuilderVisible(false);
    setSelectedTest(null);
    // Force refresh to get updated question counts
    if (schoolCode) {
      fetchData();
    }
  };

  const handlePreviewModalClose = () => {
    setPreviewModalVisible(false);
    setSelectedTest(null);
  };

  // Handle import
  const handleImportTests = () => {
    setImportModalVisible(true);
  };

  const handleImportComplete = () => {
    fetchData(); // Refresh the test list
  };

  const handleImportModalClose = () => {
    setImportModalVisible(false);
  };

  // Handle allow reattempts
  const handleAllowReattempts = async (test) => {
    try {
      // Show confirmation modal
      Modal.confirm({
        title: 'Allow Reattempts',
        content: `Are you sure you want to allow all students to retake the test "${test.title}"? This will reset all previous attempts for this test.`,
        okText: 'Yes, Allow Reattempts',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            // Reset all attempts for this test to 'abandoned' status
            const { error } = await supabase
              .from('test_attempts')
              .update({ 
                status: 'abandoned',
                updated_at: new Date().toISOString()
              })
              .eq('test_id', test.id)
              .eq('status', 'completed');

            if (error) throw error;
            
            message.success('Reattempts allowed for all students. They can now retake this test.');
          } catch (error) {
            console.error('Error allowing reattempts:', error);
            message.error('Failed to allow reattempts');
            fetchData(); // Refresh data even on error
          }
        }
      });
    } catch (error) {
      console.error('Error allowing reattempts:', error);
      message.error('Failed to allow reattempts');
      fetchData(); // Refresh data even on error
    }
  };

  // Filter handlers
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      school: null,
      class: null,
      subject: null,
      testType: null
    });
  };

  // Get test type color
  const getTestTypeColor = (type) => {
    if (!type) return 'default';
    
    const typeLower = type.toLowerCase();
    const colors = {
      quiz: 'blue',
      test: 'green',
      exam: 'red',
      assignment: 'orange',
      practice: 'cyan',
      midterm: 'purple',
      final: 'volcano',
      homework: 'lime'
    };
    
    // Check for partial matches
    for (const [key, color] of Object.entries(colors)) {
      if (typeLower.includes(key)) {
        return color;
      }
    }
    
    return 'default';
  };

  // Format time limit
  const formatTimeLimit = (seconds) => {
    if (!seconds) return 'No limit';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${secs}s`;
    }
  };

  // Calculate statistics
  const totalTests = tests.length;
  const totalQuestions = tests.reduce((sum, test) => sum + (test.question_count || 0), 0);
  const activeTests = tests.filter(test => test.is_active !== false).length;
  const draftTests = tests.filter(test => test.is_active === false).length;

  // Pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTests = filteredTests.slice(startIndex, endIndex);

  // Test type options
  const testTypeOptions = [
    { value: 'quiz', label: 'Quiz' },
    { value: 'unit_test', label: 'Unit Test' },
    { value: 'assignment', label: 'Assignment' },
    { value: 'exam', label: 'Exam' },
    { value: 'practice', label: 'Practice' }
  ];

  return (
    <div style={{ padding: '24px', background: antdTheme.token.colorBgLayout, minHeight: '100vh' }}>
      {/* Compact Header with Stats and Actions */}
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
              onClick={() => {
                fetchData();
              }}
              size="large"
              style={{
                borderRadius: '8px',
                height: '40px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Refresh Data
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
              size="large"
              style={{
                background: antdTheme.token.colorPrimary,
                borderColor: antdTheme.token.colorPrimary,
                borderRadius: '8px',
                height: '40px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(24, 144, 255, 0.2)'
              }}
            >
              Create Test
            </Button>
          </Space>
        </div>

        {/* Compact Stats Row */}
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <Card
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                height: '60px'
              }}
              bodyStyle={{ padding: '12px 16px', height: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                <div>
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    color: 'white',
                    lineHeight: '1'
                  }}>
                    {totalTests}
                  </div>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '12px', fontWeight: '500' }}>
                    Total Tests
                  </Text>
                </div>
                <BookOutlined style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.8)' }} />
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card
              style={{
                background: antdTheme.token.colorFillTertiary,
                border: `1px solid ${antdTheme.token.colorBorder}`,
                borderRadius: '8px',
                height: '60px'
              }}
              bodyStyle={{ padding: '12px 16px', height: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                <div>
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    color: antdTheme.token.colorPrimary,
                    lineHeight: '1'
                  }}>
                    {totalQuestions}
                  </div>
                  <Text style={{ color: antdTheme.token.colorTextSecondary, fontSize: '12px', fontWeight: '500' }}>
                    Questions
                  </Text>
                </div>
                <QuestionCircleOutlined style={{ fontSize: '20px', color: antdTheme.token.colorTextTertiary }} />
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card
              style={{
                background: antdTheme.token.colorFillTertiary,
                border: `1px solid ${antdTheme.token.colorBorder}`,
                borderRadius: '8px',
                height: '60px'
              }}
              bodyStyle={{ padding: '12px 16px', height: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                <div>
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    color: antdTheme.token.colorPrimary,
                    lineHeight: '1'
                  }}>
                    {activeTests}
                  </div>
                  <Text style={{ color: antdTheme.token.colorTextSecondary, fontSize: '12px', fontWeight: '500' }}>
                    Active
                  </Text>
                </div>
                <TrophyOutlined style={{ fontSize: '20px', color: antdTheme.token.colorTextTertiary }} />
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card
              style={{
                background: antdTheme.token.colorFillTertiary,
                border: `1px solid ${antdTheme.token.colorBorder}`,
                borderRadius: '8px',
                height: '60px'
              }}
              bodyStyle={{ padding: '12px 16px', height: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                <div>
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    color: antdTheme.token.colorPrimary,
                    lineHeight: '1'
                  }}>
                    {draftTests}
                  </div>
                  <Text style={{ color: antdTheme.token.colorTextSecondary, fontSize: '12px', fontWeight: '500' }}>
                    Drafts
                  </Text>
                </div>
                <UserOutlined style={{ fontSize: '20px', color: antdTheme.token.colorTextTertiary }} />
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Main Content */}
      <Card
        style={{
          background: antdTheme.token.colorBgContainer,
          border: `1px solid ${antdTheme.token.colorBorder}`,
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
        bodyStyle={{ padding: '24px' }}
      >
        {/* Toolbar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${antdTheme.token.colorBorder}`
        }}>
          <Title level={4} style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
            All Tests
          </Title>
        </div>

                  {/* Filters */}
                  {user?.role === 'superadmin' && (
                    <div style={{ 
                      display: 'flex', 
                      gap: '8px', 
                      marginBottom: '20px',
                      padding: '12px 16px',
                      background: antdTheme.token.colorBgContainer,
                      border: `1px solid ${antdTheme.token.colorBorder}`,
                      borderRadius: '8px',
                      alignItems: 'center',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        marginRight: '8px',
                        paddingRight: '12px',
                        borderRight: `1px solid ${antdTheme.token.colorBorder}`
                      }}>
                        <FilterOutlined style={{ 
                          color: antdTheme.token.colorTextSecondary,
                          fontSize: '14px'
                        }} />
                        <Text style={{ 
                          fontSize: '14px', 
                          fontWeight: '500',
                          color: antdTheme.token.colorTextSecondary
                        }}>
                          Filters
                        </Text>
                      </div>
                      
                      <Select
                        placeholder="Class"
                        value={filters.class}
                        onChange={(value) => handleFilterChange('class', value)}
                        style={{ 
                          minWidth: '120px',
                          fontSize: '14px'
                        }}
                        allowClear
                        size="small"
                        suffixIcon={<span style={{ fontSize: '12px' }}>▼</span>}
                      >
                        {classInstances.map(cls => (
                          <Select.Option key={cls.id} value={cls.id}>
                            Grade {cls.grade} {cls.section}
                          </Select.Option>
                        ))}
                      </Select>
                      
                      <Select
                        placeholder="Subject"
                        value={filters.subject}
                        onChange={(value) => handleFilterChange('subject', value)}
                        style={{ 
                          minWidth: '120px',
                          fontSize: '14px'
                        }}
                        allowClear
                        size="small"
                        suffixIcon={<span style={{ fontSize: '12px' }}>▼</span>}
                      >
                        {subjects.map(subject => (
                          <Select.Option key={subject.id} value={subject.id}>
                            {subject.subject_name}
                          </Select.Option>
                        ))}
                      </Select>
                      
                      <Input
                        placeholder="Test Type"
                        value={filters.testType}
                        onChange={(e) => handleFilterChange('testType', e.target.value)}
                        style={{ 
                          minWidth: '120px',
                          fontSize: '14px'
                        }}
                        allowClear
                        size="small"
                      />
                      
                      <div style={{ 
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {(filters.class || filters.subject || filters.testType) && (
                          <Text style={{ 
                            fontSize: '12px', 
                            color: antdTheme.token.colorTextTertiary
                          }}>
                            {[filters.class, filters.subject, filters.testType].filter(Boolean).length} active
                          </Text>
                        )}
                        <Button 
                          onClick={clearFilters}
                          size="small"
                          type="text"
                          style={{ 
                            fontSize: '12px',
                            color: antdTheme.token.colorTextSecondary,
                            padding: '4px 8px',
                            height: 'auto'
                          }}
                          disabled={!filters.class && !filters.subject && !filters.testType}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <Spin size="large" />
                    </div>
                  ) : filteredTests.length === 0 ? (
                    <EmptyState
                      type="tests"
                      onAction={() => setModalVisible(true)}
                    />
                  ) : (
                    <div>
                      {/* Test Cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {paginatedTests.map((test) => (
                          <Card
                            key={test.id}
                            style={{
                              borderRadius: '12px',
                              border: `1px solid ${antdTheme.token.colorBorder}`,
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer'
                            }}
                            hoverable
                            bodyStyle={{ padding: '20px' }}
                          >
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              alignItems: 'flex-start'
                            }}>
                              {/* Left: Title, Description, Type */}
                              <div style={{ flex: '1', minWidth: 0 }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  marginBottom: '8px',
                                  flexWrap: 'nowrap',
                                  minWidth: 0
                                }}>
                                  <Title level={4} style={{ 
                                    margin: 0, 
                                    fontSize: '16px', 
                                    fontWeight: '600',
                                    color: antdTheme.token.colorText,
                                    marginRight: '12px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    flexShrink: 0
                                  }}>
                                    {test.title}
                                  </Title>
                                  <Tag 
                                    color={getTestTypeColor(test.test_type)} 
                                    style={{ 
                                      textTransform: 'capitalize',
                                      fontWeight: '500',
                                      borderRadius: '6px',
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      margin: 0,
                                      flexShrink: 0
                                    }}
                                  >
                                    {test.test_type}
                                  </Tag>
                                </div>
                                
                                {test.description && (
                                  <Text 
                                    type="secondary" 
                                    style={{ 
                                      fontSize: '14px', 
                                      lineHeight: '1.4',
                                      display: 'block',
                                      marginBottom: '12px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                  >
                                    {test.description}
                                  </Text>
                                )}

                                {test.syllabus_chapters && (
                                  <div style={{ 
                                    marginBottom: '12px',
                                    padding: '6px 10px',
                                    background: antdTheme.token.colorFillTertiary,
                                    borderRadius: '6px',
                                    border: `1px solid ${antdTheme.token.colorBorderSecondary}`
                                  }}>
                                    <Text style={{ 
                                      fontSize: '12px', 
                                      color: antdTheme.token.colorTextSecondary,
                                      fontWeight: '500',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: 'block'
                                    }}>
                                      📚 Chapter {test.syllabus_chapters.chapter_no}: {test.syllabus_chapters.title}
                                    </Text>
                                  </div>
                                )}

                                <div style={{ 
                                  display: 'flex', 
                                  gap: '8px', 
                                  alignItems: 'center',
                                  flexWrap: 'nowrap',
                                  minWidth: 0
                                }}>
                                  <Text style={{ 
                                    fontSize: '12px', 
                                    color: antdTheme.token.colorTextTertiary,
                                    background: antdTheme.token.colorFillTertiary,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}>
                                    Grade {test.class_instances?.grade} {test.class_instances?.section}
                                  </Text>
                                  <Text style={{ 
                                    fontSize: '12px', 
                                    color: antdTheme.token.colorTextTertiary,
                                    background: antdTheme.token.colorFillTertiary,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}>
                                    {test.subjects?.subject_name}
                                  </Text>
                                </div>
                              </div>

                              {/* Right: Stats and Actions */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                {/* Stats */}
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ 
                                      fontSize: '18px', 
                                      fontWeight: '600', 
                                      color: antdTheme.token.colorPrimary,
                                      lineHeight: '1'
                                    }}>
                                      {test.question_count || 0}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '11px', fontWeight: '500' }}>
                                      Questions
                                    </Text>
                                  </div>
                                  
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ 
                                      fontSize: '14px', 
                                      fontWeight: '500',
                                      color: antdTheme.token.colorText,
                                      lineHeight: '1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      <ClockCircleOutlined style={{ fontSize: '12px' }} />
                                      {formatTimeLimit(test.time_limit_seconds)}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '11px', fontWeight: '500' }}>
                                      Time Limit
                                    </Text>
                                  </div>
                                  
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ 
                                      fontSize: '14px', 
                                      fontWeight: '500',
                                      color: antdTheme.token.colorTextTertiary,
                                      lineHeight: '1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      <BookOutlined style={{ fontSize: '12px' }} />
                                      {test.question_count || 0} questions
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '11px', fontWeight: '500' }}>
                                      Questions
                                    </Text>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<SettingOutlined />}
                                    onClick={() => handleManageQuestions(test)}
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: '500',
                                      height: '36px',
                                      paddingLeft: '12px',
                                      paddingRight: '12px',
                                      borderRadius: '6px'
                                    }}
                                  >
                                    Manage
                                  </Button>
                                  
                                  <Dropdown
                                    menu={{
                                      items: [
                                        {
                                          key: 'edit',
                                          label: 'Edit Test',
                                          icon: <EditOutlined />,
                                          onClick: () => handleEditTest(test)
                                        },
                                        {
                                          key: 'preview',
                                          label: 'Preview Questions',
                                          icon: <EyeOutlined />,
                                          onClick: () => handlePreviewQuestions(test)
                                        },
                                        {
                                          type: 'divider'
                                        },
                                        {
                                          key: 'delete',
                                          label: 'Delete Test',
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
                                    trigger={['click']}
                                  >
                                    <Button
                                      size="small"
                                      icon={<MoreOutlined />}
                                      style={{
                                        height: '36px',
                                        width: '36px',
                                        borderRadius: '6px'
                                      }}
                                    />
                                  </Dropdown>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      {/* Pagination */}
                      {filteredTests.length > pageSize && (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'flex-end', 
                          marginTop: '24px',
                          paddingTop: '16px',
                          borderTop: `1px solid ${antdTheme.token.colorBorder}`
                        }}>
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
                    </div>
                  )}
      </Card>

      {/* Create/Edit Test Modal */}
      <Modal
        title={editingTest ? 'Edit Test' : 'Create Test'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTest(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={confirmLoading}
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
            <Input placeholder="Enter test title" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea 
              placeholder="Enter test description" 
              rows={3}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="test_type"
                label="Test Type"
                rules={[{ required: true, message: 'Please enter test type' }]}
                extra="Enter any test type (e.g., Quiz, Unit Test, Midterm, Final, etc.)"
              >
                <Input 
                  placeholder="Enter test type (e.g., Quiz, Unit Test, Midterm)"
                  style={{ fontSize: '14px' }}
                />
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
                    <Select.Option key={cls.id} value={cls.id}>
                      Grade {cls.grade} {cls.section}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

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
                <Select.Option key={subject.id} value={subject.id}>
                  {subject.subject_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="chapter_id"
            label="Chapter (Optional)"
            help="Select a chapter from the syllabus to associate with this test"
          >
            <Select 
              placeholder="Select chapter (optional)"
              allowClear
              disabled={!chapters.length}
            >
              {chapters.map(chapter => (
                <Select.Option key={chapter.id} value={chapter.id}>
                  Ch {chapter.chapter_no}: {chapter.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

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
                <Switch 
                  checkedChildren="Yes" 
                  unCheckedChildren="No"
                  defaultChecked={false}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Reattempt Settings"
            help="When enabled, students can retake this test multiple times. Previous attempts will be marked as 'abandoned' when a new attempt is started."
          >
            <div style={{ 
              padding: '12px', 
              background: antdTheme.token.colorFillTertiary, 
              borderRadius: '6px',
              fontSize: '12px',
              color: antdTheme.token.colorTextSecondary
            }}>
              <Text type="secondary">
                Note: Reattempt settings can be changed at any time. When disabled, students can only take the test once.
              </Text>
            </div>
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