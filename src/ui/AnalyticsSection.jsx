// src/ui/AnalyticsSection.jsx
// Reusable analytics section component for the hub

import React from 'react';
import { Card, Button, Typography, Space, Spin, Alert } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
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
        ...style
      }}
      styles={{ body: { padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon && (
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#f0f9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {icon}
              </div>
            )}
            <div>
              <Title level={4} style={{ margin: 0, color: theme.token.colorTextHeading, fontSize: '18px' }}>
                {title}
              </Title>
              {description && (
                <Text type="secondary" style={{ fontSize: '14px', color: theme.token.colorTextSecondary }}>
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
                padding: 0
              }}
            >
              View Details
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
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 16,
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
