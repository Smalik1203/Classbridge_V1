// src/ui/AnalyticsSection.jsx
// Reusable analytics section component for the hub

import React from 'react';
import { Card, Button, Typography, Space, Spin, Alert } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import AnalyticsKPI from './AnalyticsKPI';

const { Title, Text } = Typography;

const AnalyticsSection = ({ 
  title, 
  description, 
  icon, 
  link, 
  children, 
  loading = false, 
  error = null,
  kpis = [],
  chart,
  className = '',
  style = {}
}) => {
  const navigate = useNavigate();
  const { isDarkMode, theme } = useTheme();

  const handleViewDetails = () => {
    if (link) {
      navigate(link);
    }
  };

  return (
    <Card
      className={`analytics-section ${className}`}
      style={{
        borderRadius: 12,
        border: `1px solid ${theme.token.colorBorder}`,
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        background: theme.token.colorBgContainer,
        height: '100%',
        width: '100%',
        ...style
      }}
      styles={{ 
        body: { 
          padding: window.innerWidth < 768 ? '16px' : '20px', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column' 
        } 
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between', 
          marginBottom: 8,
          flexWrap: 'wrap',
          gap: 8
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: window.innerWidth < 768 ? 8 : 12,
            flex: 1,
            minWidth: '200px'
          }}>
            {icon && (
              <div style={{
                width: window.innerWidth < 768 ? 32 : 40,
                height: window.innerWidth < 768 ? 32 : 40,
                borderRadius: '50%',
                background: '#f0f9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {icon}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Title level={4} style={{ 
                margin: 0, 
                color: theme.token.colorTextHeading, 
                fontSize: window.innerWidth < 768 ? '16px' : '18px',
                lineHeight: 1.2
              }}>
                {title}
              </Title>
              {description && (
                <Text type="secondary" style={{ 
                  fontSize: window.innerWidth < 768 ? '12px' : '14px', 
                  color: theme.token.colorTextSecondary,
                  lineHeight: 1.4
                }}>
                  {description}
                </Text>
              )}
            </div>
          </div>
          {link && (
            <Button 
              type="link" 
              icon={<ArrowRightOutlined />}
              onClick={handleViewDetails}
              style={{ 
                color: '#3b82f6',
                fontWeight: 500,
                padding: 0,
                fontSize: window.innerWidth < 768 ? '12px' : '14px',
                flexShrink: 0
              }}
            >
              {window.innerWidth < 768 ? 'View' : 'View Details'}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '200px',
            flex: 1
          }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Alert
            message="Error loading data"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : (
          <>
            {/* KPI Cards */}
            {kpis && kpis.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div 
                  className="analytics-kpi-grid"
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: window.innerWidth < 768 
                      ? 'repeat(2, 1fr)' 
                      : window.innerWidth < 1024 
                        ? 'repeat(3, 1fr)' 
                        : 'repeat(4, 1fr)',
                    gap: window.innerWidth < 768 ? 12 : 16,
                    marginBottom: 16
                  }}
                >
                  {kpis.map((kpi, index) => (
                    <AnalyticsKPI
                      key={index}
                      value={kpi.value}
                      label={kpi.label}
                      icon={kpi.icon}
                      color={kpi.color}
                      trend={kpi.trend}
                      delta={kpi.delta}
                      suffix={kpi.suffix}
                      loading={loading}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Chart */}
            {chart && (
              <div style={{ flex: 1, minHeight: '200px' }}>
                {chart}
              </div>
            )}

            {/* Additional Children */}
            {children}
          </>
        )}
      </div>
    </Card>
  );
};

export default AnalyticsSection;
