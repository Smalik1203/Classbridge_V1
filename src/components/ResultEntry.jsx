// src/components/ResultEntry.jsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Alert,
  Popconfirm,
  message,
  Spin,
  Empty,
  Divider,
  Tabs,
  Badge,
  Progress
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  BookOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { 
  getExams, 
  getExamResults, 
  createResult, 
  updateResult, 
  deleteResult,
  toggleResultPublish,
  getGradeColor,
  getRankSuffix
} from '../services/resultsService';
import { getStudents } from '../services/studentService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const ResultEntry = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('results');

  const schoolCode = user?.user_metadata?.school_code;

  useEffect(() => {
    if (schoolCode) {
      fetchExams();
    }
  }, [schoolCode]);



  const fetchExams = async () => {
    setLoading(true);
    try {
      const data = await getExams(schoolCode, { isActive: true });
      setExams(data);
    } catch (error) {
      message.error('Failed to fetch exams');
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    if (!selectedExam) return;
    
    setResultsLoading(true);
    try {
      const data = await getExamResults(selectedExam.id);
      setResults(data);
    } catch (error) {
      message.error('Failed to fetch results');
      console.error('Error fetching results:', error);
    } finally {
      setResultsLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!selectedExam) return;
    
    try {
      const data = await getStudents(schoolCode, { 
        classInstanceId: selectedExam.class_instance_id 
      });
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleCreateResult = () => {
    setEditingResult(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditResult = (result) => {
    setEditingResult(result);
    form.setFieldsValue({
      student_id: result.student_id,
      total_obtained_marks: result.total_obtained_marks,
      total_max_marks: result.total_max_marks,
      remarks: result.remarks,
      is_published: result.is_published,
      subject_results: result.subject_results?.map(sr => ({
        exam_subject_id: sr.exam_subject_id,
        obtained_marks: sr.obtained_marks,
        max_marks: sr.max_marks,
        remarks: sr.remarks
      })) || []
    });
    setModalVisible(true);
  };

  const handleDeleteResult = async (resultId) => {
    try {
      await deleteResult(resultId);
      message.success('Result deleted successfully');
      fetchResults();
    } catch (error) {
      message.error('Failed to delete result');
      console.error('Error deleting result:', error);
    }
  };

  const handleTogglePublish = async (resultId, isPublished) => {
    try {
      await toggleResultPublish(resultId, isPublished);
      message.success(`Result ${isPublished ? 'published' : 'unpublished'} successfully`);
      fetchResults();
    } catch (error) {
      message.error(`Failed to ${isPublished ? 'publish' : 'unpublish'} result`);
      console.error('Error toggling result publish:', error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const resultData = {
        ...values,
        exam_id: selectedExam.id,
        created_by: user.id
      };

      if (editingResult) {
        await updateResult(editingResult.id, resultData);
        message.success('Result updated successfully');
      } else {
        await createResult(resultData);
        message.success('Result created successfully');
      }

      setModalVisible(false);
      fetchResults();
    } catch (error) {
      message.error(editingResult ? 'Failed to update result' : 'Failed to create result');
      console.error('Error saving result:', error);
    }
  };

  const getGradeColor = (grade) => {
    const colors = {
      'A+': 'green',
      'A': 'green',
      'B+': 'blue',
      'B': 'blue',
      'C+': 'orange',
      'C': 'orange',
      'D': 'red',
      'F': 'red'
    };
    return colors[grade] || 'default';
  };

  const getRankSuffix = (rank) => {
    if (rank === 1) return 'st';
    if (rank === 2) return 'nd';
    if (rank === 3) return 'rd';
    return 'th';
  };

  const resultColumns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <div>
                          <Text strong>{record.student?.full_name}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {record.student?.student_code} • {record.student?.class_instance?.grade} - {record.student?.class_instance?.section}
                </Text>
        </div>
      )
    },
    {
      title: 'Marks',
      key: 'marks',
      render: (_, record) => (
        <div>
          <Text strong style={{ fontSize: '16px' }}>
            {record.total_obtained_marks}/{record.total_max_marks}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.percentage}%
          </Text>
        </div>
      )
    },
    {
      title: 'Grade',
      key: 'grade',
      render: (_, record) => (
        <Tag color={getGradeColor(record.overall_grade)} style={{ fontSize: '14px', padding: '4px 8px' }}>
          {record.overall_grade}
        </Tag>
      )
    },
    {
      title: 'Rank',
      key: 'rank',
      render: (_, record) => (
        <div style={{ textAlign: 'center' }}>
          <Text strong style={{ fontSize: '16px' }}>
            {record.class_rank}{getRankSuffix(record.class_rank)}
          </Text>
          <br />
          <TrophyOutlined style={{ color: record.class_rank <= 3 ? '#faad14' : '#d9d9d9' }} />
        </div>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Badge
          status={record.is_published ? 'success' : 'default'}
          text={record.is_published ? 'Published' : 'Draft'}
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => console.log('View result:', record.id)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditResult(record)}
          />
          <Button
            type="text"
            icon={record.is_published ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
            onClick={() => handleTogglePublish(record.id, !record.is_published)}
            title={record.is_published ? 'Unpublish' : 'Publish'}
          />
          <Popconfirm
            title="Delete Result"
            description="Are you sure you want to delete this result? This action cannot be undone."
            onConfirm={() => handleDeleteResult(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okType="danger"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const renderResults = () => {
    if (!selectedExam) {
      return (
        <Card>
          <Empty
            description="Please select an exam to view results"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      );
    }

    if (results.length === 0 && !resultsLoading) {
      return (
        <Card>
          <Empty
            description="Click 'Load Results' to fetch exam results and student data"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      );
    }

    const publishedResults = results.filter(r => r.is_published);
    const draftResults = results.filter(r => !r.is_published);
    const totalStudents = students.length;
    const resultsEntered = results.length;
    const resultsPublished = publishedResults.length;

    return (
      <div>
        {/* Statistics */}
        <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <UserOutlined style={{ fontSize: '24px', color: antdTheme.token.colorPrimary }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong style={{ fontSize: '18px' }}>
                    {totalStudents}
                  </Text>
                  <br />
                  <Text type="secondary">Total Students</Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <BookOutlined style={{ fontSize: '24px', color: antdTheme.token.colorSuccess }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong style={{ fontSize: '18px' }}>
                    {resultsEntered}
                  </Text>
                  <br />
                  <Text type="secondary">Results Entered</Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: '24px', color: antdTheme.token.colorWarning }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong style={{ fontSize: '18px' }}>
                    {resultsPublished}
                  </Text>
                  <br />
                  <Text type="secondary">Published</Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <TrophyOutlined style={{ fontSize: '24px', color: antdTheme.token.colorInfo }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong style={{ fontSize: '18px' }}>
                    {totalStudents > 0 ? Math.round((resultsEntered / totalStudents) * 100) : 0}%
                  </Text>
                  <br />
                  <Text type="secondary">Completion</Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Progress Bar */}
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px' }}>
            <Text strong>Progress: {resultsEntered}/{totalStudents} students</Text>
          </div>
          <Progress
            percent={totalStudents > 0 ? Math.round((resultsEntered / totalStudents) * 100) : 0}
            status={resultsEntered === totalStudents ? 'success' : 'active'}
          />
        </Card>

        {/* Results Table */}
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={5} style={{ margin: 0 }}>
                  Results for {selectedExam.exam_name}
                </Title>
              </Col>
              <Col>
                <Space>
                  <Button icon={<SaveOutlined />}>
                    Export Results
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateResult}
                  >
                    Add Result
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>

          <Table
            columns={resultColumns}
            dataSource={results}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} results`
            }}
            locale={{
              emptyText: (
                <Empty
                  description="No results found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </Card>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
        <Col>
          <Title level={4} style={{ margin: 0, color: antdTheme.token.colorText }}>
            Result Entry
          </Title>
          <Text type="secondary" style={{ color: antdTheme.token.colorTextSecondary }}>
            Enter and manage student results for exams
          </Text>
        </Col>
      </Row>

      {/* Exam Selection */}
      <Card style={{ marginBottom: '16px' }}>
        <Form layout="inline">
          <Form.Item label="Select Exam">
            <Select
              style={{ width: 300 }}
              placeholder="Choose an exam"
              value={selectedExam?.id}
              onChange={(examId) => {
                const exam = exams.find(e => e.id === examId);
                setSelectedExam(exam);
                setResults([]);
                setStudents([]);
              }}
              allowClear={true}
            >
              {exams.map(exam => (
                <Option key={exam.id} value={exam.id}>
                  {exam.exam_name} - {exam.class_instance?.grade} {exam.class_instance?.section}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              onClick={() => {
                if (selectedExam) {
                  fetchResults();
                  fetchStudents();
                }
              }}
              disabled={!selectedExam}
              loading={resultsLoading}
            >
              {resultsLoading ? 'Loading...' : 'Load Results'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Content */}
      {selectedExam && (
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <Space>
                <BookOutlined />
                Results
              </Space>
            }
            key="results"
          >
            {renderResults()}
          </TabPane>
        </Tabs>
      )}

      {/* Create/Edit Result Modal */}
      <Modal
        title={editingResult ? 'Edit Result' : 'Add New Result'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            is_published: false,
            subject_results: []
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="student_id"
                label="Student"
                rules={[{ required: true, message: 'Please select student' }]}
              >
                <Select placeholder="Select student">
                  {students.map(student => (
                    <Option key={student.id} value={student.id}>
                      {student.full_name} ({student.student_code})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_published"
                label="Status"
              >
                <Select>
                  <Option value={false}>Draft</Option>
                  <Option value={true}>Published</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="total_obtained_marks"
                label="Total Obtained Marks"
                rules={[{ required: true, message: 'Please enter obtained marks' }]}
              >
                <InputNumber
                  min={0}
                  max={selectedExam?.total_marks || 1000}
                  style={{ width: '100%' }}
                  placeholder="Enter marks"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="total_max_marks"
                label="Total Max Marks"
                rules={[{ required: true, message: 'Please enter max marks' }]}
              >
                <InputNumber
                  min={1}
                  max={1000}
                  style={{ width: '100%' }}
                  placeholder="Enter max marks"
                  defaultValue={selectedExam?.total_marks}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="remarks"
            label="Remarks"
          >
            <TextArea
              rows={3}
              placeholder="Enter remarks for the student..."
            />
          </Form.Item>

          {selectedExam?.exam_subjects && selectedExam.exam_subjects.length > 0 && (
            <>
              <Divider>Subject-wise Marks</Divider>
              <Form.List name="subject_results">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Row gutter={16} key={key} style={{ marginBottom: '16px' }}>
                        <Col span={8}>
                          <Form.Item
                            {...restField}
                            name={[name, 'exam_subject_id']}
                            label="Subject"
                            rules={[{ required: true, message: 'Please select subject' }]}
                          >
                            <Select placeholder="Select subject">
                              {selectedExam.exam_subjects.map(es => (
                                <Option key={es.id} value={es.id}>
                                  {es.subject?.subject_name} (Max: {es.max_marks})
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, 'obtained_marks']}
                            label="Obtained Marks"
                            rules={[{ required: true, message: 'Required' }]}
                          >
                            <InputNumber
                              min={0}
                              max={1000}
                              style={{ width: '100%' }}
                              placeholder="Marks"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, 'max_marks']}
                            label="Max Marks"
                            rules={[{ required: true, message: 'Required' }]}
                          >
                            <InputNumber
                              min={1}
                              max={1000}
                              style={{ width: '100%' }}
                              placeholder="Max"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={3}>
                          <Form.Item
                            {...restField}
                            name={[name, 'remarks']}
                            label="Remarks"
                          >
                            <Input placeholder="Remarks" />
                          </Form.Item>
                        </Col>
                        <Col span={1}>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                            style={{ marginTop: '32px' }}
                          />
                        </Col>
                      </Row>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        Add Subject Result
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </>
          )}

          <Form.Item style={{ marginTop: '24px', textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingResult ? 'Update Result' : 'Add Result'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ResultEntry;
