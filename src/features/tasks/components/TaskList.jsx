import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Popconfirm, 
  message, 
  Card, 
  Select, 
  Input, 
  DatePicker, 
  Typography,
  Tooltip,
  Modal,
  Spin
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  BookOutlined,
  FileOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';
import dayjs from 'dayjs';
import { TaskService } from '../services/taskService';
import EmptyState from '@/shared/ui/EmptyState';
import AttachmentPreview from './AttachmentPreview';
import TaskProgress from './TaskProgress';

const { Text, Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Shared priority color map (consistent with TaskForm)
const PRIORITY_COLORS = {
  low: 'green',
  medium: 'orange',
  high: 'red',
  urgent: 'red'
};

export default function TaskList({
  schoolCode,
  academicYearId,
  classes = [],
  subjects = [],
  user,
  onEditTask,
  onCreateTask,
  refreshTrigger
}) {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    classInstanceId: null,
    subjectId: null,
    priority: null,
    dateRange: null,
    search: ''
  });
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressTask, setProgressTask] = useState(null);

  // Debounce timer ref
  const searchDebounceTimer = useRef(null);

  // Fetch tasks with server-side filtering and pagination
  const fetchTasks = useCallback(async (page = 1, pageSize = 10) => {
    if (!schoolCode) return;
    
    setLoading(true);
    try {
      const filterParams = {
        // Only include academicYearId if it exists and user wants to filter by it
        // For now, show all tasks regardless of academic year
        classInstanceId: filters.classInstanceId,
        subjectId: filters.subjectId,
        priority: filters.priority,
        search: filters.search || undefined,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD')
      };
      
      // Remove null/undefined values
      Object.keys(filterParams).forEach(key => {
        if (filterParams[key] === null || filterParams[key] === undefined) {
          delete filterParams[key];
        }
      });

      const response = await TaskService.getTasks(
        schoolCode, 
        filterParams,
        { page, pageSize }
      );
      
      console.log('Fetched tasks from server:', response);
      
      setTasks(response.data);
      setPagination({
        current: response.page,
        pageSize: response.pageSize,
        total: response.total
      });
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      message.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [schoolCode, filters]);

  // Fetch tasks when dependencies change
  useEffect(() => {
    fetchTasks(pagination.current, pagination.pageSize);
  }, [schoolCode, refreshTrigger]);

  // Debounced search handler
  useEffect(() => {
    // Clear existing timer
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    // Set new timer (400ms debounce)
    searchDebounceTimer.current = setTimeout(() => {
      // Reset to page 1 when search changes
      fetchTasks(1, pagination.pageSize);
    }, 400);

    // Cleanup
    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, [filters.search]);

  // Handle filter changes (non-search)
  useEffect(() => {
    // Reset to page 1 when filters change
    fetchTasks(1, pagination.pageSize);
  }, [
    filters.classInstanceId, 
    filters.subjectId, 
    filters.priority, 
    filters.dateRange
  ]);

  // Handle task deletion
  const handleDelete = async (taskId) => {
    try {
      await TaskService.deleteTask(taskId);
      message.success('Task deleted successfully');
      // Refresh the current page, or go to previous page if current page becomes empty
      const remainingTasks = pagination.total - 1;
      const totalPages = Math.ceil(remainingTasks / pagination.pageSize);
      const newPage = pagination.current > totalPages ? totalPages : pagination.current;
      fetchTasks(newPage || 1, pagination.pageSize);
    } catch (error) {
      console.error('Failed to delete task:', error);
      message.error('Failed to delete task');
    }
  };

  // Handle pagination change
  const handleTableChange = (newPagination) => {
    fetchTasks(newPagination.current, newPagination.pageSize);
  };

  // Handle viewing attachments
  const handleViewAttachments = (task) => {
    setSelectedTask(task);
    setAttachmentModalVisible(true);
  };

  // Handle viewing single attachment
  const handlePreviewAttachment = (attachment) => {
    setPreviewAttachment(attachment);
    setPreviewVisible(true);
  };

  // Handle viewing progress
  const handleViewProgress = (task) => {
    setProgressTask(task);
    setProgressModalVisible(true);
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

  // Table columns
  const columns = [
    {
      title: 'Task Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.description && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.description.length > 50 
                  ? `${record.description.substring(0, 50)}...` 
                  : record.description
                }
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => (
        <Tag color={PRIORITY_COLORS[priority] || 'default'}>
          {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Subject',
      dataIndex: ['subjects', 'subject_name'],
      key: 'subject',
      width: 120,
    },
    {
      title: 'Class',
      key: 'class',
      width: 100,
      render: (_, record) => (
        <Text>
          Grade {record.class_instances?.grade} - {record.class_instances?.section}
        </Text>
      ),
    },
    {
      title: 'Assigned Date',
      dataIndex: 'assigned_date',
      key: 'assigned_date',
      width: 120,
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
      sorter: (a, b) => dayjs(a.assigned_date).unix() - dayjs(b.assigned_date).unix(),
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      render: (date) => {
        const status = getDueDateStatus(date);
        return (
          <Space direction="vertical" size={0}>
            <Text>{dayjs(date).format('MMM DD, YYYY')}</Text>
            <Tag color={status.color} style={{ fontSize: 10 }}>
              {status.text}
            </Tag>
          </Space>
        );
      },
      sorter: (a, b) => dayjs(a.due_date).unix() - dayjs(b.due_date).unix(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Progress">
            <Button 
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => handleViewProgress(record)}
            >
              Progress
            </Button>
          </Tooltip>
          {record.attachments && record.attachments.length > 0 && (
            <Tooltip title="View Attachments">
              <Button 
                type="default" 
                size="small"
                icon={<FileOutlined />}
                onClick={() => handleViewAttachments(record)}
              >
                {record.attachments.length}
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Edit Task">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => onEditTask(record)}
              aria-label="Edit task"
            />
          </Tooltip>
          <Popconfirm
            title="Delete Task"
            description="Are you sure you want to delete this task?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Task">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                size="small"
                aria-label="Delete task"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Filters */}
      <Card 
        size="small" 
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <FilterOutlined />
            Filters
          </Space>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <Text strong>Search</Text>
            <Input
              placeholder="Search tasks..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              allowClear
            />
          </div>
          
          <div>
            <Text strong>Class</Text>
            <Select
              placeholder="All Classes"
              style={{ width: '100%' }}
              value={filters.classInstanceId}
              onChange={(value) => setFilters(prev => ({ ...prev, classInstanceId: value }))}
              allowClear
            >
              {classes.map(cls => (
                <Option key={cls.id} value={cls.id}>
                  Grade {cls.grade} - Section {cls.section}
                </Option>
              ))}
            </Select>
          </div>
          
          <div>
            <Text strong>Subject</Text>
            <Select
              placeholder="All Subjects"
              style={{ width: '100%' }}
              value={filters.subjectId}
              onChange={(value) => setFilters(prev => ({ ...prev, subjectId: value }))}
              allowClear
            >
              {subjects.map(subject => (
                <Option key={subject.id} value={subject.id}>
                  {subject.subject_name}
                </Option>
              ))}
            </Select>
          </div>
          
          <div>
            <Text strong>Priority</Text>
            <Select
              placeholder="All Priorities"
              style={{ width: '100%' }}
              value={filters.priority}
              onChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
              allowClear
            >
              <Option value="low">Low</Option>
              <Option value="medium">Medium</Option>
              <Option value="high">High</Option>
              <Option value="urgent">Urgent</Option>
            </Select>
          </div>
          
          <div>
            <Text strong>Date Range</Text>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
              format="YYYY-MM-DD"
            />
          </div>
        </div>
      </Card>

      {/* Tasks Table */}
      <Card
        title={
          <Space>
            <BookOutlined />
            <Title level={4} style={{ margin: 0 }}>
              Tasks ({pagination.total})
            </Title>
          </Space>
        }
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={onCreateTask}
          >
            Create Task
          </Button>
        }
      >
        {loading && tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<BookOutlined />}
            title="No Tasks Found"
            description="No tasks match your current filters. Try adjusting your search criteria or create a new task."
            action={
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreateTask}>
                Create First Task
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} tasks`,
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
            size="small"
          />
        )}
      </Card>

      {/* Attachments List Modal */}
      <Modal
        title={
          <Space>
            <FileOutlined />
            {selectedTask?.title} - Attachments
          </Space>
        }
        open={attachmentModalVisible}
        onCancel={() => {
          setAttachmentModalVisible(false);
          setSelectedTask(null);
        }}
        footer={
          <Button onClick={() => {
            setAttachmentModalVisible(false);
            setSelectedTask(null);
          }}>
            Close
          </Button>
        }
        width={600}
      >
        {selectedTask?.attachments && selectedTask.attachments.length > 0 ? (
          <div>
            {selectedTask.attachments.map((attachment, index) => (
              <Card 
                key={index} 
                size="small" 
                style={{ marginBottom: 8 }}
                hoverable
                onClick={() => handlePreviewAttachment(attachment)}
              >
                <Space>
                  <FileOutlined style={{ fontSize: 20 }} />
                  <div>
                    <Text strong>{attachment.name}</Text>
                    {attachment.size && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {(attachment.size / 1024).toFixed(2)} KB
                        </Text>
                      </div>
                    )}
                  </div>
                </Space>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FileOutlined />}
            title="No Attachments"
            description="This task has no attachments."
          />
        )}
      </Modal>

      {/* Single Attachment Preview Modal */}
      <AttachmentPreview
        attachment={previewAttachment}
        open={previewVisible}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewAttachment(null);
        }}
        showDownload={true}
      />

      {/* Task Progress Modal */}
      <TaskProgress
        task={progressTask}
        open={progressModalVisible}
        onClose={() => {
          setProgressModalVisible(false);
          setProgressTask(null);
        }}
      />
    </div>
  );
}
