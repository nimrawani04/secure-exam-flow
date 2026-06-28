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
// The upstream CUK API server emits an invalid `keep-alive` header in HTTP/2
// frames which Deno's HTTP/2 client refuses with PROTOCOL_ERROR. We bypass
// that by routing every upstream call through Node's https module (HTTP/1.1
// only).
import * as https from "node:https";
import { Buffer } from "node:buffer";

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

type ApiMethod = "GET" | "POST";

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

function httpJson(
  url: string,
  method: ApiMethod = "POST",
  body = "",
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers: Record<string, string> = {
      "Origin": SPA_BASE,
      "Referer": `${SPA_BASE}/`,
      "User-Agent":
        "CUK-Confidential-Exam-Indexer/2.1 (+https://confidential-exam.lovable.app)",
      "Accept": "application/json, text/plain, */*",
      "langtype": "1",
      "Connection": "close",
    };
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body).toString();
    }
    const req = https.request(
      {
        method,
        host: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Uint8Array[] = [];
        res.on("data", (c: Uint8Array) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 0, text });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });
    if (method === "POST") req.write(body);
    req.end();
  });
}

const parseArrayResponse = (text: string): unknown[] => {
  if (!text || text.length < 3) return [];
  try {
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
};

async function apiPost(path: string, payload: Record<string, unknown>): Promise<unknown[]> {
  const { status, text } = await httpJson(`${API_BASE}/${path}`, "POST", JSON.stringify(payload));
  if (status !== 200) {
    console.warn(`[crawl] ${path} -> HTTP ${status}`);
    return [];
  }
  return parseArrayResponse(text);
}

async function apiGet(path: string): Promise<unknown[]> {
  const { status, text } = await httpJson(`${API_BASE}/${path}`, "GET");
  if (status !== 200) {
    console.warn(`[crawl] ${path} -> HTTP ${status}`);
    return [];
  }
  return parseArrayResponse(text);
}

async function callApi(spec: EndpointSpec): Promise<unknown[]> {
  try {
    return await apiPost(spec.path, { langType: 1, seen: 0, next: spec.next ?? 500 });
  } catch (err) {
    console.warn(`[crawl] ${spec.path} -> ${(err as Error).message}`);
    return [];
  }
}

// ── Normalisers ──────────────────────────────────────────────────────────────

type PageRow = {
  url: string;
  title: string;
  content: string;
  is_pdf: boolean;
};

const absoluteUrl = (u: string): string => {
  const value = (u || "").trim();
  if (!value || /^(javascript:|mailto:|tel:)/i.test(value)) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${API_BASE}${value}`;
  return `${API_BASE}/${value.replace(/^\.\//, "")}`;
};

const cleanFileTitle = (url: string): string => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "PDF document");
    return name
      .replace(/\.pdf$/i, "")
      .replace(/^\d{8,}-?\d*_?/g, "")
      .replace(/^\d+[_-]+/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "PDF document";
  } catch {
    return "PDF document";
  }
};

function extractPdfLinks(html: string): Array<{ url: string; title: string }> {
  const found = new Map<string, string>();
  const anchorRe = /<a\b[^>]*\bhref=["']([^"']+\.pdf(?:[?#][^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const url = absoluteUrl(m[1]);
    if (!url) continue;
    const title = stripHtml(m[2]) || cleanFileTitle(url);
    found.set(url, title);
  }

  const urlRe = /(?:href|src|data-[\w-]+)=["']([^"']+\.pdf(?:[?#][^"']*)?)["']/gi;
  while ((m = urlRe.exec(html))) {
    const url = absoluteUrl(m[1]);
    if (url && !found.has(url)) found.set(url, cleanFileTitle(url));
  }
  return Array.from(found, ([url, title]) => ({ url, title }));
}

