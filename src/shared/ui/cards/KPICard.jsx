import React from 'react';
import { Card, Statistic, Typography } from 'antd';
import { chartTheme } from '../charts/chartTheme';

const { Text } = Typography;

const KPICard = ({ 
  title, 
  value, 
  prefix, 
  suffix, 
  precision = 0,
  status = 'default',
  trend,
  loading = false,
  style = {},
  ...props 
}) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'success':
        return {
          backgroundColor: '#f6ffed',
          borderLeft: `4px solid ${chartTheme.colors.success}`,
          color: chartTheme.colors.success
        };
      case 'warning':
        return {
          backgroundColor: '#fffbe6',
          borderLeft: `4px solid ${chartTheme.colors.warning}`,
          color: chartTheme.colors.warning
        };
      case 'error':
        return {
          backgroundColor: '#fff2f0',
          borderLeft: `4px solid ${chartTheme.colors.error}`,
          color: chartTheme.colors.error
        };
      case 'info':
        return {
          backgroundColor: '#e6f7ff',
          borderLeft: `4px solid ${chartTheme.colors.info}`,
          color: chartTheme.colors.info
        };
      default:
        return {
          backgroundColor: '#fafafa',
          borderLeft: `4px solid ${chartTheme.colors.primary}`,
          color: chartTheme.colors.primary
        };
    }
  };

  const statusStyle = getStatusStyle();

  return (
    <Card
      style={{
        ...chartTheme.kpiCard,
        ...statusStyle,
        ...style
      }}
      bodyStyle={{ padding: '20px' }}
      loading={loading}
      {...props}
    >
      <Statistic
        title={
          <Text 
            style={{ 
              fontSize: '14px', 
              color: chartTheme.colors.textSecondary,
              fontWeight: 500,
              marginBottom: '8px',
              display: 'block'
            }}
          >
            {title}
          </Text>
        }
        value={value}
        precision={precision}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{
          fontSize: '28px',
          fontWeight: 700,
          color: statusStyle.color,
          lineHeight: 1.2
        }}
      />
      {trend && (
        <div style={{ marginTop: '8px' }}>
          <Text 
            style={{ 
              fontSize: '12px', 
              color: chartTheme.colors.textSecondary 
            }}
          >
            {trend}
          </Text>
        </div>
      )}
    </Card>
  );
};

export default KPICard;
