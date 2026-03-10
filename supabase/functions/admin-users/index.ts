import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getUserFromToken = async (token: string) => {
  if (!token) return null;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error) return null;
  return data.user;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: roleCheck, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleCheck) {
      return jsonResponse({ error: "Forbidden" }, 403);
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
        return jsonResponse({ error: error?.message || "Failed to create user" }, 400);
      }

      const userId = data.user.id;
      const { error: profileError } = await adminClient.from("profiles").insert({
        id: userId,
        full_name: fullName,
        email,
        department_id: departmentId ?? null,
      });
      if (profileError) {
        return jsonResponse({ error: profileError.message }, 400);
      }

      const { error: roleInsertError } = await adminClient.from("user_roles").insert({
        user_id: userId,
        role,
      });
      if (roleInsertError) {
        return jsonResponse({ error: roleInsertError.message }, 400);
      }

      return jsonResponse({ success: true, userId }, 200);
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
        return jsonResponse({ error: authUpdateError.message }, 400);
      }

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ full_name: fullName, email, department_id: departmentId ?? null })
        .eq("id", userId);
      if (profileError) {
        return jsonResponse({ error: profileError.message }, 400);
      }

      await adminClient.from("user_roles").delete().eq("user_id", userId);
      const { error: roleInsertError } = await adminClient.from("user_roles").insert({ user_id: userId, role });
      if (roleInsertError) {
        return jsonResponse({ error: roleInsertError.message }, 400);
      }

      return jsonResponse({ success: true }, 200);
    }

    if (action === "delete") {
      const { userId } = body;
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ success: true }, 200);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
