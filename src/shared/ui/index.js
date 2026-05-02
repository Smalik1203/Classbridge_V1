// Shared UI - Public API

// New design-system primitives
export { Card } from './Card';
export { KPI } from './KPI';
export { Badge } from './Badge';
export { PageHeader } from './PageHeader';
export { EmptyState } from './EmptyState';
export { Field } from './Field';
export { Drawer as CbDrawer } from './Drawer';
export { Modal as CbModal } from './Modal';
export { FormDialog } from './FormDialog';
export { FormDrawer } from './FormDrawer';
export { OptionGroup, RadioRow } from './OptionGroup';
export { MultiSelect } from './MultiSelect';
export { default as EmptyState2 } from './EmptyState';

// Charts
export { default as EnhancedChart } from './charts/EnhancedChart';
export { default as GeneralBarChart } from './charts/GeneralBarChart';
export * from './charts/chartTheme';

// Cards (legacy)
export { default as EnhancedCard } from './cards/EnhancedCard';
export { default as KPICard } from './cards/KPICard';

// Tables (legacy)
export { default as EnhancedStudentTable } from './tables/EnhancedStudentTable';

// Other UI Components (legacy)
export { default as CompactFilterBar } from './CompactFilterBar';
export { default as ConfirmAction } from './ConfirmAction';
export { default as DataVisualization } from './DataVisualization';
export { default as EntityDrawer } from './EntityDrawer';
export { default as Page } from './Page';

// Theme
export * from './theme';
