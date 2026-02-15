import { useMemo, useState } from 'react';
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

export default function Profile() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const accentStorageKey = getAccentStorageKey(profile?.id);
  const [accentHex, setAccentHex] = useState(
    () => localStorage.getItem(accentStorageKey) || DEFAULT_ACCENT_HEX
  );

  const previewTextColor = useMemo(() => getContrastText(accentHex), [accentHex]);

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
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-2">Update your personal details.</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile?.role || ''} disabled className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={profile?.department_name || profile?.department_id || ''} disabled className="h-11" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Profile Theme Color</h2>
              <p className="text-sm text-muted-foreground">Personalize your accent color.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleThemeChange(DEFAULT_ACCENT_HEX)}>
              Reset
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleThemeChange(color)}
                className="h-9 w-9 rounded-full border border-white/10 shadow-sm"
                style={{ backgroundColor: color }}
                aria-label={`Set color ${color}`}
              />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="block w-full">
              <span className="sr-only">Pick a custom color</span>
              <input
                type="color"
                value={accentHex}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-lg border border-input bg-transparent p-1"
                aria-label="Pick a custom color"
              />
            </label>
            <Input
              value={accentHex}
              onChange={(e) => setAccentHex(e.target.value)}
              placeholder="#17a38b"
              className="h-11 w-full sm:w-40 font-mono"
            />
            <Button variant="outline" onClick={() => handleThemeChange(accentHex)}>
              Apply
            </Button>
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
              <span>Preview</span>
              <span>Text adapts to background</span>
            </div>
            <div
              className="rounded-lg p-4 text-sm font-medium"
              style={{ backgroundColor: accentHex, color: previewTextColor }}
            >
              Accent Preview
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Update Password</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            For security, you can request a reset link or update your password directly.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSendResetLink}>
              Send Reset Link
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleUpdatePassword} disabled={savingPassword}>
              {savingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