function extractAnchorLinks(html: string): Array<{ url: string; title: string; isPdf: boolean }> {
  const found = new Map<string, { title: string; isPdf: boolean }>();
  const anchorRe = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const url = absoluteUrl(m[1]);
    if (!url || /^(mailto|tel|javascript):/i.test(url)) continue;
    const title = stripHtml(m[2]) || cleanFileTitle(url);
    found.set(url, { title, isPdf: isPdf(url) });
  }
  return Array.from(found, ([url, value]) => ({ url, ...value }));
}

function makeDepartmentRoute(masterId: string, kind: "school" | "department" = "department"): string {
  return kind === "school"
    ? `${SPA_BASE}/departmentList;sid=${encodeURIComponent(masterId)}`
    : `${SPA_BASE}/departmentList;id=${encodeURIComponent(masterId)}`;
}

function makeStudentZoneRoute(masterId: string): string {
  return `${SPA_BASE}/studentzone;id=${encodeURIComponent(masterId)}`;
}

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

// ── Deep department/school crawl ─────────────────────────────────────────────

type DepartmentStats = {
  schools: number;
  departmentApiCalls: number;
  departmentPages: number;
  pdfs: number;
  rows: number;
};

type StudentZoneStats = {
  apiCalls: number;
  pages: number;
  links: number;
  pdfs: number;
  rows: number;
};

function normaliseDepartmentPage(
  raw: Record<string, unknown>,
  path: string[],
): { page: PageRow | null; pdfs: PageRow[]; childMasterId: string } {
  const name = pick(raw, "DepartmentName", "DepartmentTitle", "Name") || "Department page";
  const masterId = pick(raw, "DepartmentMasterId", "MasterId");
  const parentId = pick(raw, "ParentDepartmentMasterId", "ParentMasterId");
  const descriptionHtml = pick(raw, "DepartmentDescription", "Description", "Content");
  const description = stripHtml(descriptionHtml);
  const breadcrumb = [...path, name].filter(Boolean).join(" > ");
  const url = masterId ? makeDepartmentRoute(masterId) : `${SPA_BASE}/departmentList`;

  const content = [
    "Category: Department Page",
    `Title: ${name}`,
    breadcrumb ? `Path: ${breadcrumb}` : "",
    parentId ? `ParentDepartmentMasterId: ${parentId}` : "",
    masterId ? `DepartmentMasterId: ${masterId}` : "",
    description,
  ].filter(Boolean).join("\n").slice(0, MAX_CONTENT_CHARS);

  const page = masterId || description
    ? {
      url,
      title: breadcrumb ? `${name} — ${path[path.length - 1] ?? "CUK"}` : name,
      content,
      is_pdf: false,
    }
    : null;

  const pdfs = extractPdfLinks(descriptionHtml).map(({ url: pdfUrl, title }) => ({
    url: pdfUrl,
    title: title || cleanFileTitle(pdfUrl),
    content: [
      "Category: Department PDF",
      `Title: ${title || cleanFileTitle(pdfUrl)}`,
      breadcrumb ? `Department path: ${breadcrumb}` : "",
      description ? `Page context: ${description.slice(0, 4000)}` : "",
    ].filter(Boolean).join("\n").slice(0, MAX_CONTENT_CHARS),
    is_pdf: true,
  }));

  return { page, pdfs, childMasterId: masterId };
}

