// @ts-ignore - Deno URL imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore - Deno URL imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ======================================================
   ✅ CORS WRAPPER - allows both prod & local origins
====================================================== */
function withCors(res: Response, origin?: string | null) {
  const headers = new Headers(res.headers);
  const allowedOrigins = [
    "https://app.classbridge.in",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8081",
  ];

  const allowedOrigin = allowedOrigins.includes(origin ?? "")
    ? origin
    : "https://app.classbridge.in";

  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return new Response(res.body, { status: res.status, headers });
}

/* ======================================================
   🚀 EDGE FUNCTION ENTRY POINT
====================================================== */
serve(async (req) => {
  const origin = req.headers.get("Origin");

  // ✅ Handle preflight CORS
  if (req.method === "OPTIONS") {
    return withCors(new Response("OK", { status: 200 }), origin);
  }

  try {
    /* ======================================================
       🔧 Initialize Supabase client
    ======================================================= */
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("❌ Missing Supabase environment variables!");
      return withCors(
        new Response(
          JSON.stringify({
            error: "Server configuration error",
            details:
              "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in secrets",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    const supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    /* ======================================================
       🔐 Verify admin or superadmin token
    ======================================================= */
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return withCors(
        new Response(
          JSON.stringify({ error: "Authorization token required" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    const { data: { user: requester }, error: authError } =
      await supabaseClient.auth.getUser(token);

    if (authError || !requester) {
      return withCors(
        new Response(
          JSON.stringify({
            error: "Authentication failed",
            details: authError?.message || "User not found",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    /* ======================================================
       🧠 Verify role and school info
       ✅ Use ONLY app_metadata (immutable, authoritative)
       ❌ NEVER fallback to user_metadata (mutable, unreliable)
    ======================================================= */
    const userRole = requester.app_metadata?.role;
    const isAdmin = userRole === "admin" || userRole === "superadmin";

    if (!userRole || !isAdmin) {
      return withCors(
        new Response(
          JSON.stringify({
            error: "Forbidden - Not an admin or super admin",
            details: userRole
              ? `Invalid role: ${userRole}. Only admins and super admins can delete students.`
              : "Missing role in app_metadata. This is a data integrity issue.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    // Get school information from requester (ONLY from app_metadata)
    const schoolCode = requester.app_metadata?.school_code;

    if (!schoolCode) {
      return withCors(
        new Response(
          JSON.stringify({
            error: "School information not found",
            details: "User must have school_code in their profile",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    /* ======================================================
       🧾 Parse request body
    ======================================================= */
    let requestData;
    try {
      requestData = await req.json();
    } catch (err) {
      return withCors(
        new Response(
          JSON.stringify({ error: "Invalid JSON", details: err.message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    const { student_id } = requestData;

    if (!student_id) {
      return withCors(
        new Response(
          JSON.stringify({
            error: "Missing required field",
            details: "student_id is required",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    // Get student record with auth_user_id for cleanup
    const { data: student, error: studentError } = await supabaseClient
      .from("student")
      .select("id, school_code, auth_user_id")
      .eq("id", student_id)
      .single();

    if (studentError || !student) {
      return withCors(
        new Response(
          JSON.stringify({
            error: "Student not found",
            details: studentError?.message || "Student record does not exist",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    // Verify tenant isolation (for admin role, superadmin can delete from any school)
    if (userRole === "admin" && student.school_code !== schoolCode) {
      return withCors(
        new Response(
          JSON.stringify({
            error: "Unauthorized",
            details: "Cannot delete student from different school",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }

    const authUserId = student.auth_user_id || student_id;

    // Step 1: Delete from student table
    const { error: deleteError } = await supabaseClient
      .from("student")
      .delete()
      .eq("id", student_id);

    if (deleteError) {
      console.error("❌ Student table delete error:", deleteError);
      return withCors(
        new Response(
          JSON.stringify({
            error: "Failed to delete student record",
            details: deleteError.message,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }


    // Step 2: Delete from users table
    const { error: usersDeleteError } = await supabaseClient
      .from("users")
      .delete()
      .eq("id", authUserId);

    if (usersDeleteError) {
      console.error("❌ Users table delete error:", usersDeleteError);
      // Continue with auth deletion even if users delete fails
      // (might already be deleted or not exist)
    } else {
    }

    // Step 3: Delete auth user (final step)
    const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(authUserId);

    if (authDeleteError) {
      console.error("❌ Auth user delete error:", authDeleteError);
      return withCors(
        new Response(
          JSON.stringify({
            error: "Failed to delete auth user",
            details: authDeleteError.message,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        origin
      );
    }


    /* ======================================================
       ✅ SUCCESS RESPONSE
    ======================================================= */
    return withCors(
      new Response(
        JSON.stringify({
          success: true,
          message: "Student deleted successfully",
          data: {
            student_id: student_id,
            auth_user_id: authUserId,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
      origin
    );
  } catch (error) {
    console.error("🔥 Unexpected error in delete-student:", error);
    return withCors(
      new Response(
        JSON.stringify({
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ),
      origin
    );
  }
});