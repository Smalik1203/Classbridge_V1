import React from 'react';
import { PlayCircleOutlined, FilePdfOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';

const ResourceThumbnail = ({ type, size = 'medium' }) => {
  const { theme: antdTheme } = useTheme();
  
  const sizeMap = {
    small: { icon: 16, container: 32 },
    medium: { icon: 24, container: 48 },
    large: { icon: 32, container: 64 }
  };
  
  const { icon: iconSize, container: containerSize } = sizeMap[size];
  
  const getThumbnailConfig = (resourceType) => {
    switch (resourceType) {
      case 'video':
        return {
          icon: <PlayCircleOutlined />,
          color: '#8B5CF6', // Purple
          bgColor: '#F3F0FF',
          borderColor: '#DDD6FE'
        };
      case 'pdf':
        return {
          icon: <FilePdfOutlined />,
          color: '#3B82F6', // Blue
          bgColor: '#EFF6FF',
          borderColor: '#BFDBFE'
        };
      case 'quiz':
        return {
          icon: <QuestionCircleOutlined />,
          color: '#F59E0B', // Orange
          bgColor: '#FFFBEB',
          borderColor: '#FDE68A'
        };
      default:
        return {
          icon: <FilePdfOutlined />,
          color: '#6B7280', // Gray
          bgColor: '#F9FAFB',
          borderColor: '#E5E7EB'
        };
    }
  };
  
  const config = getThumbnailConfig(type);
  
  return (
    <div
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: antdTheme.token.borderRadius,
        backgroundColor: config.bgColor,
        border: `2px solid ${config.borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s ease'
      }}
    >
      <div
        style={{
          fontSize: iconSize,
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {config.icon}
      </div>
    </div>
  );
};

export default ResourceThumbnail;