async function crawlDepartmentTree(): Promise<{ rows: PageRow[]; stats: DepartmentStats }> {
  const rows: PageRow[] = [];
  const stats: DepartmentStats = {
    schools: 0,
    departmentApiCalls: 0,
    departmentPages: 0,
    pdfs: 0,
    rows: 0,
  };
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[]; depth: number }> = [];
  const MAX_DEPARTMENT_API_CALLS = 450;

  let schools: unknown[] = [];
  try {
    schools = await apiGet("school/schoolList");
  } catch (err) {
    console.warn(`[crawl] school/schoolList -> ${(err as Error).message}`);
  }
  stats.schools = Array.isArray(schools) ? schools.length : 0;

  await mapLimit(schools as Record<string, unknown>[], PER_REQUEST_CONCURRENCY, async (school) => {
    const schoolId = pick(school, "SchoolMasterId", "MasterId");
    const schoolName = pick(school, "SchoolName", "Name") || "School";
    if (!schoolId) return;
    rows.push({
      url: makeDepartmentRoute(schoolId, "school"),
      title: schoolName,
      content: ["Category: School", `Title: ${schoolName}`, `SchoolMasterId: ${schoolId}`].join("\n"),
      is_pdf: false,
    });

    try {
      const departments = await apiPost("department/getMappedDepartmentListBySchoolMasterId", {
        SchoolMasterId: schoolId,
      });
      for (const d of departments as Record<string, unknown>[]) {
        const id = pick(d, "DepartmentMasterId", "MasterId");
        if (id) queue.push({ id, path: [schoolName], depth: 0 });
      }
    } catch (err) {
      console.warn(`[crawl] department/getMappedDepartmentListBySchoolMasterId(${schoolId}) -> ${(err as Error).message}`);
    }
  });

  // Breadth-first, concurrent traversal. This indexes every department/menu page
  // returned by the official API without doing one long serial recursion that can
  // hit Edge Function timeouts.
  while (queue.length && stats.departmentApiCalls < MAX_DEPARTMENT_API_CALLS) {
    const batch = queue.splice(0, PER_REQUEST_CONCURRENCY * 2);
    const discovered = await mapLimit(batch, PER_REQUEST_CONCURRENCY, async (node) => {
      const childNodes: Array<{ id: string; path: string[]; depth: number }> = [];
      if (!node.id || visited.has(node.id) || node.depth > 8) return childNodes;
      visited.add(node.id);
      stats.departmentApiCalls += 1;

      let list: unknown[] = [];
      try {
        list = await apiPost("department/departmentListById", { Id: node.id });
      } catch (err) {
        console.warn(`[crawl] department/departmentListById(${node.id}) -> ${(err as Error).message}`);
        return childNodes;
      }

      for (const item of list as Record<string, unknown>[]) {
        const { page, pdfs, childMasterId } = normaliseDepartmentPage(item, node.path);
        if (page) {
          rows.push(page);
          stats.departmentPages += 1;
        }
        if (pdfs.length) {
          rows.push(...pdfs);
          stats.pdfs += pdfs.length;
        }
        if (childMasterId && childMasterId !== node.id && !visited.has(childMasterId)) {
          const childName = pick(item, "DepartmentName", "DepartmentTitle", "Name");
          childNodes.push({
            id: childMasterId,
            path: [...node.path, childName].filter(Boolean),
            depth: node.depth + 1,
          });
        }
      }
      return childNodes;
    });
    for (const children of discovered) queue.push(...(children || []));
  }

  stats.rows = rows.length;
  return { rows, stats };
}

// ── Student-zone/download/e-resource crawl ───────────────────────────────────

