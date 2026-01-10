import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================
   CORS
========================= */
function withCors(res: Response, origin?: string | null) {
  const headers = new Headers(res.headers);
  headers.set(
    "Access-Control-Allow-Origin",
    origin && origin !== "null"
      ? origin
      : "https://app.classbridge.in"
  );
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(res.body, { status: res.status, headers });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return withCors(new Response("OK"), origin);
  }

  try {
    /* =========================
       Parse input
    ========================= */
    const {
      email,
      password,
      full_name,
      phone,
      school_code,
      super_admin_code,
    } = await req.json();

    if (
      !email ||
      !password ||
      !full_name ||
      !phone ||
      !school_code ||
      !super_admin_code
    ) {
      return withCors(
        new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400 }
        ),
        origin
      );
    }

    // Basic validation
    if (password.length < 6) {
      return withCors(
        new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400 }
        ),
        origin
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return withCors(
        new Response(
          JSON.stringify({ error: "Invalid email format" }),
          { status: 400 }
        ),
        origin
      );
    }

    /* =========================
       Supabase
    ========================= */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    /* =========================
       Auth & authorization
    ========================= */
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return withCors(
        new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
        origin
      );
    }

    const { data: { user: requester } } =
      await supabase.auth.getUser(token);

    if (!requester || requester.app_metadata?.role !== "cb_admin") {
      return withCors(
        new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
        origin
      );
    }

    /* =========================
       Verify school exists
    ========================= */
    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("school_code, school_name")
      .eq("school_code", school_code)
      .single();

    if (schoolErr || !school) {
      return withCors(
        new Response(
          JSON.stringify({ error: "School does not exist" }),
          { status: 400 }
        ),
        origin
      );
    }

    /* =========================
       Check super_admin_code uniqueness
    ========================= */
    const { data: existingSA } = await supabase
      .from("super_admin")
      .select("super_admin_code")
      .eq("super_admin_code", super_admin_code)
      .maybeSingle();

    if (existingSA) {
      return withCors(
        new Response(
          JSON.stringify({ error: "Super Admin code already exists" }),
          { status: 400 }
        ),
        origin
      );
    }

    /* =========================
       Create auth user
       🔒 Role HARD-LOCKED
    ========================= */
    const { data: authRes, error: authErr } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          role: "superadmin",
          school_code: school.school_code,
          school_name: school.school_name,
          super_admin_code,
        },
        user_metadata: { full_name, phone },
      });

    if (authErr || !authRes.user) {
      return withCors(
        new Response(
          JSON.stringify({
            error: "Failed to create auth user",
            details: authErr?.message,
          }),
          { status: 400 }
        ),
        origin
      );
    }

    const userId = authRes.user.id;

    /* =========================
       public.users
    ========================= */
    const { error: usersErr } = await supabase.from("users").insert({
      id: userId,
      email,
      full_name,
      phone,
      role: "superadmin",
      school_code: school.school_code,
      school_name: school.school_name,
    });

    if (usersErr) {
      await supabase.auth.admin.deleteUser(userId);
      return withCors(
        new Response(
          JSON.stringify({
            error: "Failed to create user profile",
            details: usersErr.message,
          }),
          { status: 500 }
        ),
        origin
      );
    }

    /* =========================
       super_admin table
    ========================= */
    const { error: saErr } = await supabase.from("super_admin").insert({
      auth_user_id: userId,
      email,
      full_name,
      phone,
      school_code: school.school_code,
      school_name: school.school_name,
      super_admin_code,
      role: "superadmin",
    });

    if (saErr) {
      await supabase.from("users").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return withCors(
        new Response(
          JSON.stringify({
            error: "Failed to create super admin record",
            details: saErr.message,
          }),
          { status: 500 }
        ),
        origin
      );
    }

    /* =========================
       Success
    ========================= */
    return withCors(
      new Response(
        JSON.stringify({
          message: "Super Admin created successfully",
          data: {
            auth_user_id: userId,
            email,
            full_name,
            phone,
            school_code: school.school_code,
            super_admin_code,
          },
        }),
        { status: 200 }
      ),
      origin
    );
  } catch (err) {
    console.error(err);
    return withCors(
      new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500 }
      ),
      origin
    );
  }
});
