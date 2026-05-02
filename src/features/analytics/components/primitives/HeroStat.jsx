import React from 'react';
import { Typography, Space } from 'antd';

const { Text } = Typography;

const GRADIENTS = {
  brand:    'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)',
  emerald:  'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  amber:    'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  rose:     'linear-gradient(135deg, #dc2626 0%, #f43f5e 100%)',
  ocean:    'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
  midnight: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
  forest:   'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
};

/**
 * Big hero stat with optional inline sparkbars.
 *
 * <HeroStat
 *   gradient="brand"
 *   eyebrow="Attendance · AY 2025-26"
 *   value="92.4"
 *   suffix="%"
 *   label="Avg attendance"
 *   delta={{ value: '+2.1%', positive: true }}
 *   foot={<Sparkbar values={...} />}
 * />
 */
export default function HeroStat({
  gradient = 'brand', eyebrow, value, suffix, prefix, label, delta, icon,
  foot, height = 180, dim = false,
}) {
  const bg = GRADIENTS[gradient] || gradient;
  return (
    <div style={{
      background: bg, color: '#fff', borderRadius: 16, padding: '20px 24px',
      minHeight: height, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: '0 8px 24px -8px rgba(99,102,241,0.35)',
      position: 'relative', overflow: 'hidden',
      opacity: dim ? 0.7 : 1,
    }}>
      {/* Decorative diffuse blob */}
      <div aria-hidden style={{
        position: 'absolute', right: -40, top: -40, width: 180, height: 180,
        background: 'radial-gradient(closest-side, rgba(255,255,255,0.18), transparent)',
        pointerEvents: 'none',
      }} />

      <Space direction="vertical" size={2} style={{ position: 'relative', zIndex: 1 }}>
        {(eyebrow || icon) && (
          <Space size={6}>
            {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
            {eyebrow && (
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
                {eyebrow}
              </Text>
            )}
          </Space>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {prefix && <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.9 }}>{prefix}</span>}
          <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, letterSpacing: -1.2 }}>
            {value}
          </span>
          {suffix && <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.9 }}>{suffix}</span>}
        </div>
        {label && (
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{label}</Text>
        )}
        {delta && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, marginTop: 4,
          }}>
            {delta.value}
            {delta.label && <span style={{ opacity: 0.85 }}>· {delta.label}</span>}
          </span>
        )}
      </Space>

      {foot && (
        <div style={{ position: 'relative', zIndex: 1, marginTop: 16 }}>
          {foot}
        </div>
      )}
    </div>
  );
}

export const HERO_GRADIENTS = GRADIENTS;
