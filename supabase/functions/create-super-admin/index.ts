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
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(res.body, {
    status: res.status,
    headers
  });
}
serve(async (req)=>{
  const origin = req.headers.get("Origin");
  
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return withCors(new Response("OK", {
      status: 200
    }), origin);
  }

  try {
    // Parse request body with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return withCors(new Response(JSON.stringify({
        error: "Invalid JSON in request body",
        details: parseError.message
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    const { email, password, full_name, phone, school_id, school_name, school_code, role, super_admin_code } = requestData;

    // Validate required fields
    if (!email || !password || !full_name || !phone || !school_name || !school_code || !role || !super_admin_code) {
      return withCors(new Response(JSON.stringify({
        error: "Missing required fields",
        details: "email, password, full_name, phone, school_name, school_code, role, and super_admin_code are required"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return withCors(new Response(JSON.stringify({
        error: "Invalid email format"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    // Validate password strength
    if (password.length < 6) {
      return withCors(new Response(JSON.stringify({
        error: "Password must be at least 6 characters long"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }
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
  // Check role in both app_metadata and user_metadata for backward compatibility
  const userRole = requester.app_metadata?.role || requester.user_metadata?.role;
  const isCbAdmin = userRole === "cb_admin";
  if (!isCbAdmin) {
    return withCors(new Response(JSON.stringify({
      error: "Forbidden - Not a CB Admin",
      details: "Only CB Admins can create new users"
    }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    }), origin);
  }

  // SECURITY: Validate that CB Admin is not trying to create a super admin for a school they shouldn't access
  // CB Admin should be able to create super admins for any school (platform-level operation)
  // But we should log this operation for audit purposes
  console.log(`[SECURITY_AUDIT] CB Admin ${requester.email} creating super admin for school ${school_code}`);
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    app_metadata: {
      role,
      school_id,
      school_name,
      school_code,
      super_admin_code
    },
    user_metadata: {
      full_name,
      phone
    },
    email_confirm: true
  });
    if (createError) {
      console.error("User creation error:", createError);
      return withCors(new Response(JSON.stringify({
        error: "Failed to create user",
        details: createError.message
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      }), origin);
    }

    if (!newUser.user) {
      return withCors(new Response(JSON.stringify({
        error: "User creation failed - no user returned"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }), origin);
    }
  const id = newUser.user.id;
  const { error: insertError } = await supabase.from("super_admin").insert({
    id,
    full_name,
    email,
    phone,
    school_id,
    school_name,
    school_code,
    super_admin_code,
    role
  });
    if (insertError) {
      console.error("Database insert error:", insertError);
      return withCors(new Response(JSON.stringify({
        error: "Failed to save super admin record",
        details: insertError.message
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }), origin);
    }
    return withCors(new Response(JSON.stringify({
      message: "Super Admin created successfully",
      data: {
        id,
        email,
        full_name,
        phone,
        school_id,
        role,
        super_admin_code,
        school_name
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }), origin);

  } catch (error) {
    console.error("Unexpected error in create-super-admin:", error);
    return withCors(new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    }), origin);
  }
});
