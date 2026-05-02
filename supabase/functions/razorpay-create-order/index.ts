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
    const RZP_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    // @ts-ignore - Deno global
    const RZP_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "Server configuration error: missing Supabase env" }, 500, origin);
    }
    if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
      return json({ error: "Server configuration error: missing Razorpay keys. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase function secrets." }, 500, origin);
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Authorization token required" }, 401, origin);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Authentication failed", details: authErr?.message }, 401, origin);

    let body: { invoice_id?: string; amount?: number };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    const { invoice_id, amount } = body;
    if (!invoice_id) return json({ error: "invoice_id is required" }, 400, origin);
    if (!amount || amount <= 0) return json({ error: "amount must be > 0" }, 400, origin);

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

    const amountPaise = Math.round(amount * 100);

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `inv_${invoice_id}`.slice(0, 40),
        notes: {
          invoice_id,
          school_code: invoice.school_code,
          student_id: invoice.student_id,
          collected_by: user.id,
        },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      console.error("Razorpay order error:", errText);
      return json({ error: "Failed to create Razorpay order", details: errText }, 502, origin);
    }

    const order = await rzpRes.json();
    return json(
      {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: RZP_KEY_ID,
      },
      200,
      origin,
    );
  } catch (err: any) {
    console.error("Unexpected error in razorpay-create-order:", err);
    return json({ error: "Internal server error", details: err?.message || String(err) }, 500, origin);
  }
});
