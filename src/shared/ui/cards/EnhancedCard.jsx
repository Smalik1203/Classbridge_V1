// src/ui/EnhancedCard.jsx
// Enhanced card component with minimalist design and better data visualization

import React from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import { designTokens } from '../theme';

const { Title, Text } = Typography;

/**
 * Enhanced card component with minimalist design
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.title - Card title
 * @param {string} props.subtitle - Card subtitle
 * @param {React.ReactNode} props.extra - Extra content (actions, filters, etc.)
 * @param {React.ReactNode} props.footer - Footer content
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.hoverable - Whether card should be hoverable
 * @param {string} props.size - Card size (small, default, large)
 * @param {string} props.variant - Card variant (default, outlined, filled)
 * @param {string} props.className - Additional CSS class
 * @param {Object} props.style - Additional inline styles
 * @param {Function} props.onClick - Click handler
 */
const EnhancedCard = ({
  children,
  title,
  subtitle,
  extra,
  footer,
  loading = false,
  hoverable = false,
  size = 'default',
  variant = 'default',
  className = '',
  style = {},
  onClick,
  ...props
}) => {
  const { theme: antdTheme } = useTheme();

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          headerPadding: `${designTokens.spacing.md}px ${designTokens.spacing.lg}px`,
          bodyPadding: `${designTokens.spacing.lg}px`,
          borderRadius: designTokens.radius.md,
        };
      case 'large':
        return {
          headerPadding: `${designTokens.spacing.xl}px ${designTokens.spacing.xxl}px`,
          bodyPadding: `${designTokens.spacing.xxxl}px`,
          borderRadius: designTokens.radius.xl,
        };
      default:
        return {
          headerPadding: `${designTokens.spacing.lg}px ${designTokens.spacing.xxl}px`,
          bodyPadding: `${designTokens.spacing.xxl}px`,
          borderRadius: designTokens.radius.lg,
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return {
          background: 'transparent',
          border: `2px solid ${antdTheme.token.colorBorder}`,
          boxShadow: 'none',
        };
      case 'filled':
        return {
          background: antdTheme.token.colorBgElevated,
          border: 'none',
          boxShadow: designTokens.shadows.sm,
        };
      default:
        return {
          background: antdTheme.token.colorBgContainer,
          border: `1px solid ${antdTheme.token.colorBorder}`,
          boxShadow: designTokens.shadows.sm,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  const cardStyle = {
    borderRadius: sizeStyles.borderRadius,
    background: variantStyles.background,
    border: variantStyles.border,
    boxShadow: variantStyles.boxShadow,
    transition: 'all 0.2s ease',
    ...style,
  };

  const headerStyle = {
    padding: sizeStyles.headerPadding,
    borderBottom: `1px solid ${antdTheme.token.colorBorder}`,
    background: 'transparent',
  };

  const bodyStyle = {
    padding: sizeStyles.bodyPadding,
  };

  const footerStyle = {
    padding: sizeStyles.headerPadding,
    borderTop: `1px solid ${antdTheme.token.colorBorder}`,
    background: 'transparent',
  };

  return (
    <Card
      className={`enhanced-card ${className}`}
      style={cardStyle}
      loading={loading}
      hoverable={hoverable}
      onClick={onClick}
      styles={{
        header: headerStyle,
        body: bodyStyle,
      }}
      {...props}
    >
      {/* Enhanced Header */}
      {(title || subtitle || extra) && (
        <div style={{ marginBottom: children ? designTokens.spacing.lg : 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: designTokens.spacing.md,
            }}
          >
            <div style={{ flex: 1 }}>
              {title && (
                <Title
                  level={4}
                  style={{
                    margin: 0,
                    marginBottom: subtitle ? designTokens.spacing.xs : 0,
                    color: antdTheme.token.colorTextHeading,
                    fontWeight: antdTheme.token.fontWeightStrong,
                    fontSize: size === 'small' ? antdTheme.token.fontSizeLG : antdTheme.token.fontSizeHeading4,
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
                    fontSize: antdTheme.token.fontSize,
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
        </div>
      )}

      {/* Card Content */}
      {children && (
        <div style={{ marginBottom: footer ? designTokens.spacing.lg : 0 }}>
          {children}
        </div>
      )}

      {/* Enhanced Footer */}
      {footer && (
        <>
          <Divider style={{ margin: `${designTokens.spacing.lg}px 0` }} />
          <div style={footerStyle}>
            {footer}
          </div>
        </>
      )}
    </Card>
  );
};

export default EnhancedCard;
