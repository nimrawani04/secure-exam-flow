import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const STORAGE_KEY = 'secure_exam_cookie_consent';

export interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  security: boolean;
}

const defaultPreferences: CookiePreferences = {
  necessary: true,
  functional: true,
  analytics: false,
  security: true,
};

export const openCookiePreferences = () => {
  window.dispatchEvent(new CustomEvent('open-cookie-preferences'));
};

export function CookieConsent() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    const handleOpenModal = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.preferences) {
            setPreferences(parsed.preferences);
          }
        }
      } catch {
        // Fall back to current state
      }
      setShowCustomize(true);
    };

    window.addEventListener('open-cookie-preferences', handleOpenModal);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences(parsed.preferences || defaultPreferences);
        setIsOpen(false);
      } else {
        const timer = setTimeout(() => setIsOpen(true), 500);
        return () => clearTimeout(timer);
      }
    } catch {
      setIsOpen(true);
    }

    return () => {
      window.removeEventListener('open-cookie-preferences', handleOpenModal);
    };
  }, []);

  const saveConsent = (prefs: CookiePreferences, status: 'all' | 'rejected' | 'customized') => {
    const payload = {
      status,
      preferences: prefs,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: payload }));
    } catch (e) {
      console.warn('Could not save cookie consent to localStorage:', e);
    }
    setPreferences(prefs);
    setIsOpen(false);
    setShowCustomize(false);

    if (status === 'all') {
      toast.success('All cookies accepted');
    } else if (status === 'rejected') {
      toast.info('Optional cookies declined');
    } else {
      toast.success('Cookie preferences updated');
    }
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      functional: true,
      analytics: true,
      security: true,
    };
    saveConsent(allAccepted, 'all');
  };

  const handleRejectAll = () => {
    const onlyEssential: CookiePreferences = {
      necessary: true,
      functional: false,
      analytics: false,
      security: false,
    };
    saveConsent(onlyEssential, 'rejected');
  };

  const handleSaveCustom = () => {
    saveConsent(
      {
        ...preferences,
        necessary: true,
      },
      'customized'
    );
  };

  return (
    <>
      {/* Floating Cookie Consent Notice */}
      {isOpen && (
        <aside
          role="region"
          aria-label="Cookie consent banner"
          className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-[440px] z-50 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-[12px] p-5 shadow-lg dark:shadow-2xl text-slate-900 dark:text-slate-100 font-sans">
            <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Cookie settings
            </h2>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 mt-1.5">
              We use cookies and browser storage to maintain secure authentication, preserve your display preferences, and ensure dependable platform operations.
            </p>

            <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setShowCustomize(true)}
                className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a] dark:focus-visible:ring-slate-400 rounded-[6px] py-1 px-1 transition-colors"
              >
                Preferences
              </button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRejectAll}
                  className="h-8 px-3 text-[12.5px] font-medium text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-[6px] transition-colors focus-visible:ring-[#0f172a]"
                >
                  Reject optional
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAcceptAll}
                  className="h-8 px-3.5 text-[12.5px] font-medium text-white bg-[#0f172a] hover:bg-[#1e293b] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-[6px] transition-colors shadow-xs focus-visible:ring-[#0f172a]"
                >
                  Accept all
                </Button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Cookie Preferences Dialog */}
      <Dialog open={showCustomize} onOpenChange={setShowCustomize}>
        <DialogContent
          className="sm:max-w-[560px] p-0 gap-0 rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-xl overflow-hidden font-sans"
          aria-describedby="cookie-preferences-description"
        >
          <DialogHeader className="px-6 pt-6 pb-5 text-left border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-[24px] sm:text-[26px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Cookie preferences
            </DialogTitle>
            <DialogDescription
              id="cookie-preferences-description"
              className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400 mt-2"
            >
              Configure your consent preferences below. Strictly necessary storage ensures essential platform functionality and authentication sessions. Optional categories help optimize performance and remember your settings.
            </DialogDescription>
          </DialogHeader>

          {/* Compact Single-Column Preferences List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 px-6 max-h-[58vh] overflow-y-auto">
            {/* 1. Strictly Necessary */}
            <div className="py-4 first:pt-4 last:pb-4 flex items-start justify-between gap-4">
              <div className="space-y-1 pr-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[14.5px] font-medium text-slate-900 dark:text-slate-100 leading-snug">
                    Strictly necessary
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-[4px]">
                    Always active
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  Required for user authentication, encrypted session state, and navigation across secure examination workflows. These cannot be disabled.
                </p>
              </div>
              <Switch
                id="cookie-necessary"
                checked={true}
                disabled={true}
                aria-label="Strictly necessary cookies (Always active)"
                className="mt-0.5 shrink-0 data-[state=checked]:bg-[#0f172a] dark:data-[state=checked]:bg-slate-300 disabled:opacity-50"
              />
            </div>

            {/* 2. Security & Integrity */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="space-y-1 pr-2 min-w-0">
                <label
                  htmlFor="cookie-security"
                  className="text-[14.5px] font-medium text-slate-900 dark:text-slate-100 block cursor-pointer leading-snug"
                >
                  Security &amp; protection
                </label>
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  Validates session tokens and guards requests against tampering to protect user accounts and confidential exam data.
                </p>
              </div>
              <Switch
                id="cookie-security"
                checked={preferences.security}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, security: checked }))}
                aria-label="Security and protection cookies"
                className="mt-0.5 shrink-0 data-[state=checked]:bg-[#0f172a] dark:data-[state=checked]:bg-slate-100 focus-visible:ring-[#0f172a]"
              />
            </div>

            {/* 3. Functional */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="space-y-1 pr-2 min-w-0">
                <label
                  htmlFor="cookie-functional"
                  className="text-[14.5px] font-medium text-slate-900 dark:text-slate-100 block cursor-pointer leading-snug"
                >
                  Functional &amp; preferences
                </label>
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  Remembers your interface choices such as display themes, active academic sessions, and table pagination settings.
                </p>
              </div>
              <Switch
                id="cookie-functional"
                checked={preferences.functional}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, functional: checked }))}
                aria-label="Functional and preferences cookies"
                className="mt-0.5 shrink-0 data-[state=checked]:bg-[#0f172a] dark:data-[state=checked]:bg-slate-100 focus-visible:ring-[#0f172a]"
              />
            </div>

            {/* 4. Analytics */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="space-y-1 pr-2 min-w-0">
                <label
                  htmlFor="cookie-analytics"
                  className="text-[14.5px] font-medium text-slate-900 dark:text-slate-100 block cursor-pointer leading-snug"
                >
                  Analytics &amp; performance
                </label>
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  Measures anonymous traffic and user interactions to help diagnose latency issues and improve system responsiveness.
                </p>
              </div>
              <Switch
                id="cookie-analytics"
                checked={preferences.analytics}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, analytics: checked }))}
                aria-label="Analytics and performance cookies"
                className="mt-0.5 shrink-0 data-[state=checked]:bg-[#0f172a] dark:data-[state=checked]:bg-slate-100 focus-visible:ring-[#0f172a]"
              />
            </div>
          </div>

          {/* Understated Secondary / Prominent Primary Dialog Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRejectAll}
                className="w-full sm:w-auto h-9 px-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-[6px] transition-colors focus-visible:ring-[#0f172a]"
              >
                Reject all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAcceptAll}
                className="w-full sm:w-auto h-9 px-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-[6px] transition-colors focus-visible:ring-[#0f172a]"
              >
                Accept all
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveCustom}
              className="w-full sm:w-auto h-9 px-4 text-[13px] font-medium text-white bg-[#0f172a] hover:bg-[#1e293b] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-[6px] transition-colors shadow-xs focus-visible:ring-[#0f172a]"
            >
              Save preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
