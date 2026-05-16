import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type FirecrawlSearchResult = { title?: string; url?: string; markdown?: string; html?: string; description?: string };
type VerifiedSource = { title: string; url: string; content: string; isPdf: boolean; score: number };
type SearchContext = { context: string; verifiedSources: VerifiedSource[] };

// ─── RAG-Style Prompt (ported from prompt.py) ────────────────────────────────

const SYSTEM_PROMPT = `You are the official AI assistant for the Central University of Kashmir (CUK), integrated into a Confidential Exam Paper Management System.

Answer only from the supplied context when context is provided.

Rules:
- If the answer is supported by the context, answer clearly and cite sources like [1] or [2].
- If the answer is only partially supported, say what is confirmed and what is missing.
- If the answer is not in the context, say exactly: "I don't have that information. Please contact the university office directly."
- Prefer exact facts, dates, eligibility rules, and links when they exist in the context.
- Do not invent contact details, deadlines, fees, or policies.
- For staff/faculty/contact questions, prefer official role/designation and direct contact fields from the context.
- When the context contains table rows or row-like records, keep values matched to the correct row; do not mix cells from different rows.
- For count questions, only count what is explicitly listed or stated, and say when the total is incomplete.
- Start with a direct answer, then add short, well-grouped details that are easy to scan.
- Use bullets for steps, requirements, dates, or lists when the context contains them.
- Cite grounded claims. Keep citations tidy — prefer one citation block at the end of a sentence or bullet.
- Mention official URLs from the context when they directly help the student act on the answer.
- If a VERIFIED SOURCE CATALOG is provided, do NOT output a Sources section — the system will append verified links automatically. Never invent external links.
- NEVER give numbered step-by-step walkthroughs unless explicitly asked.
- NEVER say "visit the website" or "go to" — instead provide the direct clickable link.
- Be concise — answer in 2-4 sentences when possible, then bullets for details.

Exam Paper System Help:
- Teachers: uploading papers, checking submission status, rollback/cancel, assigned subjects, calendar deadlines
- HODs: reviewing papers, selecting/rejecting papers, department management, exam sessions, alerts
- Exam Cell: managing datesheets, paper inbox, exam sessions, HOD alerts, archive
- Admin: user management, departments, audit logs, broadcasts, security
- For app features, use markdown links like [Upload Paper](/upload), [Submissions](/submissions), [Review](/review), [Calendar](/calendar), [Settings](/settings)`;

// ─── Category synonyms (from crawler.py) ────────────────────────────────────

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  admissions: ["admission", "admissions", "apply", "application", "entrance", "cuet", "merit list", "selection list", "counselling", "prospectus", "eligibility"],
  fees: ["fee", "fees", "fee structure", "challan", "payment", "tuition", "hostel fee", "refund"],
  results: ["result", "results", "marksheet", "grade card", "score card", "transcript", "revaluation"],
  examinations: ["exam", "examination", "datesheet", "date sheet", "schedule", "timetable", "admit card", "hall ticket", "backlog", "supplementary", "reappear"],
  academics: ["academic", "syllabus", "course", "courses", "programme", "curriculum", "ordinance", "regulation"],
  faculty: ["faculty", "teacher", "professor", "assistant professor", "associate professor"],
  departments: ["department", "departments", "school", "schools", "centre", "center"],
  scholarships: ["scholarship", "fellowship", "stipend", "financial aid"],
  notices: ["notice", "notification", "circular", "announcement", "office order"],
  recruitment: ["job", "jobs", "career", "recruitment", "vacancy", "employment", "walk-in"],
  tenders: ["tender", "tenders", "quotation", "bid", "procurement"],
  research: ["research", "project", "publication", "phd", "doctoral"],
  library: ["library", "opac", "e-resource", "journal"],
  hostels: ["hostel", "hostels", "accommodation"],
  placements: ["placement", "placements", "internship", "training"],
  contact: ["contact", "email", "phone", "telephone", "address", "directory"],
  downloads: ["download", "form", "brochure", "bulletin"],
  about: ["about", "profile", "vision", "mission", "statute", "act", "chancellor", "vice chancellor", "registrar"],
};

// ─── Follow-up question rewriting (ported from memory.py) ────────────────────

