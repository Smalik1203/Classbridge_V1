// src/ui/Page.jsx
// Enhanced standardized page shell component with minimalist design

import React from 'react';
import { Layout, Typography, Spin, Button, Result } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';
import { designTokens } from './theme';

const { Content } = Layout;
const { Title, Text } = Typography;

/**
 * Enhanced standardized page component with minimalist design
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
 * @param {boolean} props.stickyHeader - Whether header should be sticky
 * @param {boolean} props.fullWidth - Whether content should be full width
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
  stickyHeader = false,
  fullWidth = false,
}) => {
  const { theme: antdTheme } = useTheme();
  
  return (
    <Content
      className={`page-container ${className}`}
      style={{
        padding: fullWidth ? 0 : antdTheme.token.paddingLG,
        minHeight: '100vh',
        background: antdTheme.token.colorBgLayout,
        ...style,
      }}
    >
      {/* Enhanced Page Header */}
      {(title || extra) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: antdTheme.token.marginLG,
            gap: antdTheme.token.margin,
            padding: stickyHeader ? `${antdTheme.token.paddingLG}px 0` : 0,
            position: stickyHeader ? 'sticky' : 'static',
            top: 0,
            background: stickyHeader ? antdTheme.token.colorBgLayout : 'transparent',
            zIndex: stickyHeader ? 10 : 'auto',
            borderBottom: stickyHeader ? `1px solid ${antdTheme.token.colorBorder}` : 'none',
            backdropFilter: stickyHeader ? 'blur(8px)' : 'none',
          }}
        >
          <div style={{ flex: 1 }}>
            {title && (
              <Title
                level={1}
                style={{
                  margin: 0,
                  marginBottom: subtitle ? antdTheme.token.marginXS : 0,
                  color: antdTheme.token.colorTextHeading,
                  fontWeight: antdTheme.token.fontWeightStrong,
                  fontSize: antdTheme.token.fontSizeHeading1,
                  lineHeight: antdTheme.token.lineHeightLG,
                }}
              >
                {title}
              </Title>
            )}
            {subtitle && (
              <Text
                type="secondary"
                style={{
                  fontSize: antdTheme.token.fontSizeLG,
                  color: antdTheme.token.colorTextSecondary,
                  lineHeight: antdTheme.token.lineHeight,
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

      {/* Enhanced Page Content */}
      <div
        style={{
          position: 'relative',
          minHeight: '200px',
        }}
      >
        {error ? (
          <Result
            status="error"
            title="Error"
            subTitle={errorMessage}
            extra={
              onRetry && (
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={onRetry}
                  style={{
                    borderRadius: designTokens.radius.md,
                    height: designTokens.spacing.xxxxl,
                    paddingLeft: designTokens.spacing.lg,
                    paddingRight: designTokens.spacing.lg,
                  }}
                >
                  Try Again
                </Button>
              )
            }
            style={{
              background: antdTheme.token.colorBgContainer,
              borderRadius: designTokens.radius.lg,
              boxShadow: designTokens.shadows.sm,
              border: `1px solid ${antdTheme.token.colorBorder}`,
            }}
          />
        ) : loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '300px',
              background: antdTheme.token.colorBgContainer,
              borderRadius: designTokens.radius.lg,
              boxShadow: designTokens.shadows.sm,
              border: `1px solid ${antdTheme.token.colorBorder}`,
            }}
          >
            <Spin size="large" />
          </div>
        ) : (
          children
        )}
      </div>
    </Content>
  );
};

export default Page; 