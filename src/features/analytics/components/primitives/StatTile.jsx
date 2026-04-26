import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

/**
 * Compact non-hero stat tile. Use 3-4 in a row beside a HeroStat.
 *
 *   <StatTile
 *     label="Present days"
 *     value="1,847"
 *     accent="#10b981"
 *     icon={<CheckCircleOutlined />}
 *     trend={{ value: '+12 vs last week', positive: true }}
 *   />
 */
export default function StatTile({
  label, value, suffix, prefix, accent = '#6366F1', icon, trend, foot, dim = false,
}) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #eef2ff',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      minHeight: 96,
      position: 'relative',
      overflow: 'hidden',
      opacity: dim ? 0.7 : 1,
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && (
          <span style={{
            width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: `${accent}1A`, color: accent, borderRadius: 7, fontSize: 13,
          }}>
            {icon}
          </span>
        )}
        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {label}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
        {prefix && <span style={{ fontSize: 14, color: '#64748b' }}>{prefix}</span>}
        <span style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: -0.5, lineHeight: 1 }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: 14, color: '#64748b' }}>{suffix}</span>}
      </div>
      {trend && (
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: trend.positive === true ? '#10b981' : trend.positive === false ? '#ef4444' : '#64748b',
        }}>
          {trend.value}
        </span>
      )}
      {foot && <div style={{ marginTop: 8 }}>{foot}</div>}
    </div>
  );
}
