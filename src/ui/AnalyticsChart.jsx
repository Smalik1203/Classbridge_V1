// src/ui/AnalyticsChart.jsx
// Wrapper component for consistent chart styling

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { chartTheme, chartColors } from './chartTheme';

const AnalyticsChart = ({ 
  type = 'bar',
  data = [],
  config = {},
  height = 200,
  className = '',
  style = {}
}) => {
  const { isDarkMode, theme } = useTheme();
  
  const defaultConfig = {
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
    ...config
  };

  const renderChart = () => {
    const commonProps = {
      data,
      height,
      ...defaultConfig
    };

    switch (type) {
      case 'pie':
        return (
          <PieChart {...commonProps}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [value, '']} />
            <Legend />
          </PieChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#f0f0f0'} />
            <XAxis dataKey="name" stroke={isDarkMode ? '#9ca3af' : '#666'} fontSize={12} />
            <YAxis stroke={isDarkMode ? '#9ca3af' : '#666'} fontSize={12} />
            <Tooltip 
              contentStyle={{
                backgroundColor: theme.token.colorBgContainer,
                border: `1px solid ${theme.token.colorBorder}`,
                borderRadius: '8px',
                boxShadow: isDarkMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                color: theme.token.colorText
              }}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={chartColors[0]} 
              strokeWidth={2}
              dot={{ fill: chartColors[0], strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#f0f0f0'} />
            <XAxis dataKey="name" stroke={isDarkMode ? '#9ca3af' : '#666'} fontSize={12} />
            <YAxis stroke={isDarkMode ? '#9ca3af' : '#666'} fontSize={12} />
            <Tooltip 
              contentStyle={{
                backgroundColor: theme.token.colorBgContainer,
                border: `1px solid ${theme.token.colorBorder}`,
                borderRadius: '8px',
                boxShadow: isDarkMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                color: theme.token.colorText
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={chartColors[0]} 
              fill={chartColors[0]}
              fillOpacity={0.3}
            />
          </AreaChart>
        );

      case 'bar':
      default:
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#f0f0f0'} />
            <XAxis dataKey="name" stroke={isDarkMode ? '#9ca3af' : '#666'} fontSize={12} />
            <YAxis stroke={isDarkMode ? '#9ca3af' : '#666'} fontSize={12} />
            <Tooltip 
              contentStyle={{
                backgroundColor: theme.token.colorBgContainer,
                border: `1px solid ${theme.token.colorBorder}`,
                borderRadius: '8px',
                boxShadow: isDarkMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                color: theme.token.colorText
              }}
            />
            <Bar 
              dataKey="value" 
              fill={chartColors[0]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );
    }
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: theme.token.colorTextSecondary,
        fontSize: '14px',
        ...style
      }}>
        No data available
      </div>
    );
  }

  return (
    <div className={`analytics-chart ${className}`} style={style}>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default AnalyticsChart;
