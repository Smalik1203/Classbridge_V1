// Centralized chart theme configuration for consistent UI/UX
export const chartTheme = {
  colors: {
    primary: '#1890ff',
    success: '#52c41a',
    warning: '#faad14',
    error: '#ff4d4f',
    info: '#13c2c2',
    collected: '#52c41a',
    outstanding: '#ff4d4f',
    noPlan: '#d9d9d9',
    background: '#fafafa',
    text: '#262626',
    textSecondary: '#8c8c8c',
    border: '#d9d9d9',
    grid: '#f0f0f0'
  },
  
  // Chart styling
  chart: {
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
    barRadius: [4, 4, 0, 0],
    strokeWidth: 2,
    fontSize: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  
  // KPI card styling
  kpiCard: {
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      transform: 'translateY(-2px)'
    }
  },
  
  // Status colors for badges
  statusColors: {
    paid: '#52c41a',
    partiallyPaid: '#faad14',
    unpaid: '#ff4d4f',
    noPlan: '#d9d9d9'
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
