import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DEFAULT_ACCENT_HEX, getContrastText, setAccentFromHex, getAccentStorageKey } from '@/lib/theme';
import { Lock } from 'lucide-react';

const presetColors = [
  '#1d4ed8',
  '#10b981',
  '#7c3aed',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
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
  const accentStorageKey = getAccentStorageKey(profile?.id);
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
      toast({ title: 'Invalid color', description: 'Please enter a valid hex color.' , variant: 'destructive' });
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

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?reset=true`,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Reset link sent',
      description: 'Check your email to set a new password.',
    });
  };

  return (
    <DashboardLayout>
      <div
        className="w-full space-y-6 px-8 py-6 sm:px-10 lg:px-12 transition-colors duration-300"
        style={accentVars}
      >
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your personal details and theme preferences.</p>
        </div>

        <section className="rounded-xl border border-border/60 bg-card/80 p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-secondary text-foreground/80 flex items-center justify-center text-sm font-semibold">
                  {(fullName || profile?.full_name || 'U')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{fullName || profile?.full_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{email || profile?.email || 'No email set'}</p>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Appearance</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetTheme}
                    className="h-[34px] border-muted-foreground/30 text-muted-foreground shadow-none hover:border-muted-foreground/60 hover:text-foreground"
                  >
                    Reset
                  </Button>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div>
                    <Label className="text-sm text-muted-foreground">Accent Colors</Label>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {presetColors.map((color) => {
                        const isActive = accentHex.toLowerCase() === color.toLowerCase();
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => handleThemeChange(color)}
                            className={`h-[30px] w-[30px] rounded-full border border-border/60 transition-transform hover:scale-105 ${isActive ? 'ring-2 ring-white shadow-[0_0_0_4px_var(--accent-soft)]' : ''}`}
                            style={{ backgroundColor: color }}
                            aria-label={`Set color ${color}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block">
                      <span className="sr-only">Pick a custom color</span>
                      <input
                        type="color"
                        value={accentHex}
                        onChange={(e) => handleThemeChange(e.target.value)}
                        className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
                        aria-label="Pick a custom color"
                      />
                    </label>
                    <div className="mt-4 flex items-center gap-3">
                      <Input
                        value={accentHex}
                        onChange={(e) => setAccentHex(e.target.value)}
                        placeholder="#17a38b"
                        className="h-10 flex-1 min-w-0 font-mono focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:border-[var(--accent-color)]"
                      />
                      <Button
                        onClick={() => handleThemeChange(accentHex)}
                        className="h-10 min-w-[110px] shrink-0 px-5 shadow-none hover:shadow-sm bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Preview</p>
                    <Button
                      type="button"
                      size="sm"
                      className="h-10 min-w-[110px] shadow-none hover:shadow-sm bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]"
                    >
                      Accent Preview
                    </Button>
                  </div>
                </div>
              </div>
            </aside>

            <div className="space-y-5 pt-2">
              <div className="space-y-1.5">
                <h2 className="text-base font-semibold">Account Settings</h2>
                <p className="text-sm text-muted-foreground">Update your profile and security settings.</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">Profile Info</p>
                <div className="mt-3 grid gap-y-3.5 gap-x-6 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-[38px] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:border-[var(--accent-color)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-[38px] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:border-[var(--accent-color)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Input value={profile?.role || ''} disabled className="h-[38px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Department</Label>
                    <Input value={profile?.department_name || profile?.department_id || ''} disabled className="h-[38px]" />
                  </div>
                </div>
                <div className="mt-3.5 flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-[38px] min-w-[170px] px-5 shadow-none hover:shadow-sm bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] disabled:bg-[var(--accent-soft)] disabled:text-foreground"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>

              <div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Security</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Update your password and keep your account secure.</p>
                </div>

                {passwordUpdated && (
                  <div
                    className="mt-3 rounded-md border px-4 py-3 text-sm"
                    style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent-ring)' }}
                  >
                    Password updated successfully.
                  </div>
                )}

                <div className="mt-2">
                  <Button
                    variant="outline"
                    onClick={handleSendResetLink}
                    className="h-[38px] border-muted-foreground/30 text-muted-foreground shadow-none hover:border-muted-foreground/60 hover:text-foreground"
                  >
                    Send Reset Link
                  </Button>
                </div>

                <div className="mt-3.5 grid gap-y-3.5 gap-x-6 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>New Password</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordUpdated(false);
                      }}
                      className="h-[38px] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:border-[var(--accent-color)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordUpdated(false);
                      }}
                      className="h-[38px] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:border-[var(--accent-color)]"
                    />
                  </div>
                </div>
                <div className="mt-3.5 flex justify-end">
                  <Button
                    onClick={handleUpdatePassword}
                    disabled={savingPassword}
                    className="h-[38px] min-w-[170px] px-5 shadow-none hover:shadow-sm bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] disabled:bg-[var(--accent-soft)] disabled:text-foreground"
                  >
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
