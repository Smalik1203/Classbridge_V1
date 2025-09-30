// src/ui/AttendanceChart.jsx
// Modern chart component specifically designed for attendance analytics

import React from 'react';
import { Card, Typography } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { designTokens } from './theme';

const { Title, Text } = Typography;

/**
 * Enhanced chart component for attendance analytics with consistent styling
 * @param {Object} props - Component props
 * @param {string} props.title - Chart title
 * @param {string} props.type - Chart type: 'bar', 'pie', 'line', 'area'
 * @param {Array} props.data - Chart data
 * @param {Object} props.config - Chart configuration
 * @param {React.ReactNode} props.children - Custom chart content
 */
const AttendanceChart = ({
  title,
  type = 'bar',
  data = [],
  config = {},
  children,
  ...props
}) => {
  const { antdTheme } = useTheme();

  // Attendance-specific color palette - only real categories
  const attendanceColors = {
    present: '#10b981',    // green-500
    absent: '#ef4444',     // red-500
    late: '#f59e0b'        // amber-500
  };

  // Default chart configurations
  const defaultConfigs = {
    bar: {
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      barSize: 40,
      radius: [4, 4, 0, 0]
    },
    pie: {
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      innerRadius: 60,
      outerRadius: 100,
      paddingAngle: 2
    },
    line: {
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      strokeWidth: 3,
      dot: { r: 4 }
    },
    area: {
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
      strokeWidth: 2
    }
  };

  const chartConfig = { ...defaultConfigs[type], ...config };

  // Custom tooltip formatter
  const formatTooltip = (value, name, props) => {
    const attendanceLabels = {
      present: 'Present',
      absent: 'Absent',
      late: 'Late'
    };
    
    return [
      `${value} ${typeof value === 'number' ? 'students' : ''}`,
      attendanceLabels[name] || name
    ];
  };

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data,
      margin: chartConfig.margin
    };

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={antdTheme?.token?.colorBorder} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: antdTheme?.token?.colorTextSecondary }}
              axisLine={{ stroke: antdTheme?.token?.colorBorder }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: antdTheme?.token?.colorTextSecondary }}
              axisLine={{ stroke: antdTheme?.token?.colorBorder }}
            />
            <Tooltip 
              formatter={formatTooltip}
              contentStyle={{
                backgroundColor: antdTheme?.token?.colorBgElevated,
                border: `1px solid ${antdTheme?.token?.colorBorder}`,
                borderRadius: designTokens.borderRadius.md
              }}
            />
            <Legend />
            {Object.keys(attendanceColors).map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={attendanceColors[key]}
                radius={chartConfig.radius}
              />
            ))}
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart {...commonProps}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={chartConfig.innerRadius}
              outerRadius={chartConfig.outerRadius}
              paddingAngle={chartConfig.paddingAngle}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={attendanceColors[entry.name] || attendanceColors.total} />
              ))}
            </Pie>
            <Tooltip formatter={formatTooltip} />
            <Legend />
          </PieChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={antdTheme?.token?.colorBorder} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: antdTheme?.token?.colorTextSecondary }}
              axisLine={{ stroke: antdTheme?.token?.colorBorder }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: antdTheme?.token?.colorTextSecondary }}
              axisLine={{ stroke: antdTheme?.token?.colorBorder }}
            />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {Object.keys(attendanceColors).map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={attendanceColors[key]}
                strokeWidth={chartConfig.strokeWidth}
                dot={chartConfig.dot}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={antdTheme?.token?.colorBorder} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: antdTheme?.token?.colorTextSecondary }}
              axisLine={{ stroke: antdTheme?.token?.colorBorder }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: antdTheme?.token?.colorTextSecondary }}
              axisLine={{ stroke: antdTheme?.token?.colorBorder }}
            />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {Object.keys(attendanceColors).map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="1"
                stroke={attendanceColors[key]}
                fill={attendanceColors[key]}
                strokeWidth={chartConfig.strokeWidth}
              />
            ))}
          </AreaChart>
        );

      default:
        return children;
    }
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
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default AttendanceChart;
