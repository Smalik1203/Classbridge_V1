import React, { useState } from 'react';
import { Card, Button, Modal, Space, Typography, Tag, Tooltip, Progress, Divider, Row, Col, message } from 'antd';
import { 
  QuestionCircleOutlined, 
  PlayCircleOutlined, 
  TrophyOutlined,
  ClockCircleOutlined,
  UserOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';
import ResourceThumbnail from './ResourceThumbnail';
import ResourceTypeBadge from './ResourceTypeBadge';

const { Text, Title } = Typography;

const QuizResource = ({ resource, canEdit = false, onEdit, onDelete }) => {
  const { theme: antdTheme } = useTheme();
  const [quizVisible, setQuizVisible] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);

  // Parse quiz data from resource content_url or use default
  const getQuizData = () => {
    try {
      // Try to parse quiz data from the resource's content_url
      if (resource.content_url) {
        // If content_url is a JSON string, parse it
        if (resource.content_url.startsWith('{') || resource.content_url.startsWith('[')) {
          const parsed = JSON.parse(resource.content_url);
          return {
            questions: parsed.questions || [],
            timeLimit: parsed.timeLimit || 300,
            passingScore: parsed.passingScore || 60
          };
        }
        // If content_url is a URL, we could fetch it here in a real implementation
        // For now, we'll show a message to open the external quiz
        return {
          questions: [],
          timeLimit: 300,
          passingScore: 60,
          externalUrl: resource.content_url
        };
      }
      
      // Fallback to default quiz structure if no content_url
      return {
        questions: [
          {
            id: 1,
            question: "Sample Question 1",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correct: 0
          }
        ],
        timeLimit: 300,
        passingScore: 60
      };
    } catch (error) {
      return {
        questions: [],
        timeLimit: 300,
        passingScore: 60
      };
    }
  };

  const quizData = getQuizData();

  const handleStartQuiz = () => {
    // If quiz has external URL, open it in new tab
    if (quizData.externalUrl) {
      window.open(quizData.externalUrl, '_blank');
      return;
    }
    
    // If no questions available, show message
    if (!quizData.questions || quizData.questions.length === 0) {
      message.warning('No quiz questions available for this resource.');
      return;
    }
    
    setQuizVisible(true);
    setCurrentQuestion(0);
    setAnswers({});
    setQuizCompleted(false);
    setScore(0);
  };

  const handleAnswerSelect = (questionId, answerIndex) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestion < quizData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmitQuiz = () => {
    let correctAnswers = 0;
    quizData.questions.forEach(question => {
      if (answers[question.id] === question.correct) {
        correctAnswers++;
      }
    });
    
    const finalScore = Math.round((correctAnswers / quizData.questions.length) * 100);
    setScore(finalScore);
    setQuizCompleted(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const currentQuestionData = quizData.questions?.[currentQuestion];
  const progress = quizData.questions?.length ? ((currentQuestion + 1) / quizData.questions.length) * 100 : 0;

  return (
    <>
      <Card
        hoverable
        style={{ 
          height: '100%', 
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease'
        }}
        bodyStyle={{ padding: 20 }}
      >
        <Row gutter={16} align="middle">
          {/* Left: Thumbnail */}
          <Col flex="none">
            <ResourceThumbnail type="quiz" size="medium" />
          </Col>
          
          {/* Middle: Content */}
          <Col flex="auto" style={{ minWidth: 0 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {/* Title */}
              <Tooltip title={resource.title}>
                <Title 
                  level={4} 
                  style={{ 
                    margin: 0, 
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#1F2937',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {resource.title}
                </Title>
              </Tooltip>
              
              {/* Description */}
              {resource.description && (
                <Tooltip title={resource.description}>
                  <Text 
                    type="secondary" 
                    style={{ 
                      fontSize: 14,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '20px'
                    }}
                  >
                    {resource.description}
                  </Text>
                </Tooltip>
              )}
              
              {/* Metadata */}
              <Text 
                type="secondary" 
                style={{ 
                  fontSize: 12,
                  color: '#6B7280'
                }}
              >
                {resource.class_instances ? `Grade ${resource.class_instances.grade}${resource.class_instances.section ? ' - ' + resource.class_instances.section : ''}` : ''}
                {resource.class_instances ? ' • ' : ''}
                {formatDate(resource.created_at)}
                {quizData.questions.length > 0 && ` • ${quizData.questions.length} Questions • ${formatTime(quizData.timeLimit)}`}
                {quizData.externalUrl && ' • External Quiz'}
              </Text>
            </Space>
          </Col>
          
          {/* Right: Actions */}
          <Col flex="none">
            <Space direction="vertical" size={8} align="end">
              {/* Type Badge */}
              <ResourceTypeBadge type="quiz" size="small" />
              
              {/* Action Buttons */}
              <Space size={4}>
                {canEdit && (
                  <>
                    <Tooltip title="Edit">
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined />} 
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        style={{ color: '#6B7280' }}
                      />
                    </Tooltip>
                    <Tooltip title="Delete">
                      <Button 
                        type="text" 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      />
                    </Tooltip>
                  </>
                )}
                <Button 
                  type="primary" 
                  size="small"
                  icon={<QuestionCircleOutlined />}
                  onClick={handleStartQuiz}
                  style={{ 
                    fontWeight: 500,
                    minWidth: 80
                  }}
                >
                  Attempt
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Quiz Modal */}
      <Modal
        title={
          <Space>
            <QuestionCircleOutlined />
            {resource.title}
          </Space>
        }
        open={quizVisible}
        onCancel={() => setQuizVisible(false)}
        footer={null}
        width={600}
        style={{ top: 20 }}
        bodyStyle={{ padding: antdTheme.token.paddingLG }}
      >
        {!quizCompleted ? (
          <div>
            {quizData.questions?.length > 0 ? (
              <>
                {/* Progress Bar */}
                <div style={{ marginBottom: antdTheme.token.marginLG }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: antdTheme.token.marginXS 
                  }}>
                    <Text strong>Question {currentQuestion + 1} of {quizData.questions.length}</Text>
                    <Text type="secondary">
                      <ClockCircleOutlined /> {formatTime(quizData.timeLimit)}
                    </Text>
                  </div>
                  <Progress 
                    percent={progress} 
                    showInfo={false}
                    strokeColor={antdTheme.token.colorPrimary}
                  />
                </div>

                {/* Question */}
                <div style={{ marginBottom: antdTheme.token.marginLG }}>
                  <Title level={4} style={{ marginBottom: antdTheme.token.marginMD }}>
                    {currentQuestionData?.question}
                  </Title>
                  
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {currentQuestionData?.options?.map((option, index) => (
                      <Button
                        key={index}
                        type={answers[currentQuestionData.id] === index ? 'primary' : 'default'}
                        onClick={() => handleAnswerSelect(currentQuestionData.id, index)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          height: 'auto',
                          padding: antdTheme.token.paddingMD,
                          background: answers[currentQuestionData.id] === index 
                            ? antdTheme.token.colorPrimary 
                            : antdTheme.token.colorBgContainer,
                          borderColor: answers[currentQuestionData.id] === index 
                            ? antdTheme.token.colorPrimary 
                            : antdTheme.token.colorBorder
                        }}
                      >
                        <Space>
                          <span style={{ 
                            fontWeight: 600, 
                            color: answers[currentQuestionData.id] === index 
                              ? 'white' 
                              : antdTheme.token.colorText 
                          }}>
                            {String.fromCharCode(65 + index)}.
                          </span>
                          <span style={{ 
                            color: answers[currentQuestionData.id] === index 
                              ? 'white' 
                              : antdTheme.token.colorText 
                          }}>
                            {option}
                          </span>
                        </Space>
                      </Button>
                    ))}
                  </Space>
                </div>

                {/* Navigation Buttons */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  marginTop: antdTheme.token.marginLG
                }}>
                  <Button 
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestion === 0}
                  >
                    Previous
                  </Button>
                  <Button 
                    type="primary"
                    onClick={handleNextQuestion}
                    disabled={answers[currentQuestionData?.id] === undefined}
                  >
                    {currentQuestion === quizData.questions.length - 1 ? 'Submit Quiz' : 'Next'}
                  </Button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <QuestionCircleOutlined style={{ fontSize: '48px', color: antdTheme.token.colorTextSecondary, marginBottom: '16px' }} />
                <Title level={4} style={{ marginBottom: '16px' }}>No Quiz Questions Available</Title>
                <Text type="secondary" style={{ marginBottom: '24px', display: 'block' }}>
                  {quizData.externalUrl 
                    ? 'This quiz is hosted externally. Click the button below to open it in a new tab.'
                    : 'This resource does not contain quiz questions yet.'
                  }
                </Text>
                {quizData.externalUrl && (
                  <Button 
                    type="primary" 
                    size="large"
                    onClick={() => window.open(quizData.externalUrl, '_blank')}
                  >
                    Open External Quiz
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Quiz Results */
          <div style={{ textAlign: 'center' }}>
            <TrophyOutlined 
              style={{ 
                fontSize: '64px', 
                color: score >= quizData.passingScore 
                  ? antdTheme.token.colorSuccess 
                  : antdTheme.token.colorWarning,
                marginBottom: antdTheme.token.marginLG
              }} 
            />
            
            <Title level={2} style={{ marginBottom: antdTheme.token.marginMD }}>
              Quiz Completed!
            </Title>
            
            <div style={{ marginBottom: antdTheme.token.marginLG }}>
              <Text style={{ fontSize: '48px', fontWeight: 'bold', color: antdTheme.token.colorPrimary }}>
                {score}%
              </Text>
            </div>
            
            <div style={{ marginBottom: antdTheme.token.marginLG }}>
              <Text style={{ 
                fontSize: antdTheme.token.fontSizeLG,
                color: score >= quizData.passingScore 
                  ? antdTheme.token.colorSuccess 
                  : antdTheme.token.colorError
              }}>
                {score >= quizData.passingScore ? 'Congratulations! You passed!' : 'You need to score at least 60% to pass.'}
              </Text>
            </div>
            
            <Divider />
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-around',
              marginBottom: antdTheme.token.marginLG
            }}>
              <div>
                <Text type="secondary">Correct Answers</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: antdTheme.token.colorSuccess }}>
                  {Math.round((score / 100) * quizData.questions.length)}/{quizData.questions.length}
                </div>
              </div>
              <div>
                <Text type="secondary">Time Taken</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: antdTheme.token.colorText }}>
                  {formatTime(quizData.timeLimit)}
                </div>
              </div>
            </div>
            
            <Button 
              type="primary" 
              size="large"
              onClick={() => setQuizVisible(false)}
            >
              Close Quiz
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
};

export default QuizResource;
