/**
 * Single rule for deciding what color a numeric KPI should render in.
 *
 * The product-wide problem we're solving: every dashboard was painting
 * absent / zero values bright red because the icon or stat color was
 * baked in unconditionally. A "0% attendance" on a Sunday morning isn't
 * an alarm — it's just absence. "₹0 outstanding" is good news, not bad.
 *
 * Use it like this:
 *
 *   const color = kpiTone(value, (v) => v >= 70 ? 'positive'
 *                                   : v >= 40 ? 'attention'
 *                                   : 'critical');
 *
 *   <Statistic valueStyle={{ color }} ... />
 *
 * Zero / null / undefined ALWAYS short-circuit to neutral. Callers
 * never need to remember to add that check themselves.
 */

// Centralised palette. Keep these aligned with AntD's success/warning/error
// so light & dark mode look right without per-call overrides.
export const TONE_COLORS = {
  neutral:   undefined,   // fall through to AntD's colorText (theme-aware)
  positive:  '#10b981',   // emerald — used for "Collected", "Avg score" high
  attention: '#f59e0b',   // amber  — used for partial / aging buckets
  critical:  '#ef4444',   // red    — used for serious overdue / failure
};

export function kpiTone(value, deriveTone) {
  if (value == null || value === 0 || Number.isNaN(value)) return TONE_COLORS.neutral;
  const tone = typeof deriveTone === 'function' ? deriveTone(value) : deriveTone;
  return TONE_COLORS[tone] ?? TONE_COLORS.neutral;
}

// Common derivations so callers don't reinvent thresholds each time.
// All take the raw value; zero is already handled by kpiTone().
export const TONES = {
  // Ratios where higher is better (attendance, pass rate, collection rate).
  // good >= 80, ok >= 50, otherwise attention. Critical is reserved for
  // genuine alarms — falling below a configured floor — not just "low".
  highIsGood: (v) => v >= 80 ? 'positive' : v >= 50 ? 'attention' : 'attention',

  // Currency outstanding: any non-zero amount is mildly attention-grabbing
  // but only "critical" once aging overdue is large.
  outstanding: (v) => v > 0 ? 'attention' : 'neutral',

  // Aging buckets: tone is determined by which bucket the value sits in,
  // not by the value itself. kpiTone() has already gated zero before this
  // runs, so we only get here for non-zero amounts.
  // severity is the bucket id: 'current' | '0-30' | '31-60' | '61-90' | '90+'
  agingBucket: (severity) => () => {
    if (severity === 'current') return 'neutral';
    if (severity === '0-30')    return 'attention';
    if (severity === '31-60')   return 'attention';
    return 'critical'; // 61-90, 90+
  },
};
