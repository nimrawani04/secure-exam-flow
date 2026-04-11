import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a smart, friendly university assistant chatbot for the **Central University of Kashmir (CUK)** integrated into a Confidential Exam Paper Management System. You serve Admin, Teacher, Head of Department (HOD), and Exam Cell users.

Your capabilities:
1. **Central University of Kashmir Information**: Answer ANY question about CUK — admissions, syllabus, results, faculty, departments, contact details, notices, circulars, events, policies, fees, hostel, placements, research, and more. You have access to real-time data scraped from the official CUK website (cukashmir.ac.in), **including PDFs** (prospectus, notifications, ordinances, regulations, annual reports, curriculum documents, etc.). Extract and cite specific details from PDF content when available.
2. **Exam Paper System Help**: Answer questions about paper upload workflows, submission deadlines, review processes, paper statuses, rollback features, and how the approval pipeline works.
3. **Role-Based Guidance**: Provide role-specific help:
   - Teachers: uploading papers, checking submission status, rollback/cancel, assigned subjects, calendar deadlines
   - HODs: reviewing papers, selecting/rejecting papers, department management, exam sessions, alerts
   - Exam Cell: managing datesheets, paper inbox, exam sessions, HOD alerts, archive
   - Admin: user management, departments, audit logs, broadcasts, security
4. **System Navigation**: Guide users on how to use different features of the platform.

Response Format:
- **Answer**: Give the direct answer first — no preamble, no steps
- **Details**: Key extracted information as bullet points if needed
- **Sources**: If a VERIFIED SOURCE CATALOG is provided, do NOT output a Sources section because the system will append verified links automatically. Otherwise, ALWAYS end your response with a "**Sources:**" section containing DIRECT CLICKABLE LINKS. Format each link as a markdown hyperlink: [Title](https://full-url). Use the EXACT URLs from the scraped data. For PDFs, link directly to the PDF URL. For app features, use markdown links like [Upload Paper](/upload), [Submissions](/submissions), [Review](/review), [Calendar](/calendar), [Settings](/settings)
- NEVER give numbered step-by-step walkthroughs or instructions unless explicitly asked
- NEVER say "visit the website" or "go to" — instead provide the direct clickable link
- Be concise — answer in 2-4 sentences when possible
- Every response MUST include at least one direct source link unless a VERIFIED SOURCE CATALOG is provided, in which case the system will append the direct links

Important Rules:
- Use the provided CUK website context to answer university-related questions accurately
- ALWAYS use the actual source URLs from scraped data — this is MANDATORY
- If multiple sources exist, list ALL relevant direct links
- If the scraped data doesn't contain the answer, provide a direct link to the most relevant CUK page and say the specific info wasn't found
- Do NOT make up information about specific dates, results, or data you don't have
- If asked about real-time system data (like specific paper statuses), link directly to the relevant dashboard section
- Keep responses focused, direct, and actionable
- Prefer direct links and answers over explanations
- NEVER invent, rewrite, truncate, or generalize source URLs. If a VERIFIED SOURCE CATALOG is present, only rely on it for external links and do not create your own external links.`;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type FirecrawlSearchResult = {
  title?: string;
  url?: string;
  markdown?: string;
  description?: string;
};

type VerifiedSource = {
  title: string;
  url: string;
  content: string;
  isPdf: boolean;
  score: number;
};

type SearchContext = {
  context: string;
  verifiedSources: VerifiedSource[];
};

const ALLOWED_SOURCE_HOSTS = [
  "cukashmir.ac.in",
  "www.cukashmir.ac.in",
  "cukashmir.samarth.edu.in",
  "cuet.samarth.ac.in",
];

const STOPWORDS = new Set([
  "about", "after", "all", "and", "any", "are", "can", "cuk", "for", "from", "how",
  "into", "latest", "more", "not", "official", "the", "their", "this", "university", "what",
  "when", "where", "which", "with", "you",
]);

function tokenize(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  )];
}

function normalizeUrl(rawUrl: string | undefined, baseUrl?: string): string | null {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim().replace(/^<|>$/g, "");
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("mailto:")) {
    return null;
  }

  try {
    const url = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isAllowedSourceUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ALLOWED_SOURCE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url);
}

function deriveTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "Source";
    return decodeURIComponent(lastSegment)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "Source";
  }
}

function cleanTitle(title: string | undefined, url: string): string {
  const cleaned = (title || "")
    .replace(/[*_`>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /^(click here|read more|download|view|open)$/i.test(cleaned)) {
    return deriveTitleFromUrl(url);
  }

  return cleaned;
}

function escapeLinkTitle(title: string): string {
  return title.replace(/[\[\]]/g, "").trim();
}

