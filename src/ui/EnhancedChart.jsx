import React from 'react';
import { Card, Typography } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { chartTheme, chartColors, formatCurrencyTooltip, formatCurrencyLabel } from './chartTheme';
import { formatINRCompact, formatPct } from '../utils/formatting';

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
  chartProps = {},
  xAxisProps = {},
  yAxisProps = {},
  ...props 
}) => {
  // Chart configuration

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
            <BarChart 
              {...commonProps}
              layout={chartProps.layout || "horizontal"}
              barCategoryGap={chartProps.barCategoryGap || "20%"}
              barGap={chartProps.barGap || 4}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
              <XAxis 
                dataKey={chartProps.layout === "horizontal" ? undefined : xAxisKey}
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
                type={chartProps.layout === "horizontal" ? (xAxisProps.type || "number") : (xAxisProps.type || "category")}
                domain={chartProps.layout === "horizontal" ? (xAxisProps.domain || [0, 100]) : (xAxisProps.domain || [0, 'dataMax + 10%'])}
                tickFormatter={chartProps.layout === "horizontal" ? (xAxisProps.tickFormatter || ((value) => value + '%')) : (xAxisProps.tickFormatter || ((value) => {
                  if (value >= 10000000) return `₹${(value/10000000).toFixed(1)} Cr`;
                  if (value >= 100000) return `₹${(value/100000).toFixed(1)} L`;
                  if (value >= 1000) return `₹${(value/1000).toFixed(1)} K`;
                  return `₹${value.toLocaleString('en-IN')}`;
                }))}
                angle={chartProps.layout === "horizontal" ? 0 : -30}
                textAnchor={chartProps.layout === "horizontal" ? "middle" : "end"}
                height={chartProps.layout === "horizontal" ? 40 : 80}
                interval={0}
                tickMargin={8}
              />
              <YAxis 
                dataKey={chartProps.layout === "horizontal" ? (yAxisProps.dataKey || "name") : undefined}
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
                type={chartProps.layout === "horizontal" ? (yAxisProps.type || "category") : (yAxisProps.type || "number")}
                width={yAxisProps.width || 60}
                tickFormatter={chartProps.layout === "horizontal" ? undefined : (yAxisProps.tickFormatter || ((value) => {
                  if (value >= 10000000) return `₹${(value/10000000).toFixed(1)} Cr`;
                  if (value >= 100000) return `₹${(value/100000).toFixed(1)} L`;
                  if (value >= 1000) return `₹${(value/1000).toFixed(1)} K`;
                  return `₹${value.toLocaleString('en-IN')}`;
                }))}
                domain={chartProps.layout === "horizontal" ? undefined : (yAxisProps.domain || [0, 'dataMax + 10%'])}
                allowDecimals={false}
              />
              {showTooltip && (
                <Tooltip 
                  formatter={(value, name, props) => {
                    // For percentage charts, show both percentage and raw amount
                    if (xAxisProps.type === "number" && xAxisProps.domain?.[1] === 100) {
                      const rawValue = props.payload?.total ? 
                        (name === 'collectedPct' ? 
                          (props.payload.collected || 0) : 
                          (props.payload.outstanding || 0)) : value;
                      return [`${formatPct(value)} (${formatINRCompact(rawValue)})`, name === 'collectedPct' ? 'Collected' : 'Outstanding'];
                    }
                    return [formatINRCompact(value), name];
                  }}
                  labelStyle={{ color: chartTheme.colors.text }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: `1px solid ${chartTheme.colors.border}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
              )}
              {showLegend && <Legend verticalAlign="bottom" height={36} />}
              {dataKeys.map((key, index) => (
                <Bar 
                  key={key}
                  dataKey={key} 
                  fill={colors[index % colors.length]}
                  radius={chartProps.layout === "horizontal" ? [4, 4, 4, 4] : [6, 6, 0, 0]}
                  maxBarSize={chartProps.maxBarSize || 28}
                  stackId={chartProps.stackId}
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
                tickMargin={8}
              />
              <YAxis 
                stroke={chartTheme.colors.textSecondary}
                fontSize={chartTheme.chart.fontSize}
                tickFormatter={(value) => {
                  if (value >= 10000000) return `₹${(value/10000000).toFixed(1)}Cr`;
                  if (value >= 100000) return `₹${(value/100000).toFixed(1)}L`;
                  if (value >= 1000) return `₹${(value/1000).toFixed(1)}k`;
                  return `₹${value}`;
                }}
                domain={[0, 'dataMax + 10%']}
                allowDecimals={false}
              />
              {showTooltip && (
                <Tooltip 
                  formatter={(value, name) => {
                    const formattedValue = value >= 10000000 ? `₹${(value/10000000).toFixed(1)}Cr` :
                                         value >= 100000 ? `₹${(value/100000).toFixed(1)}L` :
                                         value >= 1000 ? `₹${(value/1000).toFixed(1)}k` :
                                         `₹${value}`;
                    return [formattedValue, name];
                  }}
                  labelStyle={{ color: chartTheme.colors.text }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: `1px solid ${chartTheme.colors.border}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
              )}
              {showLegend && <Legend verticalAlign="bottom" height={36} />}
              {dataKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
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
                  formatter={(value, name) => [formatINRCompact(value), name]}
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
