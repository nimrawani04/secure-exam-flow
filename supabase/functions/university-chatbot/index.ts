/**
 * university-chatbot — deep-crawl + static-knowledge edition
 *
 * Key improvements over v2:
 * - Embedded CUK static knowledge (contacts, departments, key URLs)
 *   so common queries ALWAYS answer even if scraping fails
 * - Scraping retry: if content is empty, re-scrape without onlyMainContent
 * - waitFor bumped to 2000 ms for JS-rendered pages
 * - Smarter fallback chain: static → scrape → honest "not found"
 *
 * Required Supabase secrets:
 *   ANTHROPIC_API_KEY   — console.anthropic.com
 *   FIRECRAWL_API_KEY   — firecrawl.dev (existing key)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };
type FcResult   = { title?: string; url?: string; markdown?: string; html?: string; description?: string };
type Source     = { title: string; url: string; isPdf: boolean; score: number };

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { context: string; sources: Source[]; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000;
const CACHE_MAX = 120;

function cacheGet(key: string) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e;
}

function cacheSet(key: string, value: { context: string; sources: Source[] }) {
  if (cache.size >= CACHE_MAX) {
    let oldest = { key: "", ts: Infinity };
    for (const [k, v] of cache) if (v.ts < oldest.ts) oldest = { key: k, ts: v.ts };
    cache.delete(oldest.key);
  }
  cache.set(key, { ...value, ts: Date.now() });
}

// ─── Static CUK knowledge (always available, never needs scraping) ─────────────
//
// This is embedded directly in every prompt so the bot ALWAYS has baseline
// answers for the most common queries — even if Firecrawl is down or the page
// is JavaScript-rendered and returns empty content.

const CUK_STATIC_KNOWLEDGE = `
=== CENTRAL UNIVERSITY OF KASHMIR — STATIC KNOWLEDGE BASE ===
(Use this when live scrape data is unavailable or insufficient)

OFFICIAL WEBSITE: https://www.cukashmir.ac.in
SAMARTH PORTAL:   https://cukashmir.samarth.edu.in

── GENERAL CONTACTS ─────────────────────────────────────────
Main Office:    0194-2723001 / 2723002
Email:          info@cukashmir.ac.in
Fax:            0194-2723009
Address:        Nowgam Bye-pass, Near Puhroo Crossing, Nowgam, Srinagar — 190 015, J&K

── KEY ADMINISTRATIVE OFFICERS ──────────────────────────────
Vice-Chancellor:      Office — vc@cukashmir.ac.in
Registrar:            registrar@cukashmir.ac.in  |  0194-2723003
Finance Officer:      fo@cukashmir.ac.in
Controller of Examinations:  coe@cukashmir.ac.in  |  0194-2723006
Dean, Academic Affairs:      daa@cukashmir.ac.in
Dean, Student Welfare:       dsw@cukashmir.ac.in

── SCHOOLS & DEPARTMENTS (with contact emails) ──────────────
School of Education:              soe@cukashmir.ac.in
School of Social Sciences:        soss@cukashmir.ac.in
School of Languages:              sol@cukashmir.ac.in
School of Sciences:               sos@cukashmir.ac.in
School of Technology:             sot@cukashmir.ac.in
School of Legal Studies:          sls@cukashmir.ac.in
School of Commerce & Mgmt Sci:    scms@cukashmir.ac.in
School of Visual Arts & Performing Arts: svapa@cukashmir.ac.in

── EXAM CELL ────────────────────────────────────────────────
Controller of Examinations:  coe@cukashmir.ac.in  |  0194-2723006
Exam Cell notices:           https://www.cukashmir.ac.in/examination.aspx

── ADMISSIONS ───────────────────────────────────────────────
Admissions office:    admissions@cukashmir.ac.in  |  0194-2723004
Admission portal:     https://cuet.samarth.ac.in
Prospectus:           https://www.cukashmir.ac.in/prospectus.aspx
Admission notices:    https://www.cukashmir.ac.in/admissions.aspx
Eligibility / CUET:   Common University Entrance Test (CUET) scores are mandatory for most UG/PG programmes.
Academic calendar:    https://www.cukashmir.ac.in/academiccalendar.aspx

── IMPORTANT PAGES ──────────────────────────────────────────
Notices / Circulars:  https://www.cukashmir.ac.in/displayevents.aspx
Results:              https://www.cukashmir.ac.in/results.aspx
Datesheet:            https://www.cukashmir.ac.in/examination.aspx
Syllabus:             https://www.cukashmir.ac.in/departments.aspx (choose dept → syllabus)
Scholarship:          https://www.cukashmir.ac.in/scholarships.aspx
Recruitment:          https://www.cukashmir.ac.in/recruitment.aspx
Tenders:              https://www.cukashmir.ac.in/tenders.aspx
Downloads / Forms:    https://www.cukashmir.ac.in/downloads.aspx
RTI:                  https://www.cukashmir.ac.in/rti.aspx
Anti-Ragging:         https://www.cukashmir.ac.in/antiragging.aspx
Grievance Redressal:  https://www.cukashmir.ac.in/grievance.aspx
Library:              https://www.cukashmir.ac.in/library.aspx
Hostel:               https://www.cukashmir.ac.in/hostel.aspx
IQAC:                 https://www.cukashmir.ac.in/iqac.aspx
NSS/NCC:              https://www.cukashmir.ac.in/nss.aspx

── FEE STRUCTURE ────────────────────────────────────────────
For current fee structure visit: https://www.cukashmir.ac.in/feestructure.aspx
General enquiry: admissions@cukashmir.ac.in

=== END STATIC KNOWLEDGE BASE ===
`;

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the official AI assistant for the Central University of Kashmir (CUK), embedded in a Confidential Exam Paper Management System.

Rules:
- ALWAYS answer from the static knowledge base below AND any live scrape data provided.
- Cite live sources as [1], [2] etc. Use the static knowledge base without citation numbers.
- NEVER say "I don't have that information" for questions covered by the static knowledge base — the contacts, emails, and URLs are already embedded in your context.
- Never invent contact details, deadlines, fees, or policies beyond what is provided.
- For app features use markdown links: [Upload Paper](/upload), [Submissions](/submissions), [Review](/review), [Calendar](/calendar), [Settings](/settings).
- Be concise — 2-4 sentences then bullets for lists/steps.
- Give direct links, never say "visit the website."
- When a VERIFIED SOURCE CATALOG is present, do not output a Sources section — the system appends it.

Exam Paper System Help (answer instantly, no web search needed):
- Teachers: upload at [Upload Paper](/upload), track at [Submissions](/submissions), deadlines at [Calendar](/calendar)
- HODs: review at [Review](/review), sessions at [HOD Sessions](/hod-sessions)
- Exam Cell: datesheets at [Datesheet Management](/datesheet), inbox at [Approved Papers](/approved-papers)
- Admin: users/departments/logs at [Dashboard](/dashboard)

${CUK_STATIC_KNOWLEDGE}`;

// ─── Follow-ups ───────────────────────────────────────────────────────────────

const FOLLOW_UPS: Record<string, string[]> = {
  admissions:   ["What documents are needed for admission?", "What is the eligibility criteria?", "Where is the official admission notice?"],
  examinations: ["Where can I check the latest exam notice?", "What are the confirmed exam dates?", "How do I get my admit card?"],
  contact:      ["Which office handles this?", "Do you have the official email or phone?"],
  results:      ["How do I apply for revaluation?", "Where can I download the marksheet?"],
  general:      ["Can you summarise the key points?", "Show me the official sources for this."],
};

function detectCategory(q: string): string {
  const l = q.toLowerCase();
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

// ─── Query classification ─────────────────────────────────────────────────────

const CUK_KW = new Set([
  "cuk","central university","kashmir","admission","exam","examination","result","syllabus",
  "faculty","department","school","fee","fees","notice","scholarship","recruitment","tender",
  "hostel","placement","contact","download","about","chancellor","registrar","professor",
  "teacher","datesheet","date sheet","timetable","prospectus","eligibility","cuet","phd",
  "mba","mca","btech","bsc","msc","semester","ordinance","regulation","circular",
  "announcement","merit list","selection list","revaluation","transcript","hall ticket",
  "admit card","backlog","supplementary","library","nss","ncc","convocation","rti",
  "grievance","anti ragging","academic calendar","annual report","departments",
]);

function isUniversityQuery(text: string): boolean {
  const l = text.toLowerCase();
  return [...CUK_KW].some(k => l.includes(k));
}

const APP_ONLY = /\b(upload|submission|review|calendar|datesheet management|approved paper|hod dashboard|exam cell|teacher dashboard|settings|profile)\b/i;
function isAppNavOnly(text: string): boolean {
  return APP_ONLY.test(text) && !/cuk|university|kashmir|admission|result|notice/i.test(text);
}

// ─── Query rewriting ──────────────────────────────────────────────────────────

const REF_RE    = /\b(he|she|his|her|him|they|them|their)\b/i;
const CTX_RE    = /\b(it|its|this|that|these|those|there|same|above|below)\b/i;
const FUP_RE    = /^\s*(and|also|what about|how about|then|now)\b/i;
const AMB_RE    = /\b(form|list|names?|candidates?|selected|eligible|date|time|venue|link|details?)\b/i;
const SPC_RE    = /\b(phd|department|school|admission|exam|contact|email|phone|result|datesheet|notice)\b/i;
const PERSON_RE = /\b(?:Prof\.?|Professor|Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g;
const NON_PERSON= new Set(["central university","school of","department of","associate professor","assistant professor","professor","dean","director"]);

function needsRewrite(q: string): boolean {
  return REF_RE.test(q) || CTX_RE.test(q) || FUP_RE.test(q) || (AMB_RE.test(q) && !SPC_RE.test(q));
}

function rewriteQuery(query: string, history: ChatMessage[]): string {
  if (!history.length || !needsRewrite(query)) return query;
  let rw = query;
  for (let i = history.length - 1; i >= Math.max(0, history.length - 6); i--) {
    const titled = history[i].content.match(PERSON_RE);
    if (titled) {
      const p = titled[titled.length - 1].trim();
      if (![...NON_PERSON].some(np => p.toLowerCase().includes(np))) {
        rw = rw.replace(/\bhis\b/gi, `${p}'s`).replace(/\bher\b/gi, `${p}'s`)
               .replace(/\bhim\b/gi, p).replace(/\bhe\b/gi, p).replace(/\bshe\b/gi, p);
        break;
      }
    }
  }
  if ((CTX_RE.test(rw) || AMB_RE.test(rw) || FUP_RE.test(rw)) && !SPC_RE.test(rw)) {
    for (let i = history.length - 1; i >= Math.max(0, history.length - 4); i--) {
      if (SPC_RE.test(history[i].content)) {
        const topic = history[i].content.slice(0, 180).trim();
        if (!rw.toLowerCase().includes(topic.toLowerCase().slice(0, 30)))
          rw = `${rw.replace(/[?\s]+$/, "")}; context: ${topic}`;
        break;
      }
    }
  }
  return rw;
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

const ALLOWED_HOSTS = [
  "cukashmir.ac.in","www.cukashmir.ac.in",
  "cukashmir.samarth.edu.in","cuet.samarth.ac.in","results.cukashmir.in",
];

function isAllowed(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return ALLOWED_HOSTS.some(a => h === a || h.endsWith(`.${a}`));
  } catch { return false; }
}

function isPdf(url: string): boolean { return /\.pdf(?:$|[?#])/i.test(url); }

function normalizeUrl(raw?: string, base?: string): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/^<|>$/g, "");
  if (!t || t.startsWith("javascript:") || t.startsWith("mailto:")) return null;
  try {
    const u = base ? new URL(t, base) : new URL(t);
    if (!["http:","https:"].includes(u.protocol)) return null;
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch { return null; }
}

const TRACKING = /^(utm_|fbclid$|gclid$|mc_eid$|mc_cid$|ref$)/i;
function dedupKey(url: string): string {
  try {
    const u  = new URL(url);
    u.hash   = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const keep: [string,string][] = [];
    for (const [k,v] of u.searchParams) if (!TRACKING.test(k)) keep.push([k.toLowerCase(),v]);
    keep.sort(([a],[b]) => a.localeCompare(b));
    u.search = "";
    for (const [k,v] of keep) u.searchParams.append(k,v);
    const path = (u.pathname.replace(/\/+$/,"") || "/").toLowerCase();
    return `${u.protocol}//${u.hostname}${path}${u.search}`;
  } catch { return url.toLowerCase(); }
}

const NOISE_TITLE = /^(click here|read more|download(?: pdf)?|view|open|here|details|link|pdf|notice|attachment|file|more|→|>>|»|new)$/i;
const DATE_ONLY   = /^[\d\s/.\-,:()]+$/;
const STOPWORDS   = new Set(["about","after","all","and","any","are","can","cuk","for","from","how","latest","more","not","official","the","their","this","university","what","when","where","with","you"]);

function cleanTitle(title: string|undefined, url: string): string {
  let t = (title||"")
    .replace(/&nbsp;|&amp;|&#\d+;/g," ").replace(/<[^>]+>/g," ").replace(/[*_`>#]/g," ")
    .replace(/\s*\(\s*pdf\s*\)\s*$/i,"").replace(/\s+/g," ").trim();
  if (!t || NOISE_TITLE.test(t) || DATE_ONLY.test(t) || t.length < 4) {
    try {
      const parts = new URL(url).pathname.split("/").filter(Boolean);
      const last  = parts.pop() || "Source";
      t = decodeURIComponent(last).replace(/\.[a-z0-9]+$/i,"").replace(/[-_+]+/g," ").trim() || "Source";
    } catch { t = "Source"; }
  }
  return t.length > 120 ? t.slice(0,117)+"…" : t;
}

function tokenize(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOPWORDS.has(t)))];
}

function scoreUrl(query: string, url: string, title="", content=""): number {
  const hay = `${title} ${url} ${content}`.toLowerCase();
  const ql  = query.toLowerCase();
  let score = 0;
  for (const t of tokenize(query)) if (hay.includes(t)) score += 4;
  if (isPdf(url)) score += ql.includes("pdf") ? 8 : 4;
  if (/notice|notification|circular/.test(hay) && /notice|notification|circular/.test(ql)) score += 6;
  if (/result/.test(hay)  && /result/.test(ql))  score += 6;
  if (/syllabus|curriculum/.test(hay) && /syllabus|curriculum/.test(ql)) score += 6;
  if (/datesheet|date sheet|timetable/.test(hay) && /datesheet|date sheet|timetable/.test(ql)) score += 6;
  if (/admission|eligibility/.test(hay) && /admission|eligibility/.test(ql)) score += 6;
  if (/recruitment|vacancy/.test(hay) && /recruitment|vacancy/.test(ql)) score += 6;
  if (/scholarship|fellowship/.test(hay) && /scholarship|fellowship/.test(ql)) score += 5;
  if (/contactus|gallery|home\.aspx|index\.aspx|sitemap/.test(url)) score -= 4;
  return score;
}

// ─── Fallback pages per topic ─────────────────────────────────────────────────

const FALLBACK: Record<string, string[]> = {
  notice:      ["https://www.cukashmir.ac.in/displayevents.aspx","https://www.cukashmir.ac.in/notices.aspx"],
  datesheet:   ["https://www.cukashmir.ac.in/examination.aspx","https://www.cukashmir.ac.in/examnotices.aspx"],
  result:      ["https://www.cukashmir.ac.in/examination.aspx","https://www.cukashmir.ac.in/results.aspx"],
  syllabus:    ["https://www.cukashmir.ac.in/departments.aspx","https://www.cukashmir.ac.in/academics.aspx"],
  admission:   ["https://www.cukashmir.ac.in/admissions.aspx","https://cuet.samarth.ac.in"],
  examination: ["https://www.cukashmir.ac.in/examination.aspx"],
  recruitment: ["https://www.cukashmir.ac.in/recruitment.aspx"],
  tender:      ["https://www.cukashmir.ac.in/tenders.aspx"],
  scholarship: ["https://www.cukashmir.ac.in/scholarships.aspx"],
  fees:        ["https://www.cukashmir.ac.in/feestructure.aspx"],
  faculty:     ["https://www.cukashmir.ac.in/faculty.aspx","https://www.cukashmir.ac.in/departments.aspx"],
  contact:     ["https://www.cukashmir.ac.in/contactus.aspx","https://www.cukashmir.ac.in/directory.aspx"],
  download:    ["https://www.cukashmir.ac.in/downloads.aspx"],
};

function getFallbackUrls(query: string): string[] {
  const l = query.toLowerCase();
  const urls: string[] = [];
  if (/notice|notification|circular|announcement/.test(l)) urls.push(...(FALLBACK.notice||[]));
  if (/datesheet|date sheet|backlog|timetable|hall ticket|admit card/.test(l)) urls.push(...(FALLBACK.datesheet||[]));
  if (/result|grade|marks|transcript|revaluation/.test(l)) urls.push(...(FALLBACK.result||[]));
  if (/syllabus|syllabi|curriculum|course|ordinance/.test(l)) urls.push(...(FALLBACK.syllabus||[]));
  if (/admission|eligibility|apply|cuet|prospectus|merit list/.test(l)) urls.push(...(FALLBACK.admission||[]));
  if (/exam|examination|supplementary|reappear/.test(l)) urls.push(...(FALLBACK.examination||[]));
  if (/recruitment|vacancy|job|career|walk[- ]?in/.test(l)) urls.push(...(FALLBACK.recruitment||[]));
  if (/tender|quotation|bid/.test(l)) urls.push(...(FALLBACK.tender||[]));
  if (/scholarship|fellowship|stipend/.test(l)) urls.push(...(FALLBACK.scholarship||[]));
  if (/fee|fees|tuition|challan|payment/.test(l)) urls.push(...(FALLBACK.fees||[]));
  if (/faculty|teacher|professor/.test(l)) urls.push(...(FALLBACK.faculty||[]));
  if (/contact|email|phone|directory|department/.test(l)) urls.push(...(FALLBACK.contact||[]));
  if (/download|form|brochure/.test(l)) urls.push(...(FALLBACK.download||[]));
  return [...new Set(urls)];
}

// ─── Pagination helpers ───────────────────────────────────────────────────────

const PAGE_PARAMS = ["page","pg","pageindex","pageno","p","pagenumber","start"];

function buildPaginationUrls(baseUrl: string, maxPages = 3): string[] {
  const extra: string[] = [];
  try {
    const u = new URL(baseUrl);
    for (const param of PAGE_PARAMS) {
      const existing = u.searchParams.get(param);
      if (existing !== null) {
        const current = parseInt(existing, 10);
        if (!isNaN(current)) {
          for (let p = current+1; p <= current+maxPages; p++) {
            const nu = new URL(baseUrl); nu.searchParams.set(param, String(p)); extra.push(nu.toString());
          }
          return extra;
        }
      }
    }
    for (const param of ["page","pg","pageindex"]) {
      for (let p = 2; p <= 2+maxPages-1; p++) {
        const nu = new URL(baseUrl); nu.searchParams.set(param, String(p)); extra.push(nu.toString());
      }
    }
  } catch { /* invalid URL */ }
  return extra;
}

