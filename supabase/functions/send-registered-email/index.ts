import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "";

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

type Role = "teacher" | "hod" | "exam_cell" | "admin";

type RequestBody = {
  subject?: string;
  message?: string;
  toEmail?: string;
  userId?: string;
  targetRoles?: Role[];
  targetDepartments?: string[] | null;
};

const getUserFromToken = async (token: string) => {
  if (!token) return null;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error) return null;
  return data.user;
};

const sendEmail = async (to: string, subject: string, message: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject,
      text: message,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error ${response.status}: ${text}`);
  }
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!resendApiKey || !resendFromEmail) {
      return new Response(
        JSON.stringify({
          error: "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
        }),
        { status: 500 },
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const user = await getUserFromToken(token);
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = (await req.json()) as RequestBody;
    const subject = (body.subject || "").trim();
    const message = (body.message || "").trim();
    const toEmail = (body.toEmail || "").trim().toLowerCase();
    const userId = (body.userId || "").trim();
    const targetRoles = body.targetRoles || [];
    const targetDepartments = body.targetDepartments || null;

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: "subject and message are required" }), { status: 400 });
    }

    const recipients = new Set<string>();

    if (toEmail) {
      recipients.add(toEmail);
    }

    if (userId) {
      const { data: profile, error } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      if (!error && profile?.email) {
        recipients.add(profile.email.toLowerCase());
      }
    }

    if (targetRoles.length > 0) {
      const { data: roleRows, error: roleError } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("role", targetRoles);

      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), { status: 400 });
      }

      const userIds = Array.from(new Set((roleRows || []).map((row) => row.user_id)));
      if (userIds.length > 0) {
        let query = adminClient
          .from("profiles")
          .select("email, department_id")
          .in("id", userIds);

        if (targetDepartments && targetDepartments.length > 0) {
          query = query.in("department_id", targetDepartments);
        }

        const { data: profiles, error: profileError } = await query;
        if (profileError) {
          return new Response(JSON.stringify({ error: profileError.message }), { status: 400 });
        }

        (profiles || []).forEach((profile) => {
          if (profile.email) {
            recipients.add(profile.email.toLowerCase());
          }
        });
      }
    }

    const recipientList = Array.from(recipients).filter(Boolean);
    if (recipientList.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: true }), { status: 200 });
    }

    for (const email of recipientList) {
      await sendEmail(email, subject, message);
    }

    return new Response(
      JSON.stringify({ success: true, sent: recipientList.length }),
      { status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});

