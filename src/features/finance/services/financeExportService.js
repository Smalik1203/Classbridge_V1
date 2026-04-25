import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { financeTransactionsService, financeReportsService, financeAuditService } from './financeService';

/**
 * Finance export service — web-native equivalent of mobile financeExport.ts.
 *
 * Mobile uses expo-print + expo-sharing to make PDFs. On web we render the
 * same HTML into a hidden iframe and call window.print(); the user "Save as
 * PDF" from the print dialog. CSV/XLSX are direct browser downloads.
 *
 * Audit logging mirrors mobile (logFinanceOperation eventType='export').
 */

// ── CSV helpers ──────────────────────────────────────────────────────────────

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── CSV / XLSX exports ──────────────────────────────────────────────────────

function transactionsToRows(transactions) {
  return transactions.map(t => ({
    Date:        t.txn_date,
    Type:        (t.type || '').toUpperCase(),
    Amount:      Number(t.amount),
    Category:    t.category?.name || 'Unknown',
    Account:     t.account?.name  || 'Unknown',
    Description: t.description || '',
    'Created At': dayjs(t.created_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

export async function exportTransactionsCSV({
  schoolCode, startDate, endDate, type, categoryId, accountId,
  userId, userRole,
}) {
  const { data } = await financeTransactionsService.list({
    schoolCode, startDate, endDate, type, categoryId, accountId, limit: 10000,
  });
  if (!data.length) throw new Error('No transactions found for the selected period.');

  const headers = ['Date', 'Type', 'Amount', 'Category', 'Account', 'Description', 'Created At'];
  const rows = transactionsToRows(data);
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => csvEscape(r[h])).join(',')));
  const filename = `Finance_Transactions_${startDate}_to_${endDate}_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
  downloadBlob(lines.join('\n'), filename, 'text/csv;charset=utf-8;');

  await financeAuditService.logExport({ schoolCode, exportType: 'csv', startDate, endDate, userId, userRole });
  return { count: data.length, filename };
}

export async function exportTransactionsXLSX({
  schoolCode, startDate, endDate, type, categoryId, accountId,
  userId, userRole,
}) {
  const { data } = await financeTransactionsService.list({
    schoolCode, startDate, endDate, type, categoryId, accountId, limit: 10000,
  });
  if (!data.length) throw new Error('No transactions found for the selected period.');

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(transactionsToRows(data));
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  const filename = `Finance_Transactions_${startDate}_to_${endDate}_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
  XLSX.writeFile(wb, filename);

  await financeAuditService.logExport({ schoolCode, exportType: 'csv', startDate, endDate, userId, userRole });
  return { count: data.length, filename };
}

// ── XLSX import (web-native, for opening balances + historical entries) ────

/**
 * Parse an .xlsx / .csv File and return rows shaped for bulkCreate.
 * Expected columns (case-insensitive, missing header is OK):
 *   Date, Type, Amount, Category, Account, Description
 * Caller must resolve Category/Account names to IDs before bulkCreate.
 */
export async function parseImportFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const norm = (k) => String(k || '').trim().toLowerCase();

  return json.map((raw, i) => {
    const row = {};
    Object.keys(raw).forEach(k => { row[norm(k)] = raw[k]; });
    let date = row.date;
    if (typeof date === 'number') {
      // Excel serial date.
      const d = XLSX.SSF.parse_date_code(date);
      if (d) date = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } else if (date) {
      const d = dayjs(date);
      date = d.isValid() ? d.format('YYYY-MM-DD') : String(date);
    }
    return {
      _row: i + 2, // +1 for header, +1 for 1-based.
      txn_date: date,
      type: String(row.type || '').trim().toLowerCase(),
      amount: Number(row.amount),
      category_name: String(row.category || '').trim(),
      account_name:  String(row.account  || '').trim(),
      description:   String(row.description || '').trim(),
    };
  });
}

// ── Print-ready HTML (P&L, Balance Snapshot, Trial Balance, Ledger) ────────

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    padding: 32px; color: #1e293b; background: #fff;
  }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #6366f1; padding-bottom: 12px; }
  .header h1 { font-size: 22px; color: #1e293b; margin-bottom: 4px; }
  .header .school { color: #64748b; font-size: 12px; }
  .period { text-align: center; color: #64748b; font-size: 11px; margin-bottom: 20px; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
  .card .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; letter-spacing: 0.4px; }
  .card .amount { font-size: 18px; font-weight: 700; }
  .card.income  { border-left: 3px solid #10b981; } .card.income .amount  { color: #10b981; }
  .card.expense { border-left: 3px solid #ef4444; } .card.expense .amount { color: #ef4444; }
  .card.net     { border-left: 3px solid #6366f1; }
  .positive { color: #10b981; font-weight: 600; }
  .negative { color: #ef4444; font-weight: 600; }
  h2 { font-size: 14px; margin: 24px 0 8px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
  th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
  tr.total td { font-weight: 700; background: #f8fafc; border-top: 2px solid #475569; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; }
  .signature { text-align: center; border-top: 1px solid #1e293b; padding-top: 6px; font-size: 11px; color: #475569; }
  @page { size: A4; margin: 12mm; }
`;

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function htmlShell(title, schoolName, periodStart, periodEnd, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_STYLES}</style></head><body>
    <div class="header">
      <h1>${title}</h1>
      ${schoolName ? `<div class="school">${schoolName}</div>` : ''}
    </div>
    <div class="period">Period: ${dayjs(periodStart).format('DD MMM YYYY')} to ${dayjs(periodEnd).format('DD MMM YYYY')}</div>
    ${body}
    <div class="signatures">
      <div class="signature">Prepared by</div>
      <div class="signature">Authorized by</div>
    </div>
    <div class="footer">Generated on ${dayjs().format('DD MMMM YYYY hh:mm A')}</div>
  </body></html>`;
}

export function buildSummaryHTML({ summary, monthly, schoolName }) {
  const body = `
    <div class="summary">
      <div class="card income">  <div class="label">Total Income</div>  <div class="amount">₹${fmt(summary.total_income)}</div></div>
      <div class="card expense"> <div class="label">Total Expense</div> <div class="amount">₹${fmt(summary.total_expense)}</div></div>
      <div class="card net">     <div class="label">Net Income</div>    <div class="amount ${summary.net_income >= 0 ? 'positive' : 'negative'}">₹${fmt(Math.abs(summary.net_income))}</div></div>
    </div>
    ${monthly.length ? `
      <h2>Monthly Breakdown</h2>
      <table>
        <thead><tr>
          <th>Month</th><th class="text-right">Income</th>
          <th class="text-right">Expense</th><th class="text-right">Net</th>
          <th class="text-center">Transactions</th>
        </tr></thead>
        <tbody>
          ${monthly.map(m => `
            <tr>
              <td>${dayjs(m.month + '-01').format('MMMM YYYY')}</td>
              <td class="text-right positive">₹${fmt(m.total_income)}</td>
              <td class="text-right negative">₹${fmt(m.total_expense)}</td>
              <td class="text-right ${m.net_income >= 0 ? 'positive' : 'negative'}">₹${fmt(Math.abs(m.net_income))}</td>
              <td class="text-center">${m.transaction_count}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : ''}
  `;
  return htmlShell('Finance Report', schoolName, summary.period_start, summary.period_end, body);
}

export function buildPnLHTML({ pnl, schoolName }) {
  const incomeRows = pnl.income.length ? pnl.income.map(r => `
    <tr><td>${r.name}</td><td class="text-center">${r.count}</td><td class="text-right positive">₹${fmt(r.total)}</td></tr>
  `).join('') : '<tr><td colspan="3" class="text-center" style="color:#94a3b8">No income in this period</td></tr>';
  const expenseRows = pnl.expense.length ? pnl.expense.map(r => `
    <tr><td>${r.name}</td><td class="text-center">${r.count}</td><td class="text-right negative">₹${fmt(r.total)}</td></tr>
  `).join('') : '<tr><td colspan="3" class="text-center" style="color:#94a3b8">No expense in this period</td></tr>';
  const body = `
    <h2>Income</h2>
    <table>
      <thead><tr><th>Category</th><th class="text-center">Txn count</th><th class="text-right">Total</th></tr></thead>
      <tbody>${incomeRows}<tr class="total"><td>Total Income</td><td></td><td class="text-right positive">₹${fmt(pnl.total_income)}</td></tr></tbody>
    </table>
    <h2>Expenses</h2>
    <table>
      <thead><tr><th>Category</th><th class="text-center">Txn count</th><th class="text-right">Total</th></tr></thead>
      <tbody>${expenseRows}<tr class="total"><td>Total Expense</td><td></td><td class="text-right negative">₹${fmt(pnl.total_expense)}</td></tr></tbody>
    </table>
    <table style="margin-top:24px;">
      <tbody><tr class="total"><td>Net Income</td><td></td><td class="text-right ${pnl.net_income >= 0 ? 'positive' : 'negative'}">₹${fmt(Math.abs(pnl.net_income))}</td></tr></tbody>
    </table>
  `;
  return htmlShell('Profit & Loss Statement', schoolName, pnl.period_start, pnl.period_end, body);
}

export function buildTrialBalanceHTML({ rows, periodStart, periodEnd, schoolName }) {
  const body = `
    <table>
      <thead><tr>
        <th>Account</th><th>Type</th>
        <th class="text-right">Opening</th><th class="text-right">Income</th>
        <th class="text-right">Expense</th><th class="text-right">Closing</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.account_name}</td>
            <td><span style="text-transform:capitalize">${r.account_type}</span></td>
            <td class="text-right">₹${fmt(r.opening)}</td>
            <td class="text-right positive">₹${fmt(r.income)}</td>
            <td class="text-right negative">₹${fmt(r.expense)}</td>
            <td class="text-right ${r.closing >= 0 ? 'positive' : 'negative'}">₹${fmt(Math.abs(r.closing))}</td>
          </tr>`).join('')}
        <tr class="total">
          <td>Totals</td><td></td>
          <td class="text-right">₹${fmt(rows.reduce((s, r) => s + r.opening, 0))}</td>
          <td class="text-right positive">₹${fmt(rows.reduce((s, r) => s + r.income,  0))}</td>
          <td class="text-right negative">₹${fmt(rows.reduce((s, r) => s + r.expense, 0))}</td>
          <td class="text-right">₹${fmt(rows.reduce((s, r) => s + r.closing, 0))}</td>
        </tr>
      </tbody>
    </table>
  `;
  return htmlShell('Trial Balance', schoolName, periodStart, periodEnd, body);
}

export function buildAccountLedgerHTML({ accountName, ledger, periodStart, periodEnd, schoolName }) {
  const body = `
    <table style="margin-bottom:8px"><tbody><tr>
      <td><strong>Account:</strong> ${accountName}</td>
      <td class="text-right"><strong>Opening balance:</strong> ₹${fmt(ledger.opening_balance)}</td>
    </tr></tbody></table>
    <table>
      <thead><tr>
        <th>Date</th><th>Description</th><th>Category</th>
        <th class="text-right">Income</th><th class="text-right">Expense</th>
        <th class="text-right">Running Balance</th>
      </tr></thead>
      <tbody>
        ${ledger.lines.map(l => `
          <tr>
            <td>${dayjs(l.txn_date).format('DD MMM YYYY')}</td>
            <td>${(l.description || '').replace(/</g, '&lt;')}</td>
            <td>${l.category?.name || '—'}</td>
            <td class="text-right positive">${l.type === 'income'  ? '₹' + fmt(l.amount) : ''}</td>
            <td class="text-right negative">${l.type === 'expense' ? '₹' + fmt(l.amount) : ''}</td>
            <td class="text-right ${l.running_balance >= 0 ? 'positive' : 'negative'}">₹${fmt(Math.abs(l.running_balance))}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="text-center" style="color:#94a3b8">No movements in this period</td></tr>'}
        <tr class="total">
          <td colspan="5">Closing balance</td>
          <td class="text-right ${ledger.closing_balance >= 0 ? 'positive' : 'negative'}">₹${fmt(Math.abs(ledger.closing_balance))}</td>
        </tr>
      </tbody>
    </table>
  `;
  return htmlShell(`Account Ledger — ${accountName}`, schoolName, periodStart, periodEnd, body);
}

// ── Print harness ───────────────────────────────────────────────────────────

/**
 * Render HTML in a hidden iframe and trigger the system print dialog.
 * Mirrors the HrDocumentViewer pattern used elsewhere on web.
 */
export function printHTML(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 250);
}

export async function printSummaryReport({ schoolCode, startDate, endDate, schoolName, userId, userRole }) {
  const [summary, monthly] = await Promise.all([
    financeReportsService.incomeVsExpense({ schoolCode, startDate, endDate }),
    financeReportsService.monthlySummary({ schoolCode, startDate, endDate }),
  ]);
  const html = buildSummaryHTML({ summary, monthly, schoolName });
  printHTML(html);
  await financeAuditService.logExport({ schoolCode, exportType: 'pdf', startDate, endDate, userId, userRole });
}

export async function printPnL({ schoolCode, startDate, endDate, schoolName, userId, userRole }) {
  const pnl = await financeReportsService.profitAndLoss({ schoolCode, startDate, endDate });
  const html = buildPnLHTML({ pnl, schoolName });
  printHTML(html);
  await financeAuditService.logExport({ schoolCode, exportType: 'pdf', startDate, endDate, userId, userRole });
}

export async function printTrialBalance({ schoolCode, startDate, endDate, schoolName, userId, userRole }) {
  const rows = await financeReportsService.trialBalance({ schoolCode, startDate, endDate });
  const html = buildTrialBalanceHTML({ rows, periodStart: startDate, periodEnd: endDate, schoolName });
  printHTML(html);
  await financeAuditService.logExport({ schoolCode, exportType: 'pdf', startDate, endDate, userId, userRole });
}

export async function printAccountLedger({ schoolCode, accountId, accountName, startDate, endDate, schoolName, userId, userRole }) {
  const ledger = await financeReportsService.accountLedger({ schoolCode, accountId, startDate, endDate });
  const html = buildAccountLedgerHTML({ accountName, ledger, periodStart: startDate, periodEnd: endDate, schoolName });
  printHTML(html);
  await financeAuditService.logExport({ schoolCode, exportType: 'pdf', startDate, endDate, userId, userRole });
}
