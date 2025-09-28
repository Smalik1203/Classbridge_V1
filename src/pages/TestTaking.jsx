// pages/TestTaking.jsx
// React component for student test-taking UI (uses Ant Design).
// - Uses message.useMessage()
// - Defends against double-mounts (mountedRef)
// - Handles errors coming from service layer and shows user-friendly messages

import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Typography, Space, Tag, Row, Col, Progress, Modal, Radio, Input, message, Spin, Empty, Divider } from 'antd';
import { PlayCircleOutlined, ClockCircleOutlined, BookOutlined, TrophyOutlined, CheckCircleOutlined, ArrowLeftOutlined, ArrowRightOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { getSchoolCode, getStudentCode, getUserRole } from '../utils/metadata';
import { useTheme } from '../contexts/ThemeContext';
import {
  getAvailableTests,
  getTestForTaking,
  startTestAttempt,
  saveTestAnswer,
  submitTestAttempt,
  getTestHistory,
  allowTestReattempt
} from '../services/testTakingService';
import TestReviewModal from '../components/TestReviewModal';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function TestTaking() {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  const [messageApi, contextHolder] = message.useMessage();
  const mountedRef = useRef(false);

  // state
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [loadingTestId, setLoadingTestId] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);
  const [testHistory, setTestHistory] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [reattempting, setReattempting] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());

  const schoolCode = getSchoolCode(user);
  const studentId = user?.id;
  const userEmail = user?.email;
  const studentCode = getStudentCode(user);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    (async () => {
      await loadData();
    })();

    // cleanup on unmount
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer;
    if (currentTest && timeRemaining > 0 && currentAttempt?.status === 'in_progress') {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          // Auto-submit when time reaches 0
          if (prev <= 1) {
            autoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [currentTest, timeRemaining, currentAttempt?.status]);

  // Separate effect for warnings to avoid setState during render
  useEffect(() => {
    if (timeRemaining === 30) {
      messageApi.warning('Time is running low! 30 seconds remaining.');
    }
    if (timeRemaining === 10) {
      messageApi.error('Final warning! 10 seconds remaining. Test will auto-submit soon.');
    }
  }, [timeRemaining]);

  async function loadData() {
    setLoading(true);
    try {
      const tests = await getAvailableTests(studentId, schoolCode, userEmail, studentCode);
      const history = await getTestHistory(studentId, schoolCode, userEmail, studentCode);
      setAvailableTests(tests || []);
      setTestHistory(history || []);
    } catch (err) {
      console.error('loadData error', err);
      messageApi.error(err.message || 'Failed to load tests');
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(test) {
    setTestLoading(true);
    setLoadingTestId(test.id);
    try {
      // Always call startTestAttempt which handles reattempts properly
      const attempt = await startTestAttempt(test.id, studentId, schoolCode, userEmail, studentCode);
      
      // Get the test data separately
      const { test: testData } = await getTestForTaking(test.id, studentId, schoolCode, userEmail, studentCode);

      setCurrentTest(testData);
      setCurrentAttempt(attempt);
      setAnswers(attempt.answers || {});
      setCurrentQuestionIndex(0);
      setAutoSubmitted(false);
      
      // Initialize answered questions from existing answers
      const existingAnswers = attempt.answers || {};
      const answeredSet = new Set();
      Object.keys(existingAnswers).forEach(questionId => {
        const answer = existingAnswers[questionId];
        if (answer !== undefined && answer !== null && answer !== '') {
          answeredSet.add(questionId);
        }
      });
      setAnsweredQuestions(answeredSet);

      // set timer
      if (testData?.time_limit_seconds) {
        setTimeRemaining(testData.time_limit_seconds);
      } else {
        setTimeRemaining(0);
      }

      messageApi.success('Test started');
    } catch (err) {
      console.error('handleStart error', err);
      messageApi.error(err.message || 'Failed to start test. If you recently changed DB schema, try refreshing API schema in Supabase.');
    } finally {
      setTestLoading(false);
      setLoadingTestId(null);
    }
  }

  function handleAnswerChange(questionId, value) {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    
    // Track answered questions
    if (value !== undefined && value !== null && value !== '') {
      setAnsweredQuestions(prev => new Set([...prev, questionId]));
    } else {
      setAnsweredQuestions(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });
    }
    // Note: Answers are now saved only when clicking Next button, not automatically
  }

  async function nextQuestion() {
    if (!currentTest) return;
    
    // Check if current question has an answer
    const currentQuestion = currentTest.test_questions?.[currentQuestionIndex];
    if (currentQuestion) {
      const currentAnswer = answers[currentQuestion.id];
      if (currentAnswer === undefined || currentAnswer === null || currentAnswer === '') {
        messageApi.warning('Please select an answer before proceeding to the next question.');
        return;
      }
    }
    
    // Save current answer before moving to next question
    if (currentQuestion && currentAttempt) {
      const currentAnswer = answers[currentQuestion.id];
      if (currentAnswer !== undefined) {
        try {
          await saveTestAnswer(currentAttempt.id, currentQuestion.id, currentAnswer, studentId);
        } catch (err) {
          console.warn('Failed to save answer before next question:', err);
          messageApi.error('Could not save answer. Please try again.');
        }
      }
    }
    
    setCurrentQuestionIndex(i => Math.min(i + 1, (currentTest.test_questions || []).length - 1));
  }
  async function prevQuestion() {
    // Save current answer before moving to previous question
    const currentQuestion = currentTest.test_questions?.[currentQuestionIndex];
    if (currentQuestion && currentAttempt) {
      const currentAnswer = answers[currentQuestion.id];
      if (currentAnswer !== undefined) {
        try {
          await saveTestAnswer(currentAttempt.id, currentQuestion.id, currentAnswer, studentId);
        } catch (err) {
          console.warn('Failed to save answer before previous question:', err);
          messageApi.error('Could not save answer. Please try again.');
        }
      }
    }
    
    setCurrentQuestionIndex(i => Math.max(i - 1, 0));
  }

  async function submitConfirm() {
    // Check if all questions are answered
    const questions = currentTest?.test_questions || [];
    const unansweredQuestions = questions.filter(q => !answeredQuestions.has(q.id));
    
    if (unansweredQuestions.length > 0) {
      Modal.confirm({
        title: 'Unanswered Questions',
        content: `You have ${unansweredQuestions.length} unanswered question(s). Are you sure you want to submit the test?`,
        onOk: submit
      });
    } else {
      Modal.confirm({
        title: 'Submit Test',
        content: 'Are you sure? You will not be able to change answers after submission.',
        onOk: submit
      });
    }
  }

  async function autoSubmit() {
    // Prevent multiple auto-submissions
    if (autoSubmitted) return;
    
    setAutoSubmitted(true);
    setTimeRemaining(0);
    
    // Show auto-submit message
    messageApi.warning('Time expired — submitting test automatically.', 3);
    
    // Add a small delay to ensure the message is seen
    setTimeout(async () => {
      try {
        // Check if attempt is still valid before submitting
        if (!currentAttempt || currentAttempt.status !== 'in_progress') {
          messageApi.warning('Test has already been submitted or is no longer available.');
          return;
        }
        
        await submit();
      } catch (error) {
        console.error('Auto-submit error:', error);
        if (error.message.includes('not in progress')) {
          messageApi.warning('Test has already been submitted.');
        } else {
          messageApi.error('Failed to auto-submit test. Please try submitting manually.');
        }
        setAutoSubmitted(false); // Reset on error
      }
    }, 1000);
  }

  async function submit() {
    if (!currentAttempt) return;
    setSubmitting(true);
    try {
      // Save current answer before submitting
      const currentQuestion = currentTest.test_questions?.[currentQuestionIndex];
      if (currentQuestion) {
        const currentAnswer = answers[currentQuestion.id];
        if (currentAnswer !== undefined) {
          try {
            await saveTestAnswer(currentAttempt.id, currentQuestion.id, currentAnswer, studentId);
          } catch (err) {
            console.warn('Failed to save final answer:', err);
            // Continue with submission even if save fails
          }
        }
      }
      
      const updated = await submitTestAttempt(currentAttempt.id, answers, studentId);
      setTestResults(updated);
      setShowResults(true);
      // reset UI
      setCurrentTest(null);
      setCurrentAttempt(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setTimeRemaining(0);
      // refresh lists
      await loadData();
      messageApi.success('Test submitted successfully');
    } catch (err) {
      console.error('submit error', err);
      messageApi.error(err.message || 'Failed to submit test');
    } finally {
      setSubmitting(false);
    }
  }

  function exitTest() {
    Modal.confirm({
      title: 'Exit Test',
      content: 'Your progress will be saved. Do you want to exit?',
      onOk: () => {
        setCurrentTest(null);
        setCurrentAttempt(null);
        setAnswers({});
        setTimeRemaining(0);
        setCurrentQuestionIndex(0);
      }
    });
  }

  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs) return `${hrs}h ${mins}m ${secs}s`;
    if (mins) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  function typeColor(type) {
    const map = { quiz: 'blue', unit_test: 'green', assignment: 'orange', exam: 'red', practice: 'purple' };
    return map[type] || 'default';
  }

  // Check if a test has been completed
  function isTestCompleted(testId) {
    const completed = testHistory.some(attempt => attempt.test_id === testId && attempt.status === 'completed');
    return completed;
  }

  // Handle test review
  function handleReviewTest(attempt) {
    setSelectedAttempt(attempt);
    setReviewModalVisible(true);
  }

  // Handle test reattempt (admin/superadmin only)
  async function handleReattemptTest(attempt) {
    const userRole = getUserRole(user);
    if (!userRole || !['admin', 'superadmin'].includes(userRole)) {
      messageApi.error('Only admins can allow test reattempts');
      return;
    }

    setReattempting(true);
    try {
      await allowTestReattempt(attempt.id, studentId, schoolCode, userEmail, studentCode);
      messageApi.success('Test reattempt allowed. Student can now retake the test.');
      await loadData(); // Refresh the data
    } catch (err) {
      console.error('Error allowing reattempt:', err);
      messageApi.error(err.message || 'Failed to allow test reattempt');
    } finally {
      setReattempting(false);
    }
  }

  // Render taking UI
  if (currentTest) {
    const questions = currentTest.test_questions || [];
    const curQ = questions[currentQuestionIndex] || null;
    // Progress based on answered questions, not current position
    const progress = questions.length ? Math.round((answeredQuestions.size / questions.length) * 100) : 0;

    return (
      <>
        {contextHolder}
        <div style={{ padding: 24, minHeight: '100vh', background: antdTheme.token.colorBgLayout }}>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={3} style={{ margin: 0 }}>{currentTest.title}</Title>
                <Space>
                  <Tag color={typeColor(currentTest.test_type)}>{(currentTest.test_type || '').replace('_', ' ')}</Tag>
                  <Text type="secondary">{currentTest.subjects?.subject_name}</Text>
                  <Text type="secondary">Grade {currentTest.class_instances?.grade} {currentTest.class_instances?.section}</Text>
                </Space>
              </div>

              <div style={{ textAlign: 'right' }}>
                {timeRemaining > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <Text 
                      strong 
                      style={{ 
                        color: timeRemaining <= 10 ? '#ff4d4f' : timeRemaining <= 30 ? '#fa8c16' : undefined,
                        fontSize: timeRemaining <= 10 ? '16px' : '14px',
                        animation: timeRemaining <= 10 ? 'pulse 1s infinite' : undefined
                      }}
                    >
                      <ClockCircleOutlined /> {formatTime(timeRemaining)}
                      {timeRemaining <= 10 && ' - Auto-submitting soon!'}
                    </Text>
                  </div>
                )}
                <Button danger onClick={exitTest}>Exit</Button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <Progress percent={progress} showInfo={false} strokeColor={antdTheme.token.colorPrimary} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <Text type="secondary">Question {currentQuestionIndex + 1} of {questions.length}</Text>
                <Text type="secondary">{answeredQuestions.size} of {questions.length} answered ({progress}%)</Text>
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: 20 }}>
            {curQ ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Title level={4} style={{ margin: 0 }}>{curQ.question_text}</Title>
                  {answeredQuestions.has(curQ.id) ? (
                    <Tag color="green" style={{ fontSize: 12 }}>Answered</Tag>
                  ) : (
                    <Tag color="orange" style={{ fontSize: 12 }}>Not Answered</Tag>
                  )}
                </div>
                <Text type="secondary">{(curQ.question_type || '').replace('_', ' ')} • {curQ.points || 1} pt</Text>

                <div style={{ marginTop: 16 }}>
                  {curQ.question_type === 'multiple_choice' || curQ.question_type === 'mcq' ? (
                    <Radio.Group value={answers[curQ.id]} onChange={(e) => handleAnswerChange(curQ.id, e.target.value)} style={{ width: '100%' }}>
                      {(curQ.options || []).map((opt, idx) => (
                        <div key={idx} style={{ marginBottom: 12 }}>
                          <Radio value={opt} style={{ width: '100%' }}>{opt}</Radio>
                        </div>
                      ))}
                    </Radio.Group>
                  ) : curQ.question_type === 'one_word' ? (
                    <Input value={answers[curQ.id] || ''} onChange={(e) => handleAnswerChange(curQ.id, e.target.value)} placeholder="Type your answer" style={{ maxWidth: 480 }} />
                  ) : (
                    <TextArea rows={6} value={answers[curQ.id] || ''} onChange={(e) => handleAnswerChange(curQ.id, e.target.value)} placeholder="Type your detailed answer" />
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                  <Button icon={<ArrowLeftOutlined />} onClick={prevQuestion} disabled={currentQuestionIndex === 0}>Previous</Button>
                  <Space>
                    {currentQuestionIndex === questions.length - 1 ? (
                      <Button type="primary" icon={<CheckCircleOutlined />} onClick={submitConfirm} loading={submitting}>Submit Test</Button>
                    ) : (
                      <Button type="primary" icon={<ArrowRightOutlined />} onClick={nextQuestion}>Next</Button>
                    )}
                  </Space>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}><Text type="secondary">No question data available. Contact your teacher.</Text></div>
            )}
          </Card>
        </div>
      </>
    );
  }

  // Results screen
  if (showResults && testResults) {
    return (
      <>
        {contextHolder}
        <div style={{ padding: 24, minHeight: '100vh', background: antdTheme.token.colorBgLayout }}>
          <Card style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 12 }} />
            <Title level={2}>Test Completed</Title>
            <Text>Correct Answers: <strong>{testResults.earned_points !== null ? testResults.earned_points : (testResults.score || 0)}</strong> out of <strong>{testResults.total_points !== null ? testResults.total_points : (testResults.test?.test_questions?.length || 0)}</strong></Text>
            <Divider />
            <Space>
              <Button 
                icon={<EyeOutlined />} 
                onClick={() => {
                  setSelectedAttempt(testResults);
                  setReviewModalVisible(true);
                  setShowResults(false);
                }}
              >
                Review Test
              </Button>
              <Button type="primary" onClick={() => { setShowResults(false); loadData(); }}>
                Back to Tests
              </Button>
            </Space>
          </Card>
        </div>
      </>
    );
  }

  // Default: list of tests + history
  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
      {contextHolder}
      <div style={{ 
        padding: 24, 
        minHeight: '100vh', 
        background: '#f8f9fa'
      }}>
        <div style={{ 
          marginBottom: 32,
          textAlign: 'center',
          padding: '20px 0'
        }}>
          <Title level={2} style={{ 
            margin: 0, 
            marginBottom: 8,
            color: '#1f1f1f',
            fontWeight: 600
          }}>
            Take Tests
          </Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Complete assigned tests and track your progress
          </Text>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : (
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#1f1f1f' }}>Available Tests</span>
                    <Tag color="blue" style={{ borderRadius: 6, fontWeight: 500 }}>
                      {availableTests.length}
                    </Tag>
                  </div>
                }
                style={{
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  border: 'none'
                }}
                headStyle={{
                  background: '#ffffff',
                  color: '#1f1f1f',
                  borderRadius: '12px 12px 0 0',
                  border: 'none',
                  borderBottom: '1px solid #e8e8e8'
                }}
                bodyStyle={{ padding: '20px' }}
              >
                {availableTests.length === 0 ? (
                  <Empty description="No tests available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {availableTests.map(t => (
                      <Card 
                        key={t.id} 
                        hoverable
                        style={{ 
                          marginBottom: 16,
                          borderRadius: 12,
                          border: '1px solid #e8e8e8',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                        }}
                        bodyStyle={{ padding: '20px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, marginRight: 16 }}>
                            {/* Header with title and type */}
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              marginBottom: 12,
                              flexWrap: 'nowrap',
                              minWidth: 0
                            }}>
                              <Title level={4} style={{ 
                                margin: 0, 
                                marginRight: 12, 
                                color: '#1f1f1f',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flexShrink: 0
                              }}>
                                {t.title}
                              </Title>
                              <Tag 
                                color={typeColor(t.test_type)} 
                                style={{ 
                                  borderRadius: 6,
                                  fontWeight: 500,
                                  textTransform: 'capitalize',
                                  flexShrink: 0
                                }}
                              >
                                {t.test_type?.replace('_', ' ') || 'Test'}
                              </Tag>
                              {t.allow_reattempts && (
                                <Tag 
                                  color="green" 
                                  style={{ 
                                    borderRadius: 6,
                                    fontWeight: 500,
                                    marginLeft: 8,
                                    flexShrink: 0
                                  }}
                                >
                                  Reattempt Allowed
                                </Tag>
                              )}
                            </div>

                            {/* Subject and Class info */}
                            <div style={{ marginBottom: 12 }}>
                              <Text type="secondary" style={{ 
                                fontSize: 14,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block'
                              }}>
                                {t.subjects?.subject_name} • Grade {t.class_instances?.grade} {t.class_instances?.section}
                              </Text>
                            </div>

                            {/* Description */}
                            {t.description && (
                              <div style={{ marginBottom: 12 }}>
                                <Text type="secondary" style={{ 
                                  fontSize: 14, 
                                  lineHeight: 1.5,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'block'
                                }}>
                                  {t.description}
                                </Text>
                              </div>
                            )}

                            {/* Chapter info */}
                            {t.syllabus_chapters && (
                              <div style={{ 
                                marginBottom: 16,
                                padding: '8px 12px',
                                background: '#f5f5f5',
                                borderRadius: 6,
                                border: '1px solid #e0e0e0'
                              }}>
                                <Text style={{ 
                                  fontSize: 13, 
                                  color: '#666',
                                  fontWeight: 500,
                                  display: 'flex',
                                  alignItems: 'center',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  <span style={{ marginRight: 6, flexShrink: 0 }}>📚</span>
                                  <span style={{ 
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    Chapter {t.syllabus_chapters.chapter_no}: {t.syllabus_chapters.title}
                                  </span>
                                </Text>
                              </div>
                            )}

                            {/* Test details */}
                            <div style={{ 
                              display: 'flex', 
                              gap: 16, 
                              alignItems: 'center',
                              padding: '8px 0',
                              flexWrap: 'nowrap',
                              minWidth: 0
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 4,
                                flexShrink: 0
                              }}>
                                <BookOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
                                <Text type="secondary" style={{ 
                                  fontSize: 13,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {t.test_questions?.length || 0} questions
                                </Text>
                                {(!t.test_questions || t.test_questions.length === 0) && (
                                  <Text type="danger" style={{ 
                                    fontSize: 12, 
                                    marginLeft: 4,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    (No questions available)
                                  </Text>
                                )}
                              </div>
                              {t.time_limit_seconds && (
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 4,
                                  flexShrink: 0
                                }}>
                                  <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
                                  <Text type="secondary" style={{ 
                                    fontSize: 13,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {Math.floor(t.time_limit_seconds / 60)} minutes
                                  </Text>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action button */}
                          <Button 
                            type="primary" 
                            icon={<PlayCircleOutlined />} 
                            onClick={() => handleStart(t)} 
                            loading={loadingTestId === t.id} 
                            disabled={!t.test_questions || t.test_questions.length === 0}
                            size="large"
                            style={{
                              borderRadius: 8,
                              height: 44,
                              paddingLeft: 20,
                              paddingRight: 20,
                              fontWeight: 500,
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            {(() => {
                              const completed = isTestCompleted(t.id);
                              const hasQuestions = t.test_questions && t.test_questions.length > 0;
                              
                              if (!hasQuestions) {
                                return 'No Questions';
                              }
                              return completed ? 'Restart' : 'Start';
                            })()}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#1f1f1f' }}>Test History</span>
                    <Tag color="green" style={{ borderRadius: 6, fontWeight: 500 }}>
                      {testHistory.length}
                    </Tag>
                  </div>
                }
                style={{
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  border: 'none'
                }}
                headStyle={{
                  background: '#ffffff',
                  color: '#1f1f1f',
                  borderRadius: '12px 12px 0 0',
                  border: 'none',
                  borderBottom: '1px solid #e8e8e8'
                }}
                bodyStyle={{ padding: '20px' }}
              >
                {testHistory.length === 0 ? (
                  <Empty description="No completed tests" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {testHistory.map(a => {
                      // Calculate score dynamically
                      const questions = a.test?.test_questions || [];
                      let calculatedScore = 0;
                      
                      questions.forEach((question, index) => {
                        const userAnswer = a.answers?.[question.id];
                        let correct = false;
                        
                        
                        if (question.question_type === 'mcq' || question.question_type === 'multiple_choice') {
                          if (question.correct_index !== null && question.correct_index !== undefined) {
                            // Check if user answer matches the correct option by index
                            const correctOption = question.options?.[question.correct_index];
                            correct = (userAnswer === correctOption) || (userAnswer === question.correct_index);
                          } else if (question.correct_text) {
                            correct = String(userAnswer || '').trim().toLowerCase() === String(question.correct_text).trim().toLowerCase();
                          }
                        } else {
                          if (question.correct_text) {
                            correct = String(userAnswer || '').trim().toLowerCase() === String(question.correct_text).trim().toLowerCase();
                          }
                        }
                        
                        if (correct) calculatedScore++;
                      });
                      
                      // Use stored values if available, otherwise calculate dynamically
                      const displayScore = a.earned_points !== null ? a.earned_points : (a.score || calculatedScore);
                      const totalQuestions = a.total_points !== null ? a.total_points : questions.length;
                      
                      
                      return (
                        <div 
                          key={a.id} 
                          style={{ 
                            padding: 16, 
                            border: '1px solid #e8e8e8', 
                            borderRadius: 10,
                            marginBottom: 12,
                            background: '#ffffff',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 16, color: '#1f1f1f', marginRight: 12 }}>
                                  {a.test?.title}
                                </Text>
                                <Tag 
                                  color={displayScore >= totalQuestions * 0.7 ? 'green' : 'red'}
                                  style={{ 
                                    borderRadius: 6,
                                    fontWeight: 500,
                                    fontSize: 12
                                  }}
                                >
                                  {displayScore}/{totalQuestions}
                                </Tag>
                              </div>
                              
                              <div style={{ marginBottom: 8 }}>
                                <Text type="secondary" style={{ fontSize: 13 }}>
                                  {a.test?.subjects?.subject_name}
                                </Text>
                              </div>

                              {a.test?.syllabus_chapters && (
                                <div style={{ 
                                  marginBottom: 12,
                                  padding: '6px 10px',
                                  background: '#f5f5f5',
                                  borderRadius: 6,
                                  border: '1px solid #e0e0e0'
                                }}>
                                  <Text style={{ 
                                    fontSize: 12, 
                                    color: '#666',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}>
                                    <span style={{ marginRight: 4 }}>📚</span>
                                    Chapter {a.test.syllabus_chapters.chapter_no}: {a.test.syllabus_chapters.title}
                                  </Text>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <Button 
                              size="small" 
                              icon={<EyeOutlined />} 
                              onClick={() => handleReviewTest(a)}
                              style={{
                                borderRadius: 6,
                                fontWeight: 500
                              }}
                            >
                              Review
                            </Button>
                            {getUserRole(user) && ['admin', 'superadmin'].includes(getUserRole(user)) && (
                              <Button 
                                size="small" 
                                type="primary" 
                                loading={reattempting}
                                onClick={() => handleReattemptTest(a)}
                                style={{
                                  borderRadius: 6,
                                  fontWeight: 500
                                }}
                              >
                                Allow Reattempt
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        )}
      </div>

      {/* Test Review Modal */}
      <TestReviewModal
        visible={reviewModalVisible}
        testAttempt={selectedAttempt}
        onClose={() => {
          setReviewModalVisible(false);
          setSelectedAttempt(null);
        }}
      />
    </>
  );
}
