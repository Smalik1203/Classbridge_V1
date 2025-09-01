// src/ui/Page.jsx
// Standardized page shell component with consistent layout

import React from 'react';
import { Layout, Typography } from 'antd';
import { useTheme } from '../contexts/ThemeContext';

const { Content } = Layout;
const { Title, Text } = Typography;

/**
 * Standardized page component with consistent layout
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Page content
 * @param {string} props.title - Page title
 * @param {string} props.subtitle - Page subtitle
 * @param {React.ReactNode} props.extra - Extra content (actions, filters, etc.)
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.error - Error state
 * @param {string} props.errorMessage - Error message
 * @param {Function} props.onRetry - Retry function for error state
 * @param {string} props.className - Additional CSS class
 * @param {Object} props.style - Additional inline styles
 */
const Page = ({
  children,
  title,
  subtitle,
  extra,
  loading = false,
  error = false,
  errorMessage = 'Something went wrong. Please try again.',
  onRetry,
  className = '',
  style = {},
}) => {
  const { theme: antdTheme } = useTheme();
  
  return (
    <Content
      className={`page-container ${className}`}
      style={{
        padding: antdTheme.token.paddingLG,
        minHeight: '100vh',
        background: antdTheme.token.colorBgLayout,
        ...style,
      }}
    >
      {/* Page Header */}
      {(title || extra) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: antdTheme.token.marginLG,
            gap: antdTheme.token.margin,
          }}
        >
          <div style={{ flex: 1 }}>
            {title && (
              <Title
                level={2}
                style={{
                  margin: 0,
                  marginBottom: subtitle ? antdTheme.token.marginXS : 0,
                  color: antdTheme.token.colorTextHeading,
                  fontWeight: 600,
                }}
              >
                {title}
              </Title>
            )}
            {subtitle && (
              <Text
                type="secondary"
                style={{
                  fontSize: antdTheme.token.fontSize,
                  color: antdTheme.token.colorTextSecondary,
                }}
              >
                {subtitle}
              </Text>
            )}
          </div>
          {extra && (
            <div style={{ flexShrink: 0 }}>
              {extra}
            </div>
          )}
        </div>
      )}

      {/* Page Content */}
      <div
        style={{
          position: 'relative',
          minHeight: '200px',
        }}
      >
        {error ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: antdTheme.token.paddingLG,
              textAlign: 'center',
              color: antdTheme.token.colorTextSecondary,
            }}
          >
            <Text type="secondary" style={{ marginBottom: antdTheme.token.margin }}>
              {errorMessage}
            </Text>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  padding: `${antdTheme.token.paddingSM}px ${antdTheme.token.padding}px`,
                  border: `1px solid ${antdTheme.token.colorBorder}`,
                  borderRadius: antdTheme.token.borderRadius,
                  background: antdTheme.token.colorBgContainer,
                  color: antdTheme.token.colorText,
                  cursor: 'pointer',
                  fontSize: antdTheme.token.fontSize,
                }}
              >
                Try Again
              </button>
            )}
          </div>
        ) : loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              color: antdTheme.token.colorTextSecondary,
            }}
          >
            Loading...
          </div>
        ) : (
          children
        )}
      </div>
    </Content>
  );
};

export default Page; 