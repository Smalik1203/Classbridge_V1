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

const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

const UnifiedTestManagement = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
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

  // Get school code from user context
  const schoolCode = user?.school_code;

  useEffect(() => {
    console.log('=== USEEFFECT DEBUG ===');
    console.log('School code:', schoolCode);
    console.log('User:', user);
    console.log('Will fetch data:', !!schoolCode);
    
    if (schoolCode) {
      console.log('Calling fetchData...');
      fetchData();
    } else {
      console.log('No school code, not fetching data');
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
      message.error('Failed to fetch data: ' + error.message);
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
      filtered = filtered.filter(test => test.test_type === filters.testType);
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
      message.error('Failed to save test');
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
      message.error('Failed to delete test');
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
          }
        }
      });
    } catch (error) {
      console.error('Error allowing reattempts:', error);
      message.error('Failed to allow reattempts');
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
    const colors = {
      quiz: 'blue',
      unit_test: 'green',
      assignment: 'orange',
      exam: 'red',
      practice: 'purple'
    };
    return colors[type] || 'default';
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
  const quizCount = tests.filter(test => test.test_type === 'quiz').length;
  const examCount = tests.filter(test => test.test_type === 'exam').length;

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
    <div className="cb-container cb-section" style={{ minHeight: '100vh' }}>
      {/* Modern Header */}
      <div className="cb-dashboard-header">
        <div className="cb-flex cb-justify-between cb-items-start">
          <div>
            <h1 className="cb-heading-2 cb-mb-2">
              📝 Test Management
            </h1>
            <p className="cb-text-caption">
              Create, manage, and organize tests and assessments
            </p>
          </div>
          
          <div className="cb-dashboard-actions">
            <button
              className="cb-button cb-button-secondary"
              onClick={handleImportTests}
            >
              <span>📤</span>
              <span>Import Tests</span>
            </button>
            <button
              className="cb-button cb-button-secondary"
              onClick={() => {
                console.log('Manual refresh clicked');
                fetchData();
              }}
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>
            <button
              className="cb-button cb-button-primary"
              onClick={() => setModalVisible(true)}
            >
              <span>➕</span>
              <span>Create Test</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Stats */}
      <div className="cb-kpi-grid cb-mb-8">
        <div className="cb-kpi-card">
          <div className="cb-stat-header">
            <div className="cb-stat-icon">📝</div>
            <div className="cb-stat-change positive">↗️ +12%</div>
          </div>
          <div className="cb-stat-value">{totalTests}</div>
          <div className="cb-stat-label">Total Tests</div>
        </div>
        <div className="cb-kpi-card">
          <div className="cb-stat-header">
            <div className="cb-stat-icon">❓</div>
            <div className="cb-stat-change positive">↗️ +8%</div>
          </div>
          <div className="cb-stat-value">{totalQuestions}</div>
          <div className="cb-stat-label">Total Questions</div>
        </div>
        <div className="cb-kpi-card">
          <div className="cb-stat-header">
            <div className="cb-stat-icon">🎯</div>
            <div className="cb-stat-change positive">↗️ +5%</div>
          </div>
          <div className="cb-stat-value">{quizCount}</div>
          <div className="cb-stat-label">Active Quizzes</div>
        </div>
        <div className="cb-kpi-card">
          <div className="cb-stat-header">
            <div className="cb-stat-icon">🎓</div>
            <div className="cb-stat-change neutral">→ Stable</div>
          </div>
          <div className="cb-stat-value">{examCount}</div>
          <div className="cb-stat-label">Exams</div>
        </div>
      </div>

      {/* Modern Filters */}
      {user?.role === 'superadmin' && (
        <div className="cb-filter-bar cb-mb-6">
          <div className="cb-text-overline">Filter Tests</div>
          
          <div className="cb-filter-chips">
            {[
              { key: 'all', label: 'All Tests', icon: '📚' },
              { key: 'quiz', label: 'Quizzes', icon: '❓' },
              { key: 'unit_test', label: 'Unit Tests', icon: '📝' },
              { key: 'exam', label: 'Exams', icon: '🎓' },
              { key: 'assignment', label: 'Assignments', icon: '📋' }
            ].map(type => (
              <button
                key={type.key}
                className={`cb-chip ${filters.testType === type.key ? 'active' : ''}`}
                onClick={() => handleFilterChange('testType', type.key)}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
                <span className="cb-badge cb-badge-neutral cb-badge-sm">
                  {type.key === 'all' ? tests.length : tests.filter(t => t.test_type === type.key).length}
                </span>
              </button>
            ))}
          </div>
          
          <div className="cb-flex cb-gap-4 cb-items-center">
            <select
              className="cb-input"
              style={{ width: '200px' }}
              value={filters.class || ''}
              onChange={(e) => handleFilterChange('class', e.target.value || null)}
            >
              <option value="">All Classes</option>
              {classInstances.map(cls => (
                <option key={cls.id} value={cls.id}>
                  Grade {cls.grade} {cls.section}
                </option>
              ))}
            </select>
            
            <select
              className="cb-input"
              style={{ width: '200px' }}
              value={filters.subject || ''}
              onChange={(e) => handleFilterChange('subject', e.target.value || null)}
            >
              <option value="">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.subject_name}
                </option>
              ))}
            </select>
            
            <div className="cb-flex cb-items-center cb-gap-2" style={{ marginLeft: 'auto' }}>
              {(filters.class || filters.subject || filters.testType) && (
                <span className="cb-text-caption-sm">
                  {[filters.class, filters.subject, filters.testType].filter(Boolean).length} active
                </span>
              )}
              <button 
                className="cb-button cb-button-sm cb-button-ghost"
                onClick={clearFilters}
                disabled={!filters.class && !filters.subject && !filters.testType}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Test List */}
      <div className="cb-card">
        <div className="cb-card-body">
          {loading ? (
            <div className="cb-grid cb-grid-auto">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="cb-skeleton" style={{ 
                  height: '200px',
                  borderRadius: 'var(--radius-2xl)' 
                }}></div>
              ))}
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="cb-empty-state">
              <div className="cb-empty-icon">📝</div>
              <h3 className="cb-empty-title">No tests found</h3>
              <p className="cb-empty-description">
                {canEdit 
                  ? 'Start creating assessments for your students. You can add quizzes, unit tests, assignments, and exams.'
                  : 'Your teachers haven\'t created any tests yet. Check back soon!'
                }
              </p>
              {canEdit && (
                <button 
                  className="cb-button cb-button-primary cb-button-lg"
                  onClick={() => setModalVisible(true)}
                >
                  <span>✨</span>
                  <span>Create First Test</span>
                </button>
              )}
            </div>
          ) : (
            <div className="cb-grid cb-grid-auto">
              {paginatedTests.map((test) => (
                <div key={test.id} className="cb-card cb-card-interactive">
                  <div className="cb-card-body">
                    <div className="cb-flex cb-justify-between cb-items-start cb-mb-4">
                      <div className="cb-flex cb-items-center cb-gap-3">
                        <div className="cb-stat-icon" style={{ 
                          width: '40px', 
                          height: '40px',
                          fontSize: 'var(--text-lg)',
                          background: `var(--color-${getTestTypeColor(test.test_type)}-100)`,
                          color: `var(--color-${getTestTypeColor(test.test_type)}-600)`
                        }}>
                          {getTestTypeIcon(test.test_type)}
                        </div>
                        <div>
                          <h4 className="cb-heading-5 cb-mb-1">{test.title}</h4>
                          <div className="cb-flex cb-gap-2 cb-items-center">
                            <span className={`cb-badge cb-badge-${getTestTypeColor(test.test_type)} cb-badge-sm`}>
                              {test.test_type.replace('_', ' ')}
                            </span>
                            <span className="cb-text-caption-sm">•</span>
                            <span className="cb-text-caption-sm">
                              Grade {test.class_instances?.grade} {test.class_instances?.section}
                            </span>
                          </div>
                        </div>
                      </div>
                      
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
                        <button className="cb-button cb-button-sm cb-button-ghost">
                          ⋯
                        </button>
                      </Dropdown>
                    </div>

                    {test.description && (
                      <p className="cb-text-caption cb-mb-4" style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {test.description}
                      </p>
                    )}

                    {test.syllabus_chapters && (
                      <div className="cb-badge cb-badge-neutral cb-badge-sm cb-mb-4">
                        📚 Chapter {test.syllabus_chapters.chapter_no}: {test.syllabus_chapters.title}
                      </div>
                    )}

                    <div className="cb-flex cb-justify-between cb-items-center cb-mb-4">
                      <div className="cb-flex cb-gap-4">
                        <div className="cb-text-center">
                          <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>
                            {test.question_count || 0}
                          </div>
                          <div className="cb-text-caption-sm">Questions</div>
                        </div>
                        <div className="cb-text-center">
                          <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>
                            {formatTimeLimit(test.time_limit_seconds)}
                          </div>
                          <div className="cb-text-caption-sm">Time Limit</div>
                        </div>
                        <div className="cb-text-center">
                          <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>
                            {test.subjects?.subject_name}
                          </div>
                          <div className="cb-text-caption-sm">Subject</div>
                        </div>
                      </div>
                    </div>

                    <div className="cb-flex cb-gap-2">
                      <button
                        className="cb-button cb-button-sm cb-button-primary"
                        onClick={() => handleManageQuestions(test)}
                        style={{ flex: 1 }}
                      >
                        <span>⚙️</span>
                        <span>Manage Questions</span>
                      </button>
                      <button
                        className="cb-button cb-button-sm cb-button-secondary"
                        onClick={() => handlePreviewQuestions(test)}
                      >
                        <span>👁️</span>
                        <span>Preview</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {filteredTests.length > pageSize && (
            <div className="cb-flex cb-justify-center cb-mt-8">
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
      </div>

      {/* Enhanced Create/Edit Test Modal */}
      <Modal
        title={
          <div className="cb-flex cb-items-center cb-gap-2">
            <span>{editingTest ? '✏️' : '➕'}</span>
            <span>{editingTest ? 'Edit Test' : 'Create Test'}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTest(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
        className="cb-modal"
      >
        <div className="cb-modal-body">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateTest}
            className="cb-form"
          >
            <div className="cb-form-section">
              <h4 className="cb-form-section-title">Basic Information</h4>
              
              <div className="cb-form-group">
                <label className="cb-label cb-label-required">Test Title</label>
                <Form.Item
                  name="title"
                  rules={[{ required: true, message: 'Please enter test title' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input 
                    className="cb-input"
                    placeholder="Enter test title" 
                  />
                </Form.Item>
              </div>

              <div className="cb-form-group">
                <label className="cb-label">Description</label>
                <Form.Item
                  name="description"
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea 
                    className="cb-input cb-textarea"
                    placeholder="Enter test description" 
                    rows={3}
                  />
                </Form.Item>
              </div>
            </div>

            <div className="cb-form-section">
              <h4 className="cb-form-section-title">Test Configuration</h4>
              
              <div className="cb-form-row">
                <div className="cb-form-group">
                  <label className="cb-label cb-label-required">Test Type</label>
                  <Form.Item
                    name="test_type"
                    rules={[{ required: true, message: 'Please select test type' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select 
                      className="cb-input"
                      placeholder="Select test type"
                    >
                      {testTypeOptions.map(option => (
                        <Select.Option key={option.value} value={option.value}>
                          {option.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
                
                <div className="cb-form-group">
                  <label className="cb-label cb-label-required">Class</label>
                  <Form.Item
                    name="class_instance_id"
                    rules={[{ required: true, message: 'Please select class' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select 
                      className="cb-input"
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
                </div>
              </div>

              <div className="cb-form-group">
                <label className="cb-label cb-label-required">Subject</label>
                <Form.Item
                  name="subject_id"
                  rules={[{ required: true, message: 'Please select subject' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select 
                    className="cb-input"
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
              </div>

              <div className="cb-form-group">
                <label className="cb-label">Chapter (Optional)</label>
                <Form.Item
                  name="chapter_id"
                  style={{ marginBottom: 0 }}
                >
                  <Select 
                    className="cb-input"
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
                <div className="cb-help-text">
                  Select a chapter from the syllabus to associate with this test
                </div>
              </div>
            </div>

            <div className="cb-form-section">
              <h4 className="cb-form-section-title">Settings</h4>
              
              <div className="cb-form-row">
                <div className="cb-form-group">
                  <label className="cb-label">Time Limit (seconds)</label>
                  <Form.Item
                    name="time_limit_seconds"
                    style={{ marginBottom: 0 }}
                  >
                    <Input 
                      className="cb-input"
                      type="number" 
                      placeholder="Enter time limit"
                      min={0}
                    />
                  </Form.Item>
                  <div className="cb-help-text">Leave empty for no time limit</div>
                </div>
                
                <div className="cb-form-group">
                  <label className="cb-label">Allow Reattempts</label>
                  <Form.Item
                    name="allow_reattempts"
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <div className="cb-flex cb-items-center cb-gap-3">
                      <label className="cb-flex cb-items-center cb-gap-2">
                        <input type="radio" name="reattempts" value="no" defaultChecked />
                        <span className="cb-text-body-sm">No</span>
                      </label>
                      <label className="cb-flex cb-items-center cb-gap-2">
                        <input type="radio" name="reattempts" value="yes" />
                        <span className="cb-text-body-sm">Yes</span>
                      </label>
                    </div>
                  </Form.Item>
                  <div className="cb-help-text">
                    When enabled, students can retake this test multiple times
                  </div>
                </div>
              </div>
            </div>

            <div className="cb-flex cb-justify-end cb-gap-3">
              <button 
                type="button"
                className="cb-button cb-button-secondary"
                onClick={() => {
                  setModalVisible(false);
                  setEditingTest(null);
                  form.resetFields();
                }}
              >
                Cancel
              </button>
              <Button
                type="primary"
                htmlType="submit"
                loading={confirmLoading}
                className="cb-button cb-button-primary"
              >
                <span>{editingTest ? '💾' : '✨'}</span>
                <span>{editingTest ? 'Update Test' : 'Create Test'}</span>
              </Button>
            </div>
          </Form>
        </div>
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