function findPaginationLinks(markdown: string, baseUrl: string): string[] {
  const found = new Set<string>();
  for (const m of markdown.matchAll(/\[([^\]]{1,20})\]\(([^)]+)\)/g)) {
    const label = m[1].trim();
    const href  = m[2].trim();
    if (!/^(\d{1,3}|next|»|>|→|more)$/i.test(label)) continue;
    const url = normalizeUrl(href, baseUrl);
    if (url && isAllowed(url) && url !== baseUrl) found.add(url);
  }
  for (const m of markdown.matchAll(/https?:\/\/[^\s)"'<>]+/g)) {
    const url = normalizeUrl(m[0]);
    if (!url || !isAllowed(url)) continue;
    if (PAGE_PARAMS.some(p => url.includes(`${p}=`)) && url !== baseUrl) found.add(url);
  }
  return [...found];
}

function findPdfUrls(markdown: string, html: string, baseUrl: string): string[] {
  const found = new Set<string>();
  const add = (raw: string) => { const u = normalizeUrl(raw, baseUrl); if (u && isAllowed(u) && isPdf(u)) found.add(u); };
  for (const m of markdown.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) if (/\.pdf/i.test(m[2])) add(m[2]);
  for (const m of markdown.matchAll(/https?:\/\/[^\s)"'<>]+\.pdf(?:[?#][^\s)"'<>]*)?/gi)) add(m[0]);
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+\.pdf[^"']*)/gi)) add(m[1]);
  for (const m of html.matchAll(/(?:src|data-href|data-url)\s*=\s*["']([^"']+\.pdf[^"']*)/gi)) add(m[1]);
  return [...found];
}

// ─── Firecrawl wrappers ───────────────────────────────────────────────────────

async function fcSearch(apiKey: string, query: string, limit = 6): Promise<FcResult[]> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : [];
  } catch { return []; }
}

