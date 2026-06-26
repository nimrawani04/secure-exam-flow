/**
 * crawl-cuk — direct API harvester for the Central University of Kashmir
 *
 * The public CUK website (www.cukashmir.ac.in) is a JavaScript-rendered
 * Angular SPA whose entire content comes from a JSON API at
 *   https://cukapi.disgenweb.in/
 *
 * Static HTML scraping returns an empty <app-root/> shell, which is why the
 * previous BFS crawler produced 0 bytes of content. This rewrite calls every
 * "*ForWebSite" / "all*" endpoint that the SPA itself uses, normalises each
 * record into a `cuk_pages` row, and upserts. The chatbot's existing
 * `search_cuk_pages` RPC keeps working unchanged.
 *
 * Triggers
 *   - pg_cron POSTs `{ "secret": "<CRAWL_SECRET>" }` every day.
 *   - Manual:  `curl -X POST .../crawl-cuk -H "x-crawl-secret: $SECRET"`
 *
 * Auth: header `x-crawl-secret` OR body `secret` MUST equal CRAWL_SECRET.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-crawl-secret",
};

// ── Config ───────────────────────────────────────────────────────────────────

const API_BASE = "https://cukapi.disgenweb.in";
const SPA_BASE = "https://www.cukashmir.ac.in";
const REQUEST_TIMEOUT_MS = 25_000;
const PER_REQUEST_CONCURRENCY = 4;
const MAX_CONTENT_CHARS = 20_000;

// All endpoints exposed by the public website. Each is POSTed with
// {langType:1, seen:0, next:N} — the API requires langType to be an integer.
// `kind` lets us shape titles + URLs sensibly per record type.
type EndpointSpec = {
  path: string;
  kind:
    | "notice"
    | "exam-notification"
    | "exam-datesheet"
    | "exam-result"
    | "scholar-result"
    | "admission"
    | "tender"
    | "employment"
    | "press-release"
    | "whatnew"
    | "event"
    | "message"
    | "implink"
    | "quicklink"
    | "universitydoc"
    | "moe"
    | "promotion"
    | "faculty"
    | "media";
  next?: number;          // pagination page-size for list endpoints
  optional?: boolean;     // some endpoints may legitimately return []/2 bytes
};

const ENDPOINTS: EndpointSpec[] = [
  { path: "noticeboard/getGeneralNoticesForWebSite", kind: "notice", next: 500 },
  { path: "examnotification/getAllNotificationForWebSite", kind: "exam-notification", next: 500 },
  { path: "examdatesheet/ExamDateSheetList", kind: "exam-datesheet", next: 500 },
  { path: "examinationresult/ExaminationResultListForWebSite", kind: "exam-result", next: 500 },
  { path: "scholarresults/ScholarExaminationResultListForWebSite", kind: "scholar-result", next: 500, optional: true },
  { path: "admission/all", kind: "admission", next: 500 },
  { path: "tender/getalltender", kind: "tender", next: 500, optional: true },
  { path: "tender/all", kind: "tender", next: 500, optional: true },
  { path: "employments/allemploymentsforwebsite", kind: "employment", next: 500, optional: true },
  { path: "employments/all", kind: "employment", next: 500, optional: true },
  { path: "pressrelease/getAllPressReleasesForWebSite", kind: "press-release", next: 500 },
  { path: "whatnew/getAllWhatNewForWebSite", kind: "whatnew", next: 500 },
  { path: "event/getallupcomingeventsforwebsite", kind: "event", next: 500, optional: true },
  { path: "event/getall", kind: "event", next: 500, optional: true },
  { path: "messages/allmessagesforwebsite", kind: "message", next: 500 },
  { path: "implink/selectimplinksforwebsite", kind: "implink", next: 500 },
  { path: "universitydoc/selectforwebsite", kind: "universitydoc", next: 500 },
  { path: "publichomequicklinks/getquicklinksForwebSite", kind: "quicklink", next: 500 },
  { path: "moe/getAllPressReleasesForWebSite", kind: "moe", next: 500, optional: true },
  { path: "moes/getAllPressReleasesForWebSite", kind: "moe", next: 500, optional: true },
  { path: "itandservices/ItAndServicesNotificationListForWebSite", kind: "notice", next: 500, optional: true },
  { path: "promotions/getPromotionsForPublic", kind: "promotion", next: 500, optional: true },
  { path: "faculty/getallforwebsite", kind: "faculty", next: 500, optional: true },
  { path: "mediagallery/getmediagalleryforwebsite", kind: "media", next: 500, optional: true },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const stripHtml = (s: string) =>
  s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const formatDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const isPdf = (url: string) => /\.pdf(?:$|[?#])/i.test(url || "");

/** Pick the first non-empty string field from an object. */
const pick = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

async function callApi(spec: EndpointSpec): Promise<unknown[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/${spec.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": SPA_BASE,
        "Referer": `${SPA_BASE}/`,
        "User-Agent":
          "CUK-Confidential-Exam-Indexer/2.0 (+https://confidential-exam.lovable.app)",
      },
      body: JSON.stringify({
        langType: 1,
        seen: 0,
        next: spec.next ?? 500,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`[crawl] ${spec.path} -> HTTP ${res.status}`);
      return [];
    }
    const txt = await res.text();
    if (!txt || txt.length < 3) return [];
    try {
      const json = JSON.parse(txt);
      return Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  } catch (err) {
    console.warn(`[crawl] ${spec.path} -> ${(err as Error).message}`);
    return [];
  } finally {
    clearTimeout(t);
  }
}

// ── Normalisers ──────────────────────────────────────────────────────────────

type PageRow = {
  url: string;
  title: string;
  content: string;
  is_pdf: boolean;
};