function normaliseStudentZonePage(
  raw: Record<string, unknown>,
  path: string[],
): { page: PageRow | null; links: PageRow[]; childMasterId: string } {
  const name = pick(raw, "StudentZoneName", "StudentZoneTitle", "Name") || "Student Zone";
  const masterId = pick(raw, "StudentZoneMasterId", "MasterId");
  const parentId = pick(raw, "ParentStudentZoneMasterId", "ParentMasterId");
  const descriptionHtml = pick(raw, "StudentZoneDescription", "Description", "Content");
  const description = stripHtml(descriptionHtml);
  const breadcrumb = [...path, name].filter(Boolean).join(" > ");
  const url = masterId ? makeStudentZoneRoute(masterId) : `${SPA_BASE}/studentzone`;

  const content = [
    "Category: Student Zone / Resources",
    `Title: ${name}`,
    breadcrumb ? `Path: ${breadcrumb}` : "",
    parentId ? `ParentStudentZoneMasterId: ${parentId}` : "",
    masterId ? `StudentZoneMasterId: ${masterId}` : "",
    description,
  ].filter(Boolean).join("\n").slice(0, MAX_CONTENT_CHARS);

  const page = masterId || description
    ? { url, title: breadcrumb || name, content, is_pdf: false }
    : null;

  const links = extractAnchorLinks(descriptionHtml).map((link) => ({
    url: link.url,
    title: link.title || cleanFileTitle(link.url),
    content: [
      link.isPdf ? "Category: Student Resource PDF" : "Category: Student Resource Link",
      `Title: ${link.title || cleanFileTitle(link.url)}`,
      breadcrumb ? `Student-zone path: ${breadcrumb}` : "",
      description ? `Page context: ${description.slice(0, 4000)}` : "",
    ].filter(Boolean).join("\n").slice(0, MAX_CONTENT_CHARS),
    is_pdf: link.isPdf,
  }));

  return { page, links, childMasterId: masterId };
}

async function crawlStudentZoneTree(): Promise<{ rows: PageRow[]; stats: StudentZoneStats }> {
  const rows: PageRow[] = [];
  const stats: StudentZoneStats = { apiCalls: 0, pages: 0, links: 0, pdfs: 0, rows: 0 };
  const visited = new Set<string>();
  const queue: Array<{ id: string | null; path: string[]; depth: number }> = [{ id: null, path: [], depth: 0 }];
  const MAX_STUDENT_ZONE_API_CALLS = 160;

  while (queue.length && stats.apiCalls < MAX_STUDENT_ZONE_API_CALLS) {
    const batch = queue.splice(0, PER_REQUEST_CONCURRENCY * 2);
    const discovered = await mapLimit(batch, PER_REQUEST_CONCURRENCY, async (node) => {
      const childNodes: Array<{ id: string; path: string[]; depth: number }> = [];
      const key = node.id ?? "__root__";
      if (visited.has(key) || node.depth > 8) return childNodes;
      visited.add(key);
      stats.apiCalls += 1;

      let list: unknown[] = [];
      try {
        const payload = node.id ? { Id: node.id } : { langType: 1 };
        list = await apiPost("studentzone/studentzoneListById", payload);
      } catch (err) {
        console.warn(`[crawl] studentzone/studentzoneListById(${node.id ?? "root"}) -> ${(err as Error).message}`);
        return childNodes;
      }

      for (const item of list as Record<string, unknown>[]) {
        const { page, links, childMasterId } = normaliseStudentZonePage(item, node.path);
        if (page) {
          rows.push(page);
          stats.pages += 1;
        }
        if (links.length) {
          rows.push(...links);
          stats.links += links.length;
          stats.pdfs += links.filter((l) => l.is_pdf).length;
        }
        if (childMasterId && !visited.has(childMasterId)) {
          const childName = pick(item, "StudentZoneName", "StudentZoneTitle", "Name");
          childNodes.push({
            id: childMasterId,
            path: [...node.path, childName].filter(Boolean),
            depth: node.depth + 1,
          });
        }
      }
      return childNodes;
    });
    for (const children of discovered) queue.push(...(children || []));
  }

  stats.rows = rows.length;
  return { rows, stats };
}

// ── Hash & incremental upsert ────────────────────────────────────────────────

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fingerprint(r: PageRow): Promise<string> {
  // Stable hash over the fields that affect search/answers.
  return sha1Hex(`${r.title}\u0001${r.is_pdf ? 1 : 0}\u0001${r.content}`);
}

type UpsertStats = {
  considered: number;
  newRows: number;
  changed: number;
  unchanged: number;
  touched: number;
  resurrected: number;
};


