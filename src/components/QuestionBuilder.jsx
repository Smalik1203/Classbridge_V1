import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Card,
  List,
  Tag,
  Typography,
  Divider,
  Popconfirm,
  message,
  Spin,
  Row,
  Col,
  Radio,
  InputNumber,
  Alert
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { 
  getQuestionsForTest, 
  createQuestion, 
  updateQuestion, 
  deleteQuestion,
  getTestsForQuestions 
} from '../services/questionService';
import ImportQuestionsModal from './ImportQuestionsModal';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Option } = Select;

const QuestionBuilder = ({ visible, test, onClose, onChange }) => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  const [form] = Form.useForm();
  
  // State management
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [questionType, setQuestionType] = useState('mcq');
  const [importModalVisible, setImportModalVisible] = useState(false);

  // Comprehensive user data extraction (checking all possible locations)
  const schoolCode = user?.raw_app_meta_data?.school_code || user?.app_metadata?.school_code || user?.raw_user_meta_data?.school_code || user?.user_metadata?.school_code;

  // Load available tests when modal opens
  useEffect(() => {
    if (visible && schoolCode) {
      loadAvailableTests();
    }
  }, [visible, schoolCode]);

  // Load questions when test is selected
  useEffect(() => {
    if (visible && selectedTestId) {
      loadQuestions();
    }
  }, [visible, selectedTestId]);

  // Set initial test if provided
  useEffect(() => {
    if (test) {
      setSelectedTestId(test.id);
    } else {
      setSelectedTestId(null);
    }
  }, [test]);

  // Reset form when question type changes
  useEffect(() => {
    if (questionType !== 'mcq') {
      form.setFieldsValue({ options: undefined, correct_index: undefined });
    }
  }, [questionType, form]);

  const loadAvailableTests = async () => {
    try {
      const testsData = await getTestsForQuestions(schoolCode);
      setAvailableTests(testsData);
    } catch (error) {
      message.error('Failed to load tests');
      console.error('Error loading tests:', error);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const questionsData = await getQuestionsForTest(selectedTestId);
      setQuestions(questionsData);
    } catch (error) {
      message.error('Failed to load questions');
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSelect = (testId) => {
    setSelectedTestId(testId);
    setEditingQuestion(null);
    form.resetFields();
  };

  const handleQuestionTypeChange = (type) => {
    setQuestionType(type);
    form.setFieldsValue({ 
      options: undefined, 
      correct_index: undefined,
      correct_text: undefined 
    });
  };

  const handleSubmit = async (values) => {
    if (!selectedTestId) {
      message.error('Please select a test first');
      return;
    }

    setSubmitting(true);
    try {
      const questionData = {
        test_id: selectedTestId,
        question_text: values.question_text,
        question_type: values.question_type,
        options: values.question_type === 'mcq' ? values.options : null,
        correct_index: values.question_type === 'mcq' ? values.correct_index : null,
        correct_text: values.question_type !== 'mcq' ? values.correct_text : null
      };

      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, questionData);
        message.success('Question updated successfully');
      } else {
        await createQuestion(questionData);
        message.success('Question added successfully');
      }

      form.resetFields();
      setEditingQuestion(null);
      loadQuestions();
      onChange?.();
    } catch (error) {
      if (error.message?.includes('permission') || error.message?.includes('denied')) {
        message.error('Permission denied — check user role or test ownership');
      } else {
        message.error('Failed to save question');
      }
      console.error('Error saving question:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setQuestionType(question.question_type);
    
    form.setFieldsValue({
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options || [],
      correct_index: question.correct_index,
      correct_text: question.correct_text
    });
  };

  const handleDelete = async (questionId) => {
    try {
      await deleteQuestion(questionId);
      message.success('Question deleted successfully');
      loadQuestions();
      onChange?.();
    } catch (error) {
      if (error.message?.includes('permission') || error.message?.includes('denied')) {
        message.error('Permission denied — check user role or test ownership');
      } else {
        message.error('Failed to delete question');
      }
      console.error('Error deleting question:', error);
    }
  };

  const handleReset = () => {
    form.resetFields();
    setEditingQuestion(null);
    setQuestionType('mcq');
  };

  const getQuestionTypeColor = (type) => {
    const colors = {
      mcq: 'blue',
      one_word: 'green',
      long_answer: 'orange'
    };
    return colors[type] || 'default';
  };

  const getQuestionTypeLabel = (type) => {
    const labels = {
      mcq: 'Multiple Choice',
      one_word: 'One Word',
      long_answer: 'Long Answer'
    };
    return labels[type] || type;
  };

  const selectedTest = test || availableTests.find(t => t.id === selectedTestId);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <QuestionCircleOutlined style={{ marginRight: '8px' }} />
          {selectedTest ? `Questions for: ${selectedTest.title}` : 'Question Builder'}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      style={{ top: 20 }}
      footer={null}
    >
      <Row gutter={24} style={{ marginTop: '20px' }}>
        {/* Left Column - Question Form */}
        <Col xs={24} lg={12}>
          <Card title="Question Form" style={{ height: '100%' }}>
            {!test && (
              <div style={{ marginBottom: '16px' }}>
                <Alert
                  message="Select a test to manage questions"
                  description="Choose a test from the dropdown below, or open this modal from the Tests list for better experience."
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                <Select
                  placeholder="Select a test"
                  style={{ width: '100%' }}
                  value={selectedTestId}
                  onChange={handleTestSelect}
                  showSearch
                  optionFilterProp="children"
                >
                  {availableTests.map((test) => (
                    <Option key={test.id} value={test.id}>
                      {test.title} - Grade {test.class_instances?.grade} {test.class_instances?.section} - {test.subjects?.subject_name}
                    </Option>
                  ))}
                </Select>
              </div>
            )}

            {selectedTestId && (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{ question_type: 'mcq' }}
              >
                <Form.Item
                  name="question_text"
                  label="Question Text"
                  rules={[{ required: true, message: 'Please enter question text' }]}
                >
                  <TextArea 
                    rows={3} 
                    placeholder="Enter your question here..." 
                  />
                </Form.Item>

                <Form.Item
                  name="question_type"
                  label="Question Type"
                  rules={[{ required: true, message: 'Please select question type' }]}
                >
                  <Select 
                    placeholder="Select question type"
                    onChange={handleQuestionTypeChange}
                  >
                    <Option value="mcq">Multiple Choice Question</Option>
                    <Option value="one_word">One Word Answer</Option>
                    <Option value="long_answer">Long Answer</Option>
                  </Select>
                </Form.Item>

                {questionType === 'mcq' && (
                  <>
                    <Form.Item
                      name="options"
                      label="Options"
                      rules={[
                        { required: true, message: 'Please add at least 2 options' },
                        { 
                          validator: (_, value) => {
                            if (!value || value.length < 2) {
                              return Promise.reject('At least 2 options required');
                            }
                            return Promise.resolve();
                          }
                        }
                      ]}
                    >
                      <Form.List name="options">
                        {(fields, { add, remove }) => (
                          <div>
                            {fields.map(({ key, name, ...restField }) => (
                              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                <Form.Item
                                  {...restField}
                                  name={name}
                                  rules={[{ required: true, message: 'Missing option' }]}
                                  style={{ flex: 1 }}
                                >
                                  <Input placeholder={`Option ${name + 1}`} />
                                </Form.Item>
                                <Button 
                                  type="text" 
                                  icon={<DeleteOutlined />} 
                                  onClick={() => remove(name)}
                                  danger
                                />
                              </Space>
                            ))}
                            <Button 
                              type="dashed" 
                              onClick={() => add()} 
                              block 
                              icon={<PlusOutlined />}
                            >
                              Add Option
                            </Button>
                          </div>
                        )}
                      </Form.List>
                    </Form.Item>

                    <Form.Item
                      name="correct_index"
                      label="Correct Answer"
                      dependencies={['options']}
                      rules={[
                        { required: true, message: 'Please select correct answer' },
                        {
                          validator: (_, value) => {
                            const options = form.getFieldValue('options') || [];
                            if (value !== undefined && value >= options.length) {
                              return Promise.reject('Invalid correct answer selection');
                            }
                            return Promise.resolve();
                          }
                        }
                      ]}
                    >
                      <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.options !== currentValues.options}>
                        {() => {
                          const options = form.getFieldValue('options') || [];
                          return (
                            <Radio.Group>
                              {options.filter(option => option && option.trim() !== '').map((option, index) => (
                                <Radio key={index} value={index}>
                                  {option}
                                </Radio>
                              ))}
                            </Radio.Group>
                          );
                        }}
                      </Form.Item>
                    </Form.Item>
                  </>
                )}

                {questionType === 'one_word' && (
                  <Form.Item
                    name="correct_text"
                    label="Correct Answer (Optional)"
                    help="Provide the expected answer for reference"
                  >
                    <Input placeholder="Enter correct answer..." />
                  </Form.Item>
                )}

                {questionType === 'long_answer' && (
                  <Form.Item
                    name="correct_text"
                    label="Model Answer (Optional)"
                    help="Provide guidance or model answer for grading"
                  >
                    <TextArea 
                      rows={4} 
                      placeholder="Enter model answer or grading guidance..." 
                    />
                  </Form.Item>
                )}

                <Divider />

                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={submitting}
                    style={{
                      background: antdTheme.token.colorPrimary,
                      borderColor: antdTheme.token.colorPrimary,
                    }}
                  >
                    {editingQuestion ? 'Update Question' : 'Add Question'}
                  </Button>
                  <Button onClick={handleReset}>
                    Reset
                  </Button>
                  {selectedTestId && (
                    <Button
                      type="default"
                      icon={<UploadOutlined />}
                      onClick={() => setImportModalVisible(true)}
                      style={{
                        borderColor: antdTheme.token.colorPrimary,
                        color: antdTheme.token.colorPrimary,
                      }}
                    >
                      Import Questions
                    </Button>
                  )}
                </Space>
              </Form>
            )}
          </Card>
        </Col>

        {/* Right Column - Existing Questions */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Existing Questions ({questions.length})</span>
                {selectedTestId && (
                  <Button 
                    type="text" 
                    size="small"
                    onClick={loadQuestions}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                )}
              </div>
            }
            style={{ height: '100%' }}
          >
            {!selectedTestId ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <QuestionCircleOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
                <div style={{ marginTop: '16px', color: '#999' }}>
                  Select a test to view questions
                </div>
              </div>
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
              </div>
            ) : questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <QuestionCircleOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
                <div style={{ marginTop: '16px', color: '#999' }}>
                  No questions yet. Add your first question!
                </div>
              </div>
            ) : (
              <List
                dataSource={questions}
                renderItem={(question) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(question)}
                        style={{ color: antdTheme.token.colorPrimary }}
                      >
                        Edit
                      </Button>,
                      <Popconfirm
                        title="Delete Question"
                        description="Are you sure you want to delete this question?"
                        onConfirm={() => handleDelete(question.id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                          style={{ color: antdTheme.token.colorError }}
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <div>
                          <Text strong>{question.question_text}</Text>
                          <Tag 
                            color={getQuestionTypeColor(question.question_type)}
                            style={{ marginLeft: '8px' }}
                          >
                            {getQuestionTypeLabel(question.question_type)}
                          </Tag>
                        </div>
                      }
                      description={
                        <div>
                          {question.question_type === 'mcq' && question.options && (
                            <div style={{ marginTop: '8px' }}>
                              {question.options.map((option, index) => (
                                <div 
                                  key={index} 
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    marginBottom: '4px',
                                    padding: '4px 8px',
                                    backgroundColor: index === question.correct_index ? '#f6ffed' : 'transparent',
                                    border: index === question.correct_index ? '1px solid #b7eb8f' : '1px solid transparent',
                                    borderRadius: '4px'
                                  }}
                                >
                                  {index === question.correct_index ? (
                                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                                  ) : (
                                    <CloseCircleOutlined style={{ color: '#d9d9d9', marginRight: '8px' }} />
                                  )}
                                  <Text 
                                    style={{ 
                                      color: index === question.correct_index ? '#52c41a' : 'inherit',
                                      fontWeight: index === question.correct_index ? 500 : 'normal'
                                    }}
                                  >
                                    {option}
                                  </Text>
                                </div>
                              ))}
                            </div>
                          )}
                          {(question.question_type === 'one_word' || question.question_type === 'long_answer') && question.correct_text && (
                            <div style={{ marginTop: '8px' }}>
                              <Text type="secondary">
                                <strong>Answer:</strong> {question.correct_text}
                              </Text>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Import Questions Modal */}
      <ImportQuestionsModal
        visible={importModalVisible}
        test={selectedTest}
        onClose={() => setImportModalVisible(false)}
        onImportComplete={() => {
          loadQuestions();
          onChange?.();
        }}
      />
    </Modal>
  );
};

export default QuestionBuilder;
