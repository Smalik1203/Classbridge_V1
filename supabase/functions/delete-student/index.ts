import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "supabase"

const withCors = (response: Response, origin: string | null) => {
  const allowedOrigins = ['https://app.classbridge.in', 'http://localhost:5173'];
  const originHeader = origin && allowedOrigins.includes(origin) ? origin : 'http://localhost:5173';
  
  response.headers.set('Access-Control-Allow-Origin', originHeader);
  response.headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return response;
};

serve(async (req) => {
  const origin = req.headers.get("Origin");
  
  if (req.method === "OPTIONS") {
    return withCors(new Response("OK", { status: 200 }), origin);
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return withCors(new Response(JSON.stringify({
        error: "Authorization token required"
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    const { data: { user: requester }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !requester) {
      return withCors(new Response(JSON.stringify({
        error: 'Authentication failed', 
        details: authError?.message
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    const userRole = requester.app_metadata?.role || requester.user_metadata?.role;
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    
    if (!isAdmin) {
      return withCors(new Response(JSON.stringify({
        error: 'Unauthorized', 
        details: 'Only admins and super admins can delete students'
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    const { student_id } = await req.json();

    if (!student_id) {
      return withCors(new Response(JSON.stringify({
        error: 'Missing required field', 
        details: 'student_id is required'
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    const schoolCode = requester.app_metadata?.school_code || requester.user_metadata?.school_code;

    if (userRole === "admin") {
      const { data: student, error: studentError } = await supabaseClient
        .from("student")
        .select("school_code")
        .eq("id", student_id)
        .single();

      if (studentError || !student || student.school_code !== schoolCode) {
        return withCors(new Response(JSON.stringify({
          error: 'Student not found or unauthorized'
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }), origin);
      }
    }

    const { error: deleteError } = await supabaseClient
      .from("student")
      .delete()
      .eq("id", student_id);

    if (deleteError) {
      return withCors(new Response(JSON.stringify({
        error: 'Failed to delete student', 
        details: deleteError.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }

    await supabaseClient.auth.admin.deleteUser(student_id);

    return withCors(new Response(JSON.stringify({ 
      success: true, 
      message: 'Student deleted successfully'
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }), origin);

  } catch (error) {
    return withCors(new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    }), origin);
  }
})