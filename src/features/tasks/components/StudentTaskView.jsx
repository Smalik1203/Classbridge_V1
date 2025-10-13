import React, { useState, useEffect } from 'react';
import { 
  Card, 
  List, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Empty, 
  Badge,
  Progress,
  Statistic,
  Row,
  Col,
  Checkbox,
  Modal,
  Input,
  Upload,
  message,
  Divider
} from 'antd';
import { 
  BookOutlined, 
  CalendarOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileOutlined,
  UploadOutlined,
  SendOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useAuth } from '@/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { TaskService, TaskSubmissionService } from '../services/taskService';
import AttachmentPreview from './AttachmentPreview';
import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

// Shared priority colors
const PRIORITY_COLORS = {
  low: 'green',
  medium: 'orange',
  high: 'red',
  urgent: 'red'
};

export default function StudentTaskView() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(false);
  const [markingComplete, setMarkingComplete] = useState({});
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0
  });
  const [studentId, setStudentId] = useState(null);

  // Submission modal state
  const [submissionModalVisible, setSubmissionModalVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch student ID from database
  useEffect(() => {
    const fetchStudentId = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
        
        if (error) throw error;
        setStudentId(data?.id);
      } catch (error) {
        console.error('Failed to fetch student ID:', error);
        message.error('Failed to load student information');
      }
    };
    
    fetchStudentId();
  }, [user?.id]);

  // Fetch student's tasks
  const fetchTasks = async () => {
    if (!user?.id || !studentId) return;
    
    setLoading(true);
    try {
      const data = await TaskService.getTasksForStudent(user.id);
      setTasks(data);
      
      // Fetch completion status for all tasks
      const completionPromises = data.map(task => 
        TaskSubmissionService.getTaskCompletion(task.id, user.id)
      );
      const completionResults = await Promise.all(completionPromises);
      
      // Create completion map
      const completionMap = {};
      data.forEach((task, index) => {
        completionMap[task.id] = completionResults[index];
      });
      setCompletions(completionMap);
      
      // Calculate statistics
      const today = dayjs();
      const completed = completionResults.filter(c => c?.status === 'completed').length;
      const overdue = data.filter((task, index) => 
        !completionResults[index] && dayjs(task.due_date).isBefore(today, 'day')
      ).length;
      
      setStats({
        total: data.length,
        completed,
        pending: data.length - completed,
        overdue
      });
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchTasks();
    }
  }, [user?.id, studentId]);

  // Handle mark complete/incomplete
  const handleToggleComplete = async (task, isCompleted) => {
    setMarkingComplete(prev => ({ ...prev, [task.id]: true }));
    try {
      if (isCompleted) {
        await TaskSubmissionService.markTaskIncomplete(task.id, user.id);
      } else {
        await TaskSubmissionService.markTaskComplete(task.id, user.id);
      }
      await fetchTasks(); // Refresh to get updated completion status
    } catch (error) {
      console.error('Failed to toggle completion:', error);
    } finally {
      setMarkingComplete(prev => ({ ...prev, [task.id]: false }));
    }
  };

  // Check if task is overdue
  const isOverdue = (dueDate) => {
    return dayjs(dueDate).isBefore(dayjs(), 'day');
  };

  // Check if task is due today
  const isDueToday = (dueDate) => {
    return dayjs(dueDate).isSame(dayjs(), 'day');
  };

  // Get due date status
  const getDueDateStatus = (dueDate) => {
    if (isOverdue(dueDate)) {
      return { status: 'overdue', color: 'red', text: 'Overdue' };
    } else if (isDueToday(dueDate)) {
      return { status: 'today', color: 'orange', text: 'Due Today' };
    } else if (dayjs(dueDate).isBefore(dayjs().add(3, 'day'))) {
      return { status: 'soon', color: 'yellow', text: 'Due Soon' };
    }
    return { status: 'normal', color: 'green', text: 'On Time' };
  };

  // Handle attachment preview
  const handlePreviewAttachment = (attachment) => {
    setPreviewAttachment(attachment);
    setPreviewVisible(true);
  };

  // Open submission modal
  const openSubmissionModal = (task) => {
    setCurrentTask(task);
    setSubmissionNotes('');
    setSubmissionFiles([]);
    setSubmissionModalVisible(true);
  };

  // Handle file upload
  const handleFileChange = ({ fileList }) => {
    setSubmissionFiles(fileList);
  };

  // Submit task with files
  const handleSubmitTask = async () => {
    if (!currentTask || !studentId) {
      message.error('Student information not loaded. Please refresh the page.');
      return;
    }

    setSubmitting(true);
    try {
      // Upload files if any
      const uploadedFiles = [];
      for (const file of submissionFiles) {
        if (file.originFileObj) {
          const uploadedUrl = await TaskService.uploadAttachment(
            file.originFileObj,
            studentId,
            currentTask.id
          );
          uploadedFiles.push({
            name: file.name,
            url: uploadedUrl,
            size: file.size,
            type: file.type
          });
        }
      }

      // Submit the task - using correct field names from database schema
      await TaskSubmissionService.submitTask({
        task_id: currentTask.id,
        student_id: studentId, // Use actual student table ID, not auth user ID
        submission_text: submissionNotes, // Correct field name
        attachments: uploadedFiles,
        submitted_at: new Date().toISOString(),
        status: 'submitted'
      });

      message.success('Task submitted successfully!');
      setSubmissionModalVisible(false);
      setSubmissionNotes('');
      setSubmissionFiles([]);
      setCurrentTask(null);
      await fetchTasks(); // Refresh tasks
    } catch (error) {
      console.error('Failed to submit task:', error);
      message.error(`Failed to submit task: ${error.message || 'Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const completionPercentage = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  return (
    <div style={{ padding: '20px 24px', background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Compact Header with Inline Stats */}
        <Card 
          style={{ 
            marginBottom: 16, 
            borderRadius: 12,
            border: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <div style={{ marginBottom: stats.total > 0 ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
              <Space align="center" size={12}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                }}>
                  <BookOutlined style={{ fontSize: 20, color: 'white' }} />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
                    My Tasks
                  </Title>
                  <Text type="secondary" style={{ fontSize: '0.875rem' }}>
                    Track and complete your assignments
                  </Text>
                </div>
              </Space>

              {/* Inline Pill Stats */}
              {stats.total > 0 && (
                <Space size={8} wrap>
                  <Tag color="blue" style={{ fontSize: '0.875rem', padding: '4px 12px', margin: 0 }}>
                    📝 Total: {stats.total}
                  </Tag>
                  <Tag color="success" style={{ fontSize: '0.875rem', padding: '4px 12px', margin: 0 }}>
                    ✅ Done: {stats.completed}
                  </Tag>
                  <Tag color="warning" style={{ fontSize: '0.875rem', padding: '4px 12px', margin: 0 }}>
                    🕓 Pending: {stats.pending}
                  </Tag>
                  {stats.overdue > 0 && (
                    <Tag color="error" style={{ fontSize: '0.875rem', padding: '4px 12px', margin: 0 }}>
                      ⚠️ Overdue: {stats.overdue}
                    </Tag>
                  )}
                </Space>
              )}
            </div>
          </div>

          {/* Inline Compact Progress */}
          {stats.total > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: '0.875rem', fontWeight: 500, color: '#595959' }}>
                  Progress: {completionPercentage}% ({stats.completed}/{stats.total} tasks)
                </Text>
                {completionPercentage === 100 && (
                  <Text style={{ fontSize: '0.875rem', color: '#52c41a', fontWeight: 500 }}>
                    🎉 All Done!
                  </Text>
                )}
              </div>
              <Progress 
                percent={completionPercentage} 
                status={completionPercentage === 100 ? 'success' : 'active'}
                strokeColor={
                  completionPercentage < 50 ? '#f5222d' : 
                  completionPercentage < 80 ? '#faad14' : 
                  '#52c41a'
                }
                showInfo={false}
                strokeWidth={6}
              />
            </div>
          )}
        </Card>

      {/* Tasks List - Compact Modern Cards */}
      {tasks.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40, borderRadius: 12 }}>
          <Empty
            image={<BookOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description={
              <Text type="secondary" style={{ fontSize: '0.95rem' }}>
                No tasks assigned yet. Check back later!
              </Text>
            }
          />
        </Card>
      ) : (
        <List
          loading={loading}
          dataSource={tasks}
          renderItem={(task) => {
            const dueStatus = getDueDateStatus(task.due_date);
            const isCompleted = completions[task.id]?.status === 'completed';
            const isMarking = markingComplete[task.id];

            return (
              <List.Item style={{ border: 'none', padding: '0 0 12px 0' }}>
                <Card
                  hoverable
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    background: isCompleted ? '#f6ffed' : '#ffffff',
                    border: isCompleted ? '2px solid #52c41a' : '1px solid #e8e8e8',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                    opacity: isCompleted ? 0.9 : 1
                  }}
                  bodyStyle={{ padding: '14px 18px' }}
                >
                  {/* Task Header: Title + Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                    <Space align="start" size={10} style={{ flex: 1 }}>
                      <Checkbox
                        checked={isCompleted}
                        onChange={() => handleToggleComplete(task, isCompleted)}
                        disabled={isMarking}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <Text
                          strong
                          delete={isCompleted}
                          style={{ 
                            fontSize: '1rem', 
                            color: isCompleted ? '#52c41a' : '#262626',
                            display: 'block',
                            lineHeight: 1.4
                          }}
                        >
                          {task.title}
                        </Text>
                      </div>
                    </Space>
                    
                    {/* Due Status - Right Side */}
                    <Tag 
                      color={dueStatus.color} 
                      style={{ 
                        fontSize: '0.75rem', 
                        padding: '2px 10px',
                        margin: 0,
                        fontWeight: 500
                      }}
                    >
                      {dueStatus.text}
                    </Tag>
                  </div>

                  {/* Inline Metadata - Compact Single Line */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px 16px', 
                    marginBottom: 12,
                    fontSize: '0.85rem'
                  }}>
                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                      📅 Assigned: {dayjs(task.assigned_date).format('MMM DD')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                      ⏰ Due: {dayjs(task.due_date).format('MMM DD, YYYY')}
                    </Text>
                    {task.subjects?.subject_name && (
                      <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                        📘 {task.subjects.subject_name}
                      </Text>
                    )}
                    <Tag 
                      color={PRIORITY_COLORS[task.priority]} 
                      style={{ 
                        fontSize: '0.75rem', 
                        padding: '0 8px', 
                        margin: 0,
                        height: 22,
                        lineHeight: '20px'
                      }}
                    >
                      🏷️ {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </Tag>
                  </div>

                  {/* Description */}
                  {task.description && (
                    <>
                      <Divider style={{ margin: '10px 0', borderColor: '#f0f0f0' }} />
                      <Text 
                        type={isCompleted ? 'secondary' : undefined}
                        style={{ 
                          fontSize: '0.9rem', 
                          lineHeight: 1.6, 
                          display: 'block',
                          marginBottom: 12,
                          color: isCompleted ? '#8c8c8c' : '#595959'
                        }}
                      >
                        {task.description}
                      </Text>
                    </>
                  )}

                  {/* Instructions */}
                  {task.instructions && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: '0.875rem', color: '#262626' }}>
                        Instructions:
                      </Text>
                      <div style={{ 
                        marginTop: 6, 
                        padding: '8px 12px', 
                        background: '#fafafa', 
                        borderRadius: 6,
                        borderLeft: '3px solid #1890ff'
                      }}>
                        <Text style={{ fontSize: '0.875rem', color: '#595959' }}>
                          {task.instructions}
                        </Text>
                      </div>
                    </div>
                  )}

                  {/* Attachments - Compact */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 6 }}>
                        📎 Attachments:
                      </Text>
                      <Space wrap size={6}>
                        {task.attachments.map((attachment, index) => (
                          <Button
                            key={index}
                            size="small"
                            icon={<FileOutlined style={{ fontSize: 12 }} />}
                            onClick={() => handlePreviewAttachment(attachment)}
                            style={{ 
                              fontSize: '0.8rem', 
                              height: 28,
                              borderRadius: 6
                            }}
                          >
                            {attachment.name}
                          </Button>
                        ))}
                      </Space>
                    </div>
                  )}

                  {/* Completion Info */}
                  {isCompleted && completions[task.id]?.submitted_at && (
                    <div style={{ 
                      marginTop: 12, 
                      padding: '8px 12px', 
                      background: '#f6ffed', 
                      borderRadius: 6,
                      border: '1px solid #b7eb8f'
                    }}>
                      <Space size={6}>
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />
                        <Text style={{ color: '#52c41a', fontSize: '0.85rem', fontWeight: 500 }}>
                          Completed on {dayjs(completions[task.id].submitted_at).format('MMM DD, YYYY [at] h:mm A')}
                        </Text>
                      </Space>
                    </div>
                  )}

                  {/* Submit Button - Right Aligned, Compact */}
                  {!isCompleted && (
                    <>
                      <Divider style={{ margin: '12px 0', borderColor: '#f0f0f0' }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          type="primary"
                          icon={<SendOutlined style={{ fontSize: 14 }} />}
                          onClick={() => openSubmissionModal(task)}
                          loading={isMarking}
                          style={{
                            borderRadius: 6,
                            fontSize: '0.875rem',
                            height: 36,
                            paddingLeft: 20,
                            paddingRight: 20,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            boxShadow: '0 2px 6px rgba(102, 126, 234, 0.3)'
                          }}
                        >
                          ➤ Submit Task
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              </List.Item>
            );
          }}
        />
      )}

      {/* Submission Modal - Compact & Modern */}
      <Modal
        title={
          <Space align="center" size={8}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <SendOutlined style={{ color: 'white', fontSize: 16 }} />
            </div>
            <Text strong style={{ fontSize: '1rem' }}>Submit Task</Text>
          </Space>
        }
        open={submissionModalVisible}
        onOk={handleSubmitTask}
        onCancel={() => {
          setSubmissionModalVisible(false);
          setSubmissionNotes('');
          setSubmissionFiles([]);
          setCurrentTask(null);
        }}
        confirmLoading={submitting}
        okText={submitting ? 'Submitting...' : '✓ Submit'}
        cancelText="Cancel"
        width={550}
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: 6,
            height: 38
          }
        }}
        cancelButtonProps={{
          style: {
            borderRadius: 6,
            height: 38
          }
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {/* Task Details - Compact */}
          <div style={{ 
            padding: '10px 14px', 
            background: 'linear-gradient(135deg, #f6f8fc 0%, #fafbfd 100%)', 
            borderRadius: 8,
            border: '1px solid #e8ecf3'
          }}>
            <Text strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 6, color: '#262626' }}>
              {currentTask?.title}
            </Text>
            {currentTask?.description && (
              <Text type="secondary" style={{ fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>
                {currentTask.description}
              </Text>
            )}
            <Space size={6}>
              <CalendarOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />
              <Text type="secondary" style={{ fontSize: '0.8rem' }}>
                Due: {currentTask && dayjs(currentTask.due_date).format('MMM DD, YYYY')}
              </Text>
            </Space>
          </div>

          {/* Notes - Compact */}
          <div>
            <Text strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 8 }}>
              📝 Submission Notes (Optional)
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="Explain your work, add comments, or ask questions..."
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              style={{ borderRadius: 6, fontSize: '0.875rem' }}
            />
          </div>

          {/* File Upload - Compact */}
          <div>
            <Text strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: 8 }}>
              📎 Attach Files (Max 5)
            </Text>
            <Upload
              fileList={submissionFiles}
              onChange={handleFileChange}
              beforeUpload={() => false}
              multiple
              maxCount={5}
            >
              <Button 
                icon={<UploadOutlined />} 
                block 
                style={{ 
                  borderRadius: 6, 
                  height: 40,
                  fontSize: '0.875rem',
                  borderStyle: 'dashed'
                }}
              >
                Choose Files to Upload
              </Button>
            </Upload>
            {submissionFiles.length > 0 && (
              <Text style={{ fontSize: '0.75rem', color: '#52c41a', display: 'block', marginTop: 6 }}>
                ✓ {submissionFiles.length} file(s) selected
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: '0.75rem', display: 'block', marginTop: 6 }}>
              PDF, DOC, DOCX, images • Max 10MB per file
            </Text>
          </div>
        </Space>
      </Modal>

      {/* Attachment Preview Modal */}
      <AttachmentPreview
        attachment={previewAttachment}
        open={previewVisible}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewAttachment(null);
        }}
        showDownload={true}
      />
      </div>
    </div>
  );
}
