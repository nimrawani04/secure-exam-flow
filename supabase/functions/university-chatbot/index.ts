/**
 * university-chatbot — index-backed edition (no live Firecrawl)
 *
 * Replaces the slow live deep-crawl with a Postgres full-text search against
 * `public.cuk_pages`, which is populated by the `crawl-cuk` background
 * function. Responses are 1-2 s instead of 8-25 s and time-outs disappear.
 *
 * Pipeline per request:
 *   1. Authenticate the caller (reject anon — paid Lovable AI calls).
 *   2. Rewrite follow-up queries using conversation history (pronouns etc.).
 *   3. Run `search_cuk_pages` RPC (top 8 matches, tsvector ranked).
 *   4. Build a context block + numbered VERIFIED SOURCE CATALOG.
 *   5. Stream the answer from google/gemini-2.5-flash via Lovable AI Gateway.
 *   6. After [DONE], append the formatted sources + follow-up suggestions.
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
- Answer from the static knowledge base AND the LIVE CUK PAGE INDEX excerpts provided below.
- For admission, eligibility, fees, scholarships, results, datesheet, syllabus, recruitment or contact questions, EVERY factual sentence MUST end with a numeric citation like [1] or [1][2] pointing to an entry in the VERIFIED SOURCE CATALOG.
- The VERIFIED SOURCE CATALOG is always present — use the numbers exactly; do not invent, skip, or renumber.
- NEVER say "I don't have that information" if the static knowledge base or page index covers it.
- Never invent contact details, deadlines, fees, or policies.
- For app features use markdown links: [Upload Paper](/upload), [Submissions](/submissions), [Review](/review), [Calendar](/calendar), [Settings](/settings).
- Be concise — 2-4 sentences then bullets for lists/steps. Use [n] citations inline.
- Give direct links; never say "visit the website."
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

// ─── App-only shortcut ────────────────────────────────────────────────────────

const APP_ONLY = /\b(upload|submission|review|calendar|datesheet management|approved paper|hod dashboard|exam cell|teacher dashboard|settings|profile)\b/i;
function isAppNavOnly(text: string): boolean {
  return APP_ONLY.test(text) && !/cuk|university|kashmir|admission|result|notice/i.test(text);
}

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
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ error: "messages required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) {
      log("error", "chatbot_configuration_error", { request_id: rid, reason: "missing_lovable_api_key", latency_ms: elapsed(startedAt) });
      return new Response(JSON.stringify({ error: "AI not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const rawQuery = lastUser?.content || "";
    const searchQuery = rewriteQuery(rawQuery, messages.slice(0, -1));
    log("info", "chatbot_request_parsed", {
      request_id: rid,
      user_id: userId,
      message_count: messages.length,
      query_length: rawQuery.length,
      rewritten: searchQuery !== rawQuery,
      app_nav_only: isAppNavOnly(rawQuery),
      latency_ms: elapsed(startedAt),
    });

    // ── Postgres full-text search against pre-crawled cuk_pages ──
    const searchStartedAt = nowMs();
    let rows: SearchRow[] = [];
    if (!isAppNavOnly(rawQuery) && searchQuery.trim().length > 1) {
      try {
        const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          { auth: { persistSession: false } });
        const { data, error } = await sb.rpc("search_cuk_pages", {
          _query: searchQuery,
          _limit: 8,
        });
        if (error) {
          log("error", "chatbot_search_complete", {
            request_id: rid,
            user_id: userId,
            ok: false,
            error: error.message,
            hit_count: 0,
            latency_ms: elapsed(searchStartedAt),
          });
        }
        else rows = (data || []) as SearchRow[];
      } catch (e) {
        log("error", "chatbot_search_complete", {
          request_id: rid,
          user_id: userId,
          ok: false,
          error: safeError(e),
          hit_count: 0,
          latency_ms: elapsed(searchStartedAt),
        });
      }
      log("info", "chatbot_search_complete", {
        request_id: rid,
        user_id: userId,
        ok: true,
        hit_count: rows.length,
        pdf_hit_count: rows.filter((r) => r.is_pdf || isPdfUrl(r.url)).length,
        top_rank: rows[0]?.rank ?? null,
        latency_ms: elapsed(searchStartedAt),
      });
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
      return new Response(JSON.stringify({ error: msg }),
        { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const emit = async (obj: unknown) => {
      await writer.write(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
    };

    (async () => {
      let streamedChunks = 0;
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
                streamedChunks += 1;
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
        await emit({ object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: "\n\n⚠️ Connection interrupted. Please try again." }, finish_reason: "stop" }], follow_up_suggestions: [] }).catch(() => {});
        await writer.write(enc.encode("data: [DONE]\n\n")).catch(() => {});
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    log("error", "chatbot_request_error", { request_id: rid, error: safeError(e), total_latency_ms: elapsed(startedAt) });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
