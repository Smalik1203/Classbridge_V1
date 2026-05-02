// @ts-ignore - Deno URL imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore - Deno URL imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(origin?: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const json = (body: unknown, status: number, origin?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });

const todayISO = () => new Date().toISOString().split("T")[0];

// HMAC SHA-256 via Web Crypto (works in Deno Edge Runtime).
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  const origin = req.headers.get("Origin") || "*";

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }

  try {
    // @ts-ignore - Deno global
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    // @ts-ignore - Deno global
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // @ts-ignore - Deno global
    const RZP_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "Server configuration error: missing Supabase env" }, 500, origin);
    }
    if (!RZP_KEY_SECRET) {
      return json({ error: "Server configuration error: missing RAZORPAY_KEY_SECRET" }, 500, origin);
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Authorization token required" }, 401, origin);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Authentication failed", details: authErr?.message }, 401, origin);

    let body: {
      invoice_id?: string;
      amount?: number;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      remarks?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    const {
      invoice_id,
      amount,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      remarks = null,
    } = body;

    if (!invoice_id || !amount || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing required fields" }, 400, origin);
    }

    const expected = await hmacSha256Hex(
      RZP_KEY_SECRET,
      `${razorpay_order_id}|${razorpay_payment_id}`,
    );

    if (expected !== razorpay_signature) {
      console.warn("Razorpay signature mismatch", { invoice_id, razorpay_order_id });
      return json({ error: "Invalid payment signature" }, 400, origin);
    }

    const { data: invoice, error: invErr } = await supabase
      .from("fee_invoices")
      .select("id, school_code, student_id, total_amount, paid_amount")
      .eq("id", invoice_id)
      .single();
    if (invErr || !invoice) return json({ error: "Invoice not found", details: invErr?.message }, 404, origin);

    const remaining = Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0);
    if (amount > remaining + 0.001) {
      return json({ error: `Amount exceeds remaining balance (${remaining.toFixed(2)})` }, 400, origin);
    }

    const { data: existing } = await supabase
      .from("fee_payments")
      .select("id")
      .eq("invoice_id", invoice_id)
      .eq("receipt_number", razorpay_payment_id)
      .maybeSingle();

    if (existing?.id) {
      return json({ id: existing.id, idempotent: true }, 200, origin);
    }

    const paymentDate = todayISO();
    const recordedAt = new Date().toISOString();

    const { data: payment, error: insertErr } = await supabase
      .from("fee_payments")
      .insert({
        invoice_id,
        invoice_item_id: null,
        student_id: invoice.student_id,
        school_code: invoice.school_code,
        amount_inr: amount,
        payment_method: "online",
        payment_date: paymentDate,
        receipt_number: razorpay_payment_id,
        remarks: remarks || `Razorpay order ${razorpay_order_id}`,
        recorded_by_user_id: user.id,
        recorded_at: recordedAt,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (insertErr) {
      console.error("Insert payment error:", insertErr);
      return json({ error: "Failed to record payment", details: insertErr.message }, 500, origin);
    }

    const { data: payments } = await supabase
      .from("fee_payments")
      .select("amount_inr")
      .eq("invoice_id", invoice_id);

    const paidTotal = (payments || []).reduce((s, p) => s + Number(p.amount_inr || 0), 0);
    const total = Number(invoice.total_amount || 0);
    let status = "pending";
    if (paidTotal >= total && total > 0) status = "paid";
    else if (paidTotal > 0) status = "partial";

    await supabase
      .from("fee_invoices")
      .update({ paid_amount: paidTotal, status })
      .eq("id", invoice_id);

    return json(
      {
        id: payment.id,
        invoice_id,
        amount,
        razorpay_payment_id,
        paid_amount: paidTotal,
        status,
      },
      200,
      origin,
    );
  } catch (err: any) {
    console.error("Unexpected error in razorpay-verify-payment:", err);
    return json({ error: "Internal server error", details: err?.message || String(err) }, 500, origin);
  }
});
