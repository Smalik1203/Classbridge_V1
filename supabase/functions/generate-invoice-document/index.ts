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

const formatINR = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

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
}

const renderHTML = (data: RenderInput): string => {
  const { invoiceNumber, invoice, items, payments, student, school, classInfo, academicYear, serverComputed } = data;

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
  const statusLabel = isPaid ? "PAID" : isPartial ? "PARTIAL" : "DUE";
  const statusColor = isPaid ? "#16a34a" : isPartial ? "#d97706" : "#dc2626";
  const statusBg = isPaid ? "#dcfce7" : isPartial ? "#fef3c7" : "#fee2e2";

  const itemsRows = items.map((item) => {
    const safeLabel = escapeHtml(item.label);
    const amount = parseFloat(String(item.amount));
    return `<tr>
      <td class="cell-label">${safeLabel}</td>
      <td class="cell-amount">${formatINR(amount)}</td>
    </tr>`;
  }).join("");

  const paymentsRows = payments.length
    ? payments.map((p) => {
        const amount = parseFloat(String(p.amount_inr));
        const method = String(p.payment_method || "—").replace(/_/g, " ");
        const date = formatDate(p.payment_date);
        const ref = escapeHtml(p.receipt_number) || "—";
        return `<tr>
          <td>${date}</td>
          <td><span class="pill">${escapeHtml(method)}</span></td>
          <td class="ref">${ref}</td>
          <td class="cell-amount">${formatINR(amount)}</td>
        </tr>`;
      }).join("")
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${escapeHtml(invoiceNumber)}</title>
<style>
  *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0f172a;
    --ink-soft: #475569;
    --ink-dim: #94a3b8;
    --border: #e2e8f0;
    --border-soft: #f1f5f9;
    --accent: #2563eb;
    --accent-soft: #eff6ff;
    --status: ${statusColor};
    --status-bg: ${statusBg};
  }
  html, body { background: #f8fafc; color: var(--ink); -webkit-font-smoothing: antialiased; }
  body { font-family: 'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.55; }
  .num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
  .doc {
    width: 210mm;
    min-height: 297mm;
    margin: 24px auto;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
    overflow: hidden;
    position: relative;
  }
  .head {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%);
    color: white;
    padding: 32px 40px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
  }
  .school-block { display: flex; gap: 16px; align-items: center; }
  .school-logo {
    width: 56px; height: 56px; border-radius: 12px;
    background: rgba(255,255,255,0.18);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 700;
    backdrop-filter: blur(8px);
    overflow: hidden;
  }
  .school-logo img { max-width: 100%; max-height: 100%; }
  .school-name { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
  .school-meta { font-size: 11.5px; opacity: 0.85; margin-top: 2px; }
  .doc-meta { text-align: right; }
  .doc-type { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.8; }
  .doc-number { font-size: 14px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .status-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--status-bg); color: var(--status);
    padding: 6px 12px; border-radius: 999px;
    font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
    margin-top: 12px;
  }
  .body { padding: 36px 40px; }
  .hero {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 24px; padding-bottom: 28px; border-bottom: 1px solid var(--border);
  }
  .hero-row { display: flex; flex-direction: column; gap: 4px; }
  .hero-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); font-weight: 600; }
  .hero-value { font-size: 14px; color: var(--ink); font-weight: 500; }
  .summary {
    margin: 28px 0;
    padding: 24px 28px;
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    border: 1px solid var(--border);
    border-radius: 14px;
    display: flex; justify-content: space-between; align-items: center; gap: 24px;
  }
  .summary-left { display: flex; flex-direction: column; gap: 4px; }
  .summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); font-weight: 600; }
  .summary-amount { font-size: 32px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .summary-words { font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; font-style: italic; }
  .summary-right { text-align: right; display: flex; flex-direction: column; gap: 6px; }
  .summary-side { font-size: 12px; color: var(--ink-soft); }
  .summary-side strong { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }

  .section { margin-top: 28px; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-dim); font-weight: 700; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-dim); font-weight: 600; padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  thead th.right { text-align: right; }
  tbody td { padding: 12px; border-bottom: 1px solid var(--border-soft); font-size: 13px; }
  tbody tr:last-child td { border-bottom: none; }
  .cell-label { color: var(--ink); }
  .cell-amount { text-align: right; color: var(--ink); font-variant-numeric: tabular-nums; font-weight: 500; }
  .pill { display: inline-block; background: var(--accent-soft); color: var(--accent); padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .ref { font-family: 'JetBrains Mono', 'Menlo', ui-monospace, monospace; font-size: 11.5px; color: var(--ink-soft); }
  .totals {
    margin-top: 8px;
    margin-left: auto;
    width: 320px;
  }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .totals-row.grand { border-top: 1px solid var(--border); padding-top: 14px; margin-top: 6px; font-size: 16px; font-weight: 700; color: var(--ink); }

  .notes { margin-top: 24px; padding: 14px 16px; background: var(--accent-soft); border-radius: 10px; font-size: 12px; color: var(--ink-soft); }
  .notes strong { color: var(--ink); font-weight: 600; }

  .footer { margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
  .footer-note { font-size: 10.5px; color: var(--ink-dim); max-width: 60%; line-height: 1.5; }
  .signature { text-align: right; min-width: 180px; }
  .signature-line { font-size: 11px; color: var(--ink-dim); border-top: 1px solid var(--ink); padding-top: 6px; margin-top: 36px; }

  .gen-stamp { font-size: 10px; color: var(--ink-dim); text-align: center; padding: 14px; background: #f8fafc; }

  @media print {
    html, body { background: #fff; }
    .doc { margin: 0; box-shadow: none; border-radius: 0; width: 100%; min-height: auto; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="doc">
  <div class="head">
    <div class="school-block">
      <div class="school-logo">${safeSchoolLogo ? `<img src="${safeSchoolLogo}" alt="logo"/>` : safeSchoolName.charAt(0)}</div>
      <div>
        <div class="school-name">${safeSchoolName}</div>
        <div class="school-meta">${safeSchoolAddress || ""}</div>
        <div class="school-meta">${[safeSchoolPhone, safeSchoolEmail].filter(Boolean).join(" · ")}</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-type">${isPaid ? "Receipt" : "Invoice"}</div>
      <div class="doc-number num">${escapeHtml(invoiceNumber)}</div>
      <div class="status-chip">${statusLabel}</div>
    </div>
  </div>

  <div class="body">
    <div class="hero">
      <div class="hero-row">
        <span class="hero-label">Billed to</span>
        <span class="hero-value">${safeStudentName}</span>
        <span class="hero-meta" style="font-size:12px;color:var(--ink-soft);">
          ${[safeStudentCode, classStr, safeStudentPhone].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div class="hero-row" style="text-align:right;">
        <span class="hero-label">Period &amp; Dates</span>
        <span class="hero-value">${safeBillingPeriod}</span>
        <span style="font-size:12px;color:var(--ink-soft);">
          Issued ${safeIssueDate} · Due ${safeDueDate} · AY ${escapeHtml(academicYearStr)}
        </span>
      </div>
    </div>

    <div class="summary">
      <div class="summary-left">
        <span class="summary-label">Total Paid</span>
        <span class="summary-amount num">${formatINR(serverComputed.paid)}</span>
        <span class="summary-words">${numberToWords(serverComputed.paid)} only</span>
      </div>
      <div class="summary-right">
        <span class="summary-side">Total billed: <strong>${formatINR(serverComputed.total)}</strong></span>
        <span class="summary-side">Balance due: <strong>${formatINR(serverComputed.balance)}</strong></span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Fee Items</div>
      <table>
        <thead>
          <tr><th>Description</th><th class="right">Amount</th></tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><span>${formatINR(serverComputed.total)}</span></div>
        <div class="totals-row"><span>Paid</span><span>− ${formatINR(serverComputed.paid)}</span></div>
        <div class="totals-row grand"><span>${isPaid ? "Total" : "Balance Due"}</span><span>${formatINR(isPaid ? serverComputed.total : serverComputed.balance)}</span></div>
      </div>
    </div>

    ${payments.length ? `
    <div class="section">
      <div class="section-title">Payment History</div>
      <table>
        <thead>
          <tr><th>Date</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr>
        </thead>
        <tbody>${paymentsRows}</tbody>
      </table>
    </div>` : ""}

    ${safeNotes ? `<div class="notes"><strong>Notes:</strong> ${safeNotes}</div>` : ""}

    <div class="footer">
      <div class="footer-note">
        ${escapeHtml(school?.footer_disclaimer) || "This is a computer-generated document. For any queries, please contact the school administration."}
      </div>
      <div class="signature">
        <div class="signature-line">Authorized Signature</div>
      </div>
    </div>
  </div>
  <div class="gen-stamp">Generated ${new Date().toLocaleString("en-IN")}</div>
</div>
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
