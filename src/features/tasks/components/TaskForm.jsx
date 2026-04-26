import React, { useState, useEffect } from 'react';
import { Form, Input, Select, DatePicker, Space, App, Typography, Upload } from 'antd';
import { UploadOutlined, BookOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormModal, validators, toDayjs, fromDayjs } from '../../../shared/components/forms';
import { TaskService } from '../services/taskService';
import AttachmentPreview from './AttachmentPreview';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PRIORITY_COLORS = {
  low:    '#52c41a',
  medium: '#faad14',
  high:   '#ff4d4f',
  urgent: '#ff4d4f',
};

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: PRIORITY_COLORS.low },
  { value: 'medium', label: 'Medium', color: PRIORITY_COLORS.medium },
  { value: 'high',   label: 'High',   color: PRIORITY_COLORS.high },
  { value: 'urgent', label: 'Urgent', color: PRIORITY_COLORS.urgent },
];

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export default function TaskForm({
  open, task, schoolCode, academicYearId, classes = [], subjects = [],
  user, onCancel, onSuccess,
}) {
  const { message } = App.useApp();

  // File state lives outside the form because attachments are handled
  // separately (uploaded to storage, then passed as metadata in the payload).
  const [fileList, setFileList] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [objectUrls, setObjectUrls] = useState(new Set());

  const cleanupObjectUrls = () => {
    objectUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } });
    setObjectUrls(new Set());
  };

  // Sync fileList with `open` and `task`. Form fields are managed by FormModal.
  useEffect(() => {
    if (open) {
      if (task) {
        const formattedAttachments = (task.attachments || []).map((a, i) => ({
          uid: a.path || `existing-${i}`,
          name: a.name,
          status: 'done',
          bucket: a.bucket,
          path: a.path,
          size: a.size,
          mime: a.mime,
        }));
        setFileList(formattedAttachments);
      } else {
        setFileList([]);
      }
    } else {
      cleanupObjectUrls();
      setFileList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  useEffect(() => () => cleanupObjectUrls(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const getInitialValues = (editing) => editing ? {
    title: editing.title,
    description: editing.description,
    priority: editing.priority,
    class_instance_id: editing.class_instance_id,
    subject_id: editing.subject_id,
    assigned_date: toDayjs(editing.assigned_date) || dayjs(),
    due_date: toDayjs(editing.due_date) || dayjs().add(1, 'day'),
    instructions: editing.instructions,
  } : {
    priority: 'medium',
    assigned_date: dayjs(),
    due_date: dayjs().add(1, 'day'),
  };

  const handleSubmit = async (values) => {
    if (!academicYearId) {
      throw new Error('Academic year is required. Please contact your administrator.');
    }

    // Upload any new attachments first
    const uploadedAttachments = [];
    for (const file of fileList) {
      if (file.originFileObj) {
        const metadata = await TaskService.uploadAttachment(
          file.originFileObj, schoolCode, values.class_instance_id,
        );
        uploadedAttachments.push(metadata);
      } else if (file.bucket && file.path) {
        uploadedAttachments.push({
          bucket: file.bucket, path: file.path, name: file.name,
          size: file.size, mime: file.mime,
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
      assigned_date: fromDayjs(values.assigned_date),
      due_date: fromDayjs(values.due_date),
      instructions: values.instructions?.trim() || null,
      attachments: uploadedAttachments,
      is_active: true,
      created_by: user?.id,
    };

    return task?.id
      ? TaskService.updateTask(task.id, taskData)
      : TaskService.createTask(taskData);
  };

  const beforeUpload = (file) => {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      message.error(`${file.name} exceeds 10MB limit`);
      return Upload.LIST_IGNORE;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error(`${file.name} is not a supported file type. Only images, PDFs, DOC, DOCX, and TXT are allowed.`);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const handleFileChange = ({ fileList: newFileList }) => {
    const updated = newFileList.map(file => {
      if (file.originFileObj && !file.preview) {
        const url = URL.createObjectURL(file.originFileObj);
        setObjectUrls(prev => new Set([...prev, url]));
        file.preview = url;
        file.mime = file.type;
      }
      return file;
    });
    setFileList(updated);
  };

  const handleFileRemove = (file) => {
    if (file.preview && file.preview.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(file.preview);
        setObjectUrls(prev => {
          const next = new Set(prev);
          next.delete(file.preview);
          return next;
        });
      } catch { /* ignore */ }
    }
  };

  return (
    <>
      <FormModal
        open={open}
        onClose={onCancel}
        title={<Space><BookOutlined />{task ? 'Edit Task' : 'Create New Task'}</Space>}
        okText={task ? 'Update Task' : 'Create Task'}
        width={800}
        editing={task}
        getInitialValues={getInitialValues}
        onSubmit={handleSubmit}
        onSaved={onSuccess}
        successMessage={task ? 'Task updated successfully' : 'Task created successfully'}
        errorMessage="Failed to save task"
      >
        {(form) => (
          <TaskFormBody
            form={form}
            classes={classes}
            subjects={subjects}
            fileList={fileList}
            beforeUpload={beforeUpload}
            handleFileChange={handleFileChange}
            handleFileRemove={handleFileRemove}
            handlePreview={(f) => { setPreviewFile(f); setPreviewVisible(true); }}
          />
        )}
      </FormModal>

      <AttachmentPreview
        attachment={previewFile}
        open={previewVisible}
        onClose={() => { setPreviewVisible(false); setPreviewFile(null); }}
        showDownload={false}
      />
    </>
  );
}

function TaskFormBody({
  form, classes, subjects, fileList, beforeUpload, handleFileChange, handleFileRemove, handlePreview,
}) {
  const selectedClass = Form.useWatch('class_instance_id', form);
  const filteredSubjects = selectedClass ? subjects : [];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <Form.Item
            label="Task Title"
            name="title"
            rules={[
              { required: true, message: 'Please enter task title' },
              validators.minLength(3, 'Title'),
              validators.maxLength(200, 'Title'),
            ]}
          >
            <Input placeholder="Enter task title" autoFocus />
          </Form.Item>

          <Form.Item label="Priority" name="priority" rules={[validators.required('Priority')]}>
            <Select placeholder="Select priority">
              {PRIORITY_OPTIONS.map(p => (
                <Option key={p.value} value={p.value}>
                  <Space>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color }} />
                    {p.label}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Class" name="class_instance_id" rules={[{ required: true, message: 'Please select class' }]}>
            <Select
              placeholder="Select class"
              onChange={() => form.setFieldsValue({ subject_id: undefined })}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}
            >
              {classes.map(cls => (
                <Option key={cls.id} value={cls.id}>
                  Grade {cls.grade} - Section {cls.section}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Subject" name="subject_id" rules={[{ required: true, message: 'Please select subject' }]}>
            <Select
              placeholder={selectedClass ? 'Select subject' : 'Select class first'}
              disabled={!selectedClass}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}
            >
              {filteredSubjects.map(subject => (
                <Option key={subject.id} value={subject.id}>
                  {subject.subject_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <div>
          <Form.Item label="Assigned Date" name="assigned_date" rules={[{ required: true, message: 'Please select assigned date' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            label="Due Date"
            name="due_date"
            rules={[
              { required: true, message: 'Please select due date' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const assignedDate = getFieldValue('assigned_date');
                  if (!value || !assignedDate) return Promise.resolve();
                  if (value.isBefore(assignedDate, 'day')) {
                    return Promise.reject(new Error('Due date must be on or after assigned date'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            label="File Attachments"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Max 10MB per file. Supported: Images, PDF, DOC, DOCX, TXT</Text>}
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

      <Form.Item label="Description" name="description">
        <TextArea placeholder="Enter task description (optional)" rows={3} maxLength={1000} showCount />
      </Form.Item>

      <Form.Item label="Instructions" name="instructions">
        <TextArea placeholder="Enter specific instructions for students (optional)" rows={3} maxLength={1000} showCount />
      </Form.Item>
    </div>
  );
}
