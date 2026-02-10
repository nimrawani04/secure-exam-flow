import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const getUserFromToken = async (token: string) => {
  if (!token) return null;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error) return null;
  return data.user;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: roleCheck, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleCheck) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      const { email, password, fullName, role, departmentId } = body;
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
          department_id: departmentId ?? null,
        },
      });
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: error?.message || "Failed to create user" }), { status: 400 });
      }

      const userId = data.user.id;
      const { error: profileError } = await adminClient.from("profiles").insert({
        id: userId,
        full_name: fullName,
        email,
        department_id: departmentId ?? null,
      });
      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), { status: 400 });
      }

      const { error: roleError } = await adminClient.from("user_roles").insert({
        user_id: userId,
        role,
      });
      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), { status: 400 });
      }

      return new Response(JSON.stringify({ success: true, userId }), { status: 200 });
    }

    if (action === "update") {
      const { userId, email, fullName, role, departmentId } = body;

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        user_metadata: {
          full_name: fullName,
          role,
          department_id: departmentId ?? null,
        },
      });
      if (authUpdateError) {
        return new Response(JSON.stringify({ error: authUpdateError.message }), { status: 400 });
      }

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ full_name: fullName, email, department_id: departmentId ?? null })
        .eq("id", userId);
      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), { status: 400 });
      }

      await adminClient.from("user_roles").delete().eq("user_id", userId);
      const { error: roleError } = await adminClient.from("user_roles").insert({ user_id: userId, role });
      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), { status: 400 });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    if (action === "delete") {
      const { userId } = body;
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