async function fcMap(apiKey: string, baseUrl: string, search: string, limit = 40): Promise<string[]> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: baseUrl, search, limit, includeSubdomains: false }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.links) ? d.links : [];
  } catch { return []; }
}

/**
 * Scrape a single URL.
 * - For JS-rendered pages (ASP.NET): waitFor 2000ms, try onlyMainContent first,
 *   then retry with full content if result is empty.
 * - For PDFs: get everything, no wait needed.
 */
async function fcScrape(apiKey: string, url: string): Promise<FcResult | null> {
  const pdf = isPdf(url);

  const attempt = async (onlyMain: boolean): Promise<FcResult | null> => {
    try {
      const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          formats: ["markdown", "html"],
          onlyMainContent: onlyMain,
          waitFor: pdf ? 0 : 2000,
        }),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return {
        title:    d.data?.metadata?.title,
        url:      d.data?.metadata?.sourceURL || url,
        markdown: d.data?.markdown || "",
        html:     d.data?.html     || "",
      };
    } catch { return null; }
  };

  const result = await attempt(true);

  if (!pdf && result && (result.markdown || "").trim().length < 200) {
    console.log(`Retrying ${url} with full content (first attempt was ${(result.markdown||"").length} chars)`);
    const retry = await attempt(false);
    if (retry && (retry.markdown || "").length > (result.markdown || "").length) return retry;
  }

  return result;
}

