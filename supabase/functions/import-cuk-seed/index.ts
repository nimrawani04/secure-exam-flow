/**
 * import-cuk-seed — one-shot importer for the curated CUK knowledge seed.
 *
 * Reads `seed/cuk-seed.json` from the private `cuk-docs` bucket and upserts
 * every row into `public.cuk_pages` so the chatbot's FTS search can answer
 * with real document text (syllabi, schemes, department docs) instead of
 * generic page snippets.
 *
 * Auth: header `x-crawl-secret` or body `{ "secret": "..." }` must equal
 * the CRAWL_SECRET environment secret.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-crawl-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRAWL_SECRET = Deno.env.get("CRAWL_SECRET") ?? "";
const IMPORT_SEED_SECRET = Deno.env.get("IMPORT_SEED_SECRET") ?? "";

type SeedRow = {
  url: string;
  title?: string | null;
  content?: string | null;
  is_pdf?: boolean;
};

const MAX_CONTENT = 20_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }
    const secret = req.headers.get("x-crawl-secret") ?? String(body.secret ?? "");
    const accepted = [CRAWL_SECRET, IMPORT_SEED_SECRET].filter((s) => s.length > 0);
    if (accepted.length === 0 || !accepted.includes(secret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const path = String(body.path ?? "seed/cuk-seed.json");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: file, error: dlErr } = await supabase.storage.from("cuk-docs").download(path);
    if (dlErr || !file) return json({ error: `Seed file not found: ${path}`, details: dlErr?.message }, 404);

    const parsed = JSON.parse(await file.text());
    const rows: SeedRow[] = Array.isArray(parsed) ? parsed : (parsed.rows ?? []);
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Seed file has no rows" }, 400);

    // Deduplicate by URL — cuk_pages.url is unique.
    const byUrl = new Map<string, SeedRow>();
    for (const r of rows) {
      if (!r?.url) continue;
      const prev = byUrl.get(r.url);
      if (!prev || (r.content?.length ?? 0) > (prev.content?.length ?? 0)) byUrl.set(r.url, r);
    }

    const now = new Date().toISOString();
    const payload = [...byUrl.values()].map((r) => {
      const content = (r.content ?? "").slice(0, MAX_CONTENT);
      return {
        url: r.url,
        title: r.title ?? null,
        content,
        content_length: content.length,
        is_pdf: r.is_pdf ?? /\.pdf(?:$|[?#])/i.test(r.url),
        http_status: 200,
        last_crawled_at: now,
        removed_at: null,
        first_missing_at: null,
      };
    });

    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < payload.length; i += 100) {
      const chunk = payload.slice(i, i + 100);
      const { error } = await supabase.from("cuk_pages").upsert(chunk, { onConflict: "url" });
      if (error) errors.push(error.message);
      else inserted += chunk.length;
    }

    const { count } = await supabase.from("cuk_pages").select("*", { count: "exact", head: true });
    return json({ ok: errors.length === 0, seed_rows: rows.length, upserted: inserted, total_pages: count, errors });
  } catch (err) {
    console.error("[import-cuk-seed] error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
