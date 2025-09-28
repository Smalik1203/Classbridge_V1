import React from 'react';
import { Tag } from 'antd';
import { useTheme } from '../../contexts/ThemeContext';

const ResourceTypeBadge = ({ type, size = 'default' }) => {
  const { theme: antdTheme } = useTheme();
  
  const getBadgeConfig = (resourceType) => {
    switch (resourceType) {
      case 'video':
        return {
          color: '#8B5CF6', // Purple
          text: 'VIDEO',
          bgColor: '#F3F0FF',
          borderColor: '#DDD6FE'
        };
      case 'pdf':
        return {
          color: '#3B82F6', // Blue
          text: 'PDF',
          bgColor: '#EFF6FF',
          borderColor: '#BFDBFE'
        };
      case 'quiz':
        return {
          color: '#F59E0B', // Orange
          text: 'QUIZ',
          bgColor: '#FFFBEB',
          borderColor: '#FDE68A'
        };
      default:
        return {
          color: '#6B7280', // Gray
          text: 'RESOURCE',
          bgColor: '#F9FAFB',
          borderColor: '#E5E7EB'
        };
    }
  };
  
  const config = getBadgeConfig(type);
  const isSmall = size === 'small';
  
  return (
    <Tag
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        borderRadius: antdTheme.token.borderRadius,
        fontSize: isSmall ? antdTheme.token.fontSizeXS : antdTheme.token.fontSizeSM,
        fontWeight: 600,
        padding: isSmall ? '2px 6px' : '4px 8px',
        height: isSmall ? 20 : 24,
        lineHeight: isSmall ? '16px' : '20px',
        margin: 0
      }}
    >
      {config.text}
    </Tag>
  );
};

export default ResourceTypeBadge;
