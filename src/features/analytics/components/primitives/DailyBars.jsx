import React, { useMemo, useState, useEffect, useRef, useId } from 'react';
import dayjs from 'dayjs';

/**
 * Per-day vertical bars. Each day is one bar; days with no data are
 * rendered as a faint dashed placeholder so the gap is honest.
 *
 *   <DailyBars
 *     data={[{ date: '2025-04-01', rate: 92, noData: false, ... }, ...]}
 *     dateKey="date"
 *     valueKey="rate"
 *     valueFormat={(v) => `${v}%`}
 *     domain={[0, 100]}
 *     onSelectDay={(d) => ...}
 *   />
 */
export default function DailyBars({
  data = [],
  dateKey = 'date',
  valueKey = 'rate',
  valueFormat = (v) => `${v}%`,
  domain = [0, 100],
  height = 240,
  showAxis = true,
  groupBy = 'day',  // 'day' | 'week' | 'month'
  minBarWidth = 6,  // bars below this width force horizontal-scroll mode
  showTrendLine = true, // overlay a connecting trend line on top of the bars
  trendColor = '#06b6d4', // cyan accent for the line (matches the reference image)
  // Fixed window per granularity (anchored on today by default).
  // Each bucket without input data renders as "no data" — never empty space.
  windowDays   = 30,  // day mode
  windowWeeks  = 4,   // week mode
  windowMonths = 12,  // month mode
  windowAnchor = null, // dayjs date OR null = today
  // Optional second series. Same shape as `data`. Drawn as a thinner line
  // overlay alongside the primary trend line (does NOT render bars).
  // Useful for AY-vs-AY overlays. We align the compare series to the
  // primary buckets BY POSITION (day i in primary window vs day i in
  // compare window), not by calendar date.
  compareData = null,
  compareAnchor = null, // independent anchor for the compare series
  compareColor = '#a855f7',
  compareLabel = null, // shown in tooltip
  onSelectDay,
  detailRender,    // (row) => ReactNode for tooltip body
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [hoverPos, setHoverPos] = useState(null); // { x, y } in viewport coords
  const plotRef = useRef(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const reactId = useId();
  // SVG ids must be valid CSS selectors — strip ":" that React adds.
  const safeId = reactId.replace(/:/g, '');

  // Measure plot area width so we can decide flex vs scroll dynamically.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect?.width || el.clientWidth;
        if (w) setPlotWidth(w);
      }
    });
    ro.observe(el);
    setPlotWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Build a FIXED-WINDOW bucket list per granularity. Each bucket renders
  // as a bar; if no input row has data inside it, the bar shows "no data".
  //
  //   day   → last `windowDays` days
  //   week  → last `windowWeeks` ISO-weeks
  //   month → last `windowMonths` calendar months
  //
  // Anchored on `windowAnchor` (or today). The user gets a consistent,
  // easy-to-read trailing window regardless of how much data is marked.
  const grouped = useMemo(() => {
    const mode = groupBy;
    const anchor = windowAnchor ? dayjs(windowAnchor) : dayjs();

    // Index input rows by their bucket key for O(1) lookup.
    const keyOf = (d) => {
      const x = dayjs(d);
      if (mode === 'week')  return x.startOf('week').format('YYYY-MM-DD');
      if (mode === 'month') return x.format('YYYY-MM');
      return x.format('YYYY-MM-DD');
    };
    const inputByKey = new Map();
    data.forEach((r) => {
      const k = keyOf(r[dateKey]);
      if (!inputByKey.has(k)) inputByKey.set(k, []);
      inputByKey.get(k).push(r);
    });

    // Generate the window's bucket keys, oldest → newest.
    const buckets = [];
    if (mode === 'day') {
      for (let i = windowDays - 1; i >= 0; i--) {
        const d = anchor.subtract(i, 'day');
        buckets.push({ key: d.format('YYYY-MM-DD'), label: d });
      }
    } else if (mode === 'week') {
      for (let i = windowWeeks - 1; i >= 0; i--) {
        const d = anchor.subtract(i, 'week').startOf('week');
        buckets.push({ key: d.format('YYYY-MM-DD'), label: d });
      }
    } else {
      for (let i = windowMonths - 1; i >= 0; i--) {
        const d = anchor.subtract(i, 'month').startOf('month');
        buckets.push({ key: d.format('YYYY-MM'), label: d });
      }
    }

    // Aggregate input rows into the fixed buckets.
    return buckets.map(({ key, label }) => {
      const rows = inputByKey.get(key) || [];
      const dataRows = rows.filter((r) => !r.noData && r[valueKey] != null);
      const sum = dataRows.reduce((a, r) => a + (r[valueKey] || 0), 0);
      const counts = { present: 0, absent: 0, late: 0, holiday: 0, leave: 0, total: 0 };
      rows.forEach((r) => {
        ['present','absent','late','holiday','leave','total'].forEach((k) => { counts[k] += r[k] || 0; });
      });
      const rate = dataRows.length ? Math.round((sum / dataRows.length) * 10) / 10 : null;
      return {
        [dateKey]: key,
        ...counts,
        [valueKey]: rate,
        noData: dataRows.length === 0,
        _mode: mode,
        _bucketSize: rows.length,
        _label: label,
      };
    });
  }, [data, dateKey, valueKey, groupBy, windowDays, windowWeeks, windowMonths, windowAnchor]);

  const bars = grouped;

  // Compare series — bucket-by-position. Same window-size as primary, but
  // anchored on `compareAnchor`. Returns one value per bar position, or
  // null if no data for that position. Length matches `bars.length`.
  const compareBars = useMemo(() => {
    if (!compareData || !compareData.length) return null;
    const anchor = compareAnchor ? dayjs(compareAnchor) : dayjs();
    const mode = groupBy;
    const keyOf = (d) => {
      const x = dayjs(d);
      if (mode === 'week')  return x.startOf('week').format('YYYY-MM-DD');
      if (mode === 'month') return x.format('YYYY-MM');
      return x.format('YYYY-MM-DD');
    };
    const inputByKey = new Map();
    compareData.forEach((r) => {
      const k = keyOf(r[dateKey]);
      if (!inputByKey.has(k)) inputByKey.set(k, []);
      inputByKey.get(k).push(r);
    });
    const positions = bars.length;
    const series = [];
    for (let i = positions - 1; i >= 0; i--) {
      let key;
      if (mode === 'day')        key = anchor.subtract(i, 'day').format('YYYY-MM-DD');
      else if (mode === 'week')  key = anchor.subtract(i, 'week').startOf('week').format('YYYY-MM-DD');
      else                       key = anchor.subtract(i, 'month').startOf('month').format('YYYY-MM');
      const rows = inputByKey.get(key) || [];
      const dataRows = rows.filter((r) => !r.noData && r[valueKey] != null);
      const sum = dataRows.reduce((a, r) => a + (r[valueKey] || 0), 0);
      const rate = dataRows.length ? Math.round((sum / dataRows.length) * 10) / 10 : null;
      // Push from oldest → newest (matching primary order).
      series.unshift({ key, rate, noData: rate == null });
    }
    return series;
  }, [compareData, compareAnchor, bars.length, groupBy, dateKey, valueKey]);

  if (!bars.length) return null;

  const [domMin, domMax] = domain;
  const range = domMax - domMin || 1;

  const width = '100%';
  const innerH = height - (showAxis ? 24 : 0);
  const yTicks = [0, 25, 50, 75, 100].filter((t) => t >= domMin && t <= domMax);

  const colorFor = (v) => {
    if (v == null) return '#e2e8f0';
    if (v >= 90) return '#10b981';
    if (v >= 75) return '#84cc16';
    if (v >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const isWeek = bars[0]?._mode === 'week';
  const isMonth = bars[0]?._mode === 'month';
  const isDay = !isWeek && !isMonth;

  // Layout decision: if the bars fit comfortably at flex width (each ≥
  // minBarWidth), let them stretch to fill. Otherwise force fixed-width
  // and let the container scroll horizontally.
  const gap = bars.length > 100 ? 1 : bars.length > 40 ? 2 : 4;
  const flexBarWidth = plotWidth > 0 ? (plotWidth - gap * (bars.length - 1)) / bars.length : Infinity;
  const useFixedWidth = isDay && plotWidth > 0 && flexBarWidth < minBarWidth;
  const innerWidth = useFixedWidth ? `${bars.length * (minBarWidth + gap)}px` : '100%';

  return (
    <div style={{ width, position: 'relative' }}>
      {/* Y axis labels — fixed gutter outside the scroll area */}
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ width: 40, position: 'relative', height: innerH, flexShrink: 0 }}>
          {yTicks.map((t) => {
            const y = innerH - ((t - domMin) / range) * innerH;
            return (
              <span key={t} style={{
                position: 'absolute', right: 6, top: y - 6,
                fontSize: 10, color: '#94a3b8',
              }}>{valueFormat(t)}</span>
            );
          })}
        </div>

        {/* Plot area — scrolls horizontally in daily mode only when bars
            would shrink below minBarWidth at flex sizing. */}
        <div ref={plotRef} style={{ flex: 1, overflowX: useFixedWidth ? 'auto' : 'hidden', overflowY: 'visible' }}>
          <div style={{ width: innerWidth, position: 'relative' }}>
            <div style={{
              position: 'relative', height: innerH,
              display: 'flex', alignItems: 'flex-end', gap,
            }}>
              {/* Y gridlines */}
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {yTicks.map((t) => {
                  const y = innerH - ((t - domMin) / range) * innerH;
                  return (
                    <div key={t} style={{
                      position: 'absolute', left: 0, right: 0, top: y,
                      borderTop: '1px dashed #eef2ff',
                    }} />
                  );
                })}
              </div>

              {/* Trend line overlay — stretches across all bar centres */}
              {showTrendLine && (() => {
                // Resolve pixel width of the inner container.
                const containerPx = useFixedWidth
                  ? bars.length * (minBarWidth + gap) - gap
                  : Math.max(0, plotWidth);
                if (containerPx <= 0) return null;
                const totalGap = gap * (bars.length - 1);
                const barW = (containerPx - totalGap) / bars.length;
                // x of bar i centre, accounting for gap.
                const xOf = (i) => i * (barW + gap) + barW / 2;
                const yOf = (v) => innerH - ((v - domMin) / range) * innerH;
                // Build polyline of bars with data.
                const pts = [];
                bars.forEach((d, i) => {
                  const v = d[valueKey];
                  if (d.noData || v == null) return;
                  pts.push({ i, x: xOf(i), y: yOf(v), v, isInflection: false });
                });
                if (pts.length < 2) return null;
                // Mark direction changes (local maxima / minima) for the glow dots.
                for (let k = 1; k < pts.length - 1; k++) {
                  const prev = pts[k - 1].v;
                  const cur  = pts[k].v;
                  const next = pts[k + 1].v;
                  if ((cur > prev && cur >= next) || (cur < prev && cur <= next)) {
                    pts[k].isInflection = true;
                  }
                }
                // Always glow the very first and last point.
                pts[0].isInflection = true;
                pts[pts.length - 1].isInflection = true;

                const lineId = `trend-${safeId}`;
                const polyPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

                // Compare line — same coordinates, but values from compareBars.
                let comparePath = null;
                if (compareBars && compareBars.length === bars.length) {
                  const cPts = [];
                  compareBars.forEach((c, i) => {
                    if (c.rate == null) return;
                    cPts.push({ x: xOf(i), y: yOf(c.rate) });
                  });
                  if (cPts.length >= 2) {
                    comparePath = cPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
                  }
                }

                return (
                  <svg
                    aria-hidden
                    width={containerPx}
                    height={innerH}
                    style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 2 }}
                  >
                    <defs>
                      <filter id={`${lineId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Compare line — drawn first so primary sits on top */}
                    {comparePath && (
                      <>
                        <path d={comparePath} stroke={compareColor} strokeWidth={2}
                              strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round"
                              fill="none" opacity={0.85} />
                      </>
                    )}
                    {/* Soft glow underlay */}
                    <path d={polyPath} stroke={trendColor} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
                          fill="none" opacity={0.25} />
                    {/* Crisp line */}
                    <path d={polyPath} stroke={trendColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                          fill="none" filter={`url(#${lineId}-glow)`} />
                    {/* Inflection dots */}
                    {pts.filter((p) => p.isInflection).map((p) => (
                      <g key={p.i}>
                        <circle cx={p.x} cy={p.y} r={6} fill={trendColor} opacity={0.25} />
                        <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={trendColor} strokeWidth={1.5} />
                      </g>
                    ))}
                  </svg>
                );
              })()}

              {bars.map((d, i) => {
                const v = d[valueKey];
                const noData = d.noData || v == null;
                const h = noData ? Math.max(4, innerH * 0.04) : Math.max(2, ((v - domMin) / range) * innerH);
                const color = colorFor(v);
                const isHover = hoverIdx === i;
                const barWrapStyle = useFixedWidth
                  ? { width: minBarWidth, flex: '0 0 auto', position: 'relative', height: innerH, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
                  : { flex: 1, position: 'relative', height: innerH, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
                return (
                  <div key={d[dateKey] || i}
                       onMouseEnter={(e) => {
                         setHoverIdx(i);
                         const rect = e.currentTarget.getBoundingClientRect();
                         setHoverPos({ x: rect.left + rect.width / 2, y: rect.top });
                       }}
                       onMouseLeave={() => { setHoverIdx(null); setHoverPos(null); }}
                       onClick={() => !noData && onSelectDay?.(d)}
                       style={{
                         ...barWrapStyle,
                         cursor: !noData && onSelectDay ? 'pointer' : 'default',
                       }}>
                    <div style={{
                      width: '100%', height: h,
                      background: noData
                        ? 'repeating-linear-gradient(45deg, #f1f5f9 0 4px, transparent 4px 8px)'
                        : color,
                      border: noData ? '1px dashed #e2e8f0' : 'none',
                      borderRadius: '3px 3px 0 0',
                      transition: 'all 0.2s ease',
                      boxShadow: isHover && !noData ? `0 0 0 2px #fff, 0 4px 10px ${color}55` : 'none',
                      opacity: noData ? 0.7 : (isHover ? 1 : 0.92),
                    }} />
                  </div>
                );
              })}
            </div>

            {/* X-axis labels — sparse, share the same widths as bars */}
            {showAxis && (
              <div style={{ display: 'flex', gap, padding: '6px 0 0' }}>
                {bars.map((d, i) => {
                  const total = bars.length;
                  const showEvery = isDay
                    ? (total > 30 ? 3 : total > 14 ? 2 : 1)
                    : 1;
                  const show = i % showEvery === 0 || i === total - 1;
                  const lblDate = d._label || dayjs(d[dateKey]);
                  const lbl = isMonth ? lblDate.format('MMM YY')
                            : isWeek  ? lblDate.format('DD MMM')
                            :           lblDate.format('DD');
                  const labelStyle = useFixedWidth
                    ? { width: minBarWidth, flex: '0 0 auto', textAlign: 'center', fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }
                    : { flex: 1, textAlign: 'center', fontSize: 10, color: '#94a3b8' };
                  return (
                    <div key={i} style={labelStyle}>
                      {show ? lbl : ''}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {hoverIdx != null && hoverPos && (() => {
        const d = bars[hoverIdx];
        if (!d) return null;
        const v = d[valueKey];
        const noData = d.noData || v == null;
        // Position above the bar by default; flip below if too close to top.
        const tooltipBelow = hoverPos.y < 80;
        return (
          <div style={{
            position: 'fixed',
            left: hoverPos.x,
            top: tooltipBelow ? hoverPos.y + 14 : hoverPos.y - 12,
            transform: tooltipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            background: '#0f172a', color: '#fff',
            padding: '8px 12px', borderRadius: 8,
            fontSize: 12, lineHeight: 1.45,
            whiteSpace: 'nowrap', pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>
              {(() => {
                const lbl = d._label || dayjs(d[dateKey]);
                if (isWeek)  return `Week of ${lbl.format('DD MMM YYYY')}`;
                if (isMonth) return lbl.format('MMMM YYYY');
                return lbl.format('ddd, DD MMM YYYY');
              })()}
            </div>
            {noData ? (
              <div style={{ color: '#cbd5e1' }}>No data</div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{valueFormat(v)}</div>
                {detailRender && <div style={{ color: '#cbd5e1', marginTop: 3, fontSize: 11 }}>{detailRender(d)}</div>}
                {compareBars && compareBars[hoverIdx] && compareBars[hoverIdx].rate != null && (
                  <div style={{
                    marginTop: 6, paddingTop: 6,
                    borderTop: '1px solid rgba(255,255,255,0.15)',
                    fontSize: 11, color: '#cbd5e1',
                  }}>
                    <span style={{ color: compareColor, fontWeight: 600 }}>● </span>
                    {compareLabel || 'Compare'}: <span style={{ color: '#fff', fontWeight: 600 }}>
                      {valueFormat(compareBars[hoverIdx].rate)}
                    </span>
                  </div>
                )}
              </>
            )}
            <div style={{
              position: 'absolute',
              left: '50%', transform: 'translateX(-50%) rotate(45deg)',
              top: tooltipBelow ? -3 : 'auto',
              bottom: tooltipBelow ? 'auto' : -3,
              width: 8, height: 8, background: '#0f172a',
            }} />
          </div>
        );
      })()}
    </div>
  );
}
