// Fees Feature — Public API (invoice-first model)
//
// Tables: fee_invoices, fee_invoice_items, fee_payments.
// Edge functions: generate-invoice-document, send-fee-notification.
// Mobile parity: src/services/fees.ts (invoiceService).

// Page
export { default as FeesPage } from './pages/Fees';

// Components
export { default as InvoiceTable } from './components/InvoiceTable';
export { default as InvoiceDetailDrawer } from './components/InvoiceDetailDrawer';
export { default as PaymentDrawer } from './components/PaymentDrawer';
export { default as GenerateInvoicesDrawer } from './components/GenerateInvoicesDrawer';
export { default as CreateInvoiceDrawer } from './components/CreateInvoiceDrawer';
export { default as InvoiceDocumentViewer } from './components/InvoiceDocumentViewer';
export { default as BulkRemindersDrawer } from './components/BulkRemindersDrawer';
export { default as StudentFees } from './components/StudentFees';
export { default as FeeAnalytics } from './components/FeeAnalytics';

// Context
export { FeesProvider, useFees } from './context/FeesContext';

// Service surface (1:1 with mobile invoiceService)
export * as feesService from './services/feesService';
export {
  getOrCreateInvoice,
  addInvoiceItems,
  recalculateInvoiceTotal,
  recalculateInvoicePaidAmount,
  calculateInvoiceStatus,
  calculateInvoiceTotal,
  billingPeriodFor,
  getActiveAcademicYear,
} from './services/invoiceHelpers';

// Money utilities (kept for analytics + tables — paise-based + rupee-based)
export * from './utils/money';
