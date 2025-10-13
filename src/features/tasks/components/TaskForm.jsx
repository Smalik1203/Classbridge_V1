import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, Space, message, Typography, Upload } from 'antd';
import { PlusOutlined, UploadOutlined, BookOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';
import dayjs from 'dayjs';
import { TaskService } from '../services/taskService';
import AttachmentPreview from './AttachmentPreview';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Shared priority color map
const PRIORITY_COLORS = {
  low: '#52c41a',     // green
  medium: '#faad14',  // orange
  high: '#ff4d4f',    // red
  urgent: '#ff4d4f'   // red
};

export default function TaskForm({
  open,
  task,
  schoolCode,
  academicYearId,
  classes = [],
  subjects = [],
  user,
  onCancel,
  onSuccess
}) {
  const { theme } = useTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [objectUrls, setObjectUrls] = useState(new Set());

  // Priority options
  const priorityOptions = [
    { value: 'low', label: 'Low', color: PRIORITY_COLORS.low },
    { value: 'medium', label: 'Medium', color: PRIORITY_COLORS.medium },
    { value: 'high', label: 'High', color: PRIORITY_COLORS.high },
    { value: 'urgent', label: 'Urgent', color: PRIORITY_COLORS.urgent }
  ];

  // Reset form when modal opens/closes or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        // Edit mode - populate form with existing task data
        const existingAttachments = task.attachments || [];
        
        // Convert database attachments to Upload component format
        const formattedAttachments = existingAttachments.map((attachment, index) => ({
          uid: attachment.path || `existing-${index}`,
          name: attachment.name,
          status: 'done',
          bucket: attachment.bucket,
          path: attachment.path,
          size: attachment.size,
          mime: attachment.mime
        }));
        
        form.setFieldsValue({
          title: task.title,
          description: task.description,
          priority: task.priority,
          class_instance_id: task.class_instance_id,
          subject_id: task.subject_id,
          assigned_date: task.assigned_date ? dayjs(task.assigned_date) : dayjs(),
          due_date: task.due_date ? dayjs(task.due_date) : dayjs().add(1, 'day'),
          instructions: task.instructions
        });
        setSelectedClass(task.class_instance_id);
        setFileList(formattedAttachments);
      } else {
        // Create mode - set minimal default values
        form.setFieldsValue({
          priority: 'medium',
          assigned_date: dayjs(),
          due_date: dayjs().add(1, 'day')
        });
        setSelectedClass(null);
        setFileList([]);
      }
    } else {
      // Modal closed - cleanup
      cleanupObjectUrls();
      form.resetFields();
      setSelectedClass(null);
      setFileList([]);
    }
  }, [open, task, form]);

  // Filter subjects based on selected class
  useEffect(() => {
    if (selectedClass) {
      setFilteredSubjects(subjects);
    } else {
      setFilteredSubjects([]);
    }
  }, [selectedClass, subjects]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      cleanupObjectUrls();
    };
  }, []);

  const cleanupObjectUrls = () => {
    objectUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    setObjectUrls(new Set());
  };

  const handleSubmit = async (values) => {
    // Validate academicYearId
    if (!academicYearId) {
      message.error('Academic year is required. Please contact your administrator.');
      return;
    }

    setLoading(true);
    try {
      // Upload new attachments to Supabase Storage
      const uploadedAttachments = [];
      
      for (const file of fileList) {
        // If file has originFileObj, it's a new upload
        if (file.originFileObj) {
          try {
            const metadata = await TaskService.uploadAttachment(
              file.originFileObj,
              schoolCode,
              values.class_instance_id
            );
            uploadedAttachments.push(metadata);
          } catch (error) {
            message.error(`Failed to upload ${file.name}: ${error.message}`);
            throw error;
          }
        } 
        // If file has bucket/path, it's existing
        else if (file.bucket && file.path) {
          uploadedAttachments.push({
            bucket: file.bucket,
            path: file.path,
            name: file.name,
            size: file.size,
            mime: file.mime
          });
        }
      }

      const taskData = {
        school_code: schoolCode,
        academic_year_id: academicYearId,
        class_instance_id: values.class_instance_id,
        subject_id: values.subject_id,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        priority: values.priority,
        assigned_date: values.assigned_date.format('YYYY-MM-DD'),
        due_date: values.due_date.format('YYYY-MM-DD'),
        instructions: values.instructions?.trim() || null,
        attachments: uploadedAttachments,
        is_active: true,
        created_by: user?.id
      };

      // Check if this is an update operation
      const isUpdate = task && task.id;
      
      if (isUpdate) {
        await TaskService.updateTask(task.id, taskData);
        message.success('Task updated successfully');
      } else {
        await TaskService.createTask(taskData);
        message.success('Task created successfully');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving task:', error);
      message.error(error.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    form.setFieldsValue({ subject_id: undefined });
  };

  const beforeUpload = (file) => {
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      message.error(`${file.name} exceeds 10MB limit`);
      return Upload.LIST_IGNORE;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      message.error(`${file.name} is not a supported file type. Only images, PDFs, DOC, DOCX, and TXT are allowed.`);
      return Upload.LIST_IGNORE;
    }

    // Block auto-upload
    return false;
  };

  const handleFileChange = ({ fileList: newFileList }) => {
    // Create object URLs for preview
    const updatedFileList = newFileList.map(file => {
      if (file.originFileObj && !file.preview) {
        const url = URL.createObjectURL(file.originFileObj);
        setObjectUrls(prev => new Set([...prev, url]));
        file.preview = url;
        file.mime = file.type;
      }
      return file;
    });

    setFileList(updatedFileList);
  };

  const handleFileRemove = (file) => {
    // Revoke object URL if it exists
    if (file.preview && file.preview.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(file.preview);
        setObjectUrls(prev => {
          const newSet = new Set(prev);
          newSet.delete(file.preview);
          return newSet;
        });
      } catch (e) {
        // Ignore errors
      }
    }
  };

  const handlePreview = (file) => {
    setPreviewFile(file);
    setPreviewVisible(true);
  };

  return (
    <Modal
      title={
        <Space>
          <BookOutlined />
          {task ? 'Edit Task' : 'Create New Task'}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={800}
      destroyOnHidden
      style={{
        backgroundColor: theme === 'dark' ? '#1f1f1f' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000'
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left Column */}
          <div>
            <Form.Item
              label="Task Title"
              name="title"
              rules={[
                { required: true, message: 'Please enter task title' },
                { min: 3, message: 'Title must be at least 3 characters' },
                { max: 200, message: 'Title is too long' }
              ]}
            >
              <Input 
                placeholder="Enter task title"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              label="Priority"
              name="priority"
              rules={[{ required: true, message: 'Please select priority' }]}
            >
              <Select placeholder="Select priority">
                {priorityOptions.map(priority => (
                  <Option key={priority.value} value={priority.value}>
                    <Space>
                      <div 
                        style={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: '50%', 
                          backgroundColor: priority.color 
                        }} 
                      />
                      {priority.label}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Class"
              name="class_instance_id"
              rules={[{ required: true, message: 'Please select class' }]}
            >
              <Select 
                placeholder="Select class"
                onChange={handleClassChange}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {classes.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    Grade {cls.grade} - Section {cls.section}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Subject"
              name="subject_id"
              rules={[{ required: true, message: 'Please select subject' }]}
            >
              <Select 
                placeholder={selectedClass ? "Select subject" : "Select class first"}
                disabled={!selectedClass}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {filteredSubjects.map(subject => (
                  <Option key={subject.id} value={subject.id}>
                    {subject.subject_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          {/* Right Column */}
          <div>
            <Form.Item
              label="Assigned Date"
              name="assigned_date"
              rules={[{ required: true, message: 'Please select assigned date' }]}
            >
              <DatePicker 
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
                // Allow past dates for editing existing tasks
              />
            </Form.Item>

            <Form.Item
              label="Due Date"
              name="due_date"
              rules={[
                { required: true, message: 'Please select due date' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const assignedDate = getFieldValue('assigned_date');
                    if (!value || !assignedDate) {
                      return Promise.resolve();
                    }
                    if (value.isBefore(assignedDate, 'day')) {
                      return Promise.reject(new Error('Due date must be on or after assigned date'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker 
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
              />
            </Form.Item>

            <Form.Item
              label="File Attachments"
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Max 10MB per file. Supported: Images, PDF, DOC, DOCX, TXT
                </Text>
              }
            >
              <Upload
                listType="picture-card"
                multiple
                fileList={fileList}
                beforeUpload={beforeUpload}
                onChange={handleFileChange}
                onRemove={handleFileRemove}
                onPreview={handlePreview}
                accept="image/*,.pdf,.doc,.docx,.txt"
              >
                {fileList.length < 10 && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>Upload</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          </div>
        </div>

        {/* Full Width Fields */}
        <Form.Item
          label="Description"
          name="description"
        >
          <TextArea 
            placeholder="Enter task description (optional)"
            rows={3}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item
          label="Instructions"
          name="instructions"
        >
          <TextArea 
            placeholder="Enter specific instructions for students (optional)"
            rows={3}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        {/* Form Actions */}
        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<PlusOutlined />}
            >
              {task ? 'Update Task' : 'Create Task'}
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {/* Attachment Preview Modal */}
      <AttachmentPreview
        attachment={previewFile}
        open={previewVisible}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewFile(null);
        }}
        showDownload={false}
      />
    </Modal>
  );
}
