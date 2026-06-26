/**
 * crawl-cuk — resumable BFS crawler for cukashmir.ac.in
 *
 * Pulls every reachable page + PDF on the official CUK site (and a small
 * allow-list of related hosts) into the `public.cuk_pages` table. The BFS
 * frontier lives in `public.crawl_queue` so a single invocation can do as
 * much work as fits in the 150 s edge-function budget; the next invocation
 * resumes where this one stopped.
 *
 * Triggers
 *   - pg_cron POSTs `{ "secret": "<CRAWL_SECRET>" }` every day at 21:30 UTC.
 *   - Manual: same shape, optionally with `{ "force": true }` to re-enqueue
 *     stale pages older than 7 days.
 *
 * Auth: header `x-crawl-secret` OR body `secret` MUST equal CRAWL_SECRET.
 * No user JWT involved (cron has no user).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as cheerio from "https://esm.sh/cheerio@1.0.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-crawl-secret",
};

// ── Config ───────────────────────────────────────────────────────────────────

const ALLOWED_HOSTS = new Set([
  "cukashmir.ac.in",
  "www.cukashmir.ac.in",
]);

const MAX_DEPTH = 4;                 // BFS depth from seed
const MAX_PER_INVOCATION = 80;       // pages per run (stays under CPU budget)
const CONCURRENCY = 5;               // parallel fetches
const SOFT_DEADLINE_MS = 110_000;    // stop pulling new work after this
const PAGE_TIMEOUT_MS = 20_000;      // per-page fetch timeout
const MAX_HTML_BYTES = 2_000_000;    // 2 MB cap per page
const MAX_PDF_BYTES = 15_000_000;    // 15 MB cap per PDF
const MAX_CONTENT_CHARS = 60_000;    // stored body cap (FTS-friendly)
const USER_AGENT =
  "CUK-Confidential-Exam-Bot/1.0 (+https://confidential-exam.lovable.app)";

const SKIP_EXT = /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|mp4|mp3|webm|zip|rar|7z|exe|woff2?|ttf|otf|eot)(?:$|[?#])/i;
const PDF_EXT = /\.pdf(?:$|[?#])/i;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isAllowedHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return [...ALLOWED_HOSTS].some(a => h === a || h.endsWith(`.${a}`));
  } catch { return false; }
}

function normalizeUrl(raw: string, base?: string): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/^<|>$/g, "");
  if (!t || /^(javascript:|mailto:|tel:|#)/i.test(t)) return null;
  try {
    const u = base ? new URL(t, base) : new URL(t);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch { return null; }
}

function cleanWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = PAGE_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) },
      redirect: "follow",
    });
  } finally { clearTimeout(tid); }
}

// ── Per-page processors ──────────────────────────────────────────────────────

type Processed = {
  url: string;
  title: string;
  content: string;
  isPdf: boolean;
  status: number;
  links: string[];
};

async function processHtml(url: string, html: string): Promise<Processed> {
  const $ = cheerio.load(html);
  // strip noisy elements
  $("script, style, noscript, svg, iframe, header nav, footer nav").remove();

  const title =
    cleanWhitespace($("title").first().text()) ||
    cleanWhitespace($("h1").first().text()) ||
    new URL(url).pathname;

  // Collect headings + body text for richer FTS
  const parts: string[] = [];
  $("h1, h2, h3").each((_, el) => parts.push(cleanWhitespace($(el).text())));
  parts.push(cleanWhitespace($("body").text()));
  const content = cleanWhitespace(parts.filter(Boolean).join("\n\n")).slice(0, MAX_CONTENT_CHARS);

  // Extract links
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const u = normalizeUrl(href || "", url);
    if (u && isAllowedHost(u) && !SKIP_EXT.test(u)) links.add(u);
  });
  // Also pick up data-href / data-url
  $("[data-href], [data-url]").each((_, el) => {
    const href = $(el).attr("data-href") || $(el).attr("data-url");
    const u = normalizeUrl(href || "", url);
    if (u && isAllowedHost(u) && !SKIP_EXT.test(u)) links.add(u);
  });

  return { url, title, content, isPdf: false, status: 200, links: [...links] };
}

async function processPdf(url: string, bytes: Uint8Array): Promise<Processed> {
  let content = "";
  let title = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const r = await extractText(pdf, { mergePages: true });
    content = cleanWhitespace(Array.isArray(r.text) ? r.text.join("\n") : (r.text || "")).slice(0, MAX_CONTENT_CHARS);
  } catch (e) {
    console.warn("pdf parse failed", url, (e as Error).message);
  }
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    title = decodeURIComponent(parts.pop() || "").replace(/\.pdf$/i, "").replace(/[-_+]+/g, " ").trim()
      || "PDF document";
  } catch { title = "PDF document"; }
  return { url, title, content, isPdf: true, status: 200, links: [] };
}

async function fetchAndProcess(url: string): Promise<Processed | null> {
  try {
    // HEAD first to detect content type cheaply
    let resp = await fetchWithTimeout(url, { method: "GET" });
    if (!resp.ok) {
      return { url, title: "", content: "", isPdf: false, status: resp.status, links: [] };
    }
    const ctype = (resp.headers.get("content-type") || "").toLowerCase();
    const isPdf = ctype.includes("application/pdf") || PDF_EXT.test(url);

    if (isPdf) {
      const buf = await resp.arrayBuffer();
      if (buf.byteLength > MAX_PDF_BYTES) {
        return { url, title: "", content: "", isPdf: true, status: 200, links: [] };
      }
      return await processPdf(url, new Uint8Array(buf));
    }

    if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
      return null; // skip non-html non-pdf
    }
    const text = await resp.text();
    if (text.length > MAX_HTML_BYTES) {
      return await processHtml(url, text.slice(0, MAX_HTML_BYTES));
    }
    return await processHtml(url, text);
  } catch (e) {
    console.warn("fetch failed", url, (e as Error).message);
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const secretIn = req.headers.get("x-crawl-secret") || body?.secret || "";
    const SECRET = Deno.env.get("CRAWL_SECRET");
    if (!SECRET || secretIn !== SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // If `force`, re-enqueue any page not crawled in the last 7 days.
    if (body?.force) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: stale } = await sb
        .from("cuk_pages")
        .select("url")
        .lt("last_crawled_at", cutoff)
        .limit(500);
      if (stale && stale.length) {
        const rows = stale.map((r: { url: string }) => ({ url: r.url, depth: 0, status: "pending" }));
        await sb.from("crawl_queue").upsert(rows, { onConflict: "url" });
      }
    }

    let totalProcessed = 0;
    let totalDiscovered = 0;
    let totalFailed = 0;

    // Drain the queue in batches until budget exhausted
    while (Date.now() - t0 < SOFT_DEADLINE_MS && totalProcessed < MAX_PER_INVOCATION) {
      const remaining = MAX_PER_INVOCATION - totalProcessed;
      const batchSize = Math.min(CONCURRENCY * 2, remaining);

      const { data: claimed, error: claimErr } = await sb
        .from("crawl_queue")
        .select("id, url, depth, attempts")
        .eq("status", "pending")
        .order("enqueued_at", { ascending: true })
        .limit(batchSize);
      if (claimErr) throw claimErr;
      if (!claimed || claimed.length === 0) break;

      // Mark as processing so a concurrent run does not double-fetch
      const ids = claimed.map((r) => r.id);
      await sb.from("crawl_queue").update({ status: "processing" }).in("id", ids);

      // Process with bounded concurrency
      const queue = [...claimed];
      const workers: Promise<void>[] = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        workers.push((async () => {
          while (queue.length) {
            const item = queue.shift();
            if (!item) break;
            if (Date.now() - t0 > SOFT_DEADLINE_MS) {
              // put it back as pending so next run picks it up
              await sb.from("crawl_queue")
                .update({ status: "pending" })
                .eq("id", item.id);
              continue;
            }

            const proc = await fetchAndProcess(item.url);
            if (!proc || (proc.status >= 400)) {
              totalFailed++;
              await sb.from("crawl_queue").update({
                status: proc && proc.status >= 400 ? "failed" : "failed",
                attempts: item.attempts + 1,
                last_error: proc ? `status ${proc.status}` : "fetch failed",
                processed_at: new Date().toISOString(),
              }).eq("id", item.id);
              continue;
            }

            // Upsert into cuk_pages — skip if there's literally no text.
            if (proc.content || proc.title) {
              await sb.from("cuk_pages").upsert({
                url: proc.url,
                title: proc.title?.slice(0, 500) || null,
                content: proc.content || "",
                is_pdf: proc.isPdf,
                http_status: proc.status,
                content_length: proc.content?.length || 0,
                last_crawled_at: new Date().toISOString(),
              }, { onConflict: "url" });
            }

            // Enqueue discovered links if under depth limit
            if (proc.links.length && item.depth < MAX_DEPTH) {
              const fresh = proc.links
                .filter((u) => isAllowedHost(u))
                .slice(0, 80)
                .map((u) => ({ url: u, depth: item.depth + 1, status: "pending" }));
              if (fresh.length) {
                const { error: insErr, count } = await sb
                  .from("crawl_queue")
                  .upsert(fresh, { onConflict: "url", ignoreDuplicates: true, count: "exact" });
                if (!insErr) totalDiscovered += count ?? 0;
              }
            }

            totalProcessed++;
            await sb.from("crawl_queue").update({
              status: "done",
              attempts: item.attempts + 1,
              processed_at: new Date().toISOString(),
            }).eq("id", item.id);
          }
        })());
      }
      await Promise.all(workers);
    }

    const elapsedMs = Date.now() - t0;
    const { count: pageCount } = await sb
      .from("cuk_pages").select("*", { count: "exact", head: true });
    const { count: pending } = await sb
      .from("crawl_queue").select("*", { count: "exact", head: true })
      .eq("status", "pending");

    return new Response(JSON.stringify({
      ok: true,
      processed: totalProcessed,
      discovered: totalDiscovered,
      failed: totalFailed,
      pending_in_queue: pending ?? 0,
      total_pages_indexed: pageCount ?? 0,
      elapsed_ms: elapsedMs,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("crawl-cuk error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
