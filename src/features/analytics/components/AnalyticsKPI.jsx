import React from 'react';
import { Card, Statistic } from 'antd';

export default function AnalyticsKPI({ title, value, suffix, prefix, color, valueStyle = {} }) {
  return (
    <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }}>
      <Statistic
        title={<span style={{ color: '#6b7280', fontSize: 13 }}>{title}</span>}
        value={value}
        suffix={suffix}
        prefix={prefix}
        valueStyle={{ color: color || '#1f2937', fontSize: 24, fontWeight: 600, ...valueStyle }}
      />
    </Card>
  );
}
