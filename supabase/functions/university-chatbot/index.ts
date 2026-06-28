/**
 * university-chatbot — index-backed edition with live deep-link fallback
 *
 * Uses Postgres full-text search against `public.cuk_pages`, populated by the
 * `crawl-cuk` background function, and supplements it with a fast Firecrawl
 * deep-link fallback for missing PDFs/pages.
 *
 * Pipeline per request:
 *   1. Authenticate the caller (reject anon — paid Lovable AI calls).
 *   2. Rewrite follow-up queries using conversation history (pronouns etc.).
 *   3. Run `search_cuk_pages` RPC + a scoped live deep-link search.
 *   4. Filter unrelated categories and build numbered VERIFIED SOURCE CATALOG.
 *   5. Stream the answer from google/gemini-2.5-flash via Lovable AI Gateway.
 *   6. After [DONE], append verified sources + follow-up suggestions.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

const CORRELATION_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
function readOrMintCorrelationId(req: Request): { id: string; source: "client" | "server" } {
  const incoming = req.headers.get("x-correlation-id");
  if (incoming && CORRELATION_ID_RE.test(incoming)) return { id: incoming, source: "client" };
  return { id: crypto.randomUUID(), source: "server" };
}
function jsonError(body: Record<string, unknown>, status: number, correlationId: string) {
  return new Response(JSON.stringify({ ...body, correlation_id: correlationId }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "x-correlation-id": correlationId },
  });
}

type ChatMessage = { role: "user" | "assistant"; content: string };
type Source = { title: string; url: string; isPdf: boolean };
type SearchRow = { id: string; url: string; title: string | null; snippet: string | null; is_pdf: boolean; rank: number };

type LogLevel = "info" | "warn" | "error";

function nowMs(): number { return Date.now(); }

function elapsed(start: number): number { return Date.now() - start; }

function requestId(): string { return crypto.randomUUID(); }

function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isLikelyPublishableToken(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1] || ""));
    return payload?.role === "anon" && !payload?.sub;
  } catch {
    return false;
  }
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => {
    if (m.role !== "assistant") return true;
    const text = m.content.trim().toLowerCase();
    return text !== "⚠️ unauthorized" && text !== "unauthorized";
  });
}

function sseOnce(
  content: string,
  followUps: string[],
  sources: Array<Source & { index?: number }>,
  correlationId: string,
) {
  const enc = new TextEncoder();
  const sourcePayload = sources.map((s, i) => ({
    index: s.index ?? i + 1,
    title: s.title,
    url: s.url,
    isPdf: s.isPdf,
  }));
  const body = [
    `data: ${JSON.stringify({ object: "chat.completion.chunk", choices: [{ index: 0, delta: { content }, finish_reason: null }], correlation_id: correlationId })}\n\n`,
    `data: ${JSON.stringify({ object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], follow_up_suggestions: followUps, sources: sourcePayload, correlation_id: correlationId })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
  return new Response(enc.encode(body), {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "x-correlation-id": correlationId },
  });
}

// ─── Static CUK knowledge (always available, never needs scraping) ─────────────
const CUK_STATIC_KNOWLEDGE = `
=== CENTRAL UNIVERSITY OF KASHMIR — STATIC KNOWLEDGE BASE ===
OFFICIAL WEBSITE: https://www.cukashmir.ac.in
SAMARTH PORTAL:   https://cukashmir.samarth.edu.in
ESTABLISHED:      2009, under the Central Universities Act 2009 (Act 25 of 2009)
TYPE:             Central University, funded by Govt. of India (MoE / UGC)
ACCREDITATION:    NAAC accredited; UGC recognised; member AIU

── CAMPUSES ────────────────────────────────────────
Main / Transit Campus: Nowgam Bye-pass, Near Puhroo Crossing, Nowgam, Srinagar — 190 015, J&K
Tulmulla Campus (permanent campus under construction): Ganderbal District, J&K

── GENERAL CONTACTS ────────────────────────────────
Main Office:    0194-2723001 / 2723002
Email:          info@cukashmir.ac.in
Vice-Chancellor: vc@cukashmir.ac.in
Registrar:       registrar@cukashmir.ac.in  |  0194-2723003
Controller of Examinations: coe@cukashmir.ac.in | 0194-2723006
Admissions:      admissions@cukashmir.ac.in | 0194-2723004
Placement Cell:  placement@cukashmir.ac.in
Anti-Ragging:    1800-180-5522 (toll-free)

── SCHOOLS & DEPARTMENTS ───────────────────────────
1. School of Education — B.Ed., M.Ed., Ph.D.
2. School of Social Sciences — Politics, Economics, Sociology, Convergent Journalism
3. School of Languages — English, Urdu, Kashmiri, Arabic
4. School of Sciences — Mathematics, Chemistry, Physics, Environmental Science
5. School of Technology — Computer Science (MCA, M.Sc.), IT (M.Tech.), ECE (M.Tech.)
6. School of Legal Studies — B.A. LL.B. (5-yr integrated), LL.M., Ph.D.
7. School of Business Studies — MBA, Tourism (MTTM), M.Com.
8. School of Visual & Performing Arts — Music

── KEY URLs ────────────────────────────────────────
Notices / Circulars:  https://www.cukashmir.ac.in/displayevents.aspx
Results:              https://www.cukashmir.ac.in/results.aspx
Datesheet:            https://www.cukashmir.ac.in/examination.aspx
Departments:          https://www.cukashmir.ac.in/departments.aspx
Admissions:           https://www.cukashmir.ac.in/admissions.aspx
Prospectus:           https://www.cukashmir.ac.in/prospectus.aspx
Fee Structure:        https://www.cukashmir.ac.in/feestructure.aspx
Scholarships:         https://www.cukashmir.ac.in/scholarships.aspx
Recruitment:          https://www.cukashmir.ac.in/recruitment.aspx
Tenders:              https://www.cukashmir.ac.in/tenders.aspx
Downloads / Forms:    https://www.cukashmir.ac.in/downloads.aspx
Library:              https://www.cukashmir.ac.in/library.aspx
Hostel:               https://www.cukashmir.ac.in/hostel.aspx
RTI:                  https://www.cukashmir.ac.in/rti.aspx
Grievance:            https://www.cukashmir.ac.in/grievance.aspx

── ELIGIBILITY (typical, verify on prospectus) ─────
UG: 10+2 with min. 50% (45% SC/ST) + valid CUET-UG score.
PG: Bachelor's with min. 50% (45% SC/ST) in relevant discipline + CUET-PG. MCA: Maths at 10+2/UG. M.Ed.: B.Ed. LL.M.: LL.B.
M.Tech.: B.E./B.Tech. ≥55%, GATE preferred.
Ph.D.: Master's ≥55% (50% SC/ST/OBC-NCL/PwBD) + CUET-PG/NET/GATE + RAT + interview.

── FEES (indicative) ───────────────────────────────
UG/PG arts/sciences: ~₹3,000 – ₹6,000 per semester
Hostel: ~₹8,000 – ₹15,000 per semester
Professional (MBA / MCA / M.Tech. / B.Ed. / LL.B.): higher — see prospectus.
=== END STATIC KNOWLEDGE BASE ===
`;

const SYSTEM_PROMPT = `You are the official AI assistant for the Central University of Kashmir (CUK), embedded in a Confidential Exam Paper Management System.

Rules:
- Answer ONLY from the static knowledge base AND the LIVE CUK PAGE INDEX excerpts provided below. If the user asks anything unrelated to CUK/CUKashmir, official CUK sources, admissions, exams, syllabi/resources, notices, departments, or this exam-paper app, politely refuse and offer to help with CUK instead.
- SOURCE-BOUND ANSWERING: If an answer needs a current official page/PDF and the VERIFIED SOURCE CATALOG has no exact supporting source, say "I couldn't locate the exact CUK source for that in the current index" and ask for a more specific programme, semester, session, notice number, or department. Do not answer from general knowledge.
- MANDATORY PER-SENTENCE CITATIONS: EVERY sentence that states a fact, figure, date, eligibility rule, fee, deadline, contact, link, or any verifiable claim MUST end with one or more numeric markers like [1] or [1][3] placed BEFORE the period (e.g. "The fee is ₹500 [2]."). Do not group citations only at the end of a paragraph — attach them to each individual sentence they support.
- One marker per supporting source. If two sources jointly support a sentence, write [1][2] (no spaces, no commas). Never invent a number that isn't in the VERIFIED SOURCE CATALOG.
- ONLY cite [n] when that catalog entry's title/snippet directly supports the claim and the link points to the EXACT PDF/page that verifies it. If no catalog entry verifies a sentence, either omit that sentence or write it WITHOUT any [n] marker — never cite an unrelated source as filler.
- Sentences that are pure UI guidance (e.g. "Click Upload Paper to submit"), greetings, or clarifying questions do NOT need citations.
- The VERIFIED SOURCE CATALOG is always present — use the numbers exactly; do not invent, skip, or renumber.
- NEVER say "I don't have that information" if the static knowledge base or page index covers it.
- Never invent contact details, deadlines, fees, or policies.
- For app features use markdown links: [Upload Paper](/upload), [Submissions](/submissions), [Review](/review), [Calendar](/calendar), [Settings](/settings).
- Be concise — short sentences, then bullets for lists/steps. Each factual bullet also ends with [n].

- GIVE THE ACTUAL DIRECT LINK from the VERIFIED SOURCE CATALOG — never tell the user to "visit the website and navigate to…", "go to the departments section", or any similar navigation instruction. That phrasing is FORBIDDEN. Always paste the exact deep URL of the PDF or sub-page.
- Never recommend a generic CUK homepage or landing page when a deeper PDF/page is available. Never use admission/result/recruitment/tender sources to answer syllabus/resources questions unless the user asked about admission/result/recruitment/tender.
- ENUMERATE every relevant catalog entry, not just one. If the user asks for "B.Tech resources" or any broad topic, list 3-6 specific deep links (syllabus PDFs, scheme PDFs, notices, department pages) from the catalog — each on its own line with the inline preview format.
- INLINE PREVIEW FORMAT: For every document you reference, render it on its own line as: **Section / topic name** — [Open document title (PDF)](URL) [n]. Use the real section/topic the user asked about (e.g. "B.Tech CSE 6th Semester Syllabus", "M.A. English Admission Notice 2025", "Non-Teaching Recruitment Notification"). If the catalog entry is a PDF, append " (PDF)" inside the link text so the UI can preview it directly.
- DEEP ANCHOR LINKS: Whenever you know (or can confidently infer) the exact location of the section inside the document, append a URL fragment that jumps the reader directly to it:
  • PDFs: append "#page=N" (e.g. ".../syllabus.pdf#page=42") when a page number is known. You may also use "#page=N&zoom=page-width" or "#nameddest=SectionName" when the catalog entry exposes a named destination.
  • HTML pages: append "#slug-of-heading" matching the on-page heading id (kebab-case of the heading text) so the browser scrolls to it.
  Only add the fragment when you are confident it is correct — never guess random page numbers. If unknown, omit the fragment rather than fabricate one.
- Prefer the most specific PDF in the catalog over a generic landing page. If both exist, link the PDF first and the landing page second.
- If the catalog has only broad/related official pages and no exact document matching the request, say honestly: "I couldn't locate the exact CUK source for that in the current index." Then list ONLY the closest official pages from the catalog as related links using the same inline preview format. Do NOT include unrelated admission/result/recruitment/tender PDFs as related links for syllabus/resources queries. Do NOT fabricate URLs.
- Do NOT output your own "Sources" section — the system appends it from the VERIFIED SOURCE CATALOG.



Exam Paper System Help (answer instantly):
- Teachers: upload at [Upload Paper](/upload), track at [Submissions](/submissions)
- HODs: review at [Review](/review), sessions at [HOD Sessions](/hod-sessions)
- Exam Cell: [Datesheet Management](/datesheet), [Approved Papers](/approved-papers)
- Admin: [Dashboard](/dashboard)

${CUK_STATIC_KNOWLEDGE}`;

// ─── Follow-ups ───────────────────────────────────────────────────────────────

const FOLLOW_UPS: Record<string, string[]> = {
  admissions:   ["What documents are needed for admission?", "What is the eligibility criteria?", "Where is the official admission notice?"],
  examinations: ["Where can I check the latest exam notice?", "What are the confirmed exam dates?", "How do I get my admit card?"],
  contact:      ["Which office handles this?", "Do you have the official email or phone?"],
  results:      ["How do I apply for revaluation?", "Where can I download the marksheet?"],
  syllabus:     ["Show me the official syllabus PDF.", "Which department page has this syllabus?", "Are there related scheme/course documents?"],
  recruitment:  ["Show the latest recruitment notices.", "Which documents are PDFs?", "What is the last date mentioned?"],
  tenders:      ["Show the latest tender PDFs.", "What is the submission deadline?", "Which tender document should I open?"],
  general:      ["Can you summarise the key points?", "Show me the official sources for this."],
};

function detectCategory(q: string): string {
  const l = q.toLowerCase();
  if (/syllabus|curriculum|scheme|course structure|study material/.test(l)) return "syllabus";
  if (/recruitment|vacancy|employment|job/.test(l)) return "recruitment";
  if (/tender|quotation|bid|eoi/.test(l)) return "tenders";
  if (/admission|apply|eligibility|cuet|prospectus/.test(l)) return "admissions";
  if (/exam|datesheet|date sheet|result|grade|marks|admit card|hall ticket/.test(l)) return "examinations";
  if (/contact|email|phone|directory/.test(l)) return "contact";
  if (/result|grade|marks|transcript/.test(l)) return "results";
  return "general";
}

function getFollowUps(query: string): string[] {
  const pool = [...(FOLLOW_UPS[detectCategory(query)] ?? []), ...FOLLOW_UPS.general];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of pool) {
    const k = s.toLowerCase();
    if (!seen.has(k) && k !== query.toLowerCase()) { seen.add(k); out.push(s); }
    if (out.length === 3) break;
  }
  return out;
}

// ─── App-only shortcut ────────────────────────────────────────────────────────

const APP_ONLY = /\b(upload|submission|review|calendar|datesheet management|approved paper|hod dashboard|exam cell|teacher dashboard|settings|profile)\b/i;
function isAppNavOnly(text: string): boolean {
  return APP_ONLY.test(text) && !/cuk|university|kashmir|admission|result|notice/i.test(text);
}

const CUK_TOPIC = /\b(cuk|cukashmir|central university of kashmir|samarth|admission|admissions|cuet|prospectus|eligibility|fee|fees|b\.?\s*tech|btech|m\.?\s*tech|mtech|mca|mba|llb|llm|ph\.?d|programme|program|semester|syllabus|curriculum|scheme|course structure|resource|resources|e-?content|study material|department|school|faculty|professor|vice chancellor|\bvc\b|chancellor|registrar|controller|notice|notification|circular|datesheet|date sheet|result|revaluation|examination|exam|tender|recruitment|vacancy|employment|hostel|scholarship|placement|library|downloads?|forms?|contact|phone|email|address|nowgam|tulmulla)\b/i;

function isCukScopedQuery(text: string): boolean {
  if (isAppNavOnly(text)) return true;
  return CUK_TOPIC.test(text);
}

const REFUSAL_FOLLOW_UPS = [
  "Show latest CUK notices.",
  "Find a CUK syllabus or resource PDF.",
  "Show CUK admission eligibility.",
];

const EXACT_SOURCE_FOLLOW_UPS = [
  "Search by programme and semester.",
  "Show related official CUK pages.",
  "Find CUK PDFs for this topic.",
];

// ─── Follow-up query rewriting (pronoun / contextual references) ─────────────

const REF_RE  = /\b(he|she|his|her|him|they|them|their)\b/i;
const CTX_RE  = /\b(it|its|this|that|these|those|there|same|above|below)\b/i;
const FUP_RE  = /^\s*(and|also|what about|how about|then|now)\b/i;
const AMB_RE  = /\b(form|list|names?|candidates?|selected|eligible|date|time|venue|link|details?)\b/i;
const SPC_RE  = /\b(phd|department|school|admission|exam|contact|email|phone|result|datesheet|notice)\b/i;

function rewriteQuery(query: string, history: ChatMessage[]): string {
  if (!history.length) return query;
  const needs = REF_RE.test(query) || CTX_RE.test(query) || FUP_RE.test(query) || (AMB_RE.test(query) && !SPC_RE.test(query));
  if (!needs) return query;
  let rw = query;
  for (let i = history.length - 1; i >= Math.max(0, history.length - 4); i--) {
    if (SPC_RE.test(history[i].content)) {
      const topic = history[i].content.slice(0, 180).trim();
      if (!rw.toLowerCase().includes(topic.toLowerCase().slice(0, 30))) {
        rw = `${rw.replace(/[?\s]+$/, "")}; context: ${topic}`;
      }
      break;
    }
  }
  return rw;
}

// ─── Source helpers ───────────────────────────────────────────────────────────

function isPdfUrl(u: string): boolean { return /\.pdf(?:$|[?#])/i.test(u); }

function cleanTitle(t: string | null, url: string): string {
  let s = (t || "").replace(/\s+/g, " ").trim();
  if (!s || s.length < 4) {
    try {
      const parts = new URL(url).pathname.split("/").filter(Boolean);
      const last = parts.pop() || "Source";
      s = decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, "").replace(/[-_+]+/g, " ").trim() || "Source";
    } catch { s = "Source"; }
  }
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

function rowsToSources(rows: SearchRow[]): Source[] {
  return rows.slice(0, 8).map((r) => ({
    title: cleanTitle(r.title, r.url),
    url: r.url,
    isPdf: r.is_pdf || isPdfUrl(r.url),
  }));
}

// ─── Live Firecrawl fallback (when the local index has no good hit) ───────────
type LiveHit = { url: string; title: string; snippet: string; isPdf: boolean };

async function firecrawlLiveSearch(query: string, limit = 6, extraScope = ""): Promise<LiveHit[]> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return [];
  const scoped = `site:cukashmir.ac.in ${extraScope} ${query}`.replace(/\s+/g, " ").trim();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: scoped, limit }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const data = await resp.json().catch(() => null);
    const raw: any[] = data?.data?.web || data?.web || data?.data || [];
    const hits: LiveHit[] = [];
    for (const r of raw) {
      const url: string = r?.url || r?.link || "";
      if (!url || !/cukashmir\.ac\.in|disgenweb\.in/i.test(url)) continue;
      // Skip generic landing pages so deep content surfaces first.
      if (/^https?:\/\/(www\.)?cukashmir\.ac\.in\/?(index\.aspx)?$/i.test(url)) continue;
      hits.push({
        url,
        title: (r?.title || r?.name || "").toString().trim(),
        snippet: (r?.description || r?.snippet || r?.content || "").toString().trim(),
        isPdf: isPdfUrl(url),
      });
    }
    const seen = new Set<string>();
    return hits
      .sort((a, b) => Number(b.isPdf) - Number(a.isPdf))
      .filter((h) => { const k = h.url.split("#")[0]; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, limit);
  } catch { return []; }
}

// Run scoped + PDF-targeted searches in parallel and merge.
async function firecrawlDeepHunt(query: string): Promise<LiveHit[]> {
  const [generic, pdfs] = await Promise.all([
    firecrawlLiveSearch(query, 6, ""),
    firecrawlLiveSearch(query, 6, "filetype:pdf"),
  ]);
  const merged: LiveHit[] = [];
  const seen = new Set<string>();
  // PDFs first.
  for (const h of [...pdfs, ...generic]) {
    const k = h.url.split("#")[0];
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(h);
  }
  return merged.slice(0, 10);
}

function liveHitsToRows(hits: LiveHit[]): SearchRow[] {
  return hits.map((h, i) => ({
    id: `live-${i}`,
    url: h.url,
    title: h.title || cleanTitle(null, h.url),
    snippet: h.snippet || "",
    is_pdf: h.isPdf,
    rank: 2 + (h.isPdf ? 1 : 0) - i * 0.01,
  }));
}

function curatedOfficialRows(query: string): SearchRow[] {
  const q = normalizeForMatch(query);
  const rows: SearchRow[] = [];
  const push = (url: string, title: string, snippet: string, rank = 3) => {
    rows.push({ id: `curated-${rows.length}`, url, title, snippet, is_pdf: isPdfUrl(url), rank });
  };

  if (/\b(contact|email|phone|registrar|controller|admission|address|campus|nowgam|tulmulla)\b/.test(q)) {
    push(
      "https://www.cukashmir.ac.in#contact",
      "Central University of Kashmir — Official Contact Details",
      "Official CUK contact reference. Main Office: 0194-2723001 / 2723002. Email: info@cukashmir.ac.in. Registrar: registrar@cukashmir.ac.in / 0194-2723003. Controller of Examinations: coe@cukashmir.ac.in / 0194-2723006. Admissions: admissions@cukashmir.ac.in / 0194-2723004. Main/Transit Campus: Nowgam Bye-pass, Near Puhroo Crossing, Nowgam, Srinagar — 190015, J&K.",
      5,
    );
  }

  if (/\b(notice|notices|notification|circular|latest|what new|what s new)\b/.test(q)) {
    push("https://www.cukashmir.ac.in/displayevents.aspx", "CUK Notices / Circulars", "Official CUK notices and circulars page for university notifications, notices, circulars and latest updates.", 4);
  }

  if (/\b(admission|admissions|cuet|eligibility|prospectus|fee|fees)\b/.test(q)) {
    push(
      "https://www.cukashmir.ac.in/admissions.aspx",
      "CUK Admissions",
      "Official CUK admissions page for admission notices, eligibility, CUET-related admission information and programme admission updates.",
      4,
    );
    push(
      "https://www.cukashmir.ac.in/prospectus.aspx",
      "CUK Prospectus",
      "Official CUK prospectus page for programme eligibility, intake and admission rules when published by the university.",
      3.8,
    );
  }

  if (/\b(result|results|revaluation|marks|grade)\b/.test(q)) {
    push("https://www.cukashmir.ac.in/results.aspx", "CUK Results", "Official CUK results page for examination result notifications and result documents.", 4);
  }

  if (/\b(datesheet|date sheet|exam schedule|examination schedule)\b/.test(q)) {
    push("https://www.cukashmir.ac.in/examination.aspx", "CUK Examinations", "Official CUK examination page for date sheets, exam notifications and examination updates.", 4);
  }

  if (/\b(department|school|faculty|computer science|cse|btech|b tech|technology|resources?|e content|econtent|downloads?)\b/.test(q)) {
    push("https://www.cukashmir.ac.in/departments.aspx", "CUK Departments", "Official CUK departments page for school and department pages, including School of Technology, Computer Science/CSE, B.Tech-related department information, programme pages and departmental resources where available.", 3.5);
    push("https://www.cukashmir.ac.in/downloads.aspx", "CUK Downloads / Forms", "Official CUK downloads page for student forms, documents, syllabus/resource downloads and university downloads.", 3.2);
  }

  return rows;
}

function normalizeForMatch(s: string): string {
  return ` ${s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

function queryTerms(q: string): string[] {
  const aliases = q
    .replace(/b\.?\s*tech/ig, "btech bachelor technology")
    .replace(/m\.?\s*tech/ig, "mtech master technology")
    .replace(/cs\s*&\s*e|cs\s*and\s*e|cse/ig, "cse computer science engineering")
    .replace(/sixth|6th|vi\b/ig, "sixth 6 vi")
    .replace(/fifth|5th|v\b/ig, "fifth 5 v")
    .replace(/fourth|4th|iv\b/ig, "fourth 4 iv")
    .replace(/third|3rd|iii\b/ig, "third 3 iii")
    .replace(/second|2nd|ii\b/ig, "second 2 ii")
    .replace(/first|1st|i\b/ig, "first 1 i");
  const noise = new Set([
    "what", "which", "where", "show", "find", "give", "tell", "about", "from", "official",
    "cuk", "cukashmir", "central", "university", "kashmir", "page", "pages", "link", "links",
    "pdf", "document", "documents", "site", "website", "actual", "exact", "open", "please",
  ]);
  return Array.from(new Set(normalizeForMatch(aliases).trim().split(/\s+/).filter((t) => t.length >= 2 && !noise.has(t))));
}

function rowHaystack(row: SearchRow): string {
  return normalizeForMatch(`${row.title || ""} ${row.snippet || ""} ${row.url || ""}`);
}

function categoryCompatible(query: string, row: SearchRow): boolean {
  const q = normalizeForMatch(query);
  const h = rowHaystack(row);

  // Hard gates: if the user asks for one of these, don't answer from a different category.
  if (/\b(syllabus|curriculum|scheme|course structure)\b/.test(q) && /\b(resource|resources|e content|econtent|study material|downloads?)\b/.test(q)) {
    if (/\b(admission|admissions|result|results|revaluation|recruitment|vacancy|employment|tender|quotation|bid|eoi)\b/.test(h) && !/\b(syllabus|curriculum|scheme|course structure|resource|resources|e content|econtent|study material|downloads?)\b/.test(h)) return false;
    return /\b(syllabus|curriculum|scheme|course structure|resource|resources|e content|econtent|study material|downloads?|studentzone|students downloads|course|courses|library|ebooks?|open courseware|department|departments|computer science|technology|btech|cse)\b/.test(h);
  }
  if (/\b(syllabus|curriculum|scheme|course structure)\b/.test(q)) {
    if (/\b(admission|admissions|result|results|revaluation|recruitment|vacancy|employment|tender|quotation|bid|eoi)\b/.test(h) && !/\b(syllabus|curriculum|scheme|course structure)\b/.test(h)) return false;
    return /\b(syllabus|curriculum|scheme|course structure|course|courses)\b/.test(h);
  }
  if (/\b(resource|resources|e content|econtent|study material|downloads?)\b/.test(q)) {
    if (/\b(admission|admissions|result|results|revaluation|recruitment|vacancy|employment|tender|quotation|bid|eoi)\b/.test(h) && !/\b(resource|resources|e content|econtent|study material|downloads?)\b/.test(h)) return false;
    return /\b(resource|resources|e content|econtent|study material|downloads?|studentzone|students downloads|course|courses|library|ebooks?|open courseware|department|departments|computer science|technology|btech|cse)\b/.test(h);
  }
  if (/\b(result|results|marks|grade|revaluation)\b/.test(q)) {
    return /\b(result|results|marks|grade|revaluation|examination result)\b/.test(h);
  }
  if (/\b(admission|admissions|cuet|eligibility|prospectus|selection list|merit list)\b/.test(q)) {
    return /\b(admission|admissions|cuet|eligibility|prospectus|selection list|merit list|waiting list)\b/.test(h);
  }
  if (/\b(tender|bid|quotation|eoi)\b/.test(q)) {
    return /\b(tender|bid|quotation|eoi)\b/.test(h);
  }
  if (/\b(recruitment|vacancy|employment|job)\b/.test(q)) {
    return /\b(recruitment|vacancy|employment|job)\b/.test(h);
  }
  if (/\b(datesheet|date sheet|exam schedule|examination schedule)\b/.test(q)) {
    return /\b(datesheet|date sheet|exam date|examination|schedule)\b/.test(h);
  }
  return true;
}

function filterRowsForExactQuery(query: string, rows: SearchRow[]): SearchRow[] {
  const terms = queryTerms(query);
  if (!terms.length) return rows;
  const qNorm = normalizeForMatch(query);
  const scored = rows
    .map((row) => {
      const h = rowHaystack(row);
      const titleUrl = normalizeForMatch(`${row.title || ""} ${row.url || ""}`);
      let overlap = 0;
      let titleOverlap = 0;
      for (const t of terms) {
        if (h.includes(` ${t} `)) overlap += 1;
        if (titleUrl.includes(` ${t} `)) titleOverlap += 1;
      }
      const compatible = categoryCompatible(query, row);
      let score = (row.rank || 0) + overlap * 0.5 + titleOverlap * 0.8 + (row.is_pdf || isPdfUrl(row.url) ? 0.25 : 0);
      if (/\b(syllabus|curriculum|scheme|course structure|resource|resources|e content|econtent|study material|downloads?)\b/.test(qNorm) &&
          /\b(admission|admissions|result|results|revaluation|recruitment|vacancy|employment|tender|quotation|bid|eoi)\b/.test(h)) score -= 5;
      return { row, overlap, titleOverlap, compatible, score };
    })
    .filter((s) => s.compatible && (s.overlap >= Math.min(2, terms.length) || s.titleOverlap >= 1));

  return scored
    .sort((a, b) => {
      const titleDelta = b.titleOverlap - a.titleOverlap;
      if (titleDelta !== 0) return titleDelta;
      const overlapDelta = b.overlap - a.overlap;
      if (overlapDelta !== 0) return overlapDelta;
      const pdfDelta = Number(b.row.is_pdf || isPdfUrl(b.row.url)) - Number(a.row.is_pdf || isPdfUrl(a.row.url));
      if (pdfDelta !== 0) return pdfDelta;
      return b.score - a.score;
    })
    .map((s) => s.row)
    .slice(0, 10);
}


function buildContext(rows: SearchRow[]): string {
  if (!rows.length) return "";
  const parts: string[] = ["\n\n--- LIVE CUK PAGE INDEX (top matches) ---"];
  rows.slice(0, 8).forEach((r, i) => {
    const title = cleanTitle(r.title, r.url);
    const body = (r.snippet || "").replace(/\s+/g, " ").trim().slice(0, 1200);
    parts.push(`[${i + 1}] ${title}${r.is_pdf || isPdfUrl(r.url) ? " (PDF)" : ""}\nURL: ${r.url}\n${body}`);
  });
  parts.push("--- END INDEX ---\n");
  return parts.join("\n\n");
}

function formatSources(sources: Source[]): string {
  if (!sources.length) return "";
  const lines = ["**Sources:**"];
  sources.forEach((s, i) => {
    const label = s.title || `Source ${i + 1}`;
    lines.push(`${i + 1}. [${label}${s.isPdf ? " (PDF)" : ""}](${s.url})`);
  });
  return lines.join("\n");
}

// ─── Citation verification ────────────────────────────────────────────────────
const STOPWORDS = new Set([
  "the","a","an","and","or","of","to","for","in","on","at","is","are","was","were","be","by",
  "with","from","as","that","this","it","its","into","about","over","under","you","your","we",
  "our","they","their","i","my","me","he","she","his","her","them","but","not","no","yes","if",
  "then","than","so","do","does","did","can","could","should","would","will","shall","may","might",
  "have","has","had","been","being","also","more","most","such","via","per","any","all","one","two",
  "cuk","university","kashmir","central","page","pages","pdf","source","sources","official","website",
  "click","here","link","links","please","note","kindly","information","details","detail",
]);

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function hostKeywords(url: string): string[] {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\.(pdf|aspx?|html?)$/i, "").replace(/[\/_-]+/g, " ");
    return tokenize(path);
  } catch { return []; }
}

/**
 * For each [n] marker the model emitted, verify that the cited source's
 * title/snippet/url actually relates to the surrounding sentence. If a
 * citation has no meaningful term overlap with the answer's local context,
 * drop that source from the visible Sources panel.
 */
