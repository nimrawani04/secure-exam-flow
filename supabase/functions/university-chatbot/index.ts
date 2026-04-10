import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a smart, friendly university assistant chatbot for the **Central University of Kashmir (CUK)** integrated into a Confidential Exam Paper Management System. You serve Admin, Teacher, Head of Department (HOD), and Exam Cell users.

Your capabilities:
1. **Central University of Kashmir Information**: Answer ANY question about CUK — admissions, syllabus, results, faculty, departments, contact details, notices, circulars, events, policies, fees, hostel, placements, research, and more. You have access to real-time data scraped from the official CUK website (cukashmir.ac.in).
2. **Exam Paper System Help**: Answer questions about paper upload workflows, submission deadlines, review processes, paper statuses, rollback features, and how the approval pipeline works.
3. **Role-Based Guidance**: Provide role-specific help:
   - Teachers: uploading papers, checking submission status, rollback/cancel, assigned subjects, calendar deadlines
   - HODs: reviewing papers, selecting/rejecting papers, department management, exam sessions, alerts
   - Exam Cell: managing datesheets, paper inbox, exam sessions, HOD alerts, archive
   - Admin: user management, departments, audit logs, broadcasts, security
4. **System Navigation**: Guide users on how to use different features of the platform.

Response Format:
- **Answer**: Give the direct answer first — no preamble
- **Details**: Key extracted information as bullet points if needed
- **Sources**: Provide clickable links/references whenever possible. For CUK website data, include the actual URLs from the scraped sources. For app features, use markdown links like [Upload Paper](/upload), [Submissions](/submissions), [Review](/review), [Calendar](/calendar), [Settings](/settings)
- Do NOT give numbered step-by-step walkthroughs unless explicitly asked
- Be concise — answer in 2-4 sentences when possible
- Always link to the relevant page/section with proper URLs

Important Rules:
- Use the provided CUK website context to answer university-related questions accurately
- Include source URLs from CUK website when available
- If the scraped data doesn't contain the answer, say so clearly and suggest checking cukashmir.ac.in directly
- Do NOT make up information about specific dates, results, or data you don't have
- If asked about real-time system data (like specific paper statuses), direct users to the relevant dashboard section
- Keep responses focused, direct, and actionable
- Prefer direct links and answers over explanations`;

async function searchCUK(query: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `site:cukashmir.ac.in ${query}`,
        limit: 8,
        scrapeOptions: {
          formats: ["markdown"],
          includePaths: ["*.pdf", "*.PDF"],
          waitFor: 3000,
        },
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl search failed:", response.status);
      return "";
    }

    const data = await response.json();
    const results = data.data || [];

    if (results.length === 0) return "";

    let context = "\n\n--- LIVE DATA FROM CUK WEBSITE (cukashmir.ac.in) ---\n";
    for (const r of results) {
      const title = r.title || "Untitled";
      const url = r.url || "";
      const content = r.markdown ? r.markdown.slice(0, 4000) : r.description || "";
      const isPdf = (url || "").toLowerCase().endsWith(".pdf");
      context += `\n### Source${isPdf ? " (PDF)" : ""}: ${title}\nURL: ${url}\n${content}\n`;
    }
    context += "\n--- END OF SCRAPED DATA ---\n";
    context += "\nUse the above data to answer the user's question. Always cite the source URLs.";

    return context;
  } catch (e) {
    console.error("CUK search error:", e);
    return "";
  }
}

function isUniversityQuery(message: string): boolean {
  const lower = message.toLowerCase();
  const keywords = [
    "cuk", "central university", "kashmir", "admission", "syllabus", "result",
    "faculty", "department", "contact", "notice", "circular", "fee", "hostel",
    "placement", "research", "campus", "exam date", "course", "program",
    "phd", "mba", "mca", "btech", "bsc", "msc", "semester", "university",
    "chancellor", "vice chancellor", "registrar", "dean", "professor",
    "scholarship", "library", "nss", "ncc", "sports", "tender", "recruitment",
    "convocation", "holiday", "academic calendar", "time table", "timetable",
    "who is", "what is", "tell me about", "information about", "details of",
    "how to apply", "eligibility", "cutoff", "merit", "counselling",
  ];
  return keywords.some((k) => lower.includes(k));
}

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

    // Get the latest user message to determine if we need to search CUK
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    let cukContext = "";

    if (lastUserMessage) {
      const userText = lastUserMessage.content || "";
      const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");

      if (FIRECRAWL_KEY && isUniversityQuery(userText)) {
        console.log("Searching CUK website for:", userText);
        cukContext = await searchCUK(userText, FIRECRAWL_KEY);
      }
    }

    const systemMessage = cukContext
      ? SYSTEM_PROMPT + cukContext
      : SYSTEM_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemMessage },
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
