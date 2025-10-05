// Production-ready formatting utilities for Fees Analytics

/**
 * Compact INR formatter using Indian numbering system
 * Rules: Cr (10,000,000), L (100,000), k (1,000)
 * Preserve sign; handle null/undefined/NaN
 * Keep 1 decimal when shortened, drop decimals for small numbers
 */
export function formatINRCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 1e7)  return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5)  return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3)  return `${sign}₹${(abs / 1e3).toFixed(1)}k`;

  // For < 1000, use locale formatting in en-IN
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Percentage formatter for tooltips
 */
export const formatPct = (v) =>
  Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}%` : '—';

/**
 * IST date label formatter
 */
export const formatISTDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { 
    timeZone: 'Asia/Kolkata', 
    day: '2-digit', 
    month: 'short' 
  });
