import { toast } from 'sonner';

/** Turn a possibly relative / protocol-less URL into something openable. */
export function normalizeUrl(u?: string | null): string {
  if (!u) return '#';
  const s = String(u).trim();
  if (!s || s === '#') return '#';
  if (/^(mailto:|tel:|javascript:)/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `https://www.cukashmir.ac.in${s}`;
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return `https://${s}`;
  return s;
}

export type PreviewKind = 'pdf' | 'image' | 'office' | 'html' | 'other';

/** Guess the response content type from the URL extension. Cross-origin HEAD
 *  requests to cukashmir.ac.in / gov.in sites fail CORS, so we can't read the
 *  Content-Type header at runtime — extension is the reliable signal. */
export function detectContentKind(url: string): PreviewKind {
  if (!url || url === '#') return 'other';
  let pathname = url;
  try { pathname = new URL(url, 'https://x').pathname; } catch { /* ignore */ }
  // Our own document proxy serves PDFs via ?p=<path>.pdf
  if (/[?&]p=[^&]*\.pdf/i.test(url)) return 'pdf';
  const ext = pathname.split('.').pop()?.toLowerCase().split(/[?#]/)[0] ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext)) return 'office';
  if (['htm', 'html', ''].includes(ext)) return 'html';
  return 'other';
}

export const PREVIEW_EVENT = 'chat-preview:open';

/** Route a link to the best UX based on detected type:
 *  - PDF & image → inline viewer dialog (dispatches a custom event).
 *  - Office docs → Office Web Viewer in a new tab (inline in-browser render).
 *  - HTML / other → open in new tab (browser handles redirects, 404s natively). */
export function openSmart(primary: string, fallback?: string | null, title?: string): string | null {
  const candidates = [primary, fallback && fallback !== primary ? fallback : null].filter(
    (u): u is string => !!u && u !== '#',
  );
  if (candidates.length === 0) {
    toast.error("This link doesn't have a valid URL.");
    return null;
  }
  const url = candidates[0];
  const kind = detectContentKind(url);

  if (kind === 'pdf' || kind === 'image') {
    window.dispatchEvent(
      new CustomEvent(PREVIEW_EVENT, { detail: { url, kind, title, fallback: candidates[1] ?? null } }),
    );
    return url;
  }

  let openUrl = url;
  if (kind === 'office') {
    openUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
  }
  const opened = window.open(openUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    toast.error('Popup blocked — allow popups to open sources.', { description: openUrl });
    return null;
  }
  return openUrl;
}

export function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
