import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, Bot, User, Trash2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string; error?: boolean };

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

async function streamChat({
  messages,
  signal,
  correlationId,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  signal: AbortSignal;
  correlationId: string;
  onDelta: (text: string, suggestions?: string[]) => void;
  onDone: () => void;
  onError: (msg: string, serverCorrelationId?: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    onError('Please sign in again to use the assistant.', correlationId);
    return;
  }
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
    signal,
  });

  const serverCorrelationId = resp.headers.get('x-correlation-id') || correlationId;

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: 'Request failed' }));
    onError(data.error || `Error ${resp.status}`, data.correlation_id || serverCorrelationId);
    return;
  }

  if (!resp.body) { onError('No response body', serverCorrelationId); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

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
        const content = parsed.choices?.[0]?.delta?.content;
        const suggestions = parsed.follow_up_suggestions;
        if (content) onDelta(content, suggestions);
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }
  onDone();
}

const SUGGESTIONS = [
  'How do I upload a paper?',
  'CUK admission process & eligibility',
  'Contact details of CUK departments',
  'Latest notices from Central University of Kashmir',
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

    const upsert = (chunk: string, suggestions?: string[], opts?: { error?: boolean }) => {
      assistantSoFar += chunk;
      if (suggestions && suggestions.length > 0) latestSuggestions = suggestions;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: assistantSoFar, error: opts?.error ?? m.error }
              : m,
          );
        }
        return [...prev, { role: 'assistant', content: assistantSoFar, error: opts?.error }];
      });
    };

    try {
      await streamChat({
        messages: nextHistory,
        signal: controller.signal,
        onDelta: (c, s) => upsert(c, s),
        onDone: () => {
          if (controller.signal.aborted) return;
          setIsLoading(false);
          if (latestSuggestions.length > 0) setFollowUps(latestSuggestions);
        },
        onError: (msg) => {
          if (controller.signal.aborted) return;
          upsert(`⚠️ ${msg}`, undefined, { error: true });
          setIsLoading(false);
        },
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort) {
        upsert('⚠️ Failed to connect. Please try again.', undefined, { error: true });
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
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
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
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer">
                                  {children}
                                </a>
                              ),
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
          <div className="border-t px-3 py-2.5">
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
      )}
    </>
  );
}
