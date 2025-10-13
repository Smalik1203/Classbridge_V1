// src/ui/GeneralBarChart.jsx
// General purpose bar chart component for displaying category data

import React from 'react';
import { Card, Typography } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { designTokens } from '../theme';

const { Title, Text } = Typography;

/**
 * General bar chart component for displaying category data
 * @param {Object} props - Component props
 * @param {string} props.title - Chart title
 * @param {Array} props.data - Chart data array
 * @param {string} props.dataKey - Key for the data values (e.g., 'value', 'count')
 * @param {string} props.nameKey - Key for the category names (e.g., 'name', 'category')
 * @param {string} props.color - Color for the bars
 * @param {Object} props.config - Additional chart configuration
 */
const GeneralBarChart = ({
  title,
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  color = '#3b82f6',
  config = {},
  ...props
}) => {
  const { antdTheme } = useTheme();

  // Default chart configuration
  const defaultConfig = {
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
    barSize: 40,
    radius: [4, 4, 0, 0]
  };

  const chartConfig = { ...defaultConfig, ...config };

  // Custom tooltip formatter
  const formatTooltip = (value, name, props) => {
    return [`${value}`, props.payload[nameKey] || name];
  };

  return (
    <Card
      style={{
        borderRadius: designTokens.borderRadius.lg,
        border: 'none',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        background: antdTheme?.token?.colorBgContainer,
        height: '100%'
      }}
      bodyStyle={{
        padding: designTokens.spacing.lg,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      {...props}
    >
      {title && (
        <div style={{ marginBottom: designTokens.spacing.lg }}>
          <Title
            level={5}
            style={{
              margin: 0,
              color: antdTheme?.token?.colorText,
              fontWeight: designTokens.fontWeight.semibold
            }}
          >
            {title}
          </Title>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={chartConfig.margin}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={antdTheme?.token?.colorBorder || '#e5e7eb'} 
            />
            <XAxis 
              dataKey={nameKey}
              tick={{ 
                fontSize: 12, 
                fill: antdTheme?.token?.colorTextSecondary || '#64748b' 
              }}
              axisLine={{ stroke: antdTheme?.token?.colorBorder || '#e5e7eb' }}
            />
            <YAxis 
              tick={{ 
                fontSize: 12, 
                fill: antdTheme?.token?.colorTextSecondary || '#64748b' 
              }}
              axisLine={{ stroke: antdTheme?.token?.colorBorder || '#e5e7eb' }}
            />
            <Tooltip 
              formatter={formatTooltip}
              contentStyle={{
                backgroundColor: antdTheme?.token?.colorBgElevated || '#ffffff',
                border: `1px solid ${antdTheme?.token?.colorBorder || '#e5e7eb'}`,
                borderRadius: designTokens.borderRadius.md
              }}
            />
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={chartConfig.radius}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default GeneralBarChart;
