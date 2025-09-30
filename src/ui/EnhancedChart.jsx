import React from 'react';
import { Card, Typography } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { chartTheme, chartColors, formatCurrencyTooltip, formatCurrencyLabel } from './chartTheme';

const { Title, Text } = Typography;

const EnhancedChart = ({ 
  title, 
  data, 
  type = 'bar', 
  height = 300,
  showLegend = true,
  showTooltip = true,
  xAxisKey = 'name',
  yAxisKey = 'value',
  dataKeys = ['collected', 'outstanding'],
  colors = chartColors,
  loading = false,
  emptyMessage = 'No data available',
  style = {},
  ...props 
}) => {
  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <div style={{ 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: chartTheme.colors.textSecondary 
        }}>
          <Text>{emptyMessage}</Text>
        </div>
      );
    }

    const commonProps = {
      data,
      margin: chartTheme.chart.margin
    };

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
              <XAxis 
                dataKey={xAxisKey} 
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
                tickFormatter={formatCurrencyLabel}
              />
              {showTooltip && (
                <Tooltip 
                  formatter={formatCurrencyTooltip}
                  labelStyle={{ color: chartTheme.colors.text }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: `1px solid ${chartTheme.colors.border}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
              )}
              {showLegend && <Legend />}
              {dataKeys.map((key, index) => (
                <Bar 
                  key={key}
                  dataKey={key} 
                  fill={colors[index % colors.length]}
                  radius={chartTheme.chart.barRadius}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart {...commonProps}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={yAxisKey}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              {showTooltip && (
                <Tooltip formatter={formatCurrencyTooltip} />
              )}
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
              <XAxis 
                dataKey={xAxisKey} 
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
              />
              <YAxis 
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
                tickFormatter={formatCurrencyLabel}
              />
              {showTooltip && (
                <Tooltip 
                  formatter={formatCurrencyTooltip}
                  labelStyle={{ color: chartTheme.colors.text }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: `1px solid ${chartTheme.colors.border}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
              )}
              {showLegend && <Legend />}
              {dataKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
              <XAxis 
                dataKey={xAxisKey} 
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
              />
              <YAxis 
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
                tickFormatter={formatCurrencyLabel}
              />
              {showTooltip && (
                <Tooltip 
                  formatter={formatCurrencyTooltip}
                  labelStyle={{ color: chartTheme.colors.text }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: `1px solid ${chartTheme.colors.border}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
              )}
              {showLegend && <Legend />}
              {dataKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={chartTheme.chart.strokeWidth}
                  dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card
      style={{
        ...chartTheme.kpiCard,
        ...style
      }}
      loading={loading}
      {...props}
    >
      {title && (
        <div style={{ marginBottom: '16px' }}>
          <Title level={5} style={{ margin: 0, color: chartTheme.colors.text }}>
            {title}
          </Title>
        </div>
      )}
      {renderChart()}
    </Card>
  );
};

export default EnhancedChart;