function verifyCitedSources(
  answerText: string,
  cited: number[],
  catalog: Source[],
  snippets: Record<number, string>,
): { kept: number[]; dropped: { index: number; reason: string }[] } {
  const kept: number[] = [];
  const dropped: { index: number; reason: string }[] = [];
  const answerTokens = new Set(tokenize(answerText));

  for (const n of cited) {
    const src = catalog[n - 1];
    if (!src) { dropped.push({ index: n, reason: "missing_in_catalog" }); continue; }

    // Collect text windows surrounding each occurrence of [n] in the answer.
    const re = new RegExp(`\\[${n}\\]`, "g");
    const windows: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(answerText)) !== null) {
      const start = Math.max(0, m.index - 240);
      const end = Math.min(answerText.length, m.index + 240);
      windows.push(answerText.slice(start, end));
    }
    const localText = windows.join(" ") || answerText;
    const localTokens = new Set(tokenize(localText));

    const srcTokens = new Set([
      ...tokenize(src.title || ""),
      ...tokenize(snippets[n] || ""),
      ...hostKeywords(src.url),
    ]);

    if (srcTokens.size === 0) {
      dropped.push({ index: n, reason: "source_has_no_keywords" });
      continue;
    }

    // Overlap against the local sentence context AND the whole answer.
    let localOverlap = 0;
    let globalOverlap = 0;
    for (const t of srcTokens) {
      if (localTokens.has(t)) localOverlap++;
      if (answerTokens.has(t)) globalOverlap++;
    }

    // Require at least 2 shared meaningful tokens locally, or 3 globally for
    // short titles. This blocks "decorative" citations on unrelated claims.
    const ok = localOverlap >= 2 || globalOverlap >= 3;
    if (ok) kept.push(n);
    else dropped.push({ index: n, reason: `low_overlap_local_${localOverlap}_global_${globalOverlap}` });
  }
  return { kept, dropped };
}


// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { id: correlationId, source: correlationSource } = readOrMintCorrelationId(req);
  const rid = correlationId;
  const startedAt = nowMs();
  log("info", "chatbot_request_start", {
    request_id: rid,
    correlation_id: correlationId,
    correlation_source: correlationSource,
    method: req.method,
  });

  try {
    // Auth: require a signed-in caller so paid AI calls aren't abused anonymously.
    const authStartedAt = nowMs();
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!authHeader.startsWith("Bearer ") || !jwt || isLikelyPublishableToken(jwt)) {
      log("warn", "chatbot_jwt_validation", {
        request_id: rid,
        ok: false,
        reason: !jwt ? "missing_bearer_token" : "publishable_key_not_user_jwt",
        latency_ms: elapsed(authStartedAt),
      });
      return jsonError({ error: "Unauthorized" }, 401, correlationId);
    }

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
    });
    const userData = userResp.ok ? await userResp.json().catch(() => null) : null;
    const userId = typeof userData?.id === "string" ? userData.id : null;
    if (!userResp.ok || !userId) {
      log("warn", "chatbot_jwt_validation", {
        request_id: rid,
        ok: false,
        status: userResp.status,
        reason: userResp.ok ? "missing_user_id" : "auth_user_lookup_failed",
        latency_ms: elapsed(authStartedAt),
      });
      return jsonError({ error: "Unauthorized" }, 401, correlationId);
    }
    log("info", "chatbot_jwt_validation", {
      request_id: rid,
      ok: true,
      user_id: userId,
      latency_ms: elapsed(authStartedAt),
    });

    const body = await req.json() as { messages: ChatMessage[] };
    const messages = sanitizeMessages(body.messages || []);
    if (!messages?.length) {
      log("warn", "chatbot_bad_request", { request_id: rid, reason: "messages_required", latency_ms: elapsed(startedAt) });
      return jsonError({ error: "messages required" }, 400, correlationId);
    }

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) {
      log("error", "chatbot_configuration_error", { request_id: rid, reason: "missing_lovable_api_key", latency_ms: elapsed(startedAt) });
      return jsonError({ error: "AI not configured." }, 500, correlationId);
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const rawQuery = lastUser?.content || "";
    const searchQuery = rewriteQuery(rawQuery, messages.slice(0, -1));
    const cukScoped = isCukScopedQuery(rawQuery);
    log("info", "chatbot_request_parsed", {
      request_id: rid,
      user_id: userId,
      message_count: messages.length,
      query_length: rawQuery.length,
      rewritten: searchQuery !== rawQuery,
      cuk_scoped: cukScoped,
      app_nav_only: isAppNavOnly(rawQuery),
      latency_ms: elapsed(startedAt),
    });

    if (!cukScoped) {
      log("info", "chatbot_refused_unrelated_query", {
        request_id: rid,
        user_id: userId,
        latency_ms: elapsed(startedAt),
      });
      return sseOnce(
        "I can only answer questions about Central University of Kashmir (CUK), official CUK pages/PDFs, admissions, exams, syllabi/resources, notices, departments, or this exam-paper system. Ask me a CUK-related question and I’ll use exact official sources.",
        REFUSAL_FOLLOW_UPS,
        [],
        correlationId,
      );
    }

    // ── Run pre-indexed FTS + live Firecrawl deep hunt IN PARALLEL ──
    // Why: the index only knows pages our crawler has visited. Department
    // sub-pages, PDFs in /downloads, scheme files, etc. are often missing.
    // We always ask Firecrawl for fresh deep links and merge them.
    const searchStartedAt = nowMs();
    let rows: SearchRow[] = [];
    if (!isAppNavOnly(rawQuery) && searchQuery.trim().length > 1) {
      const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } });

      const indexPromise = Promise.resolve(sb.rpc("search_cuk_pages", { _query: searchQuery, _limit: 8 }))
        .then(({ data, error }) => {
          if (error) {
            log("error", "chatbot_search_complete", { request_id: rid, user_id: userId, ok: false, error: error.message, hit_count: 0, latency_ms: elapsed(searchStartedAt) });
            return [] as SearchRow[];
          }
          return (data || []) as SearchRow[];
        })
        .catch((e: unknown) => {
          log("error", "chatbot_search_complete", { request_id: rid, user_id: userId, ok: false, error: safeError(e), hit_count: 0, latency_ms: elapsed(searchStartedAt) });
          return [] as SearchRow[];
        });

      const livePromise = firecrawlDeepHunt(searchQuery).catch(() => [] as LiveHit[]);

      const [indexRows, liveHits] = await Promise.all([indexPromise, livePromise]);
      rows = indexRows;

      log("info", "chatbot_search_complete", {
        request_id: rid,
        user_id: userId,
        ok: true,
        hit_count: rows.length,
        pdf_hit_count: rows.filter((r) => r.is_pdf || isPdfUrl(r.url)).length,
        top_rank: rows[0]?.rank ?? null,
        live_hit_count: liveHits.length,
        live_pdf_count: liveHits.filter((h: LiveHit) => h.isPdf).length,
        latency_ms: elapsed(searchStartedAt),
      });

      if (liveHits.length) {
        const liveRows = liveHitsToRows(liveHits);
        const seen = new Set(rows.map((r) => r.url.split("#")[0]));
        for (const r of liveRows) {
          const k = r.url.split("#")[0];
          if (!seen.has(k)) { rows.push(r); seen.add(k); }
        }
        // Prefer PDFs and high-ranked rows.
        rows.sort((a, b) => {
          const pdfDelta = Number(b.is_pdf || isPdfUrl(b.url)) - Number(a.is_pdf || isPdfUrl(a.url));
          if (pdfDelta !== 0) return pdfDelta;
          return (b.rank || 0) - (a.rank || 0);
        });
        rows = rows.slice(0, 10);
      }

      const curatedRows = curatedOfficialRows(searchQuery);
      if (curatedRows.length) {
        const seen = new Set(rows.map((r) => r.url.split("#")[0]));
        for (const r of curatedRows) {
          const k = r.url.split("#")[0];
          if (!seen.has(k)) { rows.push(r); seen.add(k); }
        }
      }

      const sourcesBeforeFilter = [...rows].sort((a, b) => {
        const aCompat = Number(categoryCompatible(searchQuery, a));
        const bCompat = Number(categoryCompatible(searchQuery, b));
        if (bCompat !== aCompat) return bCompat - aCompat;
        return (b.rank || 0) - (a.rank || 0);
      });
      const exactRows = filterRowsForExactQuery(searchQuery, rows);
      // Merge strict-filter results with top compatible rows so the model always
      // has enough citations (the strict overlap filter was starving sources).
      const compatPool = sourcesBeforeFilter.filter((r) => categoryCompatible(searchQuery, r));
      const merged: SearchRow[] = [];
      const seen = new Set<string>();
      const pushRow = (r: SearchRow) => {
        const key = (r.url || "").toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(r);
      };
      exactRows.forEach(pushRow);
      compatPool.filter((r) => r.is_pdf || isPdfUrl(r.url)).slice(0, 6).forEach(pushRow);
      compatPool.slice(0, 6).forEach(pushRow);
      // Last-resort fill: top-ranked search hits even if not category-strict,
      // so the Sources panel never collapses to a single landing page.
      sourcesBeforeFilter.filter((r) => r.is_pdf || isPdfUrl(r.url)).slice(0, 6).forEach(pushRow);
      sourcesBeforeFilter.slice(0, 8).forEach(pushRow);
      log("info", "chatbot_exact_source_filter", {
        request_id: rid,
        user_id: userId,
        before_count: rows.length,
        exact_count: exactRows.length,
        after_count: merged.length,
        latency_ms: elapsed(searchStartedAt),
      });
      rows = merged.length ? merged.slice(0, 10) : sourcesBeforeFilter.slice(0, 5);

    } else {
      log("info", "chatbot_search_skipped", {
        request_id: rid,
        user_id: userId,
        reason: isAppNavOnly(rawQuery) ? "app_nav_only" : "short_query",
        latency_ms: elapsed(searchStartedAt),
      });
    }

    const sources = rowsToSources(rows);
    const context = buildContext(rows);
    const followUps = getFollowUps(rawQuery);

    if (!isAppNavOnly(rawQuery) && sources.length === 0) {
      log("info", "chatbot_no_exact_sources", {
        request_id: rid,
        user_id: userId,
        query: searchQuery.slice(0, 200),
        latency_ms: elapsed(startedAt),
      });
      return sseOnce(
        "I couldn't locate the exact CUK source for that in the current index. Please ask with the programme, semester, session/year, department, or notice/document name so I can return the exact CUK page or PDF.",
        EXACT_SOURCE_FOLLOW_UPS,
        [],
        correlationId,
      );
    }

    const catalogBlock = sources.length > 0
      ? "\n\n--- VERIFIED SOURCE CATALOG (cite as [n]) ---\n" +
        sources.map((s, i) => `[${i + 1}] ${s.title}${s.isPdf ? " (PDF)" : ""} — ${s.url}`).join("\n") +
        "\n--- END CATALOG ---\n"
      : "";

    const systemPrompt = SYSTEM_PROMPT + context + catalogBlock;

    const aiStartedAt = nowMs();
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    log(aiResp.ok ? "info" : "warn", "chatbot_upstream_response", {
      request_id: rid,
      user_id: userId,
      upstream: "lovable_ai_gateway",
      status: aiResp.status,
      ok: aiResp.ok,
      latency_ms: elapsed(aiStartedAt),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      log("error", "chatbot_upstream_error", {
        request_id: rid,
        user_id: userId,
        status: aiResp.status,
        error_preview: errText.slice(0, 500),
        latency_ms: elapsed(aiStartedAt),
      });
      let msg = `AI gateway error ${aiResp.status}`;
      if (aiResp.status === 429) msg = "Too many requests right now. Please try again in a moment.";
      else if (aiResp.status === 402) msg = "AI usage limit reached. Please add credits to continue.";
      return jsonError({ error: msg }, aiResp.status, correlationId);
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const emit = async (obj: unknown) => {
      await writer.write(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
    };

    (async () => {
      let streamedChunks = 0;
      let assistantText = "";
      const snippetMap: Record<number, string> = {};
      rows.slice(0, sources.length).forEach((r, i) => { snippetMap[i + 1] = r.snippet || ""; });
      const buildCitedSources = () => {
        const cited = new Set<number>();
        const re = /\[(\d{1,2})\]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(assistantText)) !== null) {
          const n = parseInt(m[1], 10);
          if (n >= 1 && n <= sources.length) cited.add(n);
        }
        const ordered = Array.from(cited).sort((a, b) => a - b);
        if (ordered.length === 0) return [];
        const { kept, dropped } = verifyCitedSources(assistantText, ordered, sources, snippetMap);
        if (dropped.length) {
          log("info", "chatbot_citations_filtered", {
            request_id: rid,
            user_id: userId,
            cited: ordered,
            kept,
            dropped,
          });
        }
        return kept.map((n) => {
          const s = sources[n - 1];
          return { index: n, title: s.title, url: s.url, isPdf: !!s.isPdf };
        });
      };

      try {
        const reader = aiResp.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let finished = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            if (json === "[DONE]") {
              if (!finished) {
                finished = true;
                await emit({
                  object: "chat.completion.chunk",
                  choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                  follow_up_suggestions: followUps,
                  sources: buildCitedSources(),
                  correlation_id: correlationId,
                });
                await writer.write(enc.encode("data: [DONE]\n\n"));
              }
              continue;
            }
            try {
              const ev = JSON.parse(json);
              const delta = ev?.choices?.[0]?.delta?.content;
              if (delta) {
                streamedChunks += 1;
                assistantText += delta;
                await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] });
              }
            } catch { /* skip malformed */ }
          }
        }

        if (!finished) {
          await emit({
            object: "chat.completion.chunk",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            follow_up_suggestions: followUps,
            sources: buildCitedSources(),
            correlation_id: correlationId,
          });
          await writer.write(enc.encode("data: [DONE]\n\n"));
        }


        log("info", "chatbot_stream_complete", {
          request_id: rid,
          user_id: userId,
          chunks: streamedChunks,
          source_count: sources.length,
          total_latency_ms: elapsed(startedAt),
        });
      } catch (e) {
        log("error", "chatbot_stream_error", {
          request_id: rid,
          user_id: userId,
          error: safeError(e),
          total_latency_ms: elapsed(startedAt),
        });
        await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: "\n\n⚠️ Connection interrupted. Please try again." }, finish_reason: "stop" }], follow_up_suggestions: [], correlation_id: correlationId }).catch(() => {});
        await writer.write(enc.encode("data: [DONE]\n\n")).catch(() => {});
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "x-correlation-id": correlationId },
    });
  } catch (e) {
    log("error", "chatbot_request_error", { request_id: rid, error: safeError(e), total_latency_ms: elapsed(startedAt) });
    return jsonError({ error: e instanceof Error ? e.message : "Unknown error" }, 500, correlationId);
  }
});
