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

    const { email, password, full_name, phone, role, admin_code } = requestData;

    // Validate required fields
    if (!email || !password || !full_name || !phone || !role || !admin_code) {
      return withCors(new Response(JSON.stringify({
        error: "Missing required fields",
        details: "email, password, full_name, phone, role, and admin_code are required"
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
  
  // Debug logging
  /* ======================================================
     🧠 Verify role and school info
     ✅ Use ONLY app_metadata (immutable, authoritative)
     ❌ NEVER fallback to user_metadata (mutable, unreliable)
  ======================================================= */
  const userRole = requester.app_metadata?.role;
  const isSuperAdmin = userRole === "superadmin";

  if (!userRole || !isSuperAdmin) {
    return withCors(
      new Response(
        JSON.stringify({
          error: "Forbidden - Not a super admin",
          details: userRole
            ? `Invalid role: ${userRole}. Only super admins can create admins.`
            : "Missing role in app_metadata. This is a data integrity issue.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
      origin
    );
  }

  // Get school information from requester (ONLY from app_metadata)
  const schoolCode = requester.app_metadata?.school_code;
  const schoolName = requester.app_metadata?.school_name;
  const superAdminCode = requester.app_metadata?.super_admin_code;

    if (!schoolCode) {
      return withCors(new Response(JSON.stringify({
        error: "School information not found",
        details: "User must have school_code in their profile"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      }), origin);
    }
  
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    app_metadata: {
      role,
      school_name: schoolName,
      school_code: schoolCode,
      super_admin_code: superAdminCode,
      admin_code
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
  const { error: insertError } = await supabase.from("admin").insert({
    id,
    full_name,
    email,
    phone,
    school_name: schoolName,
    school_code: schoolCode,
    admin_code,
    role
  });
    if (insertError) {
      console.error("Database insert error:", insertError);
      
      // Clean up: Delete the user from auth since we couldn't save to admin table
      try {
        await supabase.auth.admin.deleteUser(id);
      } catch (cleanupError) {
        console.error("Failed to cleanup user from auth:", cleanupError);
      }
      
      return withCors(new Response(JSON.stringify({
        error: "Failed to save admin record",
        details: insertError.message
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }), origin);
    }
    return withCors(new Response(JSON.stringify({
      message: "Admin created successfully",
      data: {
        id,
        email,
        full_name,
        phone,
        school_name: schoolName,
        school_code: schoolCode,
        role,
        admin_code,
        super_admin_code: superAdminCode
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }), origin);

  } catch (error) {
    console.error("Unexpected error in create-admin:", error);
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
