import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * generate-invoice-document
 *
 * Returns a clean, premium HTML invoice/receipt for a fee_invoice.
 * Server-computes totals — never trusts client values.
 *
 * Output style: minimal, generous whitespace, single accent color, tabular
 * figures, gradient header. Prints cleanly to A4.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const errorResponse = (status: number, error: string, details?: string) => {
  console.error(`[${status}] ${error}: ${details || ""}`);
  return new Response(
    JSON.stringify({ success: false, error, details }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
};

// Use "Rs." instead of the ₹ glyph — Chromium's bundled fonts in the
// pdf-service container don't include U+20B9 in all weights, so the bold
// subtotal/grand-total rows render as ▢ boxes. "Rs." is the standard Indian
// accounting abbreviation and renders in every font.
const formatINR = (amount: number): string => {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Rs. ${formatted}`;
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(dateStr);
  }
};

const numberToWords = (num: number): string => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (num === 0) return "Zero Rupees";
  if (isNaN(num)) return "—";
  const conv = (n: number): string => {
    if (n < 20) return ones[n] || "";
    return (tens[Math.floor(n / 10)] || "") + (n % 10 !== 0 ? " " + (ones[n % 10] || "") : "");
  };
  let words = "";
  const cr = Math.floor(num / 10000000);
  const lk = Math.floor((num % 10000000) / 100000);
  const th = Math.floor((num % 100000) / 1000);
  const hu = Math.floor((num % 1000) / 100);
  const re = Math.floor(num % 100);
  const ps = Math.round((num % 1) * 100);
  if (cr > 0) words += conv(cr) + " Crore ";
  if (lk > 0) words += conv(lk) + " Lakh ";
  if (th > 0) words += conv(th) + " Thousand ";
  if (hu > 0) words += (ones[hu] || "") + " Hundred ";
  if (re > 0) words += conv(re) + " ";
  words += "Rupees";
  if (ps > 0) words += " and " + conv(ps) + " Paise";
  return words.trim();
};

const escapeHtml = (text: string | number | null | undefined): string => {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

interface RenderInput {
  invoiceNumber: string;
  invoice: any;
  items: any[];
  payments: any[];
  student: any;
  school: any;
  classInfo: any;
  academicYear: any;
  serverComputed: { total: number; paid: number; balance: number; status: string };
  copies: 1 | 2;
  // 'a4': school's default tray (A4 portrait). Content pins to top half, the
  //       bottom half tears off. Works on every Indian school printer without
  //       any tray reconfiguration.
  // 'a5': advanced setup. Either A5 paper loaded in the tray, or A4 pre-torn
  //       in half. Content fills the page edge-to-edge — no waste.
  paperSize: "a4" | "a5";
}

const renderHTML = (data: RenderInput): string => {
  const { invoiceNumber, invoice, items, payments, student, school, classInfo, academicYear, serverComputed, copies, paperSize } = data;
  // Two-up = two receipts side-by-side (Office + Parent), produced as a single
  // 210×148mm sheet. Same sheet design regardless of paper size; we just put
  // it on either A5 landscape (edge-to-edge) or A4 portrait (top half).
  const twoUp = copies === 2;
  // Compact (A6) sizing for the columns inside a two-up sheet; A5 sizing for
  // a single-copy receipt. Decided by `copies`, not paper size.
  const compact = twoUp;
  // True when the receipt is rendered on the top half of an A4 sheet that the
  // cashier will tear in half. Affects the @page rule and the wrapper layout
  // (we add a horizontal tear guide line + bottom-half whitespace).
  const onA4 = paperSize === "a4";

  const academicYearStr = academicYear
    ? `${academicYear.year_start}–${academicYear.year_end}`
    : "—";
  const classStr = classInfo
    ? `Grade ${classInfo.grade ?? "-"}${classInfo.section ? ` ${classInfo.section}` : ""}`
    : "—";

  const safeSchoolName = escapeHtml(school?.school_name) || "School";
  const safeSchoolAddress = escapeHtml(school?.school_address);
  const safeSchoolPhone = escapeHtml(school?.school_phone);
  const safeSchoolEmail = escapeHtml(school?.school_email);
  const safeSchoolLogo = escapeHtml(school?.logo_url);
  const safeStudentName = escapeHtml(student?.full_name) || "—";
  const safeStudentCode = escapeHtml(student?.student_code) || "";
  const safeStudentPhone = escapeHtml(student?.phone) || "";
  const safeBillingPeriod = escapeHtml(invoice?.billing_period) || "—";
  const safeNotes = escapeHtml(invoice?.notes);
  const safeDueDate = formatDate(invoice?.due_date);
  const safeIssueDate = formatDate(invoice?.created_at);

  const isPaid = serverComputed.status === "PAID";
  const isPartial = serverComputed.status === "PARTIAL";
  const statusLabel = isPaid ? "PAID" : isPartial ? "PART PAID" : "UNPAID";
  // Rubber-stamp colors — punchy, ink-on-paper feel.
  const stampColor = isPaid ? "#15803d" : isPartial ? "#b45309" : "#b91c1c";

  // Line items — proper column widths, no wrap on amount, wrap-anywhere on
  // description so verbose fee heads like "Transport (Route 5, Hostel)" fit
  // cleanly even at A6 width.
  const itemsRows = items.length ? items.map((item) => {
    const safeLabel = escapeHtml(item.label);
    const amount = parseFloat(String(item.amount));
    return `<tr>
      <td class="cell-desc">${safeLabel}</td>
      <td class="cell-amount">${formatINR(amount)}</td>
    </tr>`;
  }).join("") : `<tr><td class="cell-desc" colspan="2" style="color:#94a3b8;font-style:italic;">No itemised breakdown</td></tr>`;

  const paymentsRows = payments.length
    ? payments.map((p) => {
        const amount = parseFloat(String(p.amount_inr));
        const method = String(p.payment_method || "—").replace(/_/g, " ");
        const date = formatDate(p.payment_date);
        const ref = escapeHtml(p.receipt_number) || "—";
        return `<tr>
          <td class="cell-date">${date}</td>
          <td class="cell-method">${escapeHtml(method)}</td>
          <td class="cell-ref">${ref}</td>
          <td class="cell-amount">${formatINR(amount)}</td>
        </tr>`;
      }).join("")
    : "";

  // Latest payment for the prominent "received" line in compact mode.
  const latestPayment = payments[0] || null;
  const paymentMode = latestPayment
    ? String(latestPayment.payment_method || "—").replace(/_/g, " ").toUpperCase()
    : "—";
  const paymentRef = latestPayment ? (escapeHtml(latestPayment.receipt_number) || "—") : "—";
  const paymentDate = latestPayment ? formatDate(latestPayment.payment_date) : safeIssueDate;

  // Layout tokens — page dimensions by combo:
  //   compact (two-up):           105 × 148mm (A6 portrait column)
  //   single on A5 portrait:      148 × 210mm (full A5 page)
  //   single on A4 (top half):    210 × 148mm (A5 landscape, fills top half)
  const PAGE_W = compact ? "105mm" : onA4 ? "210mm" : "148mm";
  const PAGE_H = compact ? "148mm" : onA4 ? "148mm" : "210mm";
  const PAGE_PAD = compact ? "3mm 4mm 3mm" : "4mm 6mm 5mm";
  const BORDER = compact ? "0.8mm" : "1mm";
  // Type — Times serif for body (formal/legal document feel), Arial for
  // headers and labels (legible at small sizes).
  const FS_BODY = compact ? "2.6mm" : "3.4mm";
  const FS_HEAD_TITLE = compact ? "3.6mm" : "5mm";
  const FS_HEAD_SUB = compact ? "2.2mm" : "2.8mm";
  const FS_SECTION = compact ? "2.6mm" : "3.6mm";
  const FS_TABLE = compact ? "2.4mm" : "3.2mm";
  const FS_TABLE_HEAD = compact ? "2.2mm" : "2.8mm";
  const FS_TOTAL = compact ? "3.8mm" : "5.2mm";
  const FS_SIG = compact ? "2.4mm" : "3.2mm";
  const SECTION_GAP = compact ? "2.5mm" : "4mm";
  const ROW_H = compact ? "5mm" : "6.5mm";
  const RED = "#c1121f";
  const NAVY = "#0a2540";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Receipt ${escapeHtml(invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
    font-family: "Times New Roman", Times, serif;
    color: #000;
    background: #e2e8f0;
  }
  /* Page size matrix:
       A4 + 1 copy   → A4 portrait, content pinned to top half, tear bottom
       A4 + 2 copies → A4 portrait, sheet-twoup pinned to top half, tear bottom
       A5 + 1 copy   → A5 portrait, full page
       A5 + 2 copies → A5 landscape, full page (2 A6 portraits side-by-side) */
  @page {
    size: ${onA4 ? "A4 portrait" : twoUp ? "A5 landscape" : "A5 portrait"};
    margin: 0;
  }

  .num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
  .sans { font-family: Arial, "Helvetica Neue", sans-serif; }

  /* ── PAGE ── single A5 page or one half of the two-up sheet ────────── */
  .page {
    position: relative;
    width: ${PAGE_W};
    height: ${PAGE_H};
    padding: ${PAGE_PAD};
    border: ${BORDER} solid #000;
    background: #fff;
    margin: 12px auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-size: ${FS_BODY};
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.10);
  }
  .page + .page { margin-top: 16px; }

  /* ── COPY TAG ── tiny ribbon top-right, inside the border ──────────── */
  .copy-tag {
    position: absolute;
    top: 0; right: 0;
    background: ${RED};
    color: #fff;
    font-family: Arial, sans-serif;
    font-weight: 800;
    font-size: ${compact ? "2.2mm" : "2.8mm"};
    letter-spacing: 0.4mm;
    padding: ${compact ? "1mm 2.5mm" : "1.5mm 3.5mm"};
    z-index: 3;
    text-transform: uppercase;
  }

  /* ── HEADER ── logo left, school info right ─────────────────────── */
  .head {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    column-gap: ${compact ? "3mm" : "5mm"};
    padding-bottom: ${compact ? "2mm" : "3mm"};
    border-bottom: 0.3mm solid #000;
  }
  .logo {
    width: ${compact ? "14mm" : "20mm"};
    height: ${compact ? "14mm" : "20mm"};
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 0.3mm solid #000;
    background: #fff;
    font-family: Arial, sans-serif;
    font-weight: 900;
    font-size: ${compact ? "6mm" : "9mm"};
    color: ${RED};
    line-height: 1;
    overflow: hidden;
  }
  .logo img { width: 100%; height: 100%; object-fit: contain; }
  .head-info { min-width: 0; }
  .school-name {
    font-family: Arial, sans-serif;
    font-weight: 800;
    font-size: ${FS_HEAD_TITLE};
    color: ${NAVY};
    line-height: 1.1;
    letter-spacing: 0.1mm;
    text-transform: uppercase;
  }
  .school-meta {
    font-family: Arial, sans-serif;
    font-size: ${FS_HEAD_SUB};
    color: #000;
    line-height: 1.35;
    margin-top: 0.8mm;
  }
  .school-meta + .school-meta { margin-top: 0.3mm; }

  /* ── DOCUMENT TITLE ── red, centered, formal ───────────────────── */
  .title {
    text-align: center;
    font-family: Arial, sans-serif;
    font-weight: 800;
    font-size: ${compact ? "3.4mm" : "4.6mm"};
    color: ${RED};
    text-transform: uppercase;
    letter-spacing: 0.4mm;
    margin: ${compact ? "1.5mm 0 0.5mm" : "2.5mm 0 1mm"};
  }
  .title-sub {
    text-align: center;
    font-family: Arial, sans-serif;
    font-size: ${compact ? "2.4mm" : "3mm"};
    margin-bottom: ${SECTION_GAP};
  }
  .title-sub .recno {
    font-family: "Courier New", monospace;
    font-weight: 700;
    letter-spacing: 0.1mm;
  }

  /* ── SECTION HEADINGS ─────────────────────────────────────────── */
  .section-h {
    font-family: Arial, sans-serif;
    color: ${RED};
    font-weight: 800;
    font-size: ${FS_SECTION};
    text-transform: uppercase;
    letter-spacing: 0.2mm;
    margin: ${SECTION_GAP} 0 ${compact ? "1mm" : "1.5mm"};
  }
  .section-h:first-of-type { margin-top: 0; }

  /* ── PROFILE GRID ── label : value rows ───────────────────────── */
  .profile {
    display: grid;
    grid-template-columns: ${compact ? "22mm 2mm 1fr 18mm 2mm auto" : "30mm 3mm 1fr 26mm 3mm auto"};
    row-gap: ${compact ? "1.2mm" : "1.8mm"};
    column-gap: 0;
    font-size: ${FS_BODY};
    align-items: baseline;
  }
  .profile .lbl {
    font-family: Arial, sans-serif;
    font-weight: 600;
    color: #000;
    font-size: ${compact ? "2.3mm" : "2.9mm"};
  }
  .profile .colon { text-align: center; }
  .profile .val {
    font-weight: 700;
    color: #000;
    overflow-wrap: anywhere;
    line-height: 1.25;
  }

  /* ── TABLES ── bordered, formal, ruled ────────────────────────── */
  table.bill {
    width: 100%;
    border-collapse: collapse;
    font-size: ${FS_TABLE};
    table-layout: fixed;
  }
  table.bill th,
  table.bill td {
    border: 0.3mm solid #000;
    padding: ${compact ? "1mm 1.5mm" : "1.5mm 2.5mm"};
    vertical-align: middle;
  }
  table.bill thead th {
    color: ${RED};
    font-family: Arial, sans-serif;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.15mm;
    font-size: ${FS_TABLE_HEAD};
    text-align: left;
    background: #fef2f2;
  }
  table.bill thead th.right { text-align: right; }
  table.bill thead th.center { text-align: center; }
  table.bill td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  table.bill td.center { text-align: center; }
  table.bill tbody td { height: ${ROW_H}; }
  table.bill td.desc {
    overflow-wrap: anywhere;
    word-break: break-word;
    line-height: 1.3;
  }
  table.bill tr.subtotal td {
    background: #fafafa;
    font-weight: 700;
    font-family: Arial, sans-serif;
    font-size: ${FS_TABLE_HEAD};
    height: ${compact ? "4.5mm" : "5.5mm"};
  }
  table.bill tr.grand td {
    background: ${NAVY};
    color: #fff;
    font-family: Arial, sans-serif;
    font-weight: 800;
    font-size: ${FS_TOTAL};
    height: ${compact ? "6.5mm" : "8mm"};
    letter-spacing: 0.1mm;
    text-transform: uppercase;
  }
  table.bill tr.grand td.num {
    font-size: ${FS_TOTAL};
    font-weight: 900;
    letter-spacing: 0;
  }
  /* Column widths for the main fee table */
  col.c-sno { width: ${compact ? "7mm" : "10mm"}; }
  col.c-amount { width: ${compact ? "26mm" : "36mm"}; }

  /* Payment-history table (single-copy only) */
  table.pay {
    width: 100%;
    border-collapse: collapse;
    font-size: ${FS_TABLE};
    margin-top: ${compact ? "1.5mm" : "2mm"};
    table-layout: fixed;
  }
  table.pay th, table.pay td {
    border: 0.3mm solid #000;
    padding: ${compact ? "1mm 1.5mm" : "1.5mm 2mm"};
  }
  table.pay thead th {
    background: #fef2f2;
    color: ${RED};
    font-family: Arial, sans-serif;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.15mm;
    font-size: ${FS_TABLE_HEAD};
    text-align: left;
  }
  table.pay thead th.right { text-align: right; }
  table.pay col.c-date { width: ${compact ? "20mm" : "26mm"}; }
  table.pay col.c-method { width: ${compact ? "18mm" : "24mm"}; }
  table.pay col.c-payamt { width: ${compact ? "22mm" : "30mm"}; }
  table.pay td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.pay td.ref {
    font-family: "Courier New", monospace;
    font-size: ${compact ? "2mm" : "2.6mm"};
    overflow-wrap: anywhere;
  }

  /* ── AMOUNT IN WORDS ─────────────────────────────────────────── */
  .words {
    margin-top: ${SECTION_GAP};
    padding: ${compact ? "1.5mm 2mm" : "2mm 3mm"};
    border: 0.3mm solid #000;
    background: #fafafa;
    font-size: ${FS_TABLE};
    line-height: 1.35;
  }
  .words .w-lbl {
    font-family: Arial, sans-serif;
    font-weight: 800;
    color: ${RED};
    text-transform: uppercase;
    letter-spacing: 0.15mm;
    font-size: ${FS_TABLE_HEAD};
    margin-right: 2mm;
  }

  /* ── NOTES ── yellow ruled block ─────────────────────────────── */
  .notes {
    margin-top: ${compact ? "1.5mm" : "2mm"};
    padding: ${compact ? "1.5mm 2mm" : "2mm 3mm"};
    border: 0.3mm solid #000;
    background: #fffbeb;
    font-size: ${FS_TABLE};
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .notes strong {
    font-family: Arial, sans-serif;
    font-weight: 800;
    margin-right: 1.5mm;
  }

  /* ── SIGNATURES ── pinned to bottom via margin-top:auto ───────── */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-top: auto;
    padding-top: ${compact ? "6mm" : "10mm"};
    font-family: Arial, sans-serif;
    font-weight: 800;
    font-size: ${FS_SIG};
    letter-spacing: 0.2mm;
  }
  .signatures .left {
    text-align: center;
    border-top: 0.3mm solid #000;
    padding: 1mm 2mm 0;
    margin-right: ${compact ? "6mm" : "12mm"};
  }
  .signatures .right {
    text-align: center;
    border-top: 0.3mm solid #000;
    padding: 1mm 2mm 0;
    margin-left: ${compact ? "6mm" : "12mm"};
  }

  /* ── STATUS RIBBON ── thin red/green strip beside the title ──── */
  .status-pill {
    display: inline-block;
    font-family: Arial, sans-serif;
    font-weight: 800;
    font-size: ${compact ? "2.4mm" : "3mm"};
    color: ${stampColor};
    border: 0.4mm solid ${stampColor};
    padding: 0.4mm 2mm;
    text-transform: uppercase;
    letter-spacing: 0.2mm;
    margin-left: 2mm;
    vertical-align: middle;
  }

  /* ── TWO-UP SHEET ── pixel-perfect A5 landscape ──────────────── */
  .sheet-twoup {
    display: flex;
    flex-direction: row;
    width: 210mm;
    height: 148mm;
    margin: 12px auto;
    background: #fff;
    overflow: hidden;
    position: relative;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.10);
  }
  .sheet-twoup .page {
    margin: 0;
    box-shadow: none;
    flex: 0 0 105mm;
    width: 105mm;
    height: 148mm;
    border-width: ${compact ? "0.6mm" : "1mm"};
  }
  .sheet-twoup .page + .page {
    border-left-style: dashed;
    border-left-width: 0.6mm;
  }

  /* ── A4 TEAR WRAPPER ─────────────────────────────────────────
     When printing on A4, the receipt content (single A5 OR two-up sheet)
     pins to the top half of the A4 sheet. A dashed line + tiny scissor
     icon at 148mm mark where the cashier should tear. The bottom half
     stays blank. */
  .a4-tear {
    position: relative;
    width: 210mm;
    height: 297mm;
    margin: 12px auto;
    background: #fff;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.10);
    overflow: hidden;
  }
  /* Inside the A4 wrapper, the inner content (sheet or single page) sits
     pinned to the top-left, NO outer margin (the on-screen .page margin is
     suppressed via the descendant selector below). */
  .a4-tear .sheet-twoup,
  .a4-tear > .page {
    margin: 0;
    box-shadow: none;
  }
  /* For single-copy A4, the .page itself is already 210×148mm (A5 landscape)
     because PAGE_W/PAGE_H are switched when onA4 && !twoUp. No extra wrapper
     needed — the .page just pins to the top of the A4 sheet. */
  /* Cut/tear guide — horizontal dashed line + scissor icon at 148mm.
     Visible both on-screen (so the cashier can see what they'll get) and
     in print. */
  .a4-tear::before {
    content: "";
    position: absolute;
    left: 0; right: 0;
    top: 148mm;
    border-top: 0.4mm dashed #9ca3af;
    pointer-events: none;
  }
  .a4-tear::after {
    content: "✂  cut here  ✂";
    position: absolute;
    left: 50%;
    top: calc(148mm - 2.8mm);
    transform: translateX(-50%);
    font-family: Arial, sans-serif;
    font-size: 2.5mm;
    color: #6b7280;
    background: #fff;
    padding: 0 3mm;
    letter-spacing: 0.3mm;
  }

  /* ── PRINT ─────────────────────────────────────────────────── */
  @media print {
    html, body { background: #fff; margin: 0; padding: 0; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    ${onA4 ? `
    /* A4 with content on top half — the A4 page is 210×297mm, our content
       occupies the top 148mm and tears off at the dashed guide. */
    .a4-tear {
      margin: 0;
      box-shadow: none;
      width: 210mm;
      height: 297mm;
      page-break-after: auto;
    }
    .a4-tear .sheet-twoup,
    .a4-tear > .page {
      width: ${twoUp ? "210mm" : "210mm"};
      height: 148mm;
      box-shadow: none;
      page-break-after: auto;
    }
    .a4-tear .sheet-twoup .page {
      box-shadow: none;
      page-break-after: auto;
    }
    ` : twoUp ? `
    /* A5 landscape (210×148mm) — two A6 portraits edge-to-edge, no waste. */
    .sheet-twoup {
      margin: 0;
      box-shadow: none;
      width: 210mm;
      height: 148mm;
      page-break-after: auto;
    }
    .sheet-twoup .page {
      width: 105mm;
      height: 148mm;
      page-break-after: auto;
    }
    ` : `
    /* A5 portrait single copy — content fills the whole 148×210 page. */
    .page {
      margin: 0;
      box-shadow: none;
      width: 148mm;
      height: 210mm;
      page-break-after: auto;
    }
    `}
  }
</style>
</head>
<body>
${onA4 ? `<div class="a4-tear">` : ""}
${twoUp ? `<div class="sheet-twoup">` : ""}
${Array.from({ length: copies }, (_, i) => {
  const copyLabel = copies === 2 ? (i === 0 ? "OFFICE COPY" : "PARENT COPY") : "";
  // Total row reflects what the receipt is "for": if paid, show the paid amount
  // prominently; if outstanding, show the balance due. Subtotal + paid stay
  // visible above so the math is transparent.
  const grandLabel = isPaid ? "Total Paid" : isPartial ? "Balance Due" : "Total Due";
  const grandValue = isPaid ? serverComputed.paid : isPartial ? serverComputed.balance : serverComputed.total;
  // Items numbered with serial — schools insist on this.
  const itemsRowsNumbered = items.length ? items.map((item, idx) => {
    const safeLabel = escapeHtml(item.label);
    const amount = parseFloat(String(item.amount));
    return `<tr>
      <td class="center">${idx + 1}</td>
      <td class="desc">${safeLabel}</td>
      <td class="num">${formatINR(amount)}</td>
    </tr>`;
  }).join("") : `<tr><td class="center">1</td><td class="desc" colspan="2" style="font-style:italic;color:#666;">School fees</td></tr>`;

  return `<div class="page">
  ${copyLabel ? `<div class="copy-tag">${copyLabel}</div>` : ""}

  <!-- ── HEADER ── -->
  <div class="head">
    <div class="logo">${safeSchoolLogo ? `<img src="${safeSchoolLogo}" alt=""/>` : safeSchoolName.charAt(0).toUpperCase()}</div>
    <div class="head-info">
      <div class="school-name">${safeSchoolName}</div>
      ${safeSchoolAddress ? `<div class="school-meta">${safeSchoolAddress}</div>` : ""}
      ${(safeSchoolPhone || safeSchoolEmail) ? `<div class="school-meta">${[safeSchoolPhone ? `<strong>Tel:</strong> ${safeSchoolPhone}` : "", safeSchoolEmail ? `<strong>Email:</strong> ${safeSchoolEmail}` : ""].filter(Boolean).join(" &nbsp;|&nbsp; ")}</div>` : ""}
    </div>
  </div>

  <!-- ── TITLE ── -->
  <div class="title">${isPaid ? "Fee Receipt" : "Fee Invoice"}<span class="status-pill">${statusLabel}</span></div>
  <div class="title-sub">Receipt No.: <span class="recno">${escapeHtml(invoiceNumber)}</span> &nbsp;|&nbsp; Date: ${latestPayment ? paymentDate : safeIssueDate}</div>

  <!-- ── STUDENT PROFILE ── -->
  <div class="section-h">Student Particulars</div>
  <div class="profile">
    <div class="lbl">Name</div><div class="colon">:</div><div class="val">${safeStudentName}</div>
    <div class="lbl">Admn No.</div><div class="colon">:</div><div class="val">${safeStudentCode || "—"}</div>

    <div class="lbl">Class</div><div class="colon">:</div><div class="val">${classStr}</div>
    <div class="lbl">A.Y.</div><div class="colon">:</div><div class="val">${escapeHtml(academicYearStr)}</div>

    <div class="lbl">Period</div><div class="colon">:</div><div class="val">${safeBillingPeriod}</div>
    <div class="lbl">Due Date</div><div class="colon">:</div><div class="val">${safeDueDate}</div>
  </div>

  <!-- ── FEE PARTICULARS ── -->
  <div class="section-h">Fee Particulars</div>
  <table class="bill">
    <colgroup>
      <col class="c-sno"/>
      <col/>
      <col class="c-amount"/>
    </colgroup>
    <thead>
      <tr>
        <th class="center">S.No</th>
        <th>Particulars</th>
        <th class="right">Amount (Rs.)</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRowsNumbered}
      <tr class="subtotal">
        <td class="center"></td>
        <td>Subtotal</td>
        <td class="num">${formatINR(serverComputed.total)}</td>
      </tr>
      ${serverComputed.paid > 0 ? `
      <tr class="subtotal">
        <td class="center"></td>
        <td>Less: Paid Earlier${latestPayment ? ` (via ${paymentMode})` : ""}</td>
        <td class="num">− ${formatINR(serverComputed.paid)}</td>
      </tr>
      ` : ""}
      <tr class="grand">
        <td class="center"></td>
        <td>${grandLabel}</td>
        <td class="num">${formatINR(grandValue)}</td>
      </tr>
    </tbody>
  </table>

  ${!compact && payments.length > 1 ? `
  <div class="section-h">Payment History</div>
  <table class="pay">
    <colgroup>
      <col class="c-date"/>
      <col class="c-method"/>
      <col/>
      <col class="c-payamt"/>
    </colgroup>
    <thead>
      <tr>
        <th>Date</th>
        <th>Mode</th>
        <th>Reference</th>
        <th class="right">Amount (Rs.)</th>
      </tr>
    </thead>
    <tbody>${paymentsRows}</tbody>
  </table>
  ` : ""}

  <!-- ── AMOUNT IN WORDS ── -->
  <div class="words">
    <span class="w-lbl">In Words:</span>${numberToWords(grandValue)} only
  </div>

  ${safeNotes ? `<div class="notes"><strong>Note:</strong>${safeNotes}</div>` : ""}

  <!-- ── SIGNATURES ── pinned to bottom -->
  <div class="signatures">
    <div class="left">Parent / Guardian</div>
    <div class="right">Authorised Signatory</div>
  </div>
</div>`;
}).join("")}
${twoUp ? `</div>` : ""}
${onA4 ? `</div>` : ""}
</body>
</html>`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse(401, "Missing authorization header");
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === authHeader) return errorResponse(401, "Invalid authorization format");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) return errorResponse(500, "Server configuration error");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) return errorResponse(401, "Authentication failed", userErr?.message);

    const schoolCode = user.app_metadata?.school_code;
    if (!schoolCode) return errorResponse(403, "No school associated");

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    let body: any;
    try { body = await req.json(); } catch { return errorResponse(400, "Invalid request body"); }
    const { invoice_id } = body || {};
    if (!invoice_id) return errorResponse(400, "Missing invoice_id");

    const copies: 1 | 2 = body?.copies === 2 ? 2 : 1;
    // Paper size: 'a4' (default — works on every school printer, content
    // pinned to top half of A4 with a tear guide) or 'a5' (edge-to-edge,
    // for schools whose printers are configured for A5 paper).
    const paperSize: "a4" | "a5" = body?.paper_size === "a5" ? "a5" : "a4";

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(invoice_id)) return errorResponse(400, "Invalid invoice_id format");

    const { data: invoice, error: invErr } = await supabaseUser
      .from("fee_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();
    if (invErr || !invoice) return errorResponse(404, "Invoice not found", invErr?.message);
    if (invoice.school_code !== schoolCode) return errorResponse(403, "Cross-school access denied");

    const [itemsR, paymentsR, studentR, schoolR] = await Promise.all([
      supabaseAdmin.from("fee_invoice_items").select("*").eq("invoice_id", invoice_id).order("created_at"),
      supabaseAdmin.from("fee_payments").select("*").eq("invoice_id", invoice_id).order("payment_date", { ascending: false }),
      supabaseAdmin.from("student").select("id, full_name, student_code, phone, class_instance_id").eq("id", invoice.student_id).single(),
      supabaseAdmin.from("schools").select("*").eq("school_code", schoolCode).single(),
    ]);

    const items = itemsR.data || [];
    const payments = paymentsR.data || [];
    const student = studentR.data;
    const school = schoolR.data;

    const total = items.reduce((s, it) => s + parseFloat(String(it.amount)), 0);
    const paid = payments.reduce((s, p) => s + parseFloat(String(p.amount_inr)), 0);
    const balance = Math.max(0, total - paid);
    const status = paid >= total && total > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "DUE";

    let classInfo = null;
    let academicYear = null;
    if (student?.class_instance_id) {
      const { data: cls } = await supabaseAdmin
        .from("class_instances")
        .select("id, grade, section, academic_year_id")
        .eq("id", student.class_instance_id)
        .single();
      classInfo = cls;
      if (cls?.academic_year_id) {
        const { data: ay } = await supabaseAdmin
          .from("academic_years")
          .select("year_start, year_end")
          .eq("id", cls.academic_year_id)
          .single();
        academicYear = ay;
      }
    }

    const dt = invoice.created_at ? new Date(invoice.created_at) : new Date();
    const yy = dt.getFullYear().toString().slice(-2);
    const mm = (dt.getMonth() + 1).toString().padStart(2, "0");
    const shortId = invoice.id.slice(0, 8).toUpperCase();
    const invoiceNumber = `INV-${invoice.school_code}-${yy}${mm}-${shortId}`;

    const html = renderHTML({
      invoiceNumber,
      invoice,
      items,
      payments,
      student,
      school,
      classInfo,
      academicYear,
      serverComputed: { total, paid, balance, status },
      copies,
      paperSize,
    });

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        html_content: html,
        invoice_id: invoice.id,
        server_computed: { total, paid, balance, status },
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Invoice generation error:", err);
    return errorResponse(500, "Internal server error", err?.message || String(err));
  }
});
