import React from 'react';

/**
 * Compact bar strip — N values rendered as bars with labels.
 *
 *   <Sparkbar
 *     values={[
 *       { label: 'Mon', value: 92 },
 *       { label: 'Tue', value: 88 },
 *       ...
 *     ]}
 *     max={100}
 *     height={48}
 *     accent="#fff"   // for use on gradient hero backgrounds
 *   />
 */
export default function Sparkbar({
  values = [], max, height = 48, accent = '#6366F1', dim = 'rgba(99,102,241,0.18)',
  showLabels = true, valueAsLabel = false,
}) {
  if (!values.length) return null;
  const top = max ?? Math.max(...values.map((v) => Number(v.value) || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, width: '100%' }}>
      {values.map((d, i) => {
        const v = Number(d.value) || 0;
        const h = Math.max(2, (v / top) * height);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%', height: h, background: v > 0 ? accent : dim,
              borderRadius: '4px 4px 2px 2px',
              transition: 'height 0.3s ease',
              boxShadow: v > 0 ? `0 2px 4px ${accent}33` : 'none',
            }} title={`${d.label}: ${valueAsLabel ? v : `${v}%`}`} />
            {showLabels && (
              <span style={{ fontSize: 10, color: 'currentColor', opacity: 0.85, fontWeight: 500 }}>
                {d.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
