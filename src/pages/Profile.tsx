import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HodPageShell } from '@/components/layout/HodPageShell';
import { DEFAULT_ACCENT_HEX, getContrastText, setAccentFromHex, getAccentStorageKey } from '@/lib/theme';
import {
  Lock,
  User,
  Palette,
  Mail,
  Building2,
  Shield,
  Sparkles,
  Check,
  RotateCcw,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const presetColors = [
  '#0d7a6b',
  '#1d4ed8',
  '#10b981',
  '#7c3aed',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const hexToRgb = (hex: string) => {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
};

const toRgba = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(15, 23, 42, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const darkenHex = (hex: string, amount = 0.12) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = clamp(Math.round(rgb.r * (1 - amount)), 0, 255);
  const g = clamp(Math.round(rgb.g * (1 - amount)), 0, 255);
  const b = clamp(Math.round(rgb.b * (1 - amount)), 0, 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const inputWarm =
  'h-10 rounded-lg border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[13px] text-[#18202e] dark:text-[#e2eaf4] placeholder:text-[#a0aec0] dark:placeholder:text-[#3d5166] focus-visible:ring-1 focus-visible:ring-[var(--accent-color,#0d7a6b)] focus-visible:border-[var(--accent-color,#0d7a6b)]';
const inputDisabledWarm =
  'h-10 rounded-lg border-[#e8e2da]/60 dark:border-[#1c2d3d]/60 bg-[#f7f4ef]/80 dark:bg-[#0c1118]/80 text-[13px] text-[#64748b] dark:text-[#6b8299] cursor-not-allowed';
const eyebrowWarm =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]';

export default function Profile() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const accentStorageKey = getAccentStorageKey(profile?.id);
  const resetRedirectUrl = `${window.location.origin}/?reset=true`;
  const [accentHex, setAccentHex] = useState(
    () => localStorage.getItem(accentStorageKey) || DEFAULT_ACCENT_HEX
  );

  const previewTextColor = useMemo(() => getContrastText(accentHex), [accentHex]);
  const accentVars = useMemo(
    () =>
      ({
        '--accent-color': accentHex,
        '--accent-soft': toRgba(accentHex, 0.08),
        '--accent-ring': toRgba(accentHex, 0.25),
        '--accent-hover': darkenHex(accentHex, 0.12),
        '--accent-contrast': previewTextColor,
      }) as CSSProperties,
    [accentHex, previewTextColor]
  );

  const initials = useMemo(() => {
    const nameStr = fullName || profile?.full_name || 'User';
    return nameStr
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [fullName, profile?.full_name]);

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim()) {
      toast({ title: 'Error', description: 'Name and email are required.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        email: email.trim(),
        data: { full_name: fullName.trim() },
      });

      if (authError) {
        toast({ title: 'Update failed', description: authError.message, variant: 'destructive' });
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), email: email.trim() })
        .eq('id', profile?.id);

      if (profileError) {
        toast({ title: 'Update failed', description: profileError.message, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved. If you changed email, confirm it in your inbox.',
      });
    } catch {
      toast({ title: 'Error', description: 'Unexpected error. Please try again.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeChange = (hex: string) => {
    const ok = setAccentFromHex(hex, profile?.id);
    if (ok) {
      setAccentHex(hex);
    } else {
      toast({ title: 'Invalid color', description: 'Please enter a valid hex color.', variant: 'destructive' });
    }
  };

  const handleResetTheme = () => {
    localStorage.removeItem(accentStorageKey);
    setAccentFromHex(DEFAULT_ACCENT_HEX, profile?.id);
    setAccentHex(DEFAULT_ACCENT_HEX);
  };

  const handleUpdatePassword = async () => {
    if (!password || password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Password updated', description: 'Your password has been changed.' });
      setPasswordUpdated(true);
      setPassword('');
      setConfirmPassword('');
    } catch {
      toast({ title: 'Error', description: 'Unexpected error. Please try again.', variant: 'destructive' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      toast({ title: 'Error', description: 'Please enter your email.', variant: 'destructive' });
      return;
    }

    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetRedirectUrl,
      });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Reset link sent',
        description: 'Check your email to set a new password.',
      });
    } catch {
      toast({ title: 'Error', description: 'Unexpected error. Please try again.', variant: 'destructive' });
    } finally {
      setSendingReset(false);
    }
  };

  const roleLabel = (profile?.role || 'user').toUpperCase();

  return (
    <DashboardLayout>
      <div style={accentVars} className="transition-colors duration-300">
        <HodPageShell
          eyebrow={profile?.role ? `${profile.role.toUpperCase()} · PROFILE` : 'ACCOUNT · PROFILE'}
          title={
            <>
              Profile <em className="not-italic text-[var(--accent-color,#0d7a6b)]">Settings</em>
            </>
          }
          description="Manage your personal details, security settings, and theme preferences."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
            {/* ── Left Sidebar Cards ── */}
            <div className="space-y-6">
              {/* User Overview Card */}
              <div className="bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118]">
                  <p className={eyebrowWarm}>User Identity</p>
                  <h3 className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-0.5">Account Info</h3>
                </div>
                <div className="p-5 flex flex-col items-center text-center">
                  <div
                    className="h-16 w-16 rounded-full flex items-center justify-center text-lg font-bold shadow-xs border transition-colors"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      borderColor: 'var(--accent-ring)',
                      color: 'var(--accent-color)',
                    }}
                  >
                    {initials}
                  </div>
                  <h4 className="mt-3 text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                    {fullName || profile?.full_name || 'User'}
                  </h4>
                  <p className="text-[12px] text-[#64748b] dark:text-[#6b8299] mt-0.5 truncate max-w-full">
                    {email || profile?.email || 'No email set'}
                  </p>

                  <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-full">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] uppercase tracking-[0.06em] rounded-full px-2.5 py-0.5 border shrink-0"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--accent-ring)',
                        color: 'var(--accent-color)',
                      }}
                    >
                      <Shield className="w-3 h-3 mr-1 inline" />
                      {roleLabel}
                    </Badge>
                    {(profile?.department_name || profile?.department_id) && (
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] uppercase tracking-[0.06em] rounded-full px-2.5 py-0.5 border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#ede9e2]/50 dark:bg-[#131c27]/50 text-[#64748b] dark:text-[#6b8299] max-w-full text-center whitespace-normal"
                      >
                        <Building2 className="w-3 h-3 mr-1 inline shrink-0" />
                        <span className="break-words">{profile?.department_name || profile?.department_id}</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Appearance / Accent Customization Card */}
              <div className="bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118] flex items-center justify-between">
                  <div>
                    <p className={eyebrowWarm}>Appearance</p>
                    <h3 className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-0.5">Accent Color</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetTheme}
                    className="h-7 px-2.5 rounded-[8px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[11px] font-medium text-[#64748b] dark:text-[#6b8299] hover:text-[#18202e] dark:hover:text-[#e2eaf4]"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <Label className={eyebrowWarm}>Presets</Label>
                    <div className="mt-2.5 grid grid-cols-4 gap-2.5">
                      {presetColors.map((color) => {
                        const isActive = accentHex.toLowerCase() === color.toLowerCase();
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => handleThemeChange(color)}
                            className={`h-8 w-8 rounded-full border border-black/10 dark:border-white/10 transition-transform hover:scale-105 flex items-center justify-center ${
                              isActive ? 'ring-2 ring-offset-2 ring-[var(--accent-color)] dark:ring-offset-[#101820]' : ''
                            }`}
                            style={{ backgroundColor: color }}
                            aria-label={`Set accent color ${color}`}
                          >
                            {isActive && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <Label className={eyebrowWarm}>Custom Hex</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative shrink-0">
                        <input
                          type="color"
                          value={accentHex}
                          onChange={(e) => handleThemeChange(e.target.value)}
                          className="h-10 w-10 cursor-pointer rounded-lg border border-[#e8e2da] dark:border-[#1c2d3d] bg-transparent p-1 focus-visible:outline-none"
                          aria-label="Pick a custom color"
                        />
                      </div>
                      <Input
                        value={accentHex}
                        onChange={(e) => setAccentHex(e.target.value)}
                        placeholder="#0d7a6b"
                        className={`${inputWarm} font-mono flex-1`}
                      />
                      <Button
                        onClick={() => handleThemeChange(accentHex)}
                        className="h-10 rounded-lg px-3 text-[12px] font-semibold text-white border-0 shrink-0"
                        style={{
                          backgroundColor: 'var(--accent-color)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[#e8e2da]/60 dark:border-[#1c2d3d]/60">
                    <span className="text-[11px] text-[#64748b] dark:text-[#6b8299]">Live Theme Preview</span>
                    <Badge
                      className="px-3 py-1 text-[11px] font-semibold rounded-lg shadow-xs border-0"
                      style={{
                        backgroundColor: 'var(--accent-color)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1 inline" />
                      Accent Active
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right Main Column Cards ── */}
            <div className="space-y-6">
              {/* Profile Details Card */}
              <div className="bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118]">
                  <p className={eyebrowWarm}>Account Settings</p>
                  <h2 className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-0.5">Profile Information</h2>
                  <p className="text-[11px] text-[#64748b] dark:text-[#6b8299] mt-0.5">
                    Update your primary account display name and notification email address.
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className={eyebrowWarm}>
                        Full Name
                      </Label>
                      <div className="relative">
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={inputWarm}
                          placeholder="Your full name"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className={eyebrowWarm}>
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputWarm}
                        placeholder="your.email@example.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className={eyebrowWarm}>Role</Label>
                        <span className="text-[10px] text-[#a0aec0] dark:text-[#3d5166]">(Managed by Admin)</span>
                      </div>
                      <Input value={profile?.role || '—'} disabled className={inputDisabledWarm} />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className={eyebrowWarm}>Department</Label>
                        <span className="text-[10px] text-[#a0aec0] dark:text-[#3d5166]">(Managed by Admin)</span>
                      </div>
                      <Input
                        value={profile?.department_name || profile?.department_id || '—'}
                        disabled
                        className={inputDisabledWarm}
                      />
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6]/50 dark:bg-[#0c1118]/50 flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-[9px] h-9 px-5 text-[13px] font-semibold text-white border-0 transition-opacity disabled:opacity-60"
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      color: 'var(--accent-contrast)',
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save Profile Changes'}
                  </Button>
                </div>
              </div>

              {/* Security & Password Card */}
              <div className="bg-white dark:bg-[#101820] border border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px] overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6] dark:bg-[#0c1118]">
                  <p className={eyebrowWarm}>Security</p>
                  <h2 className="text-[13px] font-semibold text-[#18202e] dark:text-[#e2eaf4] mt-0.5">Password & Authentication</h2>
                  <p className="text-[11px] text-[#64748b] dark:text-[#6b8299] mt-0.5">
                    Update your account password or request a secure email reset link.
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {passwordUpdated && (
                    <div
                      className="rounded-xl border p-3.5 text-[12.5px] flex items-center gap-2.5"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--accent-ring)',
                        color: 'var(--accent-color)',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Password updated successfully. Your new password is now active.</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[#e8e2da] dark:border-[#1c2d3d] bg-[#f7f4ef]/50 dark:bg-[#0c1118]/50">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">Password Reset Email</p>
                      <p className="text-[11px] text-[#64748b] dark:text-[#6b8299]">
                        Send a secure reset link to <span className="font-medium text-[#18202e] dark:text-[#e2eaf4]">{email}</span>.
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={sendingReset}
                          className="h-8 rounded-[8px] border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] text-[12px] font-medium text-[#64748b] dark:text-[#6b8299] hover:text-[#18202e] dark:hover:text-[#e2eaf4] shrink-0"
                        >
                          <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                          {sendingReset ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white dark:bg-[#101820] border-[#e8e2da] dark:border-[#1c2d3d] rounded-[14px]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-[15px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                            Send password reset link?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-[12.5px] text-[#64748b] dark:text-[#6b8299]">
                            A password reset link will be sent to{' '}
                            <span className="font-semibold text-[#18202e] dark:text-[#e2eaf4]">{email}</span>. You can use it to set a new password securely.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-lg border-[#e8e2da] dark:border-[#1c2d3d]">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleSendResetLink}
                            className="rounded-lg text-white border-0"
                            style={{ backgroundColor: 'var(--accent-color)' }}
                          >
                            Send Reset Link
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword" className={eyebrowWarm}>
                        New Password
                      </Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordUpdated(false);
                        }}
                        placeholder="••••••••"
                        className={inputWarm}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className={eyebrowWarm}>
                        Confirm Password
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordUpdated(false);
                        }}
                        placeholder="••••••••"
                        className={inputWarm}
                      />
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-[#e8e2da] dark:border-[#1c2d3d] bg-[#fbf9f6]/50 dark:bg-[#0c1118]/50 flex justify-end">
                  <Button
                    onClick={handleUpdatePassword}
                    disabled={savingPassword || !password}
                    className="rounded-[9px] h-9 px-5 text-[13px] font-semibold text-white border-0 transition-opacity disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      color: 'var(--accent-contrast)',
                    }}
                  >
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </HodPageShell>
      </div>
    </DashboardLayout>
  );
}