const REFERENCE_WORD_RE = /\b(he|she|his|her|hers|him|they|them|their|theirs)\b/i;
const CONTEXTUAL_WORD_RE = /\b(it|its|this|that|these|those|there|same|former|latter|mentioned|above|below)\b/i;
const FOLLOW_UP_PREFIX_RE = /^\s*(and|also|what about|how about|then|now)\b/i;
const AMBIGUOUS_FOLLOW_UP_RE = /\b(form\s*(?:no|nos|number)|application\s*(?:no|number)|list|names?|candidates?|selected|eligible|date|time|venue|link|details?)\b/i;
const SPECIFIC_CONTEXT_RE = /\b(ph\.?\s*d|phd|media studies|communication|journalism|department|school|programme|program|admission|selection|selected|eligible|eligibility|interview|cuet|ug|pg|faculty|professor|teacher|contact|email|phone|syllabus|result|datesheet|notice|exam)\b/i;
const PERSON_WITH_TITLE_RE = /\b(?:Prof\.?|Professor|Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g;

const NON_PERSON_PHRASES = new Set([
  "central university", "university office", "school of", "media studies",
  "department of", "associate professor", "assistant professor", "professor",
  "dean", "director", "coordinator", "controller of examinations",
]);

function looksContextDependent(query: string): boolean {
  const clean = (query || "").trim();
  if (!clean) return false;
  if (REFERENCE_WORD_RE.test(clean) || CONTEXTUAL_WORD_RE.test(clean) || FOLLOW_UP_PREFIX_RE.test(clean)) return true;
  return AMBIGUOUS_FOLLOW_UP_RE.test(clean) && !SPECIFIC_CONTEXT_RE.test(clean);
}

function extractRecentPerson(history: ChatMessage[]): string | null {
  for (let i = history.length - 1; i >= Math.max(0, history.length - 6); i--) {
    const text = history[i].content || "";
    const titled = text.match(PERSON_WITH_TITLE_RE);
    if (titled) {
      const candidate = titled[titled.length - 1].trim();
      const lower = candidate.toLowerCase();
      if (![...NON_PERSON_PHRASES].some((p) => lower.includes(p))) return candidate;
    }
  }
  return null;
}

function extractRecentTopic(history: ChatMessage[]): string | null {
  for (let i = history.length - 1; i >= Math.max(0, history.length - 4); i--) {
    const text = (history[i].content || "").replace(/\s*Sources:\s*\[\d+(?:,\s*\d+)*\].*$/i, "").replace(/\[[0-9,\s]+\]/g, "").trim();
    if (SPECIFIC_CONTEXT_RE.test(text)) {
      return text.length > 220 ? text.slice(0, 220).trim() : text;
    }
  }
  return null;
}

function rewriteQuery(query: string, history: ChatMessage[]): string {
  if (!history.length || !looksContextDependent(query)) return query;

  let rewritten = query;
  const person = extractRecentPerson(history);
  if (person) {
    rewritten = rewritten.replace(/\bhis\b/gi, `${person}'s`);
    rewritten = rewritten.replace(/\bher\b/gi, `${person}'s`);
    rewritten = rewritten.replace(/\bhim\b/gi, person);
    rewritten = rewritten.replace(/\bhe\b/gi, person);
    rewritten = rewritten.replace(/\bshe\b/gi, person);
  }

  const topic = extractRecentTopic(history);
  const stillAmbiguous = /\b(they|them|their|theirs|there|these|those|mentioned|above|below)\b/i.test(rewritten)
    || AMBIGUOUS_FOLLOW_UP_RE.test(rewritten)
    || CONTEXTUAL_WORD_RE.test(rewritten)
    || FOLLOW_UP_PREFIX_RE.test(rewritten);

  if (topic && stillAmbiguous && !rewritten.toLowerCase().includes(topic.toLowerCase().slice(0, 40))) {
    rewritten = `${rewritten.replace(/[?\s]+$/, "")}; context: ${topic}`;
  }

  return rewritten;
}

// ─── Follow-up suggestions (ported from app.py) ─────────────────────────────

const FOLLOW_UP_LIBRARY: Record<string, string[]> = {
  admissions: [
    "What documents are required for admission?",
    "What is the eligibility criteria?",
    "Where can I find the official admission notice?",
  ],
  departments: [
    "Which department should I contact for this?",
    "Show me the relevant faculty or office details.",
    "What programmes are offered in this department?",
  ],
  contact: [
    "Do you have the official email or phone number?",
    "Which office handles this process?",
  ],
  examinations: [
    "Where can I check the latest exam notice?",
    "What dates are confirmed in the official notice?",
  ],
  general: [
    "Can you summarize the most important points?",
    "Show me the official sources for this answer.",
  ],
};

function detectCategory(query: string): string {
  const lower = (query || "").toLowerCase();
  if (/admission|apply|eligibility|cuet/.test(lower)) return "admissions";
  if (/faculty|teacher|professor|contact|email|phone/.test(lower)) return "contact";
  if (/exam|examination|datesheet|result/.test(lower)) return "examinations";
  if (/department|programme|course|school/.test(lower)) return "departments";
  return "general";
}

function getFollowUpSuggestions(query: string): string[] {
  const category = detectCategory(query);
  const pool = [...(FOLLOW_UP_LIBRARY[category] || []), ...(FOLLOW_UP_LIBRARY.general || [])];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of pool) {
    const key = s.toLowerCase();
    if (seen.has(key) || key === query.toLowerCase()) continue;
    seen.add(key);
    result.push(s);
    if (result.length === 3) break;
  }
  return result;
}

