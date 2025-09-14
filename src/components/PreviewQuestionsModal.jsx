import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Typography,
  Tag,
  Space,
  Spin,
  Empty,
  Card,
  Statistic,
  Row,
  Col
} from 'antd';
import {
  QuestionCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BookOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { getQuestionsForTest } from '../services/questionService';

const { Title, Text } = Typography;

const PreviewQuestionsModal = ({ visible, test, onClose }) => {
  const { theme: antdTheme } = useTheme();
  
  // State management
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load questions when modal opens
  useEffect(() => {
    if (visible && test) {
      loadQuestions();
    }
  }, [visible, test]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const questionsData = await getQuestionsForTest(test.id);
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
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

  // Statistics
  const totalQuestions = questions.length;
  const questionTypesCount = questions.reduce((acc, question) => {
    acc[question.question_type] = (acc[question.question_type] || 0) + 1;
    return acc;
  }, {});

  // Table columns
  const columns = [
    {
      title: 'Question',
      dataIndex: 'question_text',
      key: 'question_text',
      render: (text) => (
        <Text style={{ fontSize: '14px' }}>
          {text.length > 80 ? `${text.substring(0, 80)}...` : text}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'question_type',
      key: 'question_type',
      render: (type) => (
        <Tag color={getQuestionTypeColor(type)}>
          {getQuestionTypeLabel(type)}
        </Tag>
      ),
    },
    {
      title: 'Options/Answer',
      key: 'options_answer',
      render: (_, record) => {
        if (record.question_type === 'mcq') {
          return (
            <div>
              <Text style={{ fontSize: '12px' }}>
                {record.options?.length || 0} options
              </Text>
              {record.options && record.options.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  {record.options.map((option, index) => (
                    <div 
                      key={index}
                      style={{ 
                        fontSize: '11px',
                        color: index === record.correct_index ? antdTheme.token.colorSuccess : '#666',
                        fontWeight: index === record.correct_index ? 500 : 'normal'
                      }}
                    >
                      {index === record.correct_index && <CheckCircleOutlined style={{ marginRight: '4px' }} />}
                      {index + 1}. {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        } else if (record.correct_text) {
          return (
            <Text style={{ fontSize: '12px', color: '#666' }}>
              {record.correct_text.length > 50 
                ? `${record.correct_text.substring(0, 50)}...` 
                : record.correct_text
              }
            </Text>
          );
        }
        return <Text type="secondary" style={{ fontSize: '12px' }}>—</Text>;
      },
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <EyeOutlined style={{ marginRight: '8px' }} />
          Preview Questions - {test?.title}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1000}
      style={{ top: 20 }}
      footer={null}
    >
      <div style={{ marginTop: '20px' }}>
        {/* Test Info */}
        <Card style={{ marginBottom: '20px' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="Total Questions"
                value={totalQuestions}
                prefix={<QuestionCircleOutlined />}
                valueStyle={{ color: antdTheme.token.colorPrimary }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="Multiple Choice"
                value={questionTypesCount.mcq || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="One Word"
                value={questionTypesCount.one_word || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="Long Answer"
                value={questionTypesCount.long_answer || 0}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Col>
          </Row>
        </Card>

        {/* Questions Table */}
        <Card title="Questions List">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
            </div>
          ) : questions.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No questions found"
              style={{ padding: '40px 0' }}
            />
          ) : (
            <Table
              columns={columns}
              dataSource={questions.map((q, index) => ({ ...q, key: q.id || index }))}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} questions`,
              }}
              scroll={{ x: 600 }}
              size="small"
            />
          )}
        </Card>
      </div>
    </Modal>
  );
};

export default PreviewQuestionsModal;
