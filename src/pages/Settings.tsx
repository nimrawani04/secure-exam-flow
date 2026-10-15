import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HodPageShell } from '@/components/layout/HodPageShell';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { openCookiePreferences } from '@/components/CookieConsent';
import {
  Cookie,
  User,
  Shield,
  Palette,
  Command,
  ChevronRight,
  Building2,
  Mail,
  Lock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function Settings() {
  const { profile } = useAuth();

  const roleLabel = useMemo(() => {
    switch (profile?.role) {
      case 'hod':
        return 'Head of Department';
      case 'teacher':
        return 'Teacher';
      case 'exam_cell':
        return 'Exam Cell Member';
      case 'admin':
        return 'Administrator';
      default:
        return 'Staff Member';
    }
  }, [profile?.role]);

  return (
    <DashboardLayout>
      <HodPageShell
        eyebrow="Account & Preferences"
        title={
          <>
            System <em className="not-italic text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]">Settings</em>
          </>
        }
        description="Manage your account preferences, visual appearance, system shortcuts, and privacy consent."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/profile">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12.5px] text-[#18202e] dark:text-[#e2eaf4] hover:bg-[#ede9e2] dark:hover:bg-[#131c27]"
              >
                <User className="h-3.5 w-3.5 text-[#0d7a6b] dark:text-[#2dd4bf]" />
                <span>Profile Preferences</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
              className="gap-1.5 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12.5px] text-[#18202e] dark:text-[#e2eaf4] hover:bg-[#ede9e2] dark:hover:bg-[#131c27]"
            >
              <Command className="h-3.5 w-3.5 text-[#0d7a6b] dark:text-[#2dd4bf]" />
              <span>Shortcuts</span>
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* 1. Account Particulars Card */}
          <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] overflow-hidden shadow-xs">
            <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                  User Identity
                </p>
                <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-0.5 flex items-center gap-2">
                  <span>Account &amp; Administrative Role</span>
                </h3>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-[10px] uppercase tracking-[0.06em] rounded-full px-2.5 py-0.5 border self-start sm:self-auto"
                style={{
                  backgroundColor: 'var(--accent-soft, rgba(13,122,107,0.08))',
                  borderColor: 'var(--accent-ring, rgba(13,122,107,0.2))',
                  color: 'var(--accent-color, #0d7a6b)',
                }}
              >
                <Shield className="w-3 h-3 mr-1 inline" />
                {roleLabel}
              </Badge>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#a0aec0] dark:text-[#3d5166] mb-1">
                    <User className="h-3.5 w-3.5 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
                    <span>Full Name</span>
                  </div>
                  <p className="text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4] truncate">
                    {profile?.full_name || '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#a0aec0] dark:text-[#3d5166] mb-1">
                    <Mail className="h-3.5 w-3.5 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
                    <span>Official Email</span>
                  </div>
                  <p className="text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4] truncate">
                    {profile?.email || '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#a0aec0] dark:text-[#3d5166] mb-1">
                    <Shield className="h-3.5 w-3.5 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
                    <span>Portal Role</span>
                  </div>
                  <p className="text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4] capitalize">
                    {profile?.role || '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#a0aec0] dark:text-[#3d5166] mb-1">
                    <Building2 className="h-3.5 w-3.5 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
                    <span>Department</span>
                  </div>
                  <p className="text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4] truncate">
                    {profile?.department_name || profile?.department_id || 'Institutional'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px] text-[#64748b] dark:text-[#6b8299] border-t border-[#e8e2da] dark:border-[#1c2d3d]">
                <p>
                  These administrative particulars are managed centrally. To update your password or accent color, visit Profile Preferences.
                </p>
                <Link to="/profile" className="shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-[12px] font-medium text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] hover:bg-[var(--accent-soft,rgba(13,122,107,0.08))]"
                  >
                    <span>Edit Profile Details</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* 2. Appearance & Visual Theme Card */}
          <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] overflow-hidden shadow-xs">
            <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                  Visual Interface
                </p>
                <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-0.5">
                  Appearance &amp; Display Theme
                </h3>
              </div>
              <Palette className="w-4 h-4 text-[#a0aec0] dark:text-[#3d5166]" />
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622]">
                <div className="space-y-0.5">
                  <h4 className="text-[13.5px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                    Interface Theme Mode
                  </h4>
                  <p className="text-[12px] text-[#64748b] dark:text-[#6b8299]">
                    Toggle between clean light mode and high-contrast dark mode across all exam management screens.
                  </p>
                </div>
                <div className="shrink-0">
                  <ThemeToggle />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-[13.5px] font-semibold text-[#18202e] dark:text-[#e2eaf4] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
                    <span>Brand Accent Color Palette</span>
                  </h4>
                  <p className="text-[12px] text-[#64748b] dark:text-[#6b8299]">
                    Custom highlight colors and hex tones can be tuned under your profile settings.
                  </p>
                </div>
                <Link to="/profile" className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11.5px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                  >
                    <span>Customize Accent</span>
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* 3. Privacy & Cookie Consent Card */}
          <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] overflow-hidden shadow-xs">
            <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                  Data Privacy &amp; Compliance
                </p>
                <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-0.5">
                  Privacy &amp; Cookie Consent
                </h3>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-[10px] uppercase tracking-[0.06em] rounded-full px-2.5 py-0.5 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              >
                <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                Active Consent
              </Badge>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-[12.5px] text-[#64748b] dark:text-[#6b8299] leading-relaxed">
                ExamSecure utilizes browser cookies and local storage tokens to preserve authenticated sessions, protect paper confidentiality, remember your workspace settings, and record audit trails.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                      Strictly Necessary
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                      Enforced
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#64748b] dark:text-[#6b8299]">
                    Cryptographic tokens required for role validation and session persistence.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                      Security &amp; Integrity
                    </span>
                    <span className="text-[10px] font-mono text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf] bg-[var(--accent-soft,rgba(13,122,107,0.1))] px-1.5 py-0.5 rounded">
                      Permitted
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#64748b] dark:text-[#6b8299]">
                    Tamper guards and anti-CSRF protections protecting question paper workflows.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#e8e2da] dark:border-[#1c2d3d]">
                <span className="text-[12px] text-[#64748b] dark:text-[#6b8299]">
                  Review or update granular authorization categories at any time.
                </span>
                <Button
                  onClick={openCookiePreferences}
                  className="rounded-lg h-9 text-[12.5px] font-semibold text-white bg-[#0d7a6b] hover:bg-[#0fa88f] shadow-xs flex items-center gap-2 self-start sm:self-auto"
                >
                  <Cookie className="w-4 h-4" />
                  <span>Manage Cookie Preferences</span>
                </Button>
              </div>
            </div>
          </div>

          {/* 4. Productivity & Keyboard Shortcuts Card */}
          <div className="rounded-[14px] border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] overflow-hidden shadow-xs">
            <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                  Accessibility &amp; Productivity
                </p>
                <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-0.5">
                  Keyboard Shortcuts &amp; Command Palette
                </h3>
              </div>
              <Command className="w-4 h-4 text-[#a0aec0] dark:text-[#3d5166]" />
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-[12.5px] text-[#64748b] dark:text-[#6b8299] leading-relaxed">
                Navigate rapidly between modules, search pages, and trigger commands directly from your keyboard.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                      Command Palette
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] font-mono text-[10px] text-[#64748b] dark:text-[#a0aec0]">
                      Ctrl + K
                    </kbd>
                  </div>
                  <p className="text-[11.5px] text-[#64748b] dark:text-[#6b8299]">
                    Instant search and action menu accessible anywhere.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                      Shortcuts Cheatsheet
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] font-mono text-[10px] text-[#64748b] dark:text-[#a0aec0]">
                      ?
                    </kbd>
                  </div>
                  <p className="text-[11.5px] text-[#64748b] dark:text-[#6b8299]">
                    Full cheatsheet modal of all hotkeys and commands.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fafbfc] dark:bg-[#0e1622] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                      Key Navigation Chords
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] font-mono text-[10px] text-[#64748b] dark:text-[#a0aec0]">
                      G then Key
                    </kbd>
                  </div>
                  <p className="text-[11.5px] text-[#64748b] dark:text-[#6b8299]">
                    Jump directly to Dashboard, Profile, or Module pages.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
                  className="rounded-lg h-8 text-[12px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                >
                  <Command className="h-3.5 w-3.5 mr-1.5 text-[var(--accent-color,#0d7a6b)] dark:text-[#2dd4bf]" />
                  <span>View All Shortcuts</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                  className="rounded-lg h-8 text-[12px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820]"
                >
                  <span>Open Command Palette (Ctrl+K)</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </HodPageShell>
    </DashboardLayout>
  );
}