async function upsertBatch(
  sb: any,
  rows: PageRow[],
): Promise<UpsertStats> {
  const stats: UpsertStats = {
    considered: 0,
    newRows: 0,
    changed: 0,
    unchanged: 0,
    touched: 0,
    resurrected: 0,
  };
  if (!rows.length) return stats;


  // Dedupe by URL within batch (last wins)
  const dedup = new Map<string, PageRow>();
  for (const r of rows) dedup.set(r.url, r);
  const uniques = Array.from(dedup.values());
  stats.considered = uniques.length;

  // Compute fingerprints in parallel
  const withHash = await Promise.all(
    uniques.map(async (r) => ({ row: r, hash: await fingerprint(r) })),
  );

  // Fetch existing hashes + removal state for these URLs
  const existing = new Map<string, { hash: string | null; removed: boolean }>();
  const urls = uniques.map((u) => u.url);
  for (let i = 0; i < urls.length; i += 200) {
    const slice = urls.slice(i, i + 200);
    const { data, error } = await sb
      .from("cuk_pages")
      .select("url, content_hash, removed_at")
      .in("url", slice);
    if (error) {
      console.error("fetch existing hashes error", error);
      continue;
    }
    for (const row of data ?? []) {
      const r = row as { url: string; content_hash: string | null; removed_at: string | null };
      existing.set(r.url, { hash: r.content_hash ?? null, removed: !!r.removed_at });
    }
  }


  // Partition into changed vs unchanged
  const changedPayload: Array<Record<string, unknown>> = [];
  const unchangedUrls: string[] = [];
  const resurrectUrls: string[] = [];
  const nowIso = new Date().toISOString();
  for (const { row, hash } of withHash) {
    const prev = existing.get(row.url);
    if (prev === undefined) {
      stats.newRows++;
      changedPayload.push({
        url: row.url,
        title: row.title,
        content: row.content,
        is_pdf: row.is_pdf,
        http_status: 200,
        content_length: row.content.length,
        content_hash: hash,
        last_crawled_at: nowIso,
        removed_at: null,
        first_missing_at: null,
      });
    } else if (prev.hash !== hash) {
      stats.changed++;
      if (prev.removed) stats.resurrected++;
      changedPayload.push({
        url: row.url,
        title: row.title,
        content: row.content,
        is_pdf: row.is_pdf,
        http_status: 200,
        content_length: row.content.length,
        content_hash: hash,
        last_crawled_at: nowIso,
        removed_at: null,
        first_missing_at: null,
      });
    } else {
      stats.unchanged++;
      unchangedUrls.push(row.url);
      if (prev.removed) resurrectUrls.push(row.url);
    }
  }

  // Write only changed/new rows
  for (let i = 0; i < changedPayload.length; i += 500) {
    const chunk = changedPayload.slice(i, i + 500);
    const { error } = await sb
      .from("cuk_pages")
      .upsert(chunk, { onConflict: "url" });
    if (error) {
      console.error("upsert error", error);
    } else {
      stats.touched += chunk.length;
    }
  }

  // Cheaply refresh last_crawled_at for unchanged rows so we know they
  // were re-verified this run (no rewrite of title/content/tsvector). Also
  // clear first_missing_at because an unchanged row may have reappeared after
  // a partial upstream outage.
  for (let i = 0; i < unchangedUrls.length; i += 500) {
    const chunk = unchangedUrls.slice(i, i + 500);
    const { error } = await sb
      .from("cuk_pages")
      .update({ last_crawled_at: nowIso, first_missing_at: null })
      .in("url", chunk);
    if (error) console.error("touch unchanged error", error);
  }

  // Resurrect previously-removed rows that came back unchanged.
  for (let i = 0; i < resurrectUrls.length; i += 500) {
    const chunk = resurrectUrls.slice(i, i + 500);
    const { error } = await sb
      .from("cuk_pages")
      .update({ removed_at: null, first_missing_at: null })
      .in("url", chunk);
    if (error) console.error("resurrect error", error);
    else stats.resurrected += chunk.length;
  }

  return stats;
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

// ── Curated static seeds (authoritative CUK + allied pages) ──────────────────
// Hand-picked URLs across CUK subdomains, allied portals, and statutory bodies
// so the chatbot has citable sources even when the SPA API doesn't surface them.
const STATIC_SEEDS: Array<{ url: string; title: string; category: string; description?: string; is_pdf?: boolean }> = [
  // Core institutional
  { url: `${SPA_BASE}/`, title: "Central University of Kashmir — Home", category: "Institutional" },
  { url: `${SPA_BASE}/aboutus`, title: "About Central University of Kashmir", category: "Institutional" },
  { url: `${SPA_BASE}/contactus`, title: "Contact CUK — Address, Phone, Email", category: "Contact" },
  { url: `${SPA_BASE}/vicechancellor`, title: "Vice Chancellor — CUK", category: "Administration" },
  { url: `${SPA_BASE}/registrar`, title: "Registrar — CUK", category: "Administration" },
  { url: `${SPA_BASE}/financeofficer`, title: "Finance Officer — CUK", category: "Administration" },
  { url: `${SPA_BASE}/controllerofexaminations`, title: "Controller of Examinations — CUK", category: "Examination" },
  { url: `${SPA_BASE}/deanacademicaffairs`, title: "Dean Academic Affairs — CUK", category: "Academics" },
  { url: `${SPA_BASE}/deanstudentwelfare`, title: "Dean Students' Welfare — CUK", category: "Student Welfare" },
  { url: `${SPA_BASE}/deanresearch`, title: "Dean Research — CUK", category: "Research" },
  { url: `${SPA_BASE}/proctor`, title: "Proctor — CUK", category: "Administration" },

  // Admissions / Examinations
  { url: `${SPA_BASE}/admission`, title: "Admissions — Central University of Kashmir", category: "Admission" },
  { url: `${SPA_BASE}/admissionnotification`, title: "Admission Notifications — CUK", category: "Admission" },
  { url: `${SPA_BASE}/examnotification`, title: "Examination Notifications — CUK", category: "Examination" },
  { url: `${SPA_BASE}/examdatesheet`, title: "Examination Date Sheets — CUK", category: "Examination" },
  { url: `${SPA_BASE}/examinationresult`, title: "Examination Results — CUK", category: "Examination" },
  { url: `${SPA_BASE}/scholarresults`, title: "Scholar / PhD Results — CUK", category: "Examination" },

  // Notice / What's New / Tenders / Employment / RTI
  { url: `${SPA_BASE}/noticeboard`, title: "Notice Board — CUK", category: "Notice" },
  { url: `${SPA_BASE}/tender`, title: "Tenders — CUK", category: "Tender" },
  { url: `${SPA_BASE}/employment`, title: "Employment / Recruitment — CUK", category: "Recruitment" },
  { url: `${SPA_BASE}/pressrelease`, title: "Press Releases — CUK", category: "Press" },
  { url: `${SPA_BASE}/rti`, title: "RTI — Right to Information at CUK", category: "RTI" },
  { url: `${SPA_BASE}/iqac`, title: "Internal Quality Assurance Cell (IQAC) — CUK", category: "IQAC" },
  { url: `${SPA_BASE}/nirf`, title: "NIRF Ranking — CUK", category: "Ranking" },
  { url: `${SPA_BASE}/naac`, title: "NAAC Accreditation — CUK", category: "Accreditation" },

  // Student services
  { url: `${SPA_BASE}/studentzone`, title: "Student Zone — CUK", category: "Student" },
  { url: `${SPA_BASE}/library`, title: "Central Library — CUK", category: "Library" },
  { url: `${SPA_BASE}/hostel`, title: "Hostel Facilities — CUK", category: "Hostel" },
  { url: `${SPA_BASE}/scholarship`, title: "Scholarships — CUK", category: "Scholarship" },
  { url: `${SPA_BASE}/grievance`, title: "Grievance Redressal — CUK", category: "Grievance" },
  { url: `${SPA_BASE}/antiragging`, title: "Anti-Ragging Cell — CUK", category: "Anti-Ragging" },
  { url: `${SPA_BASE}/equalopportunitycell`, title: "Equal Opportunity Cell — CUK", category: "Student Welfare" },
  { url: `${SPA_BASE}/icc`, title: "Internal Complaints Committee — CUK", category: "ICC" },
  { url: `${SPA_BASE}/placement`, title: "Training & Placement Cell — CUK", category: "Placement" },
  { url: `${SPA_BASE}/sportscell`, title: "Sports Cell — CUK", category: "Sports" },
  { url: `${SPA_BASE}/ncc`, title: "NCC at CUK", category: "NCC" },
  { url: `${SPA_BASE}/nss`, title: "NSS at CUK", category: "NSS" },

  // Allied subdomains / portals
  { url: "https://exam.cukashmir.ac.in/", title: "CUK Examination Portal", category: "Examination Portal" },
  { url: "https://results.cukashmir.ac.in/", title: "CUK Results Portal", category: "Results Portal" },
  { url: "https://admission.cukashmir.ac.in/", title: "CUK Admission Portal", category: "Admission Portal" },
  { url: "https://library.cukashmir.ac.in/", title: "CUK Library Portal", category: "Library Portal" },
  { url: "https://recruitment.cukashmir.ac.in/", title: "CUK Recruitment Portal", category: "Recruitment Portal" },
  { url: "https://samarth.cukashmir.ac.in/", title: "CUK SAMARTH Portal (Student Lifecycle)", category: "SAMARTH" },

  // Statutory / external authoritative
  { url: "https://www.ugc.gov.in/", title: "University Grants Commission (UGC) — India", category: "UGC" },
  { url: "https://www.aicte-india.org/", title: "AICTE — All India Council for Technical Education", category: "AICTE" },
  { url: "https://www.naac.gov.in/", title: "NAAC — National Assessment and Accreditation Council", category: "NAAC" },
  { url: "https://www.nirfindia.org/", title: "NIRF — National Institutional Ranking Framework", category: "NIRF" },
  { url: "https://www.education.gov.in/", title: "Ministry of Education, Government of India", category: "MoE" },
  { url: "https://nta.ac.in/", title: "National Testing Agency (NTA) — CUET", category: "NTA" },
  { url: "https://cuet.samarth.ac.in/", title: "CUET (PG/UG) — SAMARTH Portal", category: "CUET" },
  { url: "https://swayam.gov.in/", title: "SWAYAM — Free Online Courses (MoE)", category: "SWAYAM" },
  { url: "https://ndl.iitkgp.ac.in/", title: "National Digital Library of India", category: "NDLI" },
  { url: "https://shodhganga.inflibnet.ac.in/", title: "Shodhganga — Reservoir of Indian Theses", category: "Shodhganga" },
  { url: "https://ess.inflibnet.ac.in/", title: "INFLIBNET e-ShodhSindhu — E-Resources Consortium", category: "INFLIBNET" },
];

function staticSeedRows(): PageRow[] {
  return STATIC_SEEDS.map((s) => ({
    url: s.url,
    title: s.title,
    is_pdf: !!s.is_pdf || isPdf(s.url),
    content: [
      `Category: ${s.category}`,
      `Title: ${s.title}`,
      `URL: ${s.url}`,
      s.description ? `Description: ${s.description}` : "Curated authoritative source for Central University of Kashmir queries.",
    ].filter(Boolean).join("\n"),
  }));
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

  const { rows: departmentRows, stats: departmentStats } = await crawlDepartmentTree();
  totalRows = totalRows.concat(departmentRows);

  const { rows: studentZoneRows, stats: studentZoneStats } = await crawlStudentZoneTree();
  totalRows = totalRows.concat(studentZoneRows);

  const seedRows = staticSeedRows();
  totalRows = totalRows.concat(seedRows);

  const upsertStats = await upsertBatch(sb, totalRows);

  // ── Deletion detection ──────────────────────────────────────────────────
  // A row is considered "missing" when none of this run's endpoints returned
  // its URL. We use a two-phase soft delete so a single flaky upstream run
  // can't wipe live records:
  //   1. First time a row is missing → stamp first_missing_at (still searchable).
  //   2. Still missing >= REMOVAL_GRACE_HOURS later → stamp removed_at
  //      (excluded from search by search_cuk_pages).
  // We also require this run to have collected at least MIN_SEEN_RATIO of the
  // currently-alive row count, otherwise we abort the sweep entirely.
  const REMOVAL_GRACE_HOURS = 48;
  const MIN_SEEN_RATIO = 0.5;
  const forceSweep = body?.forceRemovalSweep === true;

  const seenSet = new Set(totalRows.map((r) => r.url));
  const removalStats = {
    sweepRan: false,
    aborted: false as boolean | string,
    aliveBefore: 0,
    seenThisRun: seenSet.size,
    newlyMissing: 0,
    confirmedRemoved: 0,
  };

  const { count: aliveBefore } = await sb
    .from("cuk_pages")
    .select("id", { count: "exact", head: true })
    .is("removed_at", null);
  removalStats.aliveBefore = aliveBefore ?? 0;

  const ratio = removalStats.aliveBefore
    ? seenSet.size / removalStats.aliveBefore
    : 1;

  if (!forceSweep && ratio < MIN_SEEN_RATIO) {
    removalStats.aborted = `seen/alive ratio ${ratio.toFixed(2)} < ${MIN_SEEN_RATIO} — upstream likely degraded`;
  } else {
    removalStats.sweepRan = true;
    // Page through alive rows and partition by membership in seenSet.
    const nowIso = new Date().toISOString();
    const cutoffIso = new Date(
      Date.now() - REMOVAL_GRACE_HOURS * 3600_000,
    ).toISOString();

    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from("cuk_pages")
        .select("url, first_missing_at")
        .is("removed_at", null)
        .order("url")
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("deletion sweep page error", error);
        break;
      }
      const rows = (data ?? []) as Array<{
        url: string;
        first_missing_at: string | null;
      }>;
      if (!rows.length) break;

      const newlyMissing: string[] = [];
      const confirmRemoved: string[] = [];
      for (const r of rows) {
        if (seenSet.has(r.url)) continue;
        if (!r.first_missing_at) {
          newlyMissing.push(r.url);
        } else if (r.first_missing_at <= cutoffIso) {
          confirmRemoved.push(r.url);
        }
      }

      for (let i = 0; i < newlyMissing.length; i += 500) {
        const chunk = newlyMissing.slice(i, i + 500);
        const { error: e } = await sb
          .from("cuk_pages")
          .update({ first_missing_at: nowIso })
          .in("url", chunk);
        if (e) console.error("mark first_missing error", e);
        else removalStats.newlyMissing += chunk.length;
      }
      for (let i = 0; i < confirmRemoved.length; i += 500) {
        const chunk = confirmRemoved.slice(i, i + 500);
        const { error: e } = await sb
          .from("cuk_pages")
          .update({ removed_at: nowIso })
          .in("url", chunk);
        if (e) console.error("mark removed error", e);
        else removalStats.confirmedRemoved += chunk.length;
      }

      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  const durationMs = Date.now() - startedAt;

  return new Response(
    JSON.stringify(
      {
        ok: true,
        durationMs,
        endpoints: stats.length,
        rowsCollected: totalRows.length,
        departmentCrawl: departmentStats,
        studentZoneCrawl: studentZoneStats,
        staticSeeds: seedRows.length,
        incremental: upsertStats,
        removal: removalStats,
        perEndpoint: stats,
      },
      null,
      2,
    ),

    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
