/**
 * refresh-official-pages — lets a signed-in user trigger the CUK content
 * refresh (student zone, downloads, faculty details, quick links) that the
 * scheduled `crawl-cuk` job runs nightly.
 *
 * Auth: a valid Supabase user JWT in the Authorization header.
 * The privileged CRAWL_SECRET never leaves the server.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const CRAWL_SECRET = Deno.env.get("CRAWL_SECRET") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return json({ error: "Sign in to refresh official pages." }, 401);
  }

  // Validate the caller's session.
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON_KEY },
  });
  if (!userResp.ok) {
    return json({ error: "Your session expired. Sign in again." }, 401);
  }

  if (!CRAWL_SECRET) {
    return json({ error: "Refresh is not configured on the server." }, 500);
  }

  const started = Date.now();
  try {
    const crawl = await fetch(`${SUPABASE_URL}/functions/v1/crawl-cuk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-crawl-secret": CRAWL_SECRET,
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ secret: CRAWL_SECRET }),
    });

    const text = await crawl.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 500) };
    }

    if (!crawl.ok) {
      console.log(JSON.stringify({ fn: "refresh-official-pages", status: crawl.status, ms: Date.now() - started }));
      return json({ error: "The refresh job failed. Try again in a moment.", details: payload }, 502);
    }

    console.log(JSON.stringify({ fn: "refresh-official-pages", ok: true, ms: Date.now() - started }));
    return json({ ok: true, ms: Date.now() - started, result: payload });
  } catch (e) {
    console.log(JSON.stringify({ fn: "refresh-official-pages", error: String(e), ms: Date.now() - started }));
    return json({ error: "Could not reach the refresh job." }, 502);
  }
});
