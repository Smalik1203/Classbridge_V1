// Centralized chart theme configuration for consistent UI/UX
export const chartTheme = {
  colors: {
    primary: '#6366F1',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#8B5CF6',
    collected: '#10b981',
    outstanding: '#ef4444',
    noPlan: '#e2e8f0',
    background: '#f8fafc',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    grid: '#f1f5f9'
  },
  
  // Chart styling
  chart: {
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
    barRadius: [6, 6, 0, 0],
    strokeWidth: 2,
    fontSize: 13,
    fontFamily: 'Geist Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  
  // KPI card styling
  kpiCard: {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease',
    '&:hover': {
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      transform: 'translateY(-2px)'
    }
  },
  
  // Status colors for badges
  statusColors: {
    paid: '#10b981',
    partiallyPaid: '#f59e0b',
    unpaid: '#ef4444',
    noPlan: '#e2e8f0'
  }
};

// Chart color palette for different data series
export const chartColors = [
  chartTheme.colors.collected,
  chartTheme.colors.outstanding,
  chartTheme.colors.warning,
  chartTheme.colors.info,
  chartTheme.colors.primary
];

// Custom tooltip formatter for currency
export const formatCurrencyTooltip = (value, name) => {
  const formattedValue = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
  
  return [formattedValue, name];
};

// Custom label formatter for charts
export const formatCurrencyLabel = (value) => {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value}`;
};

// Status badge configuration
export const getStatusBadge = (status, amount = 0) => {
  const statusConfig = {
    paid: { color: chartTheme.statusColors.paid, text: 'Paid' },
    partiallyPaid: { color: chartTheme.statusColors.partiallyPaid, text: 'Partially Paid' },
    unpaid: { color: chartTheme.statusColors.unpaid, text: 'Unpaid' },
    noPlan: { color: chartTheme.statusColors.noPlan, text: 'No Plan' }
  };
  
  return statusConfig[status] || statusConfig.noPlan;
};

// Collection rate color based on percentage
export const getCollectionRateColor = (rate) => {
  if (rate >= 80) return chartTheme.colors.success;
  if (rate >= 50) return chartTheme.colors.warning;
  return chartTheme.colors.error;
};