function scoreSource(query: string, candidate: { title: string; url: string; content: string; isPdf: boolean }): number {
  const haystack = `${candidate.title} ${candidate.url} ${candidate.content}`.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryTerms = tokenize(query);

  let score = 0;

  for (const term of queryTerms) {
    if (haystack.includes(term)) score += 4;
  }

  if (candidate.isPdf) score += queryLower.includes("pdf") ? 8 : 4;
  if (/notice|notification|circular/.test(haystack) && /notice|notification|circular/.test(queryLower)) score += 6;
  if (/result|results/.test(haystack) && /result/.test(queryLower)) score += 6;
  if (/syllabus|curriculum/.test(haystack) && /syllabus|curriculum/.test(queryLower)) score += 6;
  if (/datesheet|date sheet|schedule/.test(haystack) && /datesheet|date sheet|schedule|backlog/.test(queryLower)) score += 6;
  if (/admission|eligibility|prospectus/.test(haystack) && /admission|eligibility|prospectus/.test(queryLower)) score += 6;
  if (/displayevents\.aspx|examination\.aspx/.test(candidate.url)) score += 2;
  if (/contactus|gallery|tender|home|index/.test(candidate.url)) score -= 3;

  return score;
}

function extractMarkdownLinks(markdown: string, baseUrl: string, parentTitle: string, query: string): VerifiedSource[] {
  const candidates: VerifiedSource[] = [];
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const directUrlRegex = /https?:\/\/[^\s)\]]+/g;

  for (const match of markdown.matchAll(markdownLinkRegex)) {
    const url = normalizeUrl(match[2], baseUrl);
    if (!url) continue;

    const title = cleanTitle(match[1], url);
    const content = markdown.slice(0, 4000);
    candidates.push({
      title,
      url,
      content,
      isPdf: isPdfUrl(url),
      score: scoreSource(query, { title, url, content, isPdf: isPdfUrl(url) }),
    });
  }

  for (const match of markdown.matchAll(directUrlRegex)) {
    const url = normalizeUrl(match[0], baseUrl);
    if (!url) continue;

    const title = cleanTitle(parentTitle, url);
    const content = markdown.slice(0, 4000);
    candidates.push({
      title,
      url,
      content,
      isPdf: isPdfUrl(url),
      score: scoreSource(query, { title, url, content, isPdf: isPdfUrl(url) }),
    });
  }

  return candidates;
}

function dedupeAndRankSources(sources: VerifiedSource[], limit: number): VerifiedSource[] {
  const deduped = new Map<string, VerifiedSource>();

  for (const source of sources) {
    const existing = deduped.get(source.url);
    if (!existing || source.score > existing.score || source.title.length > existing.title.length) {
      deduped.set(source.url, source);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => b.score - a.score || Number(b.isPdf) - Number(a.isPdf) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

async function verifySourceUrl(url: string): Promise<boolean> {
  if (!isAllowedSourceUrl(url)) return false;

  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 LovableBot/1.0" },
    });

    if (headResponse.ok) return true;
  } catch {
    // fall through to GET fallback
  }

  try {
    const getResponse = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Range: "bytes=0-0",
        "User-Agent": "Mozilla/5.0 LovableBot/1.0",
      },
    });

    return getResponse.ok;
  } catch {
    return false;
  }
}

async function filterWorkingSources(sources: VerifiedSource[], limit: number): Promise<VerifiedSource[]> {
  const checked = await Promise.all(
    sources.slice(0, 12).map(async (source) => ({
      source,
      ok: await verifySourceUrl(source.url),
    })),
  );

  return checked
    .filter((entry) => entry.ok)
    .map((entry) => entry.source)
    .slice(0, limit);
}

function formatSourcesSection(sources: VerifiedSource[]): string {
  return `**Sources:**\n${sources
    .map((source) => `- [${escapeLinkTitle(source.title)}](${source.url})`)
    .join("\n")}`;
}

function stripSourcesSection(content: string): string {
  return content
    .replace(/\n{0,2}\*\*Sources:\*\*[\s\S]*$/i, "")
    .replace(/\n{0,2}Sources:[\s\S]*$/i, "")
    .trim();
}

