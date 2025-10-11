import React from 'react';
import {
  Modal,
  Card,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Divider,
  Button,
  Radio,
  Input,
  Alert,
  Progress
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  BookOutlined
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const TestReviewModal = ({ visible, testAttempt, onClose }) => {
  const { theme: antdTheme } = useTheme();

  if (!testAttempt || !testAttempt.test) {
    return null;
  }

  const { test, answers, score, earned_points, total_points, completed_at } = testAttempt;
  const questions = test.test_questions || [];

  const getQuestionTypeColor = (type) => {
    const colors = {
      mcq: 'blue',
      multiple_choice: 'blue',
      one_word: 'green',
      long_answer: 'orange'
    };
    return colors[type] || 'default';
  };

  const isAnswerCorrect = (question, answer) => {
    if (!answer) {
      return false;
    }
    
    let result = false;
    
    if (question.question_type === 'mcq' || question.question_type === 'multiple_choice') {
      // For MCQ, check if answer matches correct option
      if (question.correct_index !== null && question.correct_index !== undefined) {
        const correctOption = question.options?.[question.correct_index];
        result = answer === correctOption;
      } else {
        result = answer === question.correct_text;
      }
    } else {
      // For text answers, compare with correct text
      result = answer.toLowerCase().trim() === (question.correct_text || '').toLowerCase().trim();
    }
    
    return result;
  };
  
  // Calculate score dynamically
  let calculatedScore = 0;
  let calculatedTotal = questions.length;
  
  questions.forEach((question, index) => {
    const userAnswer = answers?.[question.id];
    const isCorrect = isAnswerCorrect(question, userAnswer);
    
    
    if (isCorrect) {
      calculatedScore++;
    }
  });
  
  // Use stored values if available, otherwise calculate dynamically
  const displayScore = earned_points !== null ? earned_points : (score !== null ? score : calculatedScore);
  const displayTotal = total_points !== null ? total_points : calculatedTotal;

  const getCorrectAnswer = (question) => {
    if (question.question_type === 'mcq' || question.question_type === 'multiple_choice') {
      if (question.correct_index !== null && question.correct_index !== undefined) {
        return question.options?.[question.correct_index] || 'Not specified';
      }
      return question.correct_text || 'Not specified';
    }
    return question.correct_text || 'Not specified';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <EyeOutlined />
          Test Review: {test.title}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
    >
      <div style={{ marginTop: '20px' }}>
        {/* Test Summary */}
        <Card style={{ marginBottom: '20px' }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <Title level={2} style={{ margin: 0, color: antdTheme.token.colorPrimary }}>
                  {displayScore}/{displayTotal}
                </Title>
                <Text type="secondary">Score</Text>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <Title level={3} style={{ margin: 0 }}>
                  {Math.round((displayScore / Math.max(displayTotal, 1)) * 100)}%
                </Title>
                <Text type="secondary">Percentage</Text>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <Title level={3} style={{ margin: 0 }}>
                  {formatDate(completed_at)}
                </Title>
                <Text type="secondary">Completed</Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Questions Review */}
        <div style={{ marginBottom: '20px' }}>
          <Title level={4}>Question Review</Title>
          <Text type="secondary">
            Review your answers and see the correct answers for each question.
          </Text>
        </div>

        {questions.map((question, index) => {
          const userAnswer = answers?.[question.id];
          const isCorrect = isAnswerCorrect(question, userAnswer);
          const correctAnswer = getCorrectAnswer(question);

          return (
            <Card
              key={question.id}
              style={{ 
                marginBottom: '16px',
                border: isCorrect ? `2px solid ${antdTheme.token.colorSuccess}` : `2px solid ${antdTheme.token.colorError}`
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <Title level={5} style={{ margin: 0, flex: 1 }}>
                    Question {index + 1}: {question.question_text}
                  </Title>
                  <Space>
                    <Tag color={getQuestionTypeColor(question.question_type)}>
                      {question.question_type.replace('_', ' ')}
                    </Tag>
                    <Tag color={isCorrect ? 'green' : 'red'}>
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </Tag>
                  </Space>
                </div>
              </div>

              {/* Your Answer */}
              <div style={{ marginBottom: '12px' }}>
                <Text strong style={{ color: isCorrect ? antdTheme.token.colorSuccess : antdTheme.token.colorError }}>
                  Your Answer:
                </Text>
                <div style={{ marginTop: '4px', padding: '8px', background: antdTheme.token.colorBgContainer, borderRadius: '4px', border: `1px solid ${antdTheme.token.colorBorder}` }}>
                  {userAnswer ? (
                    <Text>{userAnswer}</Text>
                  ) : (
                    <Text type="secondary" italic>No answer provided</Text>
                  )}
                </div>
              </div>

              {/* Correct Answer */}
              <div style={{ marginBottom: '12px' }}>
                <Text strong style={{ color: antdTheme.token.colorSuccess }}>
                  Correct Answer:
                </Text>
                <div style={{ marginTop: '4px', padding: '8px', background: antdTheme.token.colorSuccessBg, borderRadius: '4px', border: `1px solid ${antdTheme.token.colorSuccessBorder}` }}>
                  <Text>{correctAnswer}</Text>
                </div>
              </div>

              {/* Question Options (for MCQ) */}
              {(question.question_type === 'mcq' || question.question_type === 'multiple_choice') && question.options && (
                <div>
                  <Text strong>Options:</Text>
                  <div style={{ marginTop: '8px' }}>
                    {question.options.map((option, optionIndex) => {
                      const isSelected = userAnswer === option;
                      const isCorrectOption = option === correctAnswer;
                      
                      return (
                        <div
                          key={optionIndex}
                          style={{
                            padding: '8px',
                            margin: '4px 0',
                            borderRadius: '4px',
                            background: isCorrectOption 
                              ? '#f6ffed' 
                              : isSelected 
                                ? '#fff2e8' 
                                : '#f5f5f5',
                            border: isCorrectOption 
                              ? '1px solid #b7eb8f' 
                              : isSelected 
                                ? '1px solid #ffd591' 
                                : '1px solid #d9d9d9'
                          }}
                        >
                          <Space>
                            {isCorrectOption && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            {isSelected && !isCorrectOption && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                            <Text 
                              style={{ 
                                color: isCorrectOption ? '#52c41a' : isSelected ? '#fa8c16' : undefined 
                              }}
                            >
                              {option}
                            </Text>
                          </Space>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {/* Summary */}
        <Card>
          <div style={{ textAlign: 'center' }}>
            <Title level={3}>
              Test Summary
            </Title>
            <Progress
              type="circle"
              percent={Math.round((displayScore / Math.max(displayTotal, 1)) * 100)}
              format={(percent) => `${displayScore}/${displayTotal}`}
              strokeColor={antdTheme.token.colorPrimary}
            />
            <div style={{ marginTop: '16px' }}>
              <Text>
                You answered {displayScore} out of {displayTotal} questions correctly.
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default TestReviewModal;
