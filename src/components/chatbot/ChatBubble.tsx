import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, Bot, User, Trash2, RotateCw, FileText, ExternalLink, Link as LinkIcon, GraduationCap, BookOpen, Bell, Download, Zap, Cpu, FlaskConical, Calculator, Languages, Scale, Briefcase, Landmark, Palette, Globe, Leaf, HeartPulse, Building2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';

export type CitedSource = { index: number; title: string; url: string; isPdf?: boolean };
type Message = { role: 'user' | 'assistant'; content: string; error?: boolean; sources?: CitedSource[]; correlationId?: string };


const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/university-chatbot`;

const STORAGE_KEY = 'cuk-chatbot-history-v1';

// Lightweight heuristic mirroring backend isUniversityQuery — used only to pick
// the correct loading label ("Searching CUK website..." vs "Thinking...").
const UNIVERSITY_HINTS = [
  'cuk', 'central university', 'kashmir', 'university', 'chancellor',
  'phd', 'mba', 'mca', 'btech', 'bsc', 'msc', 'semester', 'admission',
  'admissions', 'apply', 'application', 'cuet', 'merit', 'eligibility',
  'fee', 'fees', 'result', 'results', 'datesheet', 'date sheet', 'syllabus',
  'course', 'programme', 'faculty', 'professor', 'department', 'school',
  'scholarship', 'notice', 'notification', 'circular', 'recruitment',
  'vacancy', 'tender', 'hostel', 'placement', 'contact', 'email', 'phone',
  'address', 'download', 'form', 'brochure', 'who is', 'tell me about',
  'pdf', 'document', 'convocation', 'holiday', 'academic calendar',
];
function isUniversityQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return UNIVERSITY_HINTS.some((k) => lower.includes(k));
}

function newCorrelationId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* ignore */ }
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_CONSECUTIVE_PARSE_ERRORS = 5;

async function streamChat({
  messages,
  signal,
  correlationId,
  onCorrelationId,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  signal: AbortSignal;
  correlationId: string;
  onCorrelationId: (cid: string) => void;
  onDelta: (text: string, suggestions?: string[], sources?: CitedSource[]) => void;
  onDone: () => void;
  onError: (msg: string, serverCorrelationId?: string) => void;

}) {
  // Resolves to the best-known correlation id (server-confirmed if available).
  let resolvedCid = correlationId;
  const setCid = (cid?: string | null) => {
    if (cid && cid !== resolvedCid) {
      resolvedCid = cid;
      onCorrelationId(cid);
    }
  };

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    onError('Please sign in again to use the assistant.', resolvedCid);
    return;
  }

  // Local timeout — chained to the external abort signal so user aborts still cancel us.
  const timeoutCtl = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    timeoutCtl.abort();
  }, REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => timeoutCtl.abort();
  signal.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
      signal: timeoutCtl.signal,
    });

    setCid(resp.headers.get('x-correlation-id'));

    if (!resp.ok) {
      let serverCid: string | undefined;
      let errMsg = `Error ${resp.status}`;
      try {
        const data = await resp.json();
        if (data?.correlation_id) serverCid = String(data.correlation_id);
        if (data?.error) errMsg = String(data.error);
      } catch (parseErr) {
        // eslint-disable-next-line no-console
        console.warn('[chatbot] failed to parse error body', { correlation_id: resolvedCid, parseErr });
        errMsg = `Request failed (${resp.status}) — response was not valid JSON`;
      }
      setCid(serverCid);
      onError(errMsg, resolvedCid);
      return;
    }

    if (!resp.body) { onError('No response body', resolvedCid); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;
    let consecutiveParseErrors = 0;

    while (!done) {
      const { done: rdone, value } = await reader.read();
      if (rdone) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') { done = true; break; }
        try {
          const parsed = JSON.parse(json);
          consecutiveParseErrors = 0;
          if (parsed.correlation_id) setCid(String(parsed.correlation_id));
          const content = parsed.choices?.[0]?.delta?.content;
          const suggestions = parsed.follow_up_suggestions;
          const srcs: CitedSource[] | undefined = Array.isArray(parsed.sources) ? parsed.sources : undefined;
          if (content || (Array.isArray(suggestions) && suggestions.length > 0) || (srcs && srcs.length > 0)) {
            onDelta(content || '', suggestions, srcs);
          }

        } catch {
          // Likely a chunk boundary mid-JSON — re-buffer and wait for more bytes.
          buffer = line + '\n' + buffer;
          consecutiveParseErrors += 1;
          if (consecutiveParseErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
            // eslint-disable-next-line no-console
            console.error('[chatbot] stream parse error', { correlation_id: resolvedCid, sample: json.slice(0, 120) });
            onError('Received malformed stream from server.', resolvedCid);
            return;
          }
          break;
        }
      }
    }
    onDone();
  } catch (err) {
    // Distinguish timeout from external abort vs network failure — all must include the cid.
    if (timedOut) {
      // eslint-disable-next-line no-console
      console.error('[chatbot] timeout', { correlation_id: resolvedCid, after_ms: REQUEST_TIMEOUT_MS });
      onError(`Request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s. Please try again.`, resolvedCid);
      return;
    }
    if (signal.aborted) {
      // User aborted (new send / unmount / clear) — caller already handles silently.
      throw err;
    }
    const msg = err instanceof Error ? err.message : 'Network request failed';
    // eslint-disable-next-line no-console
    console.error('[chatbot] network error', { correlation_id: resolvedCid, err: msg });
    onError(`Failed to connect: ${msg}`, resolvedCid);
  } finally {
    window.clearTimeout(timeoutId);
    signal.removeEventListener('abort', onExternalAbort);
  }
}

const SUGGESTIONS = [
  'How do I upload a paper?',
  'CUK admission process & eligibility',
  'Contact details of CUK departments',
  'Latest notices from Central University of Kashmir',
];

type QuickAction = {
  id: string;
  label: string;
  icon: typeof GraduationCap;
  prompt: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'btech',
    label: 'B.Tech resources',
    icon: GraduationCap,
    prompt: 'List the official B.Tech (Computer Science) resources at Central University of Kashmir — syllabus PDFs, scheme of studies, study material and department page. Give exact direct links (PDFs preferred) for each semester you can find.',
  },
  {
    id: 'syllabi',
    label: 'Syllabi & curricula',
    icon: BookOpen,
    prompt: 'Show me the latest official CUK syllabus / curriculum PDFs for all departments. Return direct links to the exact PDF documents, grouped by school/department.',
  },
  {
    id: 'notices',
    label: 'Exam notifications',
    icon: Bell,
    prompt: 'List the latest CUK exam notifications, date sheets and examination notices from the official Central University of Kashmir website. Include the notice title, date and a direct link to each PDF.',
  },
  {
    id: 'downloads',
    label: 'Downloads & forms',
    icon: Download,
    prompt: 'List the official CUK downloads — application forms, admission forms, examination forms, fee forms and student forms. Give the exact direct PDF link for each form.',
  },
  {
    id: 'admissions',
    label: 'Admissions',
    icon: Zap,
    prompt: 'Give me the current CUK admission notification, eligibility criteria, important dates and the official admission portal / prospectus PDF link.',
  },
  {
    id: 'results',
    label: 'Results',
    icon: FileText,
    prompt: 'Show the latest official CUK examination results notices with direct links to the result PDFs / result portal.',
  },
  // Department-specific quick actions
  { id: 'dept-cse', label: 'Computer Science', icon: Cpu, prompt: 'List official Central University of Kashmir Department of Computer Science resources — syllabus, scheme, faculty page, notices and study material. Give direct PDF / page links.' },
  { id: 'dept-it', label: 'Information Tech', icon: Cpu, prompt: 'Give official CUK Department of Information Technology resources — syllabus PDFs, faculty, notices and department page links.' },
  { id: 'dept-electronics', label: 'Electronics', icon: Cpu, prompt: 'Give official CUK Department of Electronics and Communication Engineering resources — syllabus, scheme, faculty and notices with direct links.' },
  { id: 'dept-math', label: 'Mathematics', icon: Calculator, prompt: 'List official CUK Department of Mathematics resources — syllabus PDFs (M.Sc / Ph.D), faculty and notices with exact links.' },
  { id: 'dept-physics', label: 'Physics', icon: FlaskConical, prompt: 'List official CUK Department of Physics resources — syllabus, faculty, research and notices with direct links.' },
  { id: 'dept-chemistry', label: 'Chemistry', icon: FlaskConical, prompt: 'List official CUK Department of Chemistry resources — syllabus PDFs, faculty and notices with direct links.' },
  { id: 'dept-bio', label: 'Biotechnology', icon: Leaf, prompt: 'Give official CUK Department of Biotechnology resources — syllabus, faculty, labs and notices with direct links.' },
  { id: 'dept-env', label: 'Environmental Sci', icon: Leaf, prompt: 'Give official CUK Department of Environmental Science resources — syllabus PDFs, faculty and notices with direct links.' },
  { id: 'dept-mba', label: 'Management (MBA)', icon: Briefcase, prompt: 'List official CUK Department of Management Studies (MBA) resources — syllabus PDFs, admission notice, faculty and notices with direct links.' },
  { id: 'dept-econ', label: 'Economics', icon: Landmark, prompt: 'List official CUK Department of Economics resources — syllabus, faculty and notices with direct links.' },
  { id: 'dept-law', label: 'Law', icon: Scale, prompt: 'List official CUK Department of Law (School of Legal Studies) resources — syllabus PDFs, faculty, notices and admission links.' },
  { id: 'dept-edu', label: 'Education', icon: BookOpen, prompt: 'List official CUK Department of Education resources — B.Ed / M.Ed syllabus, faculty and notices with direct links.' },
  { id: 'dept-english', label: 'English', icon: Languages, prompt: 'List official CUK Department of English resources — syllabus, faculty, notices with direct links.' },
  { id: 'dept-urdu', label: 'Urdu', icon: Languages, prompt: 'List official CUK Department of Urdu resources — syllabus PDFs, faculty and notices with direct links.' },
  { id: 'dept-hindi', label: 'Hindi', icon: Languages, prompt: 'List official CUK Department of Hindi resources — syllabus, faculty and notices with direct links.' },
  { id: 'dept-kashmiri', label: 'Kashmiri', icon: Languages, prompt: 'List official CUK Department of Kashmiri resources — syllabus PDFs, faculty and notices with direct links.' },
  { id: 'dept-arabic', label: 'Arabic', icon: Languages, prompt: 'List official CUK Department of Arabic resources — syllabus, faculty and notices with direct links.' },
  { id: 'dept-history', label: 'History', icon: Landmark, prompt: 'List official CUK Department of History resources — syllabus, faculty and notices with direct links.' },
  { id: 'dept-politics', label: 'Politics & Governance', icon: Landmark, prompt: 'List official CUK Department of Politics and Governance resources — syllabus, faculty and notices with direct links.' },
  { id: 'dept-tourism', label: 'Tourism Studies', icon: Globe, prompt: 'List official CUK Department of Tourism Studies resources — syllabus PDFs, faculty and notices with direct links.' },
  { id: 'dept-media', label: 'Media Studies', icon: Palette, prompt: 'List official CUK Department of Convergent Journalism / Media Studies resources — syllabus PDFs, faculty and notices with direct links.' },
  { id: 'dept-music', label: 'Music & Fine Arts', icon: Palette, prompt: 'List official CUK Department of Music and Fine Arts resources — syllabus, faculty and notices with direct links.' },
  { id: 'dept-sw', label: 'Social Work', icon: HeartPulse, prompt: 'List official CUK Department of Social Work resources — MSW syllabus PDFs, faculty and notices with direct links.' },
  { id: 'dept-isl', label: 'Islamic Studies', icon: BookOpen, prompt: 'List official CUK Department of Islamic Studies resources — syllabus, faculty and notices with direct links.' },
  { id: 'schools', label: 'All schools & depts', icon: Building2, prompt: 'List every School and Department at Central University of Kashmir with their official department page link. Group by school.' },
];

type DeptCourse = { id: string; label: string; icon: typeof GraduationCap; full: string };

const DEPARTMENTS: DeptCourse[] = [
  { id: 'cse', label: 'Computer Science', icon: Cpu, full: 'Department of Computer Science' },
  { id: 'it', label: 'Information Technology', icon: Cpu, full: 'Department of Information Technology' },
  { id: 'ece', label: 'Electronics & Comm', icon: Cpu, full: 'Department of Electronics and Communication Engineering' },
  { id: 'math', label: 'Mathematics', icon: Calculator, full: 'Department of Mathematics' },
  { id: 'phy', label: 'Physics', icon: FlaskConical, full: 'Department of Physics' },
  { id: 'chem', label: 'Chemistry', icon: FlaskConical, full: 'Department of Chemistry' },
  { id: 'bio', label: 'Biotechnology', icon: Leaf, full: 'Department of Biotechnology' },
  { id: 'env', label: 'Environmental Science', icon: Leaf, full: 'Department of Environmental Science' },
  { id: 'mba', label: 'Management (MBA)', icon: Briefcase, full: 'Department of Management Studies (MBA)' },
  { id: 'econ', label: 'Economics', icon: Landmark, full: 'Department of Economics' },
  { id: 'law', label: 'Law', icon: Scale, full: 'Department of Law (School of Legal Studies)' },
  { id: 'edu', label: 'Education', icon: BookOpen, full: 'Department of Education (B.Ed / M.Ed)' },
  { id: 'eng', label: 'English', icon: Languages, full: 'Department of English' },
  { id: 'urdu', label: 'Urdu', icon: Languages, full: 'Department of Urdu' },
  { id: 'hindi', label: 'Hindi', icon: Languages, full: 'Department of Hindi' },
  { id: 'kash', label: 'Kashmiri', icon: Languages, full: 'Department of Kashmiri' },
  { id: 'arab', label: 'Arabic', icon: Languages, full: 'Department of Arabic' },
  { id: 'hist', label: 'History', icon: Landmark, full: 'Department of History' },
  { id: 'pol', label: 'Politics & Governance', icon: Landmark, full: 'Department of Politics and Governance' },
  { id: 'tour', label: 'Tourism Studies', icon: Globe, full: 'Department of Tourism Studies' },
  { id: 'media', label: 'Convergent Journalism', icon: Palette, full: 'Department of Convergent Journalism / Media Studies' },
  { id: 'music', label: 'Music & Fine Arts', icon: Palette, full: 'Department of Music and Fine Arts' },
  { id: 'sw', label: 'Social Work', icon: HeartPulse, full: 'Department of Social Work (MSW)' },
  { id: 'isl', label: 'Islamic Studies', icon: BookOpen, full: 'Department of Islamic Studies' },
];

type CourseAction = { id: 'syllabus' | 'notifications' | 'papers'; label: string; icon: typeof BookOpen; build: (d: DeptCourse) => string };

const COURSE_ACTIONS: CourseAction[] = [
  {
    id: 'syllabus',
    label: 'Syllabus',
    icon: BookOpen,
    build: (d) => `Give me the latest official syllabus / curriculum PDFs for the Central University of Kashmir ${d.full}. List each programme (UG/PG/Ph.D) with a direct link to the exact PDF on cukashmir.ac.in.`,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    build: (d) => `List the latest official notifications, notices and circulars from the Central University of Kashmir ${d.full}. Include title, date and a direct link to each PDF / page.`,
  },
  {
    id: 'papers',
    label: 'Previous papers',
    icon: FileText,
    build: (d) => `Find official previous year question papers / past exam papers published by the Central University of Kashmir ${d.full}. Give direct PDF links for each semester / paper you can locate.`,
  },
];

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist history to sessionStorage on every change so closing the widget
  // does not wipe the conversation.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* quota / disabled — ignore */ }
  }, [messages]);

  // Auto-scroll on every render — streaming mutates the last message in place
  // (same array ref), so depending on `messages` would miss those updates.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  });

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Abort any in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'user'),
    [messages],
  );
  const loadingLabel = lastUserMessage && isUniversityQuery(lastUserMessage.content)
    ? 'Searching CUK website...'
    : 'Thinking...';

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // Cancel any in-flight stream so its setMessages calls don't corrupt state.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = { role: 'user', content: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsLoading(true);
    setFollowUps([]);

    let assistantSoFar = '';
    let latestSuggestions: string[] = [];
    let latestSources: CitedSource[] = [];

    const upsert = (chunk: string, suggestions?: string[], sources?: CitedSource[], opts?: { error?: boolean }) => {
      assistantSoFar += chunk;
      if (suggestions && suggestions.length > 0) latestSuggestions = suggestions;
      if (sources && sources.length > 0) latestSources = sources;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: assistantSoFar, error: opts?.error ?? m.error, sources: latestSources.length > 0 ? latestSources : m.sources }
              : m,
          );
        }
        return [...prev, { role: 'assistant', content: assistantSoFar, error: opts?.error, sources: latestSources.length > 0 ? latestSources : undefined }];
      });
    };

    const correlationId = newCorrelationId();
    let resolvedCid = correlationId;
    try {
      await streamChat({
        messages: nextHistory,
        signal: controller.signal,
        correlationId,
        onCorrelationId: (cid) => { resolvedCid = cid; },
        onDelta: (c, s, src) => upsert(c, s, src),
        onDone: () => {
          if (controller.signal.aborted) return;
          setIsLoading(false);
          if (latestSuggestions.length > 0) setFollowUps(latestSuggestions);
        },
        onError: (msg, serverCid) => {
          if (controller.signal.aborted) return;
          const cid = serverCid || resolvedCid;
          // eslint-disable-next-line no-console
          console.error('[chatbot] error', { correlation_id: cid, message: msg });
          upsert(`⚠️ ${msg}\n\n_Reference ID: \`${cid}\`_`, undefined, undefined, { error: true });
          setIsLoading(false);
        },
      });

    } catch (err) {
      if (controller.signal.aborted) return;
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort) {
        // eslint-disable-next-line no-console
        console.error('[chatbot] network failure', { correlation_id: resolvedCid, err });
        upsert(`⚠️ Failed to connect. Please try again.\n\n_Reference ID: \`${resolvedCid}\`_`, undefined, undefined, { error: true });
        setIsLoading(false);
      }
    }
  }, [messages, isLoading]);

  const handleRetry = useCallback(() => {
    if (isLoading) return;
    // Find last user message and drop trailing failed assistant message before resending.
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const lastUserText = messages[lastUserIdx].content;
    setMessages((prev) => prev.slice(0, lastUserIdx));
    // sendMessage will re-append the user message.
    sendMessage(lastUserText);
  }, [messages, isLoading, sendMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setFollowUps([]);
    setIsLoading(false);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const lastMessage = messages[messages.length - 1];
  const showRetry = !isLoading && lastMessage?.role === 'assistant' && lastMessage.error;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          aria-label={messages.length > 0 ? 'Resume chat with university assistant' : 'Open chat assistant'}
          aria-haspopup="dialog"
        >
          <MessageCircle className="h-6 w-6" />
          {messages.length > 0 && (
            <span
              className="absolute top-1 right-1 h-3 w-3 rounded-full bg-success ring-2 ring-background"
              aria-label="You have an ongoing conversation"
            />
          )}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="University Assistant chat"
          className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">University Assistant</p>
                <p className="text-[11px] text-muted-foreground">AI-powered help</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearChat}
                  title="Clear chat"
                  aria-label="Clear chat history"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">How can I help you?</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask anything about CUK or the exam paper system</p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left text-xs px-3 py-2 rounded-lg border hover:bg-accent transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="w-full max-w-[300px] pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 text-left">
                    Quick actions
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_ACTIONS.map((a) => {
                      const Icon = a.icon;
                      return (
                        <button
                          key={a.id}
                          onClick={() => sendMessage(a.prompt)}
                          className="flex items-center gap-1.5 text-left text-[11px] px-2 py-1.5 rounded-md border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                          title={a.prompt}
                        >
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <DepartmentCourseActions
                  sendMessage={sendMessage}
                  disabled={isLoading}
                />
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div key={i} className="space-y-2">
                    <div className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                      {m.role === 'assistant' && (
                        <div className={cn(
                          'h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                          m.error ? 'bg-destructive/10' : 'bg-primary/10',
                        )}>
                          <Bot className={cn('h-3 w-3', m.error ? 'text-destructive' : 'text-primary')} />
                        </div>
                      )}
                      <div className={cn(
                        'max-w-[80%] rounded-xl px-3 py-2 text-sm',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : m.error
                            ? 'bg-destructive/10 text-destructive rounded-bl-sm border border-destructive/20'
                            : 'bg-muted rounded-bl-sm',
                      )}>
                        {m.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ol]:mb-1.5 [&>p:last-child]:mb-0 [&_a]:text-blue-400 [&_a]:underline [&_a]:break-all">
                            <ReactMarkdown
                              components={{
                                a: ({ href, children }) => {
                                  const isPdf = !!href && /\.pdf(\?|#|$)/i.test(href);
                                  const pageMatch = href?.match(/[#&]page=(\d+)/i);
                                  const hashMatch = href?.match(/#([^&]+)$/);
                                  const anchorLabel = pageMatch
                                    ? `p.${pageMatch[1]}`
                                    : hashMatch && !pageMatch && !/^page=/i.test(hashMatch[1])
                                    ? `§ ${decodeURIComponent(hashMatch[1]).replace(/[-_]/g, ' ').slice(0, 32)}`
                                    : null;
                                  return (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={isPdf ? `Open PDF${pageMatch ? ` at page ${pageMatch[1]}` : ''} in new tab` : href}
                                      className="inline-flex items-center gap-1"
                                    >
                                      {children}
                                      {isPdf && (
                                        <span className="ml-1 inline-flex items-center rounded bg-red-500/15 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-red-400 no-underline">
                                          PDF
                                        </span>
                                      )}
                                      {anchorLabel && (
                                        <span className="ml-1 inline-flex items-center rounded bg-blue-500/15 px-1 py-px text-[10px] font-semibold tracking-wide text-blue-400 no-underline">
                                          {anchorLabel}
                                        </span>
                                      )}
                                    </a>
                                  );
                                },
                              }}
                            >{m.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <span>{m.content}</span>
                        )}
                      </div>
                      {m.role === 'user' && (
                        <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    {m.role === 'assistant' && !m.error && m.sources && m.sources.length > 0 && (
                      <div className="pl-8">
                        <SourcesPanel sources={m.sources} />
                      </div>
                    )}
                  </div>
                ))}


                {showRetry && (
                  <div className="pl-8">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRetry}
                      className="h-7 text-xs gap-1.5"
                      aria-label="Retry last message"
                    >
                      <RotateCw className="h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                )}

                {/* Follow-up suggestion chips */}
                {!isLoading && !showRetry && followUps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-8">
                    {followUps.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-[11px] px-2.5 py-1.5 rounded-full border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2.5 space-y-2 w-[70%]">
                  <p className="text-[10px] text-muted-foreground mb-1.5">{loadingLabel}</p>
                  <Skeleton className="h-3 w-[90%]" />
                  <Skeleton className="h-3 w-[75%]" />
                  <Skeleton className="h-3 w-[60%]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t">
            {messages.length > 0 && (
              <div className="px-2 pt-2 pb-1 flex gap-1 overflow-x-auto scrollbar-none">
                {QUICK_ACTIONS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => sendMessage(a.prompt)}
                      disabled={isLoading}
                      className="flex items-center gap-1 shrink-0 text-[10.5px] px-2 py-1 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50"
                      title={a.prompt}
                    >
                      <Icon className="h-3 w-3 text-primary" />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {messages.length > 0 && (
              <div className="px-2 pb-2">
                <DepartmentCourseActions sendMessage={sendMessage} disabled={isLoading} compact />
              </div>
            )}
            <div className="px-3 py-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... (Shift+Enter for newline)"
                rows={1}
                aria-label="Chat message"
                className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none max-h-[120px] min-h-[36px] py-2"
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            </div>
          </div>
        </div>

      )}
    </>
  );
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function SourcesPanel({ sources }: { sources: CitedSource[] }) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const visible = expanded ? sources : sources.slice(0, 3);
  const pdfSources = sources.filter((s) => s.isPdf);

  const handleDownloadAll = async () => {
    if (downloading || pdfSources.length === 0) return;
    setDownloading(true);
    try {
      for (let i = 0; i < pdfSources.length; i++) {
        const s = pdfSources[i];
        const a = document.createElement('a');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = (s.title || `source-${s.index}`).replace(/[\\/:*?"<>|]+/g, '_');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // stagger to avoid popup-blocker drops
        await new Promise((r) => setTimeout(r, 350));
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section
      aria-label="Sources cited in this answer"
      className="rounded-lg border border-border/60 bg-card/50 px-3 py-2"
    >
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sources ({sources.length})
        </p>
        <div className="flex items-center gap-2">
          {pdfSources.length >= 2 && (
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={downloading}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Download all ${pdfSources.length} PDFs`}
              title="Download every eligible PDF cited above"
            >
              <Download className="h-3 w-3" />
              {downloading ? 'Downloading…' : `Download all PDFs (${pdfSources.length})`}
            </button>
          )}
          {sources.length > 3 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-[11px] text-primary hover:underline"
            >
              {expanded ? 'Show less' : `Show all ${sources.length}`}
            </button>
          )}
        </div>
      </div>
      <ol className="space-y-1.5">
        {visible.map((s) => (
          <SourceRow key={`${s.index}-${s.url}`} source={s} />
        ))}
      </ol>
    </section>
  );
}


function SourceRow({ source: s }: { source: CitedSource }) {
  const [copied, setCopied] = useState(false);
  const Icon = s.isPdf ? FileText : LinkIcon;
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(s.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <li>
      <div className="group flex items-start gap-2 rounded-md p-1 -ml-1 transition-colors hover:bg-accent/40">
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open source ${s.index}: ${s.title || s.url}`}
          className="flex items-start gap-2 flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <span className="mt-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
            {s.index}
          </span>
          <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 min-w-0 text-[12px] leading-snug">
            <span className="block truncate font-medium text-foreground group-hover:text-primary group-hover:underline">
              {s.title || s.url}
              {s.isPdf && <span className="ml-1 text-[10px] text-muted-foreground">(PDF)</span>}
            </span>
            <span className="block truncate text-[10.5px] text-muted-foreground">
              {hostnameOf(s.url)}
            </span>
          </span>
        </a>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Link copied' : `Copy link to ${s.title || s.url}`}
            title={copied ? 'Copied!' : 'Copy link'}
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          </button>
          {s.isPdf && (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              aria-label={`Download PDF: ${s.title || s.url}`}
              title="Download PDF"
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Download className="h-3 w-3" />
            </a>
          )}
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${s.title || s.url} in new tab`}
            title="Open in new tab"
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </li>
  );
}

function DepartmentCourseActions({
  sendMessage,
  disabled,
  compact = false,
}: {
  sendMessage: (text: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [deptId, setDeptId] = useState<string>(DEPARTMENTS[0].id);
  const dept = DEPARTMENTS.find((d) => d.id === deptId) || DEPARTMENTS[0];
  const DeptIcon = dept.icon;
  return (
    <div className={cn('w-full', compact ? '' : 'max-w-[300px] pt-2')}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 text-left">
        Course resources by department
      </p>
      <div className="flex items-center gap-1.5 mb-1.5">
        <DeptIcon className="h-3.5 w-3.5 text-primary shrink-0" />
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          disabled={disabled}
          aria-label="Select department"
          className="flex-1 text-[11px] rounded-md border border-primary/20 bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {COURSE_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => sendMessage(a.build(dept))}
              disabled={disabled}
              title={a.build(dept)}
              className="flex flex-col items-center justify-center gap-0.5 text-[10px] px-1.5 py-1.5 rounded-md border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <Icon className="h-3 w-3 text-primary" />
              <span className="truncate">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


