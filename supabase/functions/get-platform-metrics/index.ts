// @ts-ignore - Deno URL imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore - Deno URL imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🔧 Reusable CORS wrapper
function withCors(res: Response, origin?: string): Response {
  const headers = new Headers(res.headers);
  // Allow both development and production origins
  const allowedOrigins = ["https://app.classbridge.in", "http://localhost:5173"];
  const requestOrigin = origin || "https://app.classbridge.in";
  const allowedOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : "https://app.classbridge.in";
  
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(res.body, {
    status: res.status,
    headers
  });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return withCors(new Response("OK", {
      status: 200
    }), origin);
  }

  try {
    // @ts-ignore - Deno global
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    
    // Validate environment variables
    if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      console.error("Missing Supabase environment variables");
      return withCors(new Response(JSON.stringify({
        error: "Server configuration error"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return withCors(new Response(JSON.stringify({
        error: "Authorization token required"
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    const { data: { user: requester }, error: requesterError } = await supabase.auth.getUser(token);
    if (requesterError) {
      console.error("Auth error:", requesterError);
      return withCors(new Response(JSON.stringify({
        error: "Authentication failed",
        details: requesterError.message
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    if (!requester) {
      return withCors(new Response(JSON.stringify({
        error: "User not found"
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    // SECURITY: Only CB Admin can access platform metrics
    const userRole = requester.app_metadata?.role || requester.user_metadata?.role;
    if (userRole !== "cb_admin") {
      return withCors(new Response(JSON.stringify({
        error: "Forbidden - CB Admin access required",
        details: "Only CB Admins can access platform metrics"
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    // SECURITY: Log the platform metrics access for audit purposes
    console.log(`[SECURITY_AUDIT] CB Admin ${requester.email} accessing platform metrics`);

    // Get platform metrics using the safe RPC function
    const { data: metrics, error: metricsError } = await supabase.rpc('get_platform_summary');
    
    if (metricsError) {
      console.error("Platform metrics error:", metricsError);
      return withCors(new Response(JSON.stringify({
        error: "Failed to retrieve platform metrics",
        details: metricsError.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    return withCors(new Response(JSON.stringify({
      message: "Platform metrics retrieved successfully",
      data: metrics
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }), origin);

  } catch (error) {
    console.error("Unexpected error in get-platform-metrics:", error);
    return withCors(new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    }), origin);
  }
});
