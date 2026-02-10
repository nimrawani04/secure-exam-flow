import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function Profile() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-2">
            Update your personal details.
          </p>
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
              <Input value={profile?.department_id || ''} disabled className="h-11" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
