import React from 'react';
import { Progress, Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';

const SyllabusProgressIndicator = ({ 
  status = 'pending', 
  progress = 0, 
  size = 'default',
  showText = true,
  onClick,
  disabled = false
}) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'completed':
        return {
          color: 'success',
          icon: <CheckCircleOutlined />,
          text: 'Completed',
          strokeColor: '#52c41a'
        };
      case 'in_progress':
        return {
          color: 'processing',
          icon: <PlayCircleOutlined />,
          text: 'In Progress',
          strokeColor: '#1890ff'
        };
      case 'pending':
      default:
        return {
          color: 'default',
          icon: <ClockCircleOutlined />,
          text: 'Pending',
          strokeColor: '#d9d9d9'
        };
    }
  };

  const config = getStatusConfig(status);

  if (size === 'small') {
    return (
      <Tooltip title={`${config.text} - ${progress}%`}>
        <Tag 
          color={config.color} 
          icon={config.icon}
          style={{ 
            cursor: onClick ? 'pointer' : 'default',
            opacity: disabled ? 0.6 : 1
          }}
          onClick={onClick && !disabled ? onClick : undefined}
        >
          {showText && config.text}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <div style={{ 
      cursor: onClick ? 'pointer' : 'default',
      opacity: disabled ? 0.6 : 1
    }} onClick={onClick && !disabled ? onClick : undefined}>
      <Progress
        percent={progress}
        size={size}
        strokeColor={config.strokeColor}
        format={() => config.icon}
        style={{ marginBottom: showText ? '4px' : 0 }}
      />
      {showText && (
        <div style={{ 
          fontSize: '12px', 
          color: config.strokeColor,
          textAlign: 'center',
          fontWeight: '500'
        }}>
          {config.text}
        </div>
      )}
    </div>
  );
};

export default SyllabusProgressIndicator;