async function batchScrape(apiKey: string, urls: string[], concurrency = 6): Promise<FcResult[]> {
  const results: FcResult[] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch   = urls.slice(i, i + concurrency);
    const scraped = await Promise.all(batch.map(u => fcScrape(apiKey, u)));
    results.push(...scraped.filter((r): r is FcResult => !!r));
  }
  return results;
}

function formatSources(sources: Source[]): string {
  return `**Sources:**\n${sources.map(s => `- [${s.title.replace(/[\[\]]/g,"")}](${s.url})`).join("\n")}`;
}

// ─── Deep search ──────────────────────────────────────────────────────────────

async function deepSearch(query: string, apiKey: string): Promise<{ context: string; sources: Source[] }> {
  console.log("deepSearch:", query);

  const [mapUrls, searchResults] = await Promise.all([
    fcMap(apiKey, "https://www.cukashmir.ac.in", query, 40),
    fcSearch(apiKey, `site:cukashmir.ac.in ${query}`, 6),
  ]);

  console.log(`Map: ${mapUrls.length} URLs, Search: ${searchResults.length} results`);

  const fallbackUrls = getFallbackUrls(query);
  const allCandidates = new Set<string>([
    ...mapUrls.filter(u => isAllowed(u)),
    ...searchResults.map(r => r.url||"").filter(u => isAllowed(u)),
    ...fallbackUrls,
  ]);

  const toScrape = [...allCandidates]
    .map(url => ({ url, score: scoreUrl(query, url) }))
    .sort((a,b) => b.score - a.score)
    .map(s => s.url)
    .slice(0, 10);

  const snippetMap = new Map<string, FcResult>();
  for (const r of searchResults) { const u = normalizeUrl(r.url); if (u) snippetMap.set(u, r); }

  const toActuallyScrape = toScrape.filter(u => {
    const existing = snippetMap.get(u);
    return !existing || (existing.markdown || "").length < 200;
  });

  const scraped1 = await batchScrape(apiKey, toActuallyScrape, 6);

  const allScraped = new Map<string, FcResult>();
  for (const r of searchResults) { const u = normalizeUrl(r.url); if (u) allScraped.set(u, r); }
  for (const r of scraped1)      { const u = normalizeUrl(r.url); if (u) allScraped.set(u, r); }

  const paginationUrls = new Set<string>();
  const pdfUrls        = new Set<string>();

  for (const [pageUrl, page] of allScraped) {
    const md   = page.markdown || "";
    const html = page.html     || "";
    for (const u of [...findPaginationLinks(md, pageUrl), ...buildPaginationUrls(pageUrl, 3)]) {
      if (isAllowed(u) && u !== pageUrl && !allScraped.has(u)) paginationUrls.add(u);
    }
    for (const u of findPdfUrls(md, html, pageUrl)) {
      if (!allScraped.has(u)) pdfUrls.add(u);
    }
  }

  console.log(`Pagination: ${paginationUrls.size}, PDFs: ${pdfUrls.size}`);

  const topPagination = [...paginationUrls]
    .map(u => ({ u, s: scoreUrl(query, u) })).sort((a,b) => b.s-a.s)
    .map(x => x.u).slice(0, 6);

  const topPdfs = [...pdfUrls]
    .map(u => ({ u, s: scoreUrl(query, u) })).sort((a,b) => b.s-a.s)
    .map(x => x.u).slice(0, 4);

  const phase3 = [...new Set([...topPagination, ...topPdfs])];
  if (phase3.length > 0) {
    const scraped3 = await batchScrape(apiKey, phase3, 6);
    for (const r of scraped3) { const u = normalizeUrl(r.url); if (u) allScraped.set(u, r); }
  }

  const contextParts: string[] = [];
  const candidates:  Source[]  = [];
  let idx = 0;

  const sortedPages = [...allScraped.entries()]
    .map(([url, page]) => ({
      url, page,
      score: scoreUrl(query, url, page.title||"", (page.markdown||"").slice(0,500)),
      isPdfPage: isPdf(url),
    }))
    .sort((a,b) => Number(b.isPdfPage)-Number(a.isPdfPage) || b.score-a.score);

  for (const { url, page, isPdfPage } of sortedPages) {
    const title   = page.title || "CUK";
    const content = (page.markdown || page.description || "").slice(0, isPdfPage ? 8000 : 3500);
    if (!content.trim()) continue;
    idx++;
    contextParts.push(`[${idx}] ${title}\nURL: ${url}\nType: ${isPdfPage ? "PDF" : "webpage"}\n${content}`);

    if (isAllowed(url)) {
      candidates.push({ title: cleanTitle(title, url), url, isPdf: isPdfPage, score: scoreUrl(query, url, title, content) });
    }
    for (const m of (page.markdown||"").matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      const u2 = normalizeUrl(m[2], url);
      if (u2 && isAllowed(u2))
        candidates.push({ title: cleanTitle(m[1], u2), url: u2, isPdf: isPdf(u2), score: scoreUrl(query, u2) });
    }
  }

  const deduped = new Map<string, Source>();
  for (const s of candidates) {
    const k = dedupKey(s.url); const ex = deduped.get(k);
    if (!ex || s.score > ex.score) deduped.set(k, s);
  }
  const sources = [...deduped.values()]
    .sort((a,b) => Number(b.isPdf)-Number(a.isPdf) || b.score-a.score)
    .slice(0, 6);

  let context = "";
  if (contextParts.length > 0) {
    context = "\n\n--- LIVE DATA FROM CUK WEBSITE ---\n" + contextParts.join("\n\n");
    if (sources.length > 0) {
      context += "\n\n--- VERIFIED SOURCE CATALOG ---\n" +
        sources.map(s => `- ${s.title}${s.isPdf?" (PDF)":""}: ${s.url}`).join("\n");
    }
    context += "\n--- END ---\nUse above to supplement the static knowledge base. Cite live sources as [1],[2] etc.";
  }

  console.log(`Context: ${contextParts.length} pages, ${sources.length} sources`);
  return { context, sources };
}

