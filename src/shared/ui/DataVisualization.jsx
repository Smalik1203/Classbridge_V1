// src/ui/DataVisualization.jsx
// Enhanced data visualization components with minimalist design

import React from 'react';
import { Typography, Space, Tooltip } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { designTokens, dataVizPalette } from './theme';

const { Text } = Typography;

/**
 * Enhanced chart container with consistent styling
 */
const ChartContainer = ({ children, title, subtitle, extra, height = 300, className = '', style = {} }) => {
  const { theme: antdTheme } = useTheme();

  return (
    <div
      className={`chart-container ${className}`}
      style={{
        background: antdTheme.token.colorBgContainer,
        borderRadius: designTokens.radius.lg,
        border: `1px solid ${antdTheme.token.colorBorder}`,
        boxShadow: designTokens.shadows.sm,
        padding: designTokens.spacing.xxl,
        ...style,
      }}
    >
      {/* Chart Header */}
      {(title || subtitle || extra) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: designTokens.spacing.lg,
            gap: designTokens.spacing.md,
          }}
        >
          <div style={{ flex: 1 }}>
            {title && (
              <Text
                strong
                style={{
                  display: 'block',
                  fontSize: antdTheme.token.fontSizeHeading5,
                  color: antdTheme.token.colorTextHeading,
                  marginBottom: subtitle ? designTokens.spacing.xs : 0,
                }}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                type="secondary"
                style={{
                  fontSize: antdTheme.token.fontSize,
                  color: antdTheme.token.colorTextSecondary,
                }}
              >
                {subtitle}
              </Text>
            )}
          </div>
          {extra && (
            <div style={{ flexShrink: 0 }}>
              {extra}
            </div>
          )}
        </div>
      )}

      {/* Chart Content */}
      <div style={{ height, width: '100%' }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Enhanced tooltip component for charts
 */
const EnhancedTooltip = ({ active, payload, label, formatter }) => {
  const { theme: antdTheme } = useTheme();

  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: antdTheme.token.colorBgElevated,
          border: `1px solid ${antdTheme.token.colorBorder}`,
          borderRadius: designTokens.radius.md,
          padding: designTokens.spacing.md,
          boxShadow: designTokens.shadows.lg,
          minWidth: '120px',
        }}
      >
        <Text
          strong
          style={{
            display: 'block',
            marginBottom: designTokens.spacing.xs,
            color: antdTheme.token.colorTextHeading,
            fontSize: antdTheme.token.fontSize,
          }}
        >
          {label}
        </Text>
        {payload.map((entry, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: designTokens.spacing.xs,
              marginBottom: designTokens.spacing.xs,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: entry.color,
              }}
            />
            <Text
              style={{
                fontSize: antdTheme.token.fontSizeSM,
                color: antdTheme.token.colorText,
              }}
            >
              {entry.name}: {formatter ? formatter(entry.value, entry.name) : entry.value}
            </Text>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Enhanced Bar Chart component
 */
export const EnhancedBarChart = ({
  data,
  title,
  subtitle,
  extra,
  height = 300,
  xAxisKey = 'name',
  yAxisKey = 'value',
  color = dataVizPalette[0],
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  className = '',
  style = {},
}) => {
  const { theme: antdTheme } = useTheme();

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      extra={extra}
      height={height}
      className={className}
      style={style}
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={antdTheme.token.colorBorder}
              opacity={0.3}
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: antdTheme.token.fontSizeSM, fill: antdTheme.token.colorTextSecondary }}
            axisLine={{ stroke: antdTheme.token.colorBorder }}
            tickLine={{ stroke: antdTheme.token.colorBorder }}
          />
          <YAxis
            tick={{ fontSize: antdTheme.token.fontSizeSM, fill: antdTheme.token.colorTextSecondary }}
            axisLine={{ stroke: antdTheme.token.colorBorder }}
            tickLine={{ stroke: antdTheme.token.colorBorder }}
          />
          {showTooltip && <RechartsTooltip content={<EnhancedTooltip />} />}
          {showLegend && <Legend />}
          <Bar
            dataKey={yAxisKey}
            fill={color}
            radius={[designTokens.radius.sm, designTokens.radius.sm, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

/**
 * Enhanced Line Chart component
 */
export const EnhancedLineChart = ({
  data,
  title,
  subtitle,
  extra,
  height = 300,
  xAxisKey = 'name',
  yAxisKey = 'value',
  color = dataVizPalette[0],
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  showArea = false,
  className = '',
  style = {},
}) => {
  const { theme: antdTheme } = useTheme();

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      extra={extra}
      height={height}
      className={className}
      style={style}
    >
      <ResponsiveContainer>
        <ChartComponent data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={antdTheme.token.colorBorder}
              opacity={0.3}
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: antdTheme.token.fontSizeSM, fill: antdTheme.token.colorTextSecondary }}
            axisLine={{ stroke: antdTheme.token.colorBorder }}
            tickLine={{ stroke: antdTheme.token.colorBorder }}
          />
          <YAxis
            tick={{ fontSize: antdTheme.token.fontSizeSM, fill: antdTheme.token.colorTextSecondary }}
            axisLine={{ stroke: antdTheme.token.colorBorder }}
            tickLine={{ stroke: antdTheme.token.colorBorder }}
          />
          {showTooltip && <RechartsTooltip content={<EnhancedTooltip />} />}
          {showLegend && <Legend />}
          {showArea ? (
            <Area
              type="monotone"
              dataKey={yAxisKey}
              stroke={color}
              fill={color}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ) : (
            <Line
              type="monotone"
              dataKey={yAxisKey}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

/**
 * Enhanced Pie Chart component
 */
export const EnhancedPieChart = ({
  data,
  title,
  subtitle,
  extra,
  height = 300,
  dataKey = 'value',
  nameKey = 'name',
  colors = dataVizPalette,
  showTooltip = true,
  showLegend = true,
  className = '',
  style = {},
}) => {
  const { theme: antdTheme } = useTheme();

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      extra={extra}
      height={height}
      className={className}
      style={style}
    >
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey={dataKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          {showTooltip && (
            <RechartsTooltip
              contentStyle={{
                backgroundColor: antdTheme.token.colorBgElevated,
                border: `1px solid ${antdTheme.token.colorBorder}`,
                borderRadius: designTokens.radius.md,
                boxShadow: designTokens.shadows.lg,
              }}
            />
          )}
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

/**
 * Enhanced Composed Chart component for complex data visualization
 */
export const EnhancedComposedChart = ({
  data,
  title,
  subtitle,
  extra,
  height = 300,
  xAxisKey = 'name',
  bars = [],
  lines = [],
  areas = [],
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  className = '',
  style = {},
}) => {
  const { theme: antdTheme } = useTheme();

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      extra={extra}
      height={height}
      className={className}
      style={style}
    >
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={antdTheme.token.colorBorder}
              opacity={0.3}
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: antdTheme.token.fontSizeSM, fill: antdTheme.token.colorTextSecondary }}
            axisLine={{ stroke: antdTheme.token.colorBorder }}
            tickLine={{ stroke: antdTheme.token.colorBorder }}
          />
          <YAxis
            tick={{ fontSize: antdTheme.token.fontSizeSM, fill: antdTheme.token.colorTextSecondary }}
            axisLine={{ stroke: antdTheme.token.colorBorder }}
            tickLine={{ stroke: antdTheme.token.colorBorder }}
          />
          {showTooltip && <RechartsTooltip content={<EnhancedTooltip />} />}
          {showLegend && <Legend />}
          
          {/* Render bars */}
          {bars.map((bar, index) => (
            <Bar
              key={index}
              dataKey={bar.dataKey}
              fill={bar.color || dataVizPalette[index % dataVizPalette.length]}
              radius={[designTokens.radius.sm, designTokens.radius.sm, 0, 0]}
            />
          ))}
          
          {/* Render lines */}
          {lines.map((line, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color || dataVizPalette[index % dataVizPalette.length]}
              strokeWidth={2}
              dot={{ fill: line.color || dataVizPalette[index % dataVizPalette.length], strokeWidth: 2, r: 4 }}
            />
          ))}
          
          {/* Render areas */}
          {areas.map((area, index) => (
            <Area
              key={index}
              type="monotone"
              dataKey={area.dataKey}
              stroke={area.color || dataVizPalette[index % dataVizPalette.length]}
              fill={area.color || dataVizPalette[index % dataVizPalette.length]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default {
  ChartContainer,
  EnhancedTooltip,
  EnhancedBarChart,
  EnhancedLineChart,
  EnhancedPieChart,
  EnhancedComposedChart,
};
