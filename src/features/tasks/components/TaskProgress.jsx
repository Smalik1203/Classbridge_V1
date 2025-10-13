import React, { useState, useEffect } from 'react';
import { Modal, Table, Tag, Space, Typography, Progress, Spin, Empty, Button } from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { TaskSubmissionService } from '../services/taskService';
import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

/**
 * TaskProgress Component
 * Shows student completion status for a specific task
 * Admin/SuperAdmin only
 */
export default function TaskProgress({ task, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [completions, setCompletions] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0
  });

  useEffect(() => {
    if (open && task) {
      fetchProgressData();
    }
  }, [open, task]);

  const fetchProgressData = async () => {
    setLoading(true);
    try {
      // Fetch all students in the task's class
      const { data: students, error: studentsError } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', task.class_instance_id)
        .order('full_name', { ascending: true });

      if (studentsError) throw studentsError;

      // Fetch all completions for this task
      const completions = await TaskSubmissionService.getTaskCompletions(task.id);

      // Create completion map
      const completionMap = {};
      completions.forEach(completion => {
        completionMap[completion.student_id] = completion;
      });

      // Merge students with their completion status
      const progressData = students.map(student => ({
        key: student.id,
        id: student.id,
        name: student.full_name,
        studentCode: student.student_code,
        completion: completionMap[student.id] || null,
        isCompleted: !!completionMap[student.id]?.status === 'completed' || !!completionMap[student.id],
        completedAt: completionMap[student.id]?.submitted_at
      }));

      setAllStudents(students);
      setCompletions(completions);
      setProgressData(progressData);

      // Calculate statistics
      const completed = progressData.filter(p => p.isCompleted).length;
      setStats({
        total: students.length,
        completed,
        pending: students.length - completed
      });
    } catch (error) {
      console.error('Failed to fetch progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const completionPercentage = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  const columns = [
    {
      title: 'Student Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <UserOutlined />
          <Text strong>{text}</Text>
          {record.studentCode && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({record.studentCode})
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, record) => (
        record.isCompleted ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Completed
          </Tag>
        ) : (
          <Tag color="warning" icon={<ClockCircleOutlined />}>
            Pending
          </Tag>
        )
      ),
      filters: [
        { text: 'Completed', value: 'completed' },
        { text: 'Pending', value: 'pending' },
      ],
      onFilter: (value, record) => 
        value === 'completed' ? record.isCompleted : !record.isCompleted,
    },
    {
      title: 'Completed At',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY h:mm A') : '-',
      sorter: (a, b) => {
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return dayjs(a.completedAt).unix() - dayjs(b.completedAt).unix();
      },
    },
  ];

  const exportToCSV = () => {
    const csvContent = [
      ['Student Name', 'Student Code', 'Status', 'Completed At'],
      ...progressData.map(row => [
        row.name,
        row.studentCode || '',
        row.isCompleted ? 'Completed' : 'Pending',
        row.completedAt ? dayjs(row.completedAt).format('YYYY-MM-DD HH:mm:ss') : ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `task_progress_${task.title.replace(/\s+/g, '_')}_${dayjs().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      title={
        <Space direction="vertical" size={0}>
          <Title level={4} style={{ margin: 0 }}>
            Task Progress: {task?.title}
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Class: Grade {task?.class_instances?.grade} - Section {task?.class_instances?.section}
          </Text>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button 
          key="export" 
          icon={<DownloadOutlined />}
          onClick={exportToCSV}
          disabled={progressData.length === 0}
        >
          Export CSV
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* Progress Summary */}
          <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size="large">
                <div>
                  <Text type="secondary">Total Students</Text>
                  <div><Text strong style={{ fontSize: 24 }}>{stats.total}</Text></div>
                </div>
                <div>
                  <Text type="secondary">Completed</Text>
                  <div><Text strong style={{ fontSize: 24, color: '#52c41a' }}>{stats.completed}</Text></div>
                </div>
                <div>
                  <Text type="secondary">Pending</Text>
                  <div><Text strong style={{ fontSize: 24, color: '#faad14' }}>{stats.pending}</Text></div>
                </div>
              </Space>
              <div style={{ textAlign: 'right' }}>
                <Text strong style={{ fontSize: 32, color: completionPercentage === 100 ? '#52c41a' : '#1890ff' }}>
                  {completionPercentage}%
                </Text>
              </div>
            </Space>
            <Progress 
              percent={completionPercentage} 
              status={completionPercentage === 100 ? 'success' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </Space>

          {/* Students Table */}
          {progressData.length === 0 ? (
            <Empty description="No students found in this class" />
          ) : (
            <Table
              columns={columns}
              dataSource={progressData}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`,
              }}
              size="small"
            />
          )}
        </>
      )}
    </Modal>
  );
}

