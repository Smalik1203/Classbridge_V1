import React from 'react';
import { Typography, Space } from 'antd';

const { Text } = Typography;

/**
 * Section card with a tighter, more editorial feel than AntD's default Card.
 *
 *   <SectionCard
 *     title="Daily attendance trend"
 *     hint="AY 2025-26 · 64 school days"
 *     accent="#6366F1"
 *     extra={<Button>Export</Button>}
 *   >
 *     <TrendArea ... />
 *   </SectionCard>
 */
export default function SectionCard({
  title, hint, accent, extra, children, padded = true, style, bodyStyle,
}) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #eef2ff',
      borderRadius: 14,
      overflow: 'hidden',
      ...style,
    }}>
      {(title || hint || extra) && (
        <div style={{
          padding: '14px 18px 10px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <Space direction="vertical" size={2}>
            <Space size={8} align="center">
              {accent && (
                <span style={{ width: 4, height: 16, borderRadius: 2, background: accent, display: 'inline-block' }} />
              )}
              {title && (
                <Text strong style={{ fontSize: 15, color: '#0f172a' }}>{title}</Text>
              )}
            </Space>
            {hint && (
              <Text style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 500 }}>
                {hint}
              </Text>
            )}
          </Space>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div style={{ padding: padded ? 18 : 0, ...bodyStyle }}>
        {children}
      </div>
    </div>
  );
}
