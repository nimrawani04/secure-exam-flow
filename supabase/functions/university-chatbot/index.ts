import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a smart, friendly university assistant chatbot integrated into a Confidential Exam Paper Management System. You serve Admin, Teacher, Head of Department (HOD), and Exam Cell users.

Your capabilities:
1. **Exam Paper System Help**: Answer questions about paper upload workflows, submission deadlines, review processes, paper statuses, rollback features, and how the approval pipeline works.
2. **Role-Based Guidance**: Provide role-specific help:
   - Teachers: uploading papers, checking submission status, rollback/cancel, assigned subjects, calendar deadlines
   - HODs: reviewing papers, selecting/rejecting papers, department management, exam sessions, alerts
   - Exam Cell: managing datesheets, paper inbox, exam sessions, HOD alerts, archive
   - Admin: user management, departments, audit logs, broadcasts, security
3. **University Information**: Answer general university-related queries about academic processes, exam schedules, policies, and procedures.
4. **System Navigation**: Guide users on how to use different features of the platform.

Response Format:
- **Answer**: Give the direct answer first — no preamble
- **Details**: Key extracted information as bullet points if needed
- **Sources**: Provide clickable links/references whenever possible (e.g. page paths like \`/upload\`, \`/submissions\`, \`/review\`, \`/calendar\`, \`/settings\`)
- Do NOT give numbered step-by-step walkthroughs unless explicitly asked
- Be concise — answer in 2-4 sentences when possible
- Always link to the relevant page/section in the app using markdown links like [Upload Paper](/upload)

Important Rules:
- Do NOT make up information about specific dates, results, or data you don't have access to
- If asked about real-time data (like specific paper statuses), direct users to the relevant dashboard section with a link
- Keep responses focused, direct, and actionable
- Prefer direct links and answers over explanations`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service credits exhausted. Please contact admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Chatbot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
