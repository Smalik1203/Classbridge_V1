import React from 'react';
import { Row, Col, Empty, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { SectionCard } from './primitives';

/**
 * Side-by-side AY-vs-AY comparison panel. Renders only when both AYs
 * have data; opt out of the primary view's noise.
 *
 *   <AyComparePanel
 *     primary={{ label: '2025-2026', kpis: { rate, presentDays, absentDays, distinctStudents, distinctDays } }}
 *     compare={{ label: '2024-2025', kpis: {...} }}
 *     metrics={[
 *       { key: 'rate', label: 'Attendance rate', unit: '%', betterIs: 'higher', precision: 1 },
 *       { key: 'distinctDays', label: 'Days marked', betterIs: 'higher' },
 *       { key: 'distinctStudents', label: 'Students tracked' },
 *       { key: 'presentDays', label: 'Present (student-days)', betterIs: 'higher' },
 *       { key: 'absentDays', label: 'Absent (student-days)', betterIs: 'lower' },
 *     ]}
 *   />
 */
export default function AyComparePanel({ primary, compare, metrics, title = 'Year-on-year comparison' }) {
  if (!primary?.kpis || !compare?.kpis) {
    return (
      <SectionCard title={title} accent="#a855f7" hint="Pick a second AY at the top to compare">
        <Empty description="Toggle Compare in the AY picker to see side-by-side metrics for two academic years." />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={title}
      hint={`${primary.label} vs ${compare.label} · school-wide`}
      accent="#a855f7"
    >
      {/* Header row — labels for the two columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
        paddingBottom: 12,
        marginBottom: 12,
        borderBottom: '1px dashed #eef2ff',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: 0.4, textTransform: 'uppercase' }}>
          Metric
        </div>
        <ColHeader label={primary.label} accent="#06b6d4" tag="Current" />
        <ColHeader label={compare.label} accent="#a855f7" tag="Compare" dashed />
      </div>

      {/* One row per metric */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {metrics.map((m) => {
          const a = primary.kpis[m.key];
          const b = compare.kpis[m.key];
          return (
            <MetricRow key={m.key} metric={m} primaryValue={a} compareValue={b} />
          );
        })}
      </div>
    </SectionCard>
  );
}

function ColHeader({ label, accent, tag, dashed }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 12, height: 3, borderRadius: 2,
          background: dashed ? 'transparent' : accent,
          backgroundImage: dashed
            ? `repeating-linear-gradient(90deg, ${accent} 0 4px, transparent 4px 7px)`
            : 'none',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</span>
      </div>
      <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
        {tag}
      </span>
    </div>
  );
}

function MetricRow({ metric, primaryValue, compareValue }) {
  const { label, unit = '', precision = 0, betterIs, hint } = metric;
  const a = primaryValue == null ? null : Number(primaryValue);
  const b = compareValue == null ? null : Number(compareValue);
  const fmt = (v) => v == null ? '—' : `${formatNum(v, precision)}${unit}`;

  // Delta: a - b. Direction tone depends on `betterIs`.
  let delta = null;
  let tone = 'neutral'; // 'positive' | 'negative' | 'neutral'
  if (a != null && b != null) {
    delta = Math.round((a - b) * 10) / 10;
    if (delta === 0) tone = 'neutral';
    else if (betterIs === 'higher') tone = delta > 0 ? 'positive' : 'negative';
    else if (betterIs === 'lower')  tone = delta < 0 ? 'positive' : 'negative';
    else                            tone = 'neutral';
  }

  const TONE_COLORS = {
    positive: { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669', icon: <ArrowUpOutlined /> },
    negative: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: <ArrowDownOutlined /> },
    neutral:  { bg: '#f1f5f9', border: '#e2e8f0', text: '#64748b', icon: <MinusOutlined /> },
  };
  const t = TONE_COLORS[tone];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 12,
      alignItems: 'center',
      padding: '8px 0',
    }}>
      {/* Metric label + delta chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tooltip title={hint || ''}>
          <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{label}</span>
        </Tooltip>
        {delta != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: t.bg, color: t.text, border: `1px solid ${t.border}`,
            padding: '2px 8px', borderRadius: 999,
            fontSize: 11, fontWeight: 600,
          }}>
            {t.icon}
            {delta === 0 ? '0' : `${delta > 0 ? '+' : ''}${formatNum(delta, precision)}${unit}`}
          </span>
        )}
      </div>

      <ValueCell value={fmt(a)} accent="#06b6d4" />
      <ValueCell value={fmt(b)} accent="#a855f7" dashed />
    </div>
  );
}

function ValueCell({ value, accent, dashed }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '8px 12px',
      background: dashed ? '#faf5ff' : '#ecfeff',
      border: `1px solid ${dashed ? '#e9d5ff' : '#a5f3fc'}`,
      borderRadius: 8,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 999, background: accent, display: 'inline-block',
      }} />
      <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: -0.3 }}>
        {value}
      </span>
    </div>
  );
}

function formatNum(v, precision) {
  if (precision > 0) return Number(v).toFixed(precision);
  return Number(v).toLocaleString('en-IN');
}