async function searchCUK(query: string, apiKey: string): Promise<SearchContext> {
  try {
    // Run two searches in parallel: web pages + PDFs
    const [webRes, pdfRes] = await Promise.all([
      fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `site:cukashmir.ac.in ${query}`,
          limit: 8,
          scrapeOptions: { formats: ["markdown"] },
        }),
      }),
      fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `site:cukashmir.ac.in filetype:pdf ${query}`,
          limit: 8,
          scrapeOptions: { formats: ["markdown"] },
        }),
      }),
    ]);

    const webData = webRes.ok ? await webRes.json() : { data: [] };
    const pdfData = pdfRes.ok ? await pdfRes.json() : { data: [] };

    if (!webRes.ok) console.error("Firecrawl web search failed:", webRes.status);
    if (!pdfRes.ok) console.error("Firecrawl PDF search failed:", pdfRes.status);

    const webResults = Array.isArray(webData.data) ? webData.data : [];
    const pdfResults = Array.isArray(pdfData.data) ? pdfData.data : [];
    const allResults = [...webResults, ...pdfResults] as FirecrawlSearchResult[];

    if (allResults.length === 0) return { context: "", verifiedSources: [] };

    const verifiedCandidates: VerifiedSource[] = [];

    let context = "\n\n--- LIVE DATA FROM CUK WEBSITE (cukashmir.ac.in) ---\n";
    for (const r of allResults) {
      const title = r.title || "Untitled";
      const url = normalizeUrl(r.url) || "";
      const content = r.markdown ? r.markdown.slice(0, 4000) : r.description || "";
      const isPdf = (url || "").toLowerCase().endsWith(".pdf");

      if (url) {
        verifiedCandidates.push({
          title: cleanTitle(title, url),
          url,
          content,
          isPdf,
          score: scoreSource(query, { title, url, content, isPdf }),
        });
      }

      if (url && content) {
        verifiedCandidates.push(...extractMarkdownLinks(content, url, title, query));
      }

      context += `\n### Source${isPdf ? " (PDF)" : ""}: ${title}\nURL: ${url}\n${content}\n`;
    }

    const rankedSources = dedupeAndRankSources(verifiedCandidates, 10);
    const verifiedSources = await filterWorkingSources(rankedSources, 6);

    if (verifiedSources.length > 0) {
      context += "\n--- VERIFIED SOURCE CATALOG ---\n";
      for (const source of verifiedSources) {
        context += `- ${source.title}${source.isPdf ? " (PDF)" : ""}: ${source.url}\n`;
      }
    }

    context += "\n--- END OF SCRAPED DATA ---\n";
    context += "\nIMPORTANT: Use the above data to answer the user's question. If a VERIFIED SOURCE CATALOG is present, rely on it for external links and do not generate your own Sources section because verified links will be appended automatically. Never mention a source title unless it exists in the data above.";

    return { context, verifiedSources };
  } catch (e) {
    console.error("CUK search error:", e);
    return { context: "", verifiedSources: [] };
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
    "pdf", "document", "notification", "ordinance", "regulation", "statute",
    "prospectus", "brochure", "annual report", "minutes", "curriculum",
    "anti ragging", "rti", "grievance", "handbook", "rule", "policy",
    "datesheet", "date sheet", "backlog", "backlogs", "notices", "notifications",
    "results", "exam result", "exam results", "syllabi", "exam notice", "exam notices",
    "supplementary", "reappear", "arrear", "schedule", "exam schedule",
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
    const lastUserMessage = [...messages].reverse().find((m: ChatMessage) => m.role === "user");
    let cukContext = "";
    let verifiedSources: VerifiedSource[] = [];

    if (lastUserMessage) {
      const userText = lastUserMessage.content || "";
      const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");

      if (FIRECRAWL_KEY && isUniversityQuery(userText)) {
        console.log("Searching CUK website for:", userText);
        const searchResult = await searchCUK(userText, FIRECRAWL_KEY);
        cukContext = searchResult.context;
        verifiedSources = searchResult.verifiedSources;
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
        stream: false,
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

    const completion = await response.json();
    const aiContent = completion?.choices?.[0]?.message?.content;

    if (!aiContent || typeof aiContent !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanContent = stripSourcesSection(aiContent);
    const fallbackSources = verifiedSources.length > 0
      ? verifiedSources
      : (lastUserMessage && isUniversityQuery(lastUserMessage.content || ""))
        ? [{
            title: "Central University of Kashmir",
            url: "https://www.cukashmir.ac.in",
            content: "",
            isPdf: false,
            score: 0,
          }]
        : [];

    const finalContent = fallbackSources.length > 0
      ? `${cleanContent}\n\n${formatSourcesSection(fallbackSources)}`
      : aiContent;

    const ssePayload = [
      `data: ${JSON.stringify({
        id: completion?.id || crypto.randomUUID(),
        object: "chat.completion.chunk",
        created: completion?.created || Math.floor(Date.now() / 1000),
        model: completion?.model || "google/gemini-3-flash-preview",
        choices: [{ index: 0, delta: { role: "assistant", content: finalContent }, finish_reason: "stop" }],
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    return new Response(ssePayload, {
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
