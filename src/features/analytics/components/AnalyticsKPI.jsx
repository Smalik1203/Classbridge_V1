// src/ui/AnalyticsKPI.jsx
// Uniform KPI card component for analytics

import React from 'react';
import { Card, Typography } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';

const { Text } = Typography;

const AnalyticsKPI = ({ 
  value, 
  label, 
  icon, 
  color = '#1f2937',
  backgroundColor = null,
  trend = null,
  delta = null,
  suffix = '',
  loading = false,
  className = '',
  style = {}
}) => {
  const { isDarkMode, theme } = useTheme();
  
  // Use theme-aware colors
  const cardBackground = backgroundColor || theme.token.colorBgContainer;
  const secondaryTextColor = theme.token.colorTextSecondary;
  const borderColor = theme.token.colorBorder;
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend > 0) return '↗';
    if (trend < 0) return '↘';
    return '→';
  };

  const getTrendColor = () => {
    if (!trend) return '#6b7280';
    if (trend > 0) return '#16a34a';
    if (trend < 0) return '#dc2626';
    return '#6b7280';
  };

  return (
    <Card
      className={`analytics-kpi ${className}`}
      style={{
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        background: cardBackground,
        boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        minHeight: window.innerWidth < 768 ? '6rem' : '8rem',
        width: '100%',
        ...style
      }}
      styles={{ 
        body: { 
          padding: window.innerWidth < 768 ? '0.75rem' : '1rem',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        } 
      }}
      hoverable
    >
      {/* Header with Icon and Label */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: window.innerWidth < 768 ? '0.5rem' : '0.75rem'
      }}>
        {icon && (
          <div style={{
            width: window.innerWidth < 768 ? 24 : 32,
            height: window.innerWidth < 768 ? 24 : 32,
            borderRadius: '8px',
            background: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: window.innerWidth < 768 ? '12px' : '16px',
            flexShrink: 0
          }}>
            {icon}
          </div>
        )}
        <Text style={{ 
          fontSize: window.innerWidth < 768 ? '0.75rem' : '0.875rem', 
          color: secondaryTextColor,
          fontWeight: 500,
          textAlign: 'right',
          flex: 1,
          marginLeft: icon ? (window.innerWidth < 768 ? '0.25rem' : '0.5rem') : 0,
          lineHeight: 1.2
        }}>
          {label}
        </Text>
      </div>

      {/* Value */}
      <div style={{ 
        fontSize: window.innerWidth < 768 ? '1.25rem' : '1.5rem', 
        fontWeight: 600, 
        color: color,
        lineHeight: 1.2,
        marginBottom: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
        wordBreak: 'break-word'
      }}>
        {loading ? '...' : `${value}${suffix}`}
      </div>

      {/* Trend/Delta */}
      {(trend !== null || delta) && (
        <div style={{ 
          fontSize: window.innerWidth < 768 ? '0.625rem' : '0.75rem', 
          color: trend !== null ? getTrendColor() : secondaryTextColor,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          flexWrap: 'wrap'
        }}>
          {trend !== null && (
            <>
              <span>{getTrendIcon()}</span>
              <span>{Math.abs(trend)}%</span>
            </>
          )}
          {delta && (
            <span style={{ marginLeft: trend !== null ? '0.5rem' : 0 }}>
              {delta}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};

export default AnalyticsKPI;
