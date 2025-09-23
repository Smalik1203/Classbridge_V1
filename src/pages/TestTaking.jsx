// pages/TestTaking.jsx
// React component for student test-taking UI (uses Ant Design).
// - Uses message.useMessage()
// - Defends against double-mounts (mountedRef)
// - Handles errors coming from service layer and shows user-friendly messages

import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Typography, Space, Tag, Row, Col, Progress, Modal, Radio, Input, message, Spin, Empty, Divider } from 'antd';
import { PlayCircleOutlined, ClockCircleOutlined, BookOutlined, TrophyOutlined, CheckCircleOutlined, ArrowLeftOutlined, ArrowRightOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
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

  const schoolCode = user?.school_code;
  const studentId = user?.id;
  const userEmail = user?.email;
  const studentCode = user?.user_metadata?.student_code;

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
      console.log('loadData - loaded tests:', tests?.length || 0);
      console.log('loadData - loaded history:', history?.length || 0, history);
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
    try {
      // Always call startTestAttempt which handles reattempts properly
      const attempt = await startTestAttempt(test.id, studentId, schoolCode, userEmail, studentCode);
      
      // Get the test data separately
      const { test: testData } = await getTestForTaking(test.id, studentId, schoolCode, userEmail, studentCode);

      setCurrentTest(testData);
      setCurrentAttempt(attempt);
      console.log('Test started - attempt data:', attempt);
      console.log('Test started - answers loaded:', attempt.answers || {});
      setAnswers(attempt.answers || {});
      setCurrentQuestionIndex(0);
      setAutoSubmitted(false);

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
    }
  }

  function handleAnswerChange(questionId, value) {
    console.log('handleAnswerChange:', { questionId, value, currentAttemptId: currentAttempt?.id });
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    // Note: Answers are now saved only when clicking Next button, not automatically
  }

  async function nextQuestion() {
    if (!currentTest) return;
    
    // Save current answer before moving to next question
    const currentQuestion = currentTest.test_questions?.[currentQuestionIndex];
    if (currentQuestion && currentAttempt) {
      const currentAnswer = answers[currentQuestion.id];
      if (currentAnswer !== undefined) {
        try {
          console.log('Saving answer before next question:', { questionId: currentQuestion.id, answer: currentAnswer });
          await saveTestAnswer(currentAttempt.id, currentQuestion.id, currentAnswer, studentId);
          console.log('Answer saved successfully before next question');
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
          console.log('Saving answer before previous question:', { questionId: currentQuestion.id, answer: currentAnswer });
          await saveTestAnswer(currentAttempt.id, currentQuestion.id, currentAnswer, studentId);
          console.log('Answer saved successfully before previous question');
        } catch (err) {
          console.warn('Failed to save answer before previous question:', err);
          messageApi.error('Could not save answer. Please try again.');
        }
      }
    }
    
    setCurrentQuestionIndex(i => Math.max(i - 1, 0));
  }

  async function submitConfirm() {
    Modal.confirm({
      title: 'Submit Test',
      content: 'Are you sure? You will not be able to change answers after submission.',
      onOk: submit
    });
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
            console.log('Saving final answer before submit:', { questionId: currentQuestion.id, answer: currentAnswer });
            await saveTestAnswer(currentAttempt.id, currentQuestion.id, currentAnswer, studentId);
            console.log('Final answer saved successfully');
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
    console.log('isTestCompleted check:', { testId, testHistory: testHistory.length, completed });
    return completed;
  }

  // Handle test review
  function handleReviewTest(attempt) {
    setSelectedAttempt(attempt);
    setReviewModalVisible(true);
  }

  // Handle test reattempt (admin/superadmin only)
  async function handleReattemptTest(attempt) {
    if (!user?.role || !['admin', 'superadmin'].includes(user.role)) {
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
    const progress = questions.length ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100) : 0;

    return (
      <>
        {contextHolder}
        <div className="cb-container cb-section" style={{ minHeight: '100vh' }}>
          {/* Modern Test Header */}
          <div className="cb-card cb-mb-6">
            <div className="cb-card-body">
              <div className="cb-flex cb-justify-between cb-items-center cb-mb-4">
                <div>
                  <h1 className="cb-heading-3 cb-mb-2">{currentTest.title}</h1>
                  <div className="cb-flex cb-gap-3 cb-items-center">
                    <span className={`cb-badge cb-badge-${typeColor(currentTest.test_type)}`}>
                      {(currentTest.test_type || '').replace('_', ' ')}
                    </span>
                    <span className="cb-text-caption">{currentTest.subjects?.subject_name}</span>
                    <span className="cb-text-caption">
                      Grade {currentTest.class_instances?.grade} {currentTest.class_instances?.section}
                    </span>
                  </div>
                </div>

                <div className="cb-flex cb-items-center cb-gap-4">
                  {timeRemaining > 0 && (
                    <div className="cb-flex cb-items-center cb-gap-2">
                      <span style={{ fontSize: 'var(--text-lg)' }}>⏰</span>
                      <span style={{ 
                        fontSize: timeRemaining <= 10 ? 'var(--text-lg)' : 'var(--text-base)',
                        fontWeight: 'var(--font-bold)',
                        color: timeRemaining <= 10 ? 'var(--color-error-500)' : 
                               timeRemaining <= 30 ? 'var(--color-warning-500)' : 
                               'var(--color-text-primary)',
                        animation: timeRemaining <= 10 ? 'pulse 1s infinite' : undefined
                      }}>
                        {formatTime(timeRemaining)}
                        {timeRemaining <= 10 && ' - Auto-submitting soon!'}
                      </span>
                    </div>
                  )}
                  <button className="cb-button cb-button-danger" onClick={exitTest}>
                    Exit Test
                  </button>
                </div>
              </div>

              {/* Enhanced Progress Bar */}
              <div>
                <div className="cb-progress cb-mb-2">
                  <div 
                    className="cb-progress-bar"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="cb-flex cb-justify-between cb-items-center">
                  <span className="cb-text-caption">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <span className="cb-text-caption">{progress}% Complete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Enhanced Results screen
  if (showResults && testResults) {
    return (
      <>
        {contextHolder}
        <div className="cb-container cb-section" style={{ minHeight: '100vh' }}>
          <div className="cb-card" style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="cb-card-body cb-text-center">
              <div style={{ fontSize: '4rem', marginBottom: 'var(--space-6)' }}>🎉</div>
              <h1 className="cb-heading-2 cb-mb-4">Test Completed!</h1>
              
              <div className="cb-kpi-grid" style={{ maxWidth: '400px', margin: '0 auto var(--space-8)' }}>
                <div className="cb-stat-card">
                  <div className="cb-stat-value">
                    {testResults.earned_points !== null ? testResults.earned_points : (testResults.score || 0)}
                  </div>
                  <div className="cb-stat-label">Correct Answers</div>
                </div>
                <div className="cb-stat-card">
                  <div className="cb-stat-value">
                    {testResults.total_points !== null ? testResults.total_points : (testResults.test?.test_questions?.length || 0)}
                  </div>
                  <div className="cb-stat-label">Total Questions</div>
                </div>
              </div>
              
              <div className="cb-flex cb-justify-center cb-gap-4">
                <button 
                  className="cb-button cb-button-secondary"
                  onClick={() => {
                    setSelectedAttempt(testResults);
                    setReviewModalVisible(true);
                    setShowResults(false);
                  }}
                >
                  <span>👁️</span>
                  <span>Review Test</span>
                </button>
                <button 
                  className="cb-button cb-button-primary"
                  onClick={() => { setShowResults(false); loadData(); }}
                >
                  <span>📋</span>
                  <span>Back to Tests</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Enhanced Default: list of tests + history
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
      <div className="cb-container cb-section" style={{ minHeight: '100vh' }}>
        {/* Modern Header */}
        <div className="cb-dashboard-header">
          <div className="cb-text-center">
            <h1 className="cb-heading-2 cb-mb-2">
              📝 Take Tests
            </h1>
            <p className="cb-text-caption">
              Complete assigned tests and track your progress
            </p>
          </div>
        </div>

        {loading ? (
          <div className="cb-grid cb-grid-2">
            <div className="cb-skeleton" style={{ height: '400px', borderRadius: 'var(--radius-2xl)' }}></div>
            <div className="cb-skeleton" style={{ height: '400px', borderRadius: 'var(--radius-2xl)' }}></div>
          </div>
        ) : (
          <div className="cb-grid cb-grid-2">
            {/* Available Tests */}
            <div className="cb-card">
              <div className="cb-card-header">
                <div className="cb-flex cb-items-center cb-gap-2">
                  <span style={{ fontSize: 'var(--text-lg)' }}>📋</span>
                  <h3 className="cb-heading-4">Available Tests</h3>
                  <span className="cb-badge cb-badge-primary cb-badge-sm">
                    {availableTests.length}
                  </span>
                </div>
              </div>
              <div className="cb-card-body">
                {availableTests.length === 0 ? (
                  <div className="cb-empty-state">
                    <div className="cb-empty-icon">📝</div>
                    <h3 className="cb-empty-title">No tests available</h3>
                    <p className="cb-empty-description">
                      Check back later for new assignments from your teachers.
                    </p>
                  </div>
                ) : (
                  <div className="cb-list">
                    {availableTests.map(t => (
                      <div key={t.id} className="cb-list-item">
                        <div className="cb-list-item-content">
                          <div className="cb-flex cb-items-center cb-gap-3 cb-mb-2">
                            <h4 className="cb-list-item-title">{t.title}</h4>
                            <span className={`cb-badge cb-badge-${typeColor(t.test_type)} cb-badge-sm`}>
                              {t.test_type?.replace('_', ' ') || 'Test'}
                            </span>
                            {t.allow_reattempts && (
                              <span className="cb-badge cb-badge-success cb-badge-sm">
                                Reattempt Allowed
                              </span>
                            )}
                          </div>
                          
                          <div className="cb-list-item-subtitle cb-mb-3">
                            {t.subjects?.subject_name} • Grade {t.class_instances?.grade} {t.class_instances?.section}
                          </div>

                          {t.description && (
                            <p className="cb-text-caption cb-mb-3">
                              {t.description}
                            </p>
                          )}

                          {t.syllabus_chapters && (
                            <div className="cb-badge cb-badge-neutral cb-badge-sm cb-mb-3">
                              📚 Chapter {t.syllabus_chapters.chapter_no}: {t.syllabus_chapters.title}
                            </div>
                          )}

                          <div className="cb-flex cb-gap-4 cb-items-center">
                            <div className="cb-flex cb-items-center cb-gap-1">
                              <span>📖</span>
                              <span className="cb-text-caption-sm">
                                {t.test_questions?.length || 0} questions
                              </span>
                            </div>
                            {t.time_limit_seconds && (
                              <div className="cb-flex cb-items-center cb-gap-1">
                                <span>⏱️</span>
                                <span className="cb-text-caption-sm">
                                  {Math.floor(t.time_limit_seconds / 60)} minutes
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="cb-list-item-actions">
                          <button 
                            className="cb-button cb-button-primary"
                            onClick={() => handleStart(t)} 
                            disabled={testLoading}
                          >
                            {testLoading ? (
                              <>
                                <div className="cb-spinner"></div>
                                <span>Loading...</span>
                              </>
                            ) : (
                              <>
                                <span>▶️</span>
                                <span>{isTestCompleted(t.id) ? 'Restart' : 'Start'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Test History */}
            <div className="cb-card">
              <div className="cb-card-header">
                <div className="cb-flex cb-items-center cb-gap-2">
                  <span style={{ fontSize: 'var(--text-lg)' }}>🏆</span>
                  <h3 className="cb-heading-4">Test History</h3>
                  <span className="cb-badge cb-badge-success cb-badge-sm">
                    {testHistory.length}
                  </span>
                </div>
              </div>
              <div className="cb-card-body">
                {testHistory.length === 0 ? (
                  <div className="cb-empty-state">
                    <div className="cb-empty-icon">📊</div>
                    <h3 className="cb-empty-title">No completed tests</h3>
                    <p className="cb-empty-description">
                      Your completed tests will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="cb-list">
                    {testHistory.map(a => {
                      const questions = a.test?.test_questions || [];
                      let calculatedScore = 0;
                      
                      questions.forEach((question, index) => {
                        const userAnswer = a.answers?.[question.id];
                        let correct = false;
                        
                        if (question.question_type === 'mcq' || question.question_type === 'multiple_choice') {
                          if (question.correct_index !== null && question.correct_index !== undefined) {
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
                      
                      const displayScore = a.earned_points !== null ? a.earned_points : (a.score || calculatedScore);
                      const totalQuestions = a.total_points !== null ? a.total_points : questions.length;
                      
                      return (
                        <div key={a.id} className="cb-list-item">
                          <div className="cb-list-item-content">
                            <div className="cb-flex cb-items-center cb-gap-3 cb-mb-2">
                              <h4 className="cb-list-item-title">{a.test?.title}</h4>
                              <span className={`cb-badge ${displayScore >= totalQuestions * 0.7 ? 'cb-badge-success' : 'cb-badge-error'} cb-badge-sm`}>
                                {displayScore}/{totalQuestions}
                              </span>
                            </div>
                            
                            <div className="cb-list-item-subtitle cb-mb-2">
                              {a.test?.subjects?.subject_name}
                            </div>

                            {a.test?.syllabus_chapters && (
                              <div className="cb-badge cb-badge-neutral cb-badge-sm">
                                📚 Chapter {a.test.syllabus_chapters.chapter_no}: {a.test.syllabus_chapters.title}
                              </div>
                            )}
                          </div>
                          
                          <div className="cb-list-item-actions">
                            <button 
                              className="cb-button cb-button-sm cb-button-secondary"
                              onClick={() => handleReviewTest(a)}
                            >
                              <span>👁️</span>
                              <span>Review</span>
                            </button>
                            {user?.role && ['admin', 'superadmin'].includes(user.role) && (
                              <button 
                                className="cb-button cb-button-sm cb-button-primary"
                                loading={reattempting}
                                onClick={() => handleReattemptTest(a)}
                              >
                                <span>🔄</span>
                                <span>Allow Reattempt</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
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
};

          {/* Modern Question Card */}
          <div className="cb-card cb-mb-6">
            <div className="cb-card-body">
              {curQ ? (
                <>
                  <div className="cb-mb-6">
                    <h2 className="cb-heading-4 cb-mb-3">{curQ.question_text}</h2>
                    <div className="cb-flex cb-gap-3 cb-items-center">
                      <span className="cb-badge cb-badge-primary cb-badge-sm">
                        {(curQ.question_type || '').replace('_', ' ')}
                      </span>
                      <span className="cb-text-caption">
                        {curQ.points || 1} point{(curQ.points || 1) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="cb-mb-8">
                    {curQ.question_type === 'multiple_choice' || curQ.question_type === 'mcq' ? (
                      <div className="cb-flex cb-flex-col cb-gap-3">
                        {(curQ.options || []).map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`cb-button ${answers[curQ.id] === opt ? 'cb-button-primary' : 'cb-button-secondary'}`}
                            onClick={() => handleAnswerChange(curQ.id, opt)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: 'var(--space-4) var(--space-6)',
                              justifyContent: 'flex-start',
                              minHeight: '56px'
                            }}
                          >
                            <span style={{ 
                              marginRight: 'var(--space-3)',
                              fontWeight: 'var(--font-bold)',
                              minWidth: '24px'
                            }}>
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            <span>{opt}</span>
                          </button>
                        ))}
                      </div>
                    ) : curQ.question_type === 'one_word' ? (
                      <div className="cb-form-group">
                        <Input 
                          value={answers[curQ.id] || ''} 
                          onChange={(e) => handleAnswerChange(curQ.id, e.target.value)} 
                          placeholder="Type your answer"
                          className="cb-input"
                          style={{ maxWidth: '480px', fontSize: 'var(--text-lg)', padding: 'var(--space-4)' }}
                        />
                      </div>
                    ) : (
                      <div className="cb-form-group">
                        <Input.TextArea 
                          rows={8} 
                          value={answers[curQ.id] || ''} 
                          onChange={(e) => handleAnswerChange(curQ.id, e.target.value)} 
                          placeholder="Type your detailed answer"
                          className="cb-input cb-textarea"
                          style={{ fontSize: 'var(--text-base)' }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="cb-flex cb-justify-between cb-items-center">
                    <button 
                      className="cb-button cb-button-secondary"
                      onClick={prevQuestion} 
                      disabled={currentQuestionIndex === 0}
                    >
                      <span>←</span>
                      <span>Previous</span>
                    </button>
                    
                    <div className="cb-flex cb-gap-3">
                      {currentQuestionIndex === questions.length - 1 ? (
                        <button 
                          className="cb-button cb-button-success cb-button-lg"
                          onClick={submitConfirm} 
                          disabled={submitting}
                        >
                          {submitting ? (
                            <>
                              <div className="cb-spinner"></div>
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>✅</span>
                              <span>Submit Test</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button 
                          className="cb-button cb-button-primary"
                          onClick={nextQuestion}
                        >
                          <span>Next</span>
                          <span>→</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="cb-empty-state">
                  <div className="cb-empty-icon">❓</div>
                  <h3 className="cb-empty-title">No Question Available</h3>
                  <p className="cb-empty-description">
                    Question data could not be loaded. Please contact your teacher.
                  </p>
                </div>
              )}
            </div>
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
                <Text type="secondary">{progress}% Complete</Text>
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: 20 }}>
            {curQ ? (
              <>
                <Title level={4}>{curQ.question_text}</Title>
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
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                              <Title level={4} style={{ margin: 0, marginRight: 12, color: '#1f1f1f' }}>
                                {t.title}
                              </Title>
                              <Tag 
                                color={typeColor(t.test_type)} 
                                style={{ 
                                  borderRadius: 6,
                                  fontWeight: 500,
                                  textTransform: 'capitalize'
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
                                    marginLeft: 8
                                  }}
                                >
                                  Reattempt Allowed
                                </Tag>
                              )}
                            </div>

                            {/* Subject and Class info */}
                            <div style={{ marginBottom: 12 }}>
                              <Text type="secondary" style={{ fontSize: 14 }}>
                                {t.subjects?.subject_name} • Grade {t.class_instances?.grade} {t.class_instances?.section}
                              </Text>
                            </div>

                            {/* Description */}
                            {t.description && (
                              <div style={{ marginBottom: 12 }}>
                                <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>
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
                                  alignItems: 'center'
                                }}>
                                  <span style={{ marginRight: 6 }}>📚</span>
                                  Chapter {t.syllabus_chapters.chapter_no}: {t.syllabus_chapters.title}
                                </Text>
                              </div>
                            )}

                            {/* Test details */}
                            <div style={{ 
                              display: 'flex', 
                              gap: 16, 
                              alignItems: 'center',
                              padding: '8px 0'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <BookOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
                                <Text type="secondary" style={{ fontSize: 13 }}>
                                  {t.test_questions?.length || 0} questions
                                </Text>
                              </div>
                              {t.time_limit_seconds && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
                                  <Text type="secondary" style={{ fontSize: 13 }}>
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
                            loading={testLoading} 
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
                              console.log('Button text for test:', { testId: t.id, testTitle: t.title, completed });
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
                        
                        console.log(`Question ${index + 1}:`, {
                          questionId: question.id,
                          questionText: question.question_text,
                          questionType: question.question_type,
                          userAnswer: userAnswer,
                          correctIndex: question.correct_index,
                          correctText: question.correct_text,
                          options: question.options
                        });
                        
                        if (question.question_type === 'mcq' || question.question_type === 'multiple_choice') {
                          if (question.correct_index !== null && question.correct_index !== undefined) {
                            // Check if user answer matches the correct option by index
                            const correctOption = question.options?.[question.correct_index];
                            correct = (userAnswer === correctOption) || (userAnswer === question.correct_index);
                            console.log(`MCQ comparison:`, {
                              userAnswer,
                              correctIndex: question.correct_index,
                              correctOption,
                              correct
                            });
                          } else if (question.correct_text) {
                            correct = String(userAnswer || '').trim().toLowerCase() === String(question.correct_text).trim().toLowerCase();
                            console.log(`MCQ text comparison:`, {
                              userAnswer,
                              correctText: question.correct_text,
                              correct
                            });
                          }
                        } else {
                          if (question.correct_text) {
                            correct = String(userAnswer || '').trim().toLowerCase() === String(question.correct_text).trim().toLowerCase();
                            console.log(`Text comparison:`, {
                              userAnswer,
                              correctText: question.correct_text,
                              correct
                            });
                          }
                        }
                        
                        if (correct) calculatedScore++;
                        console.log(`Question ${index + 1} result:`, { correct, calculatedScore });
                      });
                      
                      // Use stored values if available, otherwise calculate dynamically
                      const displayScore = a.earned_points !== null ? a.earned_points : (a.score || calculatedScore);
                      const totalQuestions = a.total_points !== null ? a.total_points : questions.length;
                      
                      console.log('Test history item:', {
                        testTitle: a.test?.title,
                        storedScore: a.score,
                        calculatedScore: calculatedScore,
                        displayScore: displayScore,
                        totalQuestions: totalQuestions,
                        answers: a.answers,
                        questions: questions.length
                      });
                      
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
                            {user?.role && ['admin', 'superadmin'].includes(user.role) && (
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
