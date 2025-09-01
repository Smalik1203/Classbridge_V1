// src/ui/EmptyState.jsx
// Reusable empty state component

import React from 'react';
import { Empty, Typography, Button } from 'antd';
import { useTheme } from '../contexts/ThemeContext';

const { Text } = Typography;

/**
 * Empty state component
 * @param {Object} props - Component props
 * @param {string} props.title - Empty state title
 * @param {string} props.description - Empty state description
 * @param {React.ReactNode} props.icon - Custom icon
 * @param {string} props.actionText - Action button text
 * @param {Function} props.onAction - Action button handler
 * @param {boolean} props.showAction - Whether to show action button
 * @param {string} props.image - Custom image URL
 * @param {string} props.className - Additional CSS class
 * @param {Object} props.style - Additional inline styles
 */
const EmptyState = ({
  title = 'No Data',
  description = 'There is no data to display.',
  icon,
  actionText,
  onAction,
  showAction = false,
  image,
  className = '',
  style = {},
}) => {
  const { theme: antdTheme } = useTheme();

  return (
    <div
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: antdTheme.token.paddingLG,
        textAlign: 'center',
        minHeight: '300px',
        color: antdTheme.token.colorTextSecondary,
        ...style,
      }}
    >
      <Empty
        image={image || Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <Text
              strong
              style={{
                display: 'block',
                fontSize: antdTheme.token.fontSizeLG,
                color: antdTheme.token.colorText,
                marginBottom: antdTheme.token.marginXS,
              }}
            >
              {title}
            </Text>
            <Text
              type="secondary"
              style={{
                fontSize: antdTheme.token.fontSize,
                color: antdTheme.token.colorTextSecondary,
                lineHeight: antdTheme.token.lineHeight,
              }}
            >
              {description}
            </Text>
          </div>
        }
        style={{
          color: antdTheme.token.colorTextSecondary,
        }}
      >
        {showAction && actionText && onAction && (
          <Button
            type="primary"
            onClick={onAction}
            style={{
              marginTop: antdTheme.token.margin,
              borderRadius: antdTheme.token.borderRadius,
            }}
          >
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  );
};

export default EmptyState; 