// ─── Serve ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages } = await req.json() as { messages: ChatMessage[] };
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "messages required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const lastUser    = [...messages].reverse().find(m => m.role === "user");
    const rawQuery    = lastUser?.content || "";
    const searchQuery = rewriteQuery(rawQuery, messages.slice(0, -1));

    let context = "";
    let sources: Source[] = [];

    if (FIRECRAWL_KEY && isUniversityQuery(searchQuery) && !isAppNavOnly(rawQuery)) {
      const cacheKey = searchQuery.toLowerCase().trim().slice(0, 200);
      const cached   = cacheGet(cacheKey);
      if (cached) {
        context = cached.context;
        sources = cached.sources;
        console.log("Cache hit");
      } else {
        try {
          const result = await deepSearch(searchQuery, FIRECRAWL_KEY);
          context = result.context;
          sources = result.sources;
          if (context) cacheSet(cacheKey, { context, sources });
        } catch (e) {
          console.error("deepSearch failed:", e);
        }
      }
    }

    const followUps    = getFollowUps(rawQuery);
    const systemPrompt = SYSTEM_PROMPT + (context || "");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:    "google/gemini-2.5-flash",
        stream:   true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("Gateway error", aiResp.status, errText);
      let msg = `AI gateway error ${aiResp.status}`;
      if (aiResp.status === 429) msg = "Too many requests right now. Please try again in a moment.";
      else if (aiResp.status === 402) msg = "AI usage limit reached. Please add credits to continue.";
      return new Response(JSON.stringify({ error: msg }),
        { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const enc    = new TextEncoder();

    const emit = async (obj: unknown) => {
      await writer.write(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
    };

    (async () => {
      try {
        const reader = aiResp.body!.getReader();
        const dec    = new TextDecoder();
        let buf      = "";
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
                if (sources.length > 0) {
                  await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: `\n\n${formatSources(sources)}` }, finish_reason: null }] });
                }
                await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], follow_up_suggestions: followUps });
                await writer.write(enc.encode("data: [DONE]\n\n"));
              }
              continue;
            }
            try {
              const ev = JSON.parse(json);
              const delta = ev?.choices?.[0]?.delta?.content;
              if (delta) {
                await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] });
              }
            } catch { /* skip malformed */ }
          }
        }

        if (!finished) {
          if (sources.length > 0) {
            await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: `\n\n${formatSources(sources)}` }, finish_reason: null }] });
          }
          await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], follow_up_suggestions: followUps });
          await writer.write(enc.encode("data: [DONE]\n\n"));
        }
      } catch (e) {
        console.error("Stream error:", e);
        await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: "\n\n⚠️ Connection interrupted. Please try again." }, finish_reason: "stop" }], follow_up_suggestions: [] }).catch(()=>{});
        await writer.write(enc.encode("data: [DONE]\n\n")).catch(()=>{});
      } finally {
        await writer.close().catch(()=>{});
      }
    })();


    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });

  } catch (e) {
    console.error("Chatbot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
