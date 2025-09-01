import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// 🔧 Reusable CORS wrapper
function withCors(res) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "http://localhost:5173"); // ✅ change for production
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(res.body, {
    status: res.status,
    headers
  });
}
serve(async (req)=>{
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return withCors(new Response("OK", {
      status: 200
    }));
  }
  const { email, password, full_name, phone, role, admin_code } = await req.json();
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user: requester }, error: requesterError } = await supabase.auth.getUser(token);
  if (requesterError || !requester) {
    return withCors(new Response("Unauthorized", {
      status: 401
    }));
  }
  const isSuperAdmin = requester.user_metadata?.role === "superadmin";
  if (!isSuperAdmin) {
    return withCors(new Response("Forbidden", {
      status: 403
    }));
  }
  
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      full_name,
      phone,
      school_name:requester.user_metadata.school_name,
      school_code:requester.user_metadata.school_code,
      super_admin_code:requester.user_metadata.super_admin_code,
      role,
      admin_code
    },
    email_confirm: true
  });
  if (createError || !newUser.user) {
    return withCors(new Response(JSON.stringify({
      error: createError.message
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    }));
  }
  const id = newUser.user.id;
  const { error: insertError } = await supabase.from("admin").insert({
    id,
    full_name,
    email,
    phone,
    school_name:requester.user_metadata.school_name,
    school_code:requester.user_metadata.school_code,
    admin_code,
    super_admin_code:requester.user_metadata.super_admin_code,
    role
  });
  if (insertError) {
    return withCors(new Response(JSON.stringify({
      error: insertError.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    }));
  }
  return withCors(new Response(JSON.stringify({
    message: "Admin created",
    id,
    email,
    full_name,
    phone,
    school_name:requester.user_metadata.school_name,
    school_code:requester.user_metadata.school_code,
    role,
    admin_code,
    super_admin_code:requester.user_metadata.super_admin_code
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  }));
});