// ─── URL & Source Helpers ────────────────────────────────────────────────────

const ALLOWED_SOURCE_HOSTS = ["cukashmir.ac.in", "www.cukashmir.ac.in", "cukashmir.samarth.edu.in", "cuet.samarth.ac.in", "results.cukashmir.in"];
const STOPWORDS = new Set(["about", "after", "all", "and", "any", "are", "can", "cuk", "for", "from", "how", "into", "latest", "more", "not", "official", "the", "their", "this", "university", "what", "when", "where", "which", "with", "you"]);

function tokenize(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOPWORDS.has(t)))];
}

function normalizeUrl(rawUrl: string | undefined, baseUrl?: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim().replace(/^<|>$/g, "");
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("mailto:")) return null;
  try {
    const url = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch { return null; }
}

function isAllowedSourceUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ALLOWED_SOURCE_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch { return false; }
}

function isPdfUrl(url: string): boolean { return /\.pdf(?:$|[?#])/i.test(url); }

function deriveTitleFromUrl(url: string): string {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean).pop() || "Source";
    return decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  } catch { return "Source"; }
}

function cleanTitle(title: string | undefined, url: string): string {
  const cleaned = (title || "").replace(/[*_`>#]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || /^(click here|read more|download|view|open)$/i.test(cleaned)) return deriveTitleFromUrl(url);
  return cleaned;
}

function escapeLinkTitle(title: string): string { return title.replace(/[\[\]]/g, "").trim(); }

function scoreSource(query: string, candidate: { title: string; url: string; content: string; isPdf: boolean }): number {
  const haystack = `${candidate.title} ${candidate.url} ${candidate.content}`.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryTerms = tokenize(query);
  let score = 0;
  for (const term of queryTerms) { if (haystack.includes(term)) score += 4; }
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
  const mdLinkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  const directUrlRe = /https?:\/\/[^\s)\]]+/g;
  const content = markdown.slice(0, 4000);

  for (const m of markdown.matchAll(mdLinkRe)) {
    const url = normalizeUrl(m[2], baseUrl);
    if (!url) continue;
    const title = cleanTitle(m[1], url);
    candidates.push({ title, url, content, isPdf: isPdfUrl(url), score: scoreSource(query, { title, url, content, isPdf: isPdfUrl(url) }) });
  }
  for (const m of markdown.matchAll(directUrlRe)) {
    const url = normalizeUrl(m[0], baseUrl);
    if (!url) continue;
    const title = cleanTitle(parentTitle, url);
    candidates.push({ title, url, content, isPdf: isPdfUrl(url), score: scoreSource(query, { title, url, content, isPdf: isPdfUrl(url) }) });
  }
  return candidates;
}

function dedupeAndRankSources(sources: VerifiedSource[], limit: number): VerifiedSource[] {
  const deduped = new Map<string, VerifiedSource>();
  for (const s of sources) {
    const existing = deduped.get(s.url);
    if (!existing || s.score > existing.score || s.title.length > existing.title.length) deduped.set(s.url, s);
  }
  return [...deduped.values()].sort((a, b) => b.score - a.score || Number(b.isPdf) - Number(a.isPdf)).slice(0, limit);
}

async function verifySourceUrl(url: string): Promise<boolean> {
  if (!isAllowedSourceUrl(url)) return false;
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 LovableBot/1.0" } });
    if (r.ok) return true;
  } catch { /* fall through */ }
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", headers: { Range: "bytes=0-0", "User-Agent": "Mozilla/5.0 LovableBot/1.0" } });
    return r.ok;
  } catch { return false; }
}

async function filterWorkingSources(sources: VerifiedSource[], limit: number): Promise<VerifiedSource[]> {
  const checked = await Promise.all(sources.slice(0, 12).map(async (s) => ({ s, ok: await verifySourceUrl(s.url) })));
  return checked.filter((e) => e.ok).map((e) => e.s).slice(0, limit);
}

function formatSourcesSection(sources: VerifiedSource[]): string {
  return `**Sources:**\n${sources.map((s) => `- [${escapeLinkTitle(s.title)}](${s.url})`).join("\n")}`;
}

function stripSourcesSection(content: string): string {
  return content.replace(/\n{0,2}\*\*Sources:\*\*[\s\S]*$/i, "").replace(/\n{0,2}Sources:[\s\S]*$/i, "").trim();
}

// ─── Firecrawl helpers ───────────────────────────────────────────────────────

async function firecrawlSearch(apiKey: string, searchQuery: string, limit = 8): Promise<FirecrawlSearchResult[]> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery, limit, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!res.ok) { console.error("Firecrawl search failed:", res.status); return []; }
    const data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (e) { console.error("Firecrawl search error:", e); return []; }
}

async function firecrawlScrape(apiKey: string, url: string): Promise<FirecrawlSearchResult | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.data?.metadata?.title || "CUK Page", url: data.data?.metadata?.sourceURL || url, markdown: data.data?.markdown || "" };
  } catch { return null; }
}

// ─── Search expansion (category-aware, from crawler.py synonyms) ─────────────

function expandQueryForSearch(query: string): string[] {
  const lower = query.toLowerCase();
  const extraTerms: string[] = [];
  for (const [, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.some((s) => lower.includes(s))) {
      for (const s of synonyms) {
        if (!lower.includes(s) && s.length > 3) extraTerms.push(s);
      }
    }
  }
  // Return top 3 expansion terms
  return extraTerms.slice(0, 3);
}

// ─── Fallback pages ──────────────────────────────────────────────────────────

const FALLBACK_PAGES: Record<string, string[]> = {
  notice: [
    "https://www.cukashmir.ac.in/displayevents.aspx",
    "https://www.cukashmir.ac.in/notices.aspx",
    "https://www.cukashmir.ac.in/news.aspx",
    "https://cukashmir.samarth.edu.in/index.php/site/noticeBoard",
  ],
  datesheet: [
    "https://www.cukashmir.ac.in/examination.aspx",
    "https://www.cukashmir.ac.in/displayevents.aspx",
    "https://www.cukashmir.ac.in/examnotices.aspx",
  ],
  result: [
    "https://www.cukashmir.ac.in/examination.aspx",
    "https://www.cukashmir.ac.in/results.aspx",
    "https://cukashmir.samarth.edu.in/index.php/site/noticeBoard",
  ],
  syllabus: [
    "https://www.cukashmir.ac.in/departments.aspx",
    "https://www.cukashmir.ac.in/academics.aspx",
    "https://www.cukashmir.ac.in/schools.aspx",
    "https://www.cukashmir.ac.in/courses.aspx",
  ],
  admission: [
    "https://www.cukashmir.ac.in/admissions.aspx",
    "https://www.cukashmir.ac.in/prospectus.aspx",
    "https://cuet.samarth.ac.in",
  ],
  examination: [
    "https://www.cukashmir.ac.in/examination.aspx",
    "https://www.cukashmir.ac.in/examnotices.aspx",
  ],
  recruitment: [
    "https://www.cukashmir.ac.in/recruitment.aspx",
    "https://www.cukashmir.ac.in/careers.aspx",
    "https://www.cukashmir.ac.in/displayevents.aspx",
  ],
  tender: [
    "https://www.cukashmir.ac.in/tenders.aspx",
    "https://www.cukashmir.ac.in/displayevents.aspx",
  ],
  scholarship: [
    "https://www.cukashmir.ac.in/scholarships.aspx",
    "https://www.cukashmir.ac.in/students.aspx",
  ],
  fees: [
    "https://www.cukashmir.ac.in/feestructure.aspx",
    "https://www.cukashmir.ac.in/admissions.aspx",
  ],
  faculty: [
    "https://www.cukashmir.ac.in/departments.aspx",
    "https://www.cukashmir.ac.in/schools.aspx",
    "https://www.cukashmir.ac.in/faculty.aspx",
  ],
  department: [
    "https://www.cukashmir.ac.in/departments.aspx",
    "https://www.cukashmir.ac.in/schools.aspx",
  ],
  download: [
    "https://www.cukashmir.ac.in/downloads.aspx",
    "https://www.cukashmir.ac.in/forms.aspx",
  ],
  contact: [
    "https://www.cukashmir.ac.in/contactus.aspx",
    "https://www.cukashmir.ac.in/directory.aspx",
  ],
  about: [
    "https://www.cukashmir.ac.in/aboutus.aspx",
    "https://www.cukashmir.ac.in/administration.aspx",
  ],
};

function getFallbackCategories(query: string): string[] {
  const lower = query.toLowerCase();
  const cats: string[] = [];
  if (/notice|notification|circular|announcement|office order/.test(lower)) cats.push("notice");
  if (/datesheet|date sheet|backlog|schedule|timetable|hall ticket|admit card/.test(lower)) cats.push("datesheet");
  if (/result|grade|marks|transcript|revaluation/.test(lower)) cats.push("result");
  if (/syllabus|syllabi|curriculum|course|ordinance|regulation/.test(lower)) cats.push("syllabus");
  if (/admission|eligibility|apply|cuet|prospectus|merit list|selection list|counselling/.test(lower)) cats.push("admission");
  if (/exam|examination|supplementary|reappear/.test(lower)) cats.push("examination");
  if (/recruitment|vacancy|job|career|walk[- ]?in|employment/.test(lower)) cats.push("recruitment");
  if (/tender|quotation|bid|procurement/.test(lower)) cats.push("tender");
  if (/scholarship|fellowship|stipend|financial aid/.test(lower)) cats.push("scholarship");
  if (/fee|fees|tuition|challan|payment|refund/.test(lower)) cats.push("fees");
  if (/faculty|teacher|professor|assistant professor|associate professor/.test(lower)) cats.push("faculty");
  if (/department|school|centre|center/.test(lower)) cats.push("department");
  if (/download|form|brochure|bulletin/.test(lower)) cats.push("download");
  if (/contact|email|phone|telephone|address|directory/.test(lower)) cats.push("contact");
  if (/about|vision|mission|chancellor|registrar|administration/.test(lower)) cats.push("about");
  return cats;
}

// True if the user is likely looking for a downloadable document (PDF)
function expectsPdf(query: string): boolean {
  const lower = query.toLowerCase();
  return /\bpdf\b|notice|notification|circular|datesheet|date sheet|timetable|admit card|hall ticket|result|syllabus|prospectus|brochure|form|tender|recruitment|office order|ordinance|regulation|merit list|selection list/.test(lower);
}

// Pick the most promising on-page links discovered while scraping an index page,
// to follow one level deeper toward the actual document.
function pickDeepLinksFromMarkdown(markdown: string, baseUrl: string, query: string, max: number): string[] {
  const queryTerms = tokenize(query);
  const scored: { url: string; isPdf: boolean; score: number }[] = [];
  const seen = new Set<string>();

  const consider = (rawUrl: string, label: string) => {
    const url = normalizeUrl(rawUrl, baseUrl);
    if (!url || seen.has(url)) return;
    if (!isAllowedSourceUrl(url)) return;
    if (url === baseUrl) return;
    seen.add(url);
    const hay = `${label} ${url}`.toLowerCase();
    let score = 0;
    for (const t of queryTerms) if (hay.includes(t)) score += 5;
    const isPdf = isPdfUrl(url);
    if (isPdf) score += 6;
    // Prefer document/notice-like sub-pages
    if (/notice|notification|circular|datesheet|result|syllabus|admission|recruitment|tender|prospectus|download|examnotice/.test(hay)) score += 3;
    // Skip obvious chrome
    if (/contactus|gallery|home\.aspx|index\.aspx|aboutus|sitemap/.test(url)) score -= 4;
    if (score <= 0 && !isPdf) return;
    scored.push({ url, isPdf, score });
  };

  for (const m of markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) consider(m[2], m[1] || "");
  for (const m of markdown.matchAll(/https?:\/\/[^\s)\]]+/g)) consider(m[0], "");

  return scored
    .sort((a, b) => Number(b.isPdf) - Number(a.isPdf) || b.score - a.score)
    .slice(0, max)
    .map((s) => s.url);
}

// ─── Main search ─────────────────────────────────────────────────────────────

async function searchCUK(query: string, apiKey: string): Promise<SearchContext> {
  try {
    // Expand query with category synonyms
    const expansions = expandQueryForSearch(query);
    const expandedQuery = expansions.length > 0 ? `${query} ${expansions.join(" ")}` : query;

    // Phase 1: Parallel web + PDF search
    const [webResults, pdfResults] = await Promise.all([
      firecrawlSearch(apiKey, `site:cukashmir.ac.in ${expandedQuery}`, 8),
      firecrawlSearch(apiKey, `site:cukashmir.ac.in filetype:pdf ${query}`, 5),
    ]);

    let allResults: FirecrawlSearchResult[] = [...webResults, ...pdfResults];

    // Phase 2: Category-aware fallback — trigger when results are sparse OR
    // when the query expects a PDF but none were found in phase 1.
    const hasPdfInResults = allResults.some((r) => isPdfUrl(r.url || ""));
    const needsFallback = allResults.length < 3 || (expectsPdf(query) && !hasPdfInResults);

    if (needsFallback) {
      console.log("Triggering deep fallback. sparse=", allResults.length < 3, " missingPdf=", expectsPdf(query) && !hasPdfInResults);
      const categories = getFallbackCategories(query);
      const fallbackUrls = new Set<string>();
      for (const cat of categories) {
        for (const url of FALLBACK_PAGES[cat] || []) fallbackUrls.add(url);
      }

      const [broadResults, ...indexScrapes] = await Promise.all([
        firecrawlSearch(apiKey, `cukashmir.ac.in ${query}`, 5),
        ...[...fallbackUrls].slice(0, 4).map((url) => firecrawlScrape(apiKey, url)),
      ]);
      allResults.push(...broadResults);

      // Phase 3: One-level-deeper hop. From each scraped index page, pick the
      // most promising sub-links (PDFs and category-relevant pages) and scrape them.
      const deepTargets = new Set<string>();
      for (const page of indexScrapes) {
        if (!page?.markdown || !page.url) continue;
        allResults.push(page);
        for (const link of pickDeepLinksFromMarkdown(page.markdown, page.url, query, 3)) {
          deepTargets.add(link);
        }
      }
      // Cap deep hop to keep latency bounded
      const deepUrls = [...deepTargets].slice(0, 5);
      if (deepUrls.length > 0) {
        console.log("Deep hop into", deepUrls.length, "discovered links");
        const deepScrapes = await Promise.all(deepUrls.map((url) => firecrawlScrape(apiKey, url)));
        for (const r of deepScrapes) { if (r) allResults.push(r); }
      }
    }

    if (allResults.length === 0) return { context: "", verifiedSources: [] };

    const verifiedCandidates: VerifiedSource[] = [];
    const contextParts: string[] = [];
    let idx = 0;

    for (const r of allResults) {
      const title = r.title || "Untitled";
      const url = normalizeUrl(r.url) || "";
      const content = r.markdown ? r.markdown.slice(0, 4000) : r.description || "";
      const isPdf = isPdfUrl(url || "");

      if (url) {
        verifiedCandidates.push({ title: cleanTitle(title, url), url, content, isPdf, score: scoreSource(query, { title, url, content, isPdf }) });
      }
      if (url && content) {
        verifiedCandidates.push(...extractMarkdownLinks(content, url, title, query));
      }

      idx++;
      contextParts.push(`[${idx}]\nTitle: ${title}\nURL: ${url}\nCategory: ${isPdf ? "pdf" : "web"}\nContent:\n${content}`);
    }

    const rankedSources = dedupeAndRankSources(verifiedCandidates, 10);
    const verifiedSources = await filterWorkingSources(rankedSources, 6);

    let context = "\n\n--- LIVE DATA FROM CUK WEBSITE ---\n" + contextParts.join("\n\n");

    if (verifiedSources.length > 0) {
      context += "\n\n--- VERIFIED SOURCE CATALOG ---\n";
      for (const s of verifiedSources) {
        context += `- ${s.title}${s.isPdf ? " (PDF)" : ""}: ${s.url}\n`;
      }
    }

    context += "\n--- END OF SCRAPED DATA ---\n";
    context += "\nIMPORTANT: Use the above data to answer. If a VERIFIED SOURCE CATALOG is present, rely on it for external links. Never mention a source title unless it exists in the data above.";

    return { context, verifiedSources };
  } catch (e) {
    console.error("CUK search error:", e);
    return { context: "", verifiedSources: [] };
  }
}

// ─── University query detection ──────────────────────────────────────────────

function isUniversityQuery(message: string): boolean {
  const lower = message.toLowerCase();
  const allKeywords = new Set<string>();
  for (const synonyms of Object.values(CATEGORY_SYNONYMS)) {
    for (const s of synonyms) allKeywords.add(s);
  }
  // Add extra keywords
  for (const k of [
    "cuk", "central university", "kashmir", "university", "chancellor", "vice chancellor",
    "phd", "mba", "mca", "btech", "bsc", "msc", "semester", "nss", "ncc", "sports",
    "convocation", "holiday", "academic calendar", "anti ragging", "rti", "grievance",
    "handbook", "rule", "policy", "who is", "what is", "tell me about", "how to apply",
    "cutoff", "merit", "annual report", "minutes", "pdf", "document",
  ]) allKeywords.add(k);

  return [...allKeywords].some((k) => lower.includes(k));
}

// ─── Serve ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lastUserMessage = [...messages].reverse().find((m: ChatMessage) => m.role === "user");
    let cukContext = "";
    let verifiedSources: VerifiedSource[] = [];
    let followUpSuggestions: string[] = [];

    if (lastUserMessage) {
      const userText = lastUserMessage.content || "";
      const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");

      // Rewrite follow-up queries using conversation history
      const searchQuery = rewriteQuery(userText, messages.slice(0, -1));
      if (searchQuery !== userText) {
        console.log("Rewritten query:", searchQuery);
      }

      if (FIRECRAWL_KEY && isUniversityQuery(searchQuery)) {
        console.log("Searching CUK website for:", searchQuery);
        const searchResult = await searchCUK(searchQuery, FIRECRAWL_KEY);
        cukContext = searchResult.context;
        verifiedSources = searchResult.verifiedSources;
      }

      followUpSuggestions = getFollowUpSuggestions(userText);
    }

    const systemMessage = cukContext ? SYSTEM_PROMPT + cukContext : SYSTEM_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemMessage }, ...messages],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service credits exhausted. Please contact admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const completion = await response.json();
    const aiContent = completion?.choices?.[0]?.message?.content;

    if (!aiContent || typeof aiContent !== "string") {
      return new Response(JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cleanContent = stripSourcesSection(aiContent);
    const fallbackSources = verifiedSources.length > 0
      ? verifiedSources
      : (lastUserMessage && isUniversityQuery(lastUserMessage.content || ""))
        ? [{ title: "Central University of Kashmir", url: "https://www.cukashmir.ac.in", content: "", isPdf: false, score: 0 }]
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
        follow_up_suggestions: followUpSuggestions,
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
