import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Bell, FileText, GraduationCap, Award, Loader2, ExternalLink, Copy, Check, Download, Search,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { normalizeUrl, openSmart, hostnameOf, detectContentKind } from './linkUtils';

type CategoryId = 'syllabus' | 'notifications' | 'papers' | 'results' | 'admission';

type Category = {
  id: CategoryId;
  label: string;
  icon: typeof BookOpen;
  /** Words matched against document title / URL in the indexed CUK library. */
  terms: string[];
  emptyHint: string;
};

const CATEGORIES: Category[] = [
  {
    id: 'syllabus',
    label: 'Syllabus',
    icon: BookOpen,
    terms: ['syllab', 'curricul', 'scheme', 'course structure'],
    emptyHint: 'No syllabus documents indexed yet.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    terms: ['notification', 'notice', 'circular', 'date sheet', 'datesheet'],
    emptyHint: 'No notifications indexed yet.',
  },
  {
    id: 'papers',
    label: 'Previous papers',
    icon: FileText,
    terms: ['question paper', 'previous year', 'past paper', 'model paper', 'sample paper'],
    emptyHint: 'No previous question papers indexed yet.',
  },
  {
    id: 'results',
    label: 'Results',
    icon: Award,
    terms: ['result', 'gazette', 'marks'],
    emptyHint: 'No result documents indexed yet.',
  },
  {
    id: 'admission',
    label: 'Admission',
    icon: GraduationCap,
    terms: ['admission', 'prospectus', 'cuet', 'eligibility', 'entrance'],
    emptyHint: 'No admission documents indexed yet.',
  },
];

type DocRow = { id: string; url: string; title: string | null; is_pdf: boolean };

const PAGE_SIZE = 60;

function scoreRow(r: DocRow): number {
  let score = 0;
  if (r.url.includes('/functions/v1/cuk-doc')) score += 4; // our own imported documents
  if (r.is_pdf) score += 2;
  if (r.title && r.title.length > 12) score += 1;
  return score;
}

export function OfficialPages({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState<CategoryId>('syllabus');
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const category = CATEGORIES.find((c) => c.id === active) ?? CATEGORIES[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setShowAll(false);

    const orExpr = category.terms
      .flatMap((t) => [`title.ilike.%${t}%`, `url.ilike.%${t}%`])
      .join(',');

    supabase
      .from('cuk_pages')
      .select('id, url, title, is_pdf')
      .is('removed_at', null)
      .or(orExpr)
      .order('is_pdf', { ascending: false })
      .order('last_crawled_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError('Could not load official documents right now.');
          setRows([]);
        } else {
          const seen = new Set<string>();
          const unique = (data ?? []).filter((r) => {
            const key = (r.url || '').replace(/[?#].*$/, '').toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }) as DocRow[];
          unique.sort((a, b) => scoreRow(b) - scoreRow(a));
          setRows(unique);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [category]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.title ?? ''} ${r.url}`.toLowerCase().includes(q));
  }, [rows, filter]);

  const visible = showAll ? filtered : filtered.slice(0, 6);

  return (
    <div className={cn('w-full text-left', compact ? '' : 'max-w-[300px] pt-2')}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Official pages &amp; documents
      </p>

      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const isActive = c.id === active;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              aria-pressed={isActive}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 text-[10px] px-1.5 py-1.5 rounded-md border transition-colors',
                isActive
                  ? 'border-primary bg-primary/15 text-primary font-medium'
                  : 'border-primary/20 bg-primary/5 hover:bg-primary/10',
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-full">{c.label}</span>
            </button>
          );
        })}
      </div>

      <div className="relative mb-1.5">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${category.label.toLowerCase()}…`}
          aria-label={`Filter ${category.label} documents`}
          className="w-full text-[11px] rounded-md border border-primary/20 bg-background pl-6 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading official documents…
        </div>
      )}

      {!loading && error && (
        <p className="py-2 text-[11px] text-destructive">{error}</p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="py-2 text-[11px] text-muted-foreground">
          {filter ? 'Nothing matches that filter.' : category.emptyHint}
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <ul className="space-y-1">
            {visible.map((r) => (
              <DocRowItem key={r.id} row={r} />
            ))}
          </ul>
          {filtered.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="mt-1 text-[11px] text-primary hover:underline"
            >
              {showAll ? 'Show less' : `Show all ${filtered.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DocRowItem({ row }: { row: DocRow }) {
  const [copied, setCopied] = useState(false);
  const safeUrl = normalizeUrl(row.url);
  const isPdf = row.is_pdf || detectContentKind(safeUrl) === 'pdf';
  const title = row.title?.trim() || row.url;

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    openSmart(safeUrl, row.url !== safeUrl ? row.url : null, title);
  };

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(safeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <li className="group flex items-start gap-1.5 rounded-md p-1 -ml-1 hover:bg-accent/40 transition-colors">
      <a
        href={safeUrl}
        onClick={open}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-1.5 flex-1 min-w-0"
      >
        <FileText className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isPdf ? 'text-red-500' : 'text-muted-foreground')} />
        <span className="flex-1 min-w-0">
          <span className="block text-[11.5px] leading-snug font-medium text-foreground group-hover:text-primary group-hover:underline line-clamp-2">
            {title}
            {isPdf && <span className="ml-1 text-[9.5px] text-muted-foreground">(PDF)</span>}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">{hostnameOf(safeUrl)}</span>
        </span>
      </a>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={copy}
          title={copied ? 'Copied!' : 'Copy link'}
          aria-label={`Copy link to ${title}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        </button>
        {isPdf && (
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            title="Download PDF"
            aria-label={`Download ${title}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
          >
            <Download className="h-3 w-3" />
          </a>
        )}
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          aria-label={`Open ${title} in new tab`}
          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </li>
  );
}
