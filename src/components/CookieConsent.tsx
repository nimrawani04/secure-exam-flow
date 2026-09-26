import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Cookie, ShieldCheck, SlidersHorizontal, Check, X } from 'lucide-react';
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
        // Show after a brief delay for a smooth initial page load
        const timer = setTimeout(() => setIsOpen(true), 600);
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
      toast.info('Non-essential cookies rejected');
    } else {
      toast.success('Cookie preferences saved');
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
      security: true,
    };
    saveConsent(onlyEssential, 'rejected');
  };

  const handleSaveCustom = () => {
    saveConsent(preferences, 'customized');
  };

  return (
    <>
      {/* Floating Bottom Cookie Box */}
      {isOpen && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-xl z-50 animate-in fade-in slide-in-from-bottom-6 duration-300">
          <div className="bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl p-5 md:p-6 space-y-4 text-card-foreground">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                <Cookie className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-base leading-none">We value your privacy</h3>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed pt-1">
                  We use cookies and similar secure storage technologies to ensure authenticated access,
                  protect examination confidentiality, remember your preferences, and maintain seamless platform performance.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1 border-t border-border/40">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomize(true)}
                className="text-xs font-medium justify-center"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                Customize
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRejectAll}
                className="text-xs font-medium justify-center"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Reject All
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAcceptAll}
                className="text-xs font-medium justify-center shadow-sm"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Accept All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Preferences Dialog */}
      <Dialog open={showCustomize} onOpenChange={setShowCustomize}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Cookie className="w-5 h-5" />
              </div>
              <DialogTitle className="text-xl">Cookie Preferences</DialogTitle>
            </div>
            <DialogDescription className="text-xs md:text-sm">
              Customize which cookies you want to permit. Strictly necessary and core security cookies cannot be disabled as they are required for confidential exam operations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Strictly Necessary */}
            <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border bg-muted/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold text-sm">Strictly Necessary</Label>
                  <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Always Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Essential for user authentication, encrypted session validation, and navigating secure exam routes.
                </p>
              </div>
              <Switch checked={true} disabled className="mt-1" />
            </div>

            {/* Security & Integrity */}
            <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border bg-card">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sec-cookies" className="font-semibold text-sm cursor-pointer">
                    Security & Fraud Prevention
                  </Label>
                  <ShieldCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Prevents session hijacking, verifies authorized devices, and guards paper submissions against tampering.
                </p>
              </div>
              <Switch
                id="sec-cookies"
                checked={preferences.security}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, security: checked }))}
                className="mt-1"
              />
            </div>

            {/* Functional */}
            <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border bg-card">
              <div className="space-y-1">
                <Label htmlFor="func-cookies" className="font-semibold text-sm cursor-pointer">
                  Functional & Preferences
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remembers your interface themes, table sorting orders, selected semesters, and layout states.
                </p>
              </div>
              <Switch
                id="func-cookies"
                checked={preferences.functional}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, functional: checked }))}
                className="mt-1"
              />
            </div>

            {/* Analytics */}
            <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border bg-card">
              <div className="space-y-1">
                <Label htmlFor="analytics-cookies" className="font-semibold text-sm cursor-pointer">
                  Performance & Diagnostics
                </Label>
                <p className="text-xs text-muted-foreground">
                  Collects anonymous telemetry to help us diagnose slow queries, optimize PDF exports, and fix bugs.
                </p>
              </div>
              <Switch
                id="analytics-cookies"
                checked={preferences.analytics}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, analytics: checked }))}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRejectAll}
              className="w-full sm:w-auto"
            >
              Reject All
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAcceptAll}
              className="w-full sm:w-auto"
            >
              Accept All
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCustom}
              className="w-full sm:w-auto"
            >
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