function normalise(spec: EndpointSpec, raw: Record<string, unknown>): PageRow | null {
  // The API uses inconsistent field names across endpoints; coalesce gently.
  const title = pick(
    raw,
    "Name",
    "Title",
    "Notification_title",
    "Result_title",
    "ExternalTitle",
    "FileName",
    "filename",
  );

  // URL resolution: prefer direct file URL, then external link, then SPA route.
  const httpPath = pick(raw, "HttpPath", "FileUrl");
  const extUrl = pick(raw, "ExternalUrl", "Url");
  // implink stores the link in Description for ContentType=="Link"
  const ct = pick(raw, "ContentType");
  let url = "";
  if (httpPath) url = httpPath;
  else if (extUrl) {
    url = /^https?:\/\//.test(extUrl) ? extUrl : SPA_BASE + extUrl;
  } else if (spec.kind === "implink" && /link/i.test(ct)) {
    const desc = pick(raw, "Description");
    if (/^https?:\/\//.test(desc)) url = desc;
  }

  if (!url) {
    // Fall back to a deterministic SPA route so the entry is still addressable.
    const id =
      pick(raw, "RowId", "uniqueId", "Id", "RecordId") ||
      (typeof raw["Id"] === "number" ? String(raw["Id"]) : "");
    if (!id) return null;
    url = `${SPA_BASE}/#/${spec.kind}/${id}`;
  }
  if (!title && !url) return null;

  // Compose searchable body
  const department = pick(raw, "DepartmentName");
  const description = stripHtml(pick(raw, "Description", "Result_Description", "scription"));
  const created = formatDate(
    pick(raw, "CreatedOn", "UploadDate", "PublishedOn", "ApprovedOn", "VisibleFromDate") || null,
  );
  const end = formatDate(pick(raw, "EndDate", "VisibleToDate") || null);
  const filename = pick(raw, "FileName", "filename");

  const tag = (() => {
    switch (spec.kind) {
      case "notice": return "Notice";
      case "exam-notification": return "Examination Notification";
      case "exam-datesheet": return "Date Sheet";
      case "exam-result": return "Examination Result";
      case "scholar-result": return "Scholar Result";
      case "admission": return "Admission";
      case "tender": return "Tender";
      case "employment": return "Recruitment / Employment";
      case "press-release": return "Press Release";
      case "whatnew": return "What's New";
      case "event": return "Event";
      case "message": return "Message";
      case "implink": return "Important Link";
      case "quicklink": return "Quick Link";
      case "universitydoc": return "University Document";
      case "moe": return "MoE Press Release";
      case "promotion": return "Promotion";
      case "faculty": return "Faculty";
      case "media": return "Media Gallery";
    }
  })();

  const contentParts = [
    `Category: ${tag}`,
    title ? `Title: ${title}` : "",
    department ? `Department: ${department}` : "",
    created ? `Published: ${created}` : "",
    end ? `Valid until: ${end}` : "",
    filename ? `File: ${filename}` : "",
    description,
  ].filter(Boolean);

  return {
    url,
    title: title || filename || `${tag} ${formatDate(pick(raw, "CreatedOn"))}`.trim(),
    content: contentParts.join("\n").slice(0, MAX_CONTENT_CHARS),
    is_pdf: isPdf(url),
  };
}

// ── Upsert ───────────────────────────────────────────────────────────────────

async function upsertBatch(
  sb: ReturnType<typeof createClient>,
  rows: PageRow[],
): Promise<number> {
  if (!rows.length) return 0;
  // Dedupe by URL within batch (last wins)
  const map = new Map<string, PageRow>();
  for (const r of rows) map.set(r.url, r);
  const payload = Array.from(map.values()).map((r) => ({
    url: r.url,
    title: r.title,
    content: r.content,
    is_pdf: r.is_pdf,
    http_status: 200,
    content_length: r.content.length,
    last_crawled_at: new Date().toISOString(),
  }));
  // Supabase upsert chunked at 500 to keep payloads small
  let inserted = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const { error } = await sb
      .from("cuk_pages")
      .upsert(chunk, { onConflict: "url" });
    if (error) {
      console.error("upsert error", error);
    } else {
      inserted += chunk.length;
    }
  }
  return inserted;
}

// ── Concurrency limiter ──────────────────────────────────────────────────────

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        results[idx] = await fn(items[idx]);
      } catch (e) {
        console.error("worker error", e);
        // @ts-ignore
        results[idx] = undefined;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ── Entry point ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get("CRAWL_SECRET");
  const headerSecret = req.headers.get("x-crawl-secret");
  let bodySecret: string | undefined;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
    bodySecret = body?.secret as string | undefined;
  } catch {
    /* no body */
  }
  if (!secret || (headerSecret !== secret && bodySecret !== secret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const startedAt = Date.now();
  const stats: Array<{ endpoint: string; fetched: number; stored: number }> = [];
  let totalRows: PageRow[] = [];

  await mapLimit(ENDPOINTS, PER_REQUEST_CONCURRENCY, async (spec) => {
    const raw = await callApi(spec);
    const norm: PageRow[] = [];
    for (const r of raw) {
      const row = normalise(spec, r as Record<string, unknown>);
      if (row) norm.push(row);
    }
    stats.push({ endpoint: spec.path, fetched: raw.length, stored: norm.length });
    totalRows = totalRows.concat(norm);
  });

  const stored = await upsertBatch(sb, totalRows);
  const durationMs = Date.now() - startedAt;

  return new Response(
    JSON.stringify(
      {
        ok: true,
        durationMs,
        endpoints: stats.length,
        rowsCollected: totalRows.length,
        rowsUpserted: stored,
        perEndpoint: stats,
      },
      null,
      2,
    ),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
