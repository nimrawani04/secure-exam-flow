// Public document proxy for curated CUK documents stored in the private
// `cuk-docs` bucket. Chatbot citations link here so PDFs open directly in the
// browser (inline) without exposing the bucket or requiring auth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Only these prefixes are servable — prevents path traversal / arbitrary reads.
const ALLOWED_PREFIXES = ["syllabus/", "departments/"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = (url.searchParams.get("p") ?? "").replace(/^\/+/, "");

    if (!path || path.includes("..") || !ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
      return new Response(JSON.stringify({ error: "Invalid document path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await supabase.storage.from("cuk-docs").download(path);

    if (error || !data) {
      console.error("[cuk-doc] download failed", { path, error: error?.message });
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = path.split("/").pop() ?? "document.pdf";
    return new Response(data.stream(), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[cuk-doc] error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
