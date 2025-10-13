// src/ui/EmptyState.jsx
// Enhanced reusable empty state component with consistent UX patterns

import React from 'react';
import { Empty, Typography, Button, Space } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';

const { Text } = Typography;

/**
 * Enhanced empty state component with consistent UX patterns
 * @param {Object} props - Component props
 * @param {string} props.title - Empty state title (2-3 words, bold)
 * @param {string} props.description - Empty state description (why it's empty)
 * @param {React.ReactNode} props.icon - Custom icon or emoji
 * @param {string} props.actionText - Primary action button text
 * @param {Function} props.onAction - Primary action button handler
 * @param {string} props.secondaryActionText - Secondary action button text
 * @param {Function} props.onSecondaryAction - Secondary action button handler
 * @param {boolean} props.showAction - Whether to show primary action button
 * @param {boolean} props.showSecondaryAction - Whether to show secondary action button
 * @param {string} props.image - Custom image URL
 * @param {string} props.className - Additional CSS class
 * @param {Object} props.style - Additional inline styles
 * @param {string} props.type - Predefined empty state type for common patterns
 */
const EmptyState = ({
  title = 'No Data',
  description = 'There is no data to display.',
  icon,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  showAction = false,
  showSecondaryAction = false,
  image,
  className = '',
  style = {},
  type = 'default', // 'default', 'students', 'classes', 'analytics', 'fees', 'subjects', 'timetable', 'syllabus', 'tests'
}) => {
  const { theme: antdTheme } = useTheme();

  // Predefined empty state configurations for common patterns
  const getEmptyStateConfig = () => {
    const configs = {
      students: {
        title: 'No students yet',
        description: 'Get started by adding your first student to the system.',
        icon: '👩‍🎓',
        actionText: '+ Add Student',
      },
      classes: {
        title: 'No classes found',
        description: 'Create your first class to start organizing students and marking attendance.',
        icon: '📅',
        actionText: '+ Create Class',
      },
      analytics: {
        title: 'Analytics will appear here',
        description: 'Once you\'ve added students and recorded attendance, analytics will show insights and trends.',
        icon: '📊',
        actionText: null,
        secondaryActionText: 'Start by adding students',
      },
      fees: {
        title: 'No fee components yet',
        description: 'Create fee components to start managing student fees and collections.',
        icon: '💰',
        actionText: '+ Add Fee Component',
      },
      subjects: {
        title: 'No subjects yet',
        description: 'Add subjects to organize your curriculum and create structured learning paths.',
        icon: '📚',
        actionText: '+ Add Subjects',
      },
      timetable: {
        title: 'No timetable created yet',
        description: 'Create a timetable to organize classes, subjects, and schedules.',
        icon: '🕒',
        actionText: '+ Create Timetable',
      },
      syllabus: {
        title: 'No syllabus found',
        description: 'Create a syllabus for this subject and class to organize learning content.',
        icon: '📖',
        actionText: '+ Create Syllabus',
      },
      tests: {
        title: 'No tests found',
        description: 'Create your first test to start assessing student progress and performance.',
        icon: '📝',
        actionText: '+ Create Your First Test',
      },
      error: {
        title: 'Something went wrong',
        description: 'We encountered an error while loading your data. Please try again.',
        icon: '⚠️',
        actionText: '↻ Refresh',
        secondaryActionText: 'Sign in again',
      },
    };

    return configs[type] || {};
  };

  const config = getEmptyStateConfig();
  const finalTitle = config.title || title;
  const finalDescription = config.description || description;
  const finalIcon = config.icon || icon;
  const finalActionText = config.actionText || actionText;
  const finalSecondaryActionText = config.secondaryActionText || secondaryActionText;

  return (
    <div
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: antdTheme?.token?.paddingLG || 24,
        textAlign: 'center',
        minHeight: '300px',
        color: antdTheme?.token?.colorTextSecondary || '#666666',
        ...style,
      }}
    >
      <Empty
        image={image || Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            {finalIcon && (
              <div
                style={{
                  fontSize: '48px',
                  marginBottom: antdTheme?.token?.margin || 16,
                  lineHeight: 1,
                }}
              >
                {finalIcon}
              </div>
            )}
            <Text
              strong
              style={{
                display: 'block',
                fontSize: antdTheme?.token?.fontSizeLG || 18,
                color: antdTheme?.token?.colorText || '#000000',
                marginBottom: antdTheme?.token?.marginXS || 8,
                fontWeight: 600,
              }}
            >
              {finalTitle}
            </Text>
            <Text
              type="secondary"
              style={{
                fontSize: antdTheme?.token?.fontSize || 14,
                color: antdTheme?.token?.colorTextSecondary || '#666666',
                lineHeight: antdTheme?.token?.lineHeight || 1.5715,
                maxWidth: '400px',
                margin: '0 auto',
              }}
            >
              {finalDescription}
            </Text>
          </div>
        }
        style={{
          color: antdTheme?.token?.colorTextSecondary || '#666666',
        }}
      >
        {(showAction || finalActionText) && finalActionText && onAction && (
          <Space direction="vertical" size="middle" style={{ marginTop: antdTheme?.token?.margin || 16 }}>
            <Button
              type="primary"
              size="large"
              onClick={onAction}
              style={{
                borderRadius: antdTheme?.token?.borderRadius || 6,
                height: '40px',
                paddingLeft: '24px',
                paddingRight: '24px',
                fontWeight: 500,
              }}
            >
              {finalActionText}
            </Button>
            {(showSecondaryAction || finalSecondaryActionText) && finalSecondaryActionText && onSecondaryAction && (
              <Button
                type="text"
                onClick={onSecondaryAction}
                style={{
                  color: antdTheme?.token?.colorTextSecondary || '#666666',
                  fontSize: antdTheme?.token?.fontSize || 14,
                }}
              >
                {finalSecondaryActionText}
              </Button>
            )}
          </Space>
        )}
      </Empty>
    </div>
  );
};

export default EmptyState; 