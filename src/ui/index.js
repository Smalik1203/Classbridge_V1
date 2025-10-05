// src/ui/index.js
// Export all UI components and utilities

export { default as Page } from './Page';
export { default as EnhancedCard } from './EnhancedCard';
export { default as DataVisualization } from './DataVisualization';
export { default as EmptyState } from './EmptyState';
export { default as ConfirmAction } from './ConfirmAction';
export { default as EntityDrawer } from './EntityDrawer';
export { default as KPICard } from './KPICard';
export { default as EnhancedChart } from './EnhancedChart';
export { default as EnhancedStudentTable } from './EnhancedStudentTable';

// Attendance-specific Components
export { default as AttendanceKPICard } from './AttendanceKPICard';
export { default as AttendanceChart } from './AttendanceChart';
export { default as AttendanceTable } from './AttendanceTable';

// Analytics Components
export { default as AnalyticsSection } from './AnalyticsSection';
export { default as AnalyticsFilterBar } from './AnalyticsFilterBar';
export { default as AnalyticsKPI } from './AnalyticsKPI';
export { default as AnalyticsChart } from './AnalyticsChart';
export { 
  lightTheme, 
  darkTheme, 
  antdTheme, 
  dataVizPalette, 
  designTokens, 
  spacing, 
  radius, 
  shadows, 
  neutrals, 
  statusColors 
} from './theme';
export { 
  chartTheme, 
  chartColors, 
  formatCurrencyTooltip, 
  formatCurrencyLabel, 
  getStatusBadge, 
  getCollectionRateColor 
} from './chartTheme'; 