// src/ui/AttendanceTable.jsx
// Modern table component specifically designed for attendance analytics

import React from 'react';
import { Table, Tag, Typography, Space, Progress, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { designTokens } from './theme';

const { Text } = Typography;

/**
 * Enhanced table component for attendance data with modern styling
 * @param {Object} props - Component props
 * @param {Array} props.data - Table data
 * @param {Array} props.columns - Table columns configuration
 * @param {Object} props.pagination - Pagination configuration
 * @param {boolean} props.loading - Loading state
 * @param {Object} props.scroll - Scroll configuration
 */
const AttendanceTable = ({
  data = [],
  columns,
  pagination = { pageSize: 10, showSizeChanger: true, showQuickJumper: true },
  loading = false,
  scroll = { x: 800 },
  ...props
}) => {
  const { antdTheme } = useTheme();

  // Default columns for attendance data
  const defaultColumns = [
    {
      title: 'Student',
      dataIndex: 'full_name',
      key: 'full_name',
      fixed: 'left',
      width: 200,
      render: (text, record) => (
        <Space>
          <UserOutlined style={{ color: antdTheme?.token?.colorTextSecondary }} />
          <div>
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
            <br />
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{record.student_code}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Class',
      dataIndex: 'class_name',
      key: 'class_name',
      width: 120,
      render: (text) => (
        <Tag color="blue" style={{ borderRadius: designTokens.borderRadius.sm }}>
          {text}
        </Tag>
      )
    },
    {
      title: 'Working Days',
      dataIndex: 'present_days',
      key: 'present_days',
      width: 100,
      align: 'center',
      render: (value) => (
        <Space>
          <CheckCircleOutlined style={{ color: '#10b981' }} />
          <Text strong style={{ color: '#10b981' }}>{value}</Text>
        </Space>
      )
    },
    {
      title: 'Holidays',
      dataIndex: 'absent_days',
      key: 'absent_days',
      width: 100,
      align: 'center',
      render: (value) => (
        <Space>
          <CloseCircleOutlined style={{ color: '#ef4444' }} />
          <Text strong style={{ color: '#ef4444' }}>{value}</Text>
        </Space>
      )
    },
    {
      title: 'Late',
      dataIndex: 'late_days',
      key: 'late_days',
      width: 100,
      align: 'center',
      render: (value) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#f59e0b' }} />
          <Text strong style={{ color: '#f59e0b' }}>{value}</Text>
        </Space>
      )
    },
    {
      title: 'Attendance Rate',
      dataIndex: 'attendance_rate',
      key: 'attendance_rate',
      width: 120,
      align: 'center',
      render: (rate, record) => {
        const percentage = Math.round(rate);
        const getStatusColor = (rate) => {
          if (rate >= 90) return '#10b981'; // green
          if (rate >= 75) return '#f59e0b'; // amber
          return '#ef4444'; // red
        };
        
        const getStatusIcon = (rate) => {
          if (rate >= 90) return <CheckCircleOutlined />;
          if (rate >= 75) return <ExclamationCircleOutlined />;
          return <CloseCircleOutlined />;
        };

        return (
          <Tag 
            color={getStatusColor(rate)}
            style={{ 
              fontSize: 12, 
              fontWeight: 'bold',
              padding: '4px 8px',
              borderRadius: 6
            }}
            icon={getStatusIcon(rate)}
          >
            {percentage}%
          </Tag>
        );
      }
    }
  ];

  const finalColumns = columns || defaultColumns;

  return (
    <Table
      dataSource={data}
      columns={finalColumns}
      pagination={pagination}
      loading={loading}
      scroll={scroll}
      size="middle"
      style={{
        background: antdTheme?.token?.colorBgContainer,
        borderRadius: designTokens.borderRadius.lg
      }}
      rowKey="id"
      rowClassName={(record, index) => 
        index % 2 === 0 ? 'attendance-table-row-even' : 'attendance-table-row-odd'
      }
      {...props}
    />
  );
};

export default AttendanceTable;
