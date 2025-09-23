import React from 'react';
import { Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';

export const AttendanceTag = ({ status, ...props }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'present':
        return {
          color: 'success',
          icon: <CheckCircleOutlined />,
          text: 'Present'
        };
      case 'absent':
        return {
          color: 'error',
          icon: <CloseCircleOutlined />,
          text: 'Absent'
        };
      case 'late':
        return {
          color: 'warning',
          icon: <ClockCircleOutlined />,
          text: 'Late'
        };
      default:
        return {
          color: 'default',
          icon: <UserOutlined />,
          text: 'Not Marked'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Tag color={config.color} icon={config.icon} {...props}>
      {config.text}
    </Tag>
  );
};

export const getAttendanceColor = (status) => {
  switch (status) {
    case 'present':
      return '#52c41a';
    case 'absent':
      return '#ff4d4f';
    case 'late':
      return '#faad14';
    default:
      return '#d9d9d9';
  }
};

export default AttendanceTag;