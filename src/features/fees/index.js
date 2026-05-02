// Fees Feature — Public API (invoice-first model)
//
// Tables: fee_invoices, fee_invoice_items, fee_payments.
// Edge functions: generate-invoice-document, send-fee-notification,
//   razorpay-create-order, razorpay-verify-payment.

// Page
export { default as FeesPage } from './pages/Fees';

// Components — operations cockpit
export { default as InvoiceTable } from './components/InvoiceTable';
export { default as InvoiceSidePanel } from './components/InvoiceSidePanel';
export { default as PaymentPanel } from './components/PaymentPanel';
export { default as NewInvoicePanel } from './components/NewInvoicePanel';
export { default as CollectMode } from './components/CollectMode';
export { default as InvoiceDocumentViewer } from './components/InvoiceDocumentViewer';
export { default as StudentFees } from './components/StudentFees';

// Context
export { FeesProvider, useFees } from './context/FeesContext';

// Service surface (1:1 with mobile invoiceService)
export * as feesService from './services/feesService';
export {
  getOrCreateInvoice,
  addInvoiceItems,
  recalculateInvoiceTotal,
  calculateInvoiceStatus,
  calculateInvoiceTotal,
  billingPeriodFor,
  getActiveAcademicYear,
} from './services/invoiceHelpers';

// Money utilities
export * from './utils/money';
