// src/ui/AnalyticsCard.jsx
// Unified analytics card component with percentage normalization

import React from 'react';
import { Card, Typography, Button, Spin, Alert, Statistic } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text } = Typography;

const AnalyticsCard = ({
  title,
  primaryPercent,
  primaryLabel,
  secondaryPercent,
  secondaryLabel,
  supporting = [],
  onViewDetails,
  loading = false,
  error = null,
  className = '',
  style = {}
}) => {
  const { isDarkMode, theme } = useTheme();

  // Chart data for donut chart
  const chartData = [
    {
      name: primaryLabel,
      value: primaryPercent,
      color: '#16a34a' // Success green for "good" metrics
    },
    {
      name: secondaryLabel || 'Remaining',
      value: secondaryPercent || (100 - primaryPercent),
      color: '#dc2626' // Danger red for "deficit" metrics
    }
  ].filter(item => item.value > 0);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div 
          role="tooltip"
          aria-label={`${data.name}: ${data.value.toFixed(1)}%`}
          style={{
            background: theme.token.colorBgElevated,
            border: `1px solid ${theme.token.colorBorder}`,
            borderRadius: 6,
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Text style={{ color: theme.token.colorText }}>
            {data.name}: {data.value.toFixed(1)}%
          </Text>
        </div>
      );
    }
    return null;
  };

  // Custom label for pie chart segments
  const renderLabel = (entry) => {
    if (entry.value < 5) return null; // Don't show labels for very small segments
    return `${entry.value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Card
        className={`analytics-card ${className}`}
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.token.colorBorder}`,
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
          background: theme.token.colorBgContainer,
          height: '100%',
          ...style
        }}
        styles={{ body: { padding: '20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
      >
        <Spin size="large" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        className={`analytics-card ${className}`}
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.token.colorBorder}`,
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
          background: theme.token.colorBgContainer,
          height: '100%',
          ...style
        }}
        styles={{ body: { padding: '20px', height: '100%' } }}
      >
        <Alert
          message="Error loading data"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      </Card>
    );
  }

  return (
    <Card
      className={`analytics-card ${className}`}
      style={{
        borderRadius: 12,
        border: `1px solid ${theme.token.colorBorder}`,
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        background: theme.token.colorBgContainer,
        height: '100%',
        ...style
      }}
      styles={{ body: { padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' } }}
      role="region"
      aria-label={`${title} analytics card`}
      tabIndex={0}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 8
        }}>
          <Title level={4} style={{ 
            margin: 0, 
            color: theme.token.colorTextHeading,
            fontSize: '18px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {title}
          </Title>
          {onViewDetails && (
            <Button 
              type="link" 
              icon={<ArrowRightOutlined />}
              onClick={onViewDetails}
              style={{ 
                color: '#3b82f6',
                fontWeight: 500,
                padding: 0,
                fontSize: '14px'
              }}
            >
              View Details
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Primary Percentage Display */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20
        }}>
          {/* Large Percentage */}
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                color: '#16a34a',
                lineHeight: 1,
                marginBottom: 4
              }}
              role="text"
              aria-label={`${primaryPercent.toFixed(1)} percent ${primaryLabel}`}
            >
              {primaryPercent.toFixed(1)}%
            </div>
            <Text style={{ 
              fontSize: '14px',
              color: theme.token.colorTextSecondary,
              fontWeight: 500
            }}>
              {primaryLabel}
            </Text>
          </div>

          {/* Donut Chart */}
          <div 
            style={{ width: 120, height: 120 }}
            role="img"
            aria-label={`Pie chart showing ${primaryLabel} at ${primaryPercent.toFixed(1)}% and ${secondaryLabel || 'Remaining'} at ${(secondaryPercent || (100 - primaryPercent)).toFixed(1)}%`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderLabel}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Supporting Statistics */}
        {supporting.length > 0 && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            marginTop: 'auto'
          }}>
            {supporting.map((stat, index) => (
              <div key={index} style={{ textAlign: 'center' }}>
                <Statistic
                  value={stat.value}
                  valueStyle={{ 
                    fontSize: '16px',
                    fontWeight: 600,
                    color: theme.token.colorText
                  }}
                  title={
                    <Text style={{ 
                      fontSize: '12px',
                      color: theme.token.colorTextSecondary,
                      fontWeight: 500
                    }}>
                      {stat.label}
                    </Text>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default AnalyticsCard;
