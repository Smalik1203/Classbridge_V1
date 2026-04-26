import React from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

/**
 * Pre-themed area trend chart. Single value series.
 *
 *   <TrendArea
 *     data={[{ date, rate }, ...]}
 *     xKey="date"
 *     yKey="rate"
 *     yFormatter={(v) => `${v}%`}
 *     domain={[0, 100]}
 *     color="#10b981"
 *     height={260}
 *     average={87.4}
 *   />
 */
export default function TrendArea({
  data = [], xKey = 'date', yKey = 'value', height = 260,
  domain, color = '#6366F1', secondaryColor,
  yFormatter = (v) => v, xFormatter = (v) => v,
  average,
  tooltipLabelFormatter = (v) => v,
  hideAxes = false,
  smooth = true,
  fillStops = [0.55, 0.02],
}) {
  const id = `g-${color.replace('#', '')}-${Math.random().toString(36).slice(2, 7)}`;
  const stroke = color;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={fillStops[0]} />
            <stop offset="100%" stopColor={stroke} stopOpacity={fillStops[1]} />
          </linearGradient>
        </defs>
        {!hideAxes && <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />}
        {!hideAxes && (
          <XAxis
            dataKey={xKey}
            tickFormatter={xFormatter}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tick={{ fill: '#64748b', fontSize: 11 }}
            minTickGap={24}
          />
        )}
        {!hideAxes && (
          <YAxis
            domain={domain}
            tickFormatter={yFormatter}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            width={40}
          />
        )}
        {average != null && (
          <ReferenceLine
            y={average}
            stroke="#94a3b8" strokeDasharray="4 4"
            label={{ value: `Avg ${yFormatter(average)}`, position: 'right', fill: '#64748b', fontSize: 10 }}
          />
        )}
        <Tooltip
          labelFormatter={tooltipLabelFormatter}
          formatter={(v, n) => [yFormatter(v), n]}
          contentStyle={{
            borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: 12,
          }}
          cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type={smooth ? 'monotone' : 'linear'}
          dataKey={yKey}
          stroke={stroke}
          strokeWidth={2.5}
          fill={`url(#${id})`}
          connectNulls
          activeDot={{ r: 5, fill: stroke, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
