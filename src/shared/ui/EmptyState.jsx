// src/ui/EmptyState.jsx
// Enhanced reusable empty state component with consistent UX patterns

import React from 'react';
import { Empty, Typography, Button, Space } from 'antd';
import {
  TeamOutlined, AppstoreOutlined, BarChartOutlined, DollarOutlined,
  BookOutlined, ClockCircleOutlined, ReadOutlined, FileDoneOutlined,
  WarningOutlined, InboxOutlined,
} from '@ant-design/icons';
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

  // Predefined empty state configs. Icons are AntD components so they pick
  // up the theme token color automatically (works in light + dark) instead of
  // 3D color emojis that look out of place against the rest of the iconography.
  const getEmptyStateConfig = () => {
    const configs = {
      students: {
        title: 'No students yet',
        description: 'Get started by adding your first student to the system.',
        icon: <TeamOutlined />,
        actionText: '+ Add Student',
      },
      classes: {
        title: 'No classes found',
        description: 'Create your first class to start organizing students and marking attendance.',
        icon: <AppstoreOutlined />,
        actionText: '+ Create Class',
      },
      analytics: {
        title: 'Analytics will appear here',
        description: "Once tests are taken and attendance is recorded, you'll see trends here.",
        icon: <BarChartOutlined />,
        actionText: null,
      },
      fees: {
        title: 'No fee components yet',
        description: 'Create fee components to start managing student fees and collections.',
        icon: <DollarOutlined />,
        actionText: '+ Add Fee Component',
      },
      subjects: {
        title: 'No subjects yet',
        description: 'Add subjects to organize your curriculum and create structured learning paths.',
        icon: <BookOutlined />,
        actionText: '+ Add Subjects',
      },
      timetable: {
        title: 'No timetable created yet',
        description: 'Create a timetable to organize classes, subjects, and schedules.',
        icon: <ClockCircleOutlined />,
        actionText: '+ Create Timetable',
      },
      syllabus: {
        title: 'No syllabus found',
        description: 'Create a syllabus for this subject and class to organize learning content.',
        icon: <ReadOutlined />,
        actionText: '+ Create Syllabus',
      },
      tests: {
        title: 'No tests found',
        description: 'Create your first test to start assessing student progress and performance.',
        icon: <FileDoneOutlined />,
        actionText: '+ Create Your First Test',
      },
      error: {
        title: 'Something went wrong',
        description: 'We encountered an error while loading your data. Please try again.',
        icon: <WarningOutlined />,
        actionText: '↻ Refresh',
        secondaryActionText: 'Sign in again',
      },
      default: {
        icon: <InboxOutlined />,
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
        // We render our own large themed icon above. Suppress AntD's default
        // image/illustration unless the caller explicitly passed one.
        image={image || null}
        imageStyle={{ display: image ? undefined : 'none' }}
        description={
          <div>
            {finalIcon && (
              <div
                style={{
                  fontSize: 48,
                  lineHeight: 1,
                  marginBottom: antdTheme?.token?.margin || 16,
                  color: antdTheme?.token?.colorTextQuaternary || '#bfbfbf',
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