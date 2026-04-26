import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

/**
 * SVG circular progress ring.
 *   <RingStat value={87} max={100} label="Attendance" subLabel="of 105 students" tone="success" />
 *
 * tone: 'success' | 'warning' | 'critical' | 'brand' | hex
 */
export default function RingStat({
  value, max = 100, label, subLabel, size = 140, stroke = 12, tone = 'brand',
  format = (v) => `${Math.round(v)}%`,
}) {
  const TONE_HEX = {
    brand: '#6366F1',
    success: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    info: '#0ea5e9',
  };
  const color = TONE_HEX[tone] || tone || '#6366F1';
  const pct = Math.max(0, Math.min(1, (value || 0) / (max || 1)));

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * pct;
  const gap = circumference - dash;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={cx} cy={cy} r={r}
            stroke="#eef2ff" strokeWidth={stroke} fill="none"
          />
          <circle
            cx={cx} cy={cy} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: size > 110 ? 30 : 22, fontWeight: 700, lineHeight: 1, color: '#0f172a', letterSpacing: -0.5 }}>
            {format(value)}
          </span>
          {subLabel && (
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{subLabel}</Text>
          )}
        </div>
      </div>
      {label && (
        <Text style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{label}</Text>
      )}
    </div>
  );
}
