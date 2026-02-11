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

const ensureHodRole = async (userId: string) => {
  const { data, error } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "hod")
    .maybeSingle();

  if (error || !data) return false;
  return true;
};

const getHodDepartment = async (userId: string) => {
  const { data, error } = await adminClient
    .from("profiles")
    .select("department_id")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data.department_id as string | null;
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

    const isHod = await ensureHodRole(user.id);
    if (!isHod) {
      return new Response("Forbidden", { status: 403 });
    }

    const hodDepartmentId = await getHodDepartment(user.id);
    if (!hodDepartmentId) {
      return new Response(JSON.stringify({ error: "HOD department not set" }), { status: 400 });
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "add") {
      const email = (body?.email || "").trim().toLowerCase();
      const fullName = (body?.fullName || "").trim();
      const password = (body?.password || "").trim();

      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });
      }

      const { data: existingProfile, error: profileLookupError } = await adminClient
        .from("profiles")
        .select("id, department_id")
        .eq("email", email)
        .maybeSingle();

      if (profileLookupError) {
        return new Response(JSON.stringify({ error: profileLookupError.message }), { status: 400 });
      }

      if (existingProfile?.id) {
        const { data: teacherRole } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", existingProfile.id)
          .eq("role", "teacher")
          .maybeSingle();

        if (!teacherRole) {
          return new Response(JSON.stringify({ error: "Only teacher accounts can be added" }), { status: 400 });
        }

        if (existingProfile.department_id && existingProfile.department_id !== hodDepartmentId) {
          return new Response(JSON.stringify({ error: "Teacher belongs to another department" }), { status: 403 });
        }

        const { error: updateError } = await adminClient
          .from("profiles")
          .update({ department_id: hodDepartmentId })
          .eq("id", existingProfile.id);

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });
        }

        await adminClient.auth.admin.updateUserById(existingProfile.id, {
          user_metadata: { department_id: hodDepartmentId },
        });

        return new Response(JSON.stringify({ success: true, status: "attached", teacherId: existingProfile.id }), {
          status: 200,
        });
      }

      if (!password || !fullName) {
        return new Response(JSON.stringify({ error: "Full name and password are required for new accounts" }), {
          status: 400,
        });
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "teacher",
          department_id: hodDepartmentId,
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
        department_id: hodDepartmentId,
      });
      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), { status: 400 });
      }

      const { error: roleError } = await adminClient.from("user_roles").insert({
        user_id: userId,
        role: "teacher",
      });
      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), { status: 400 });
      }

      return new Response(JSON.stringify({ success: true, status: "created", teacherId: userId }), { status: 200 });
    }

    if (action === "remove") {
      const teacherId = (body?.teacherId || "").trim();
      if (!teacherId) {
        return new Response(JSON.stringify({ error: "Teacher ID is required" }), { status: 400 });
      }

      const { data: teacherProfile, error: teacherProfileError } = await adminClient
        .from("profiles")
        .select("department_id")
        .eq("id", teacherId)
        .single();

      if (teacherProfileError) {
        return new Response(JSON.stringify({ error: teacherProfileError.message }), { status: 400 });
      }

      if (teacherProfile.department_id !== hodDepartmentId) {
        return new Response(JSON.stringify({ error: "Teacher is not in your department" }), { status: 403 });
      }

      const { data: teacherRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", teacherId)
        .eq("role", "teacher")
        .maybeSingle();

      if (!teacherRole) {
        return new Response(JSON.stringify({ error: "Only teacher accounts can be removed" }), { status: 400 });
      }

      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ department_id: null })
        .eq("id", teacherId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });
      }

      await adminClient.from("teacher_subjects").delete().eq("teacher_id", teacherId);

      await adminClient.auth.admin.updateUserById(teacherId, {
        user_metadata: { department_id: null },
      });

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
