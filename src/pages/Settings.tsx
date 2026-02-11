import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { profile } = useAuth();

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account preferences and appearance.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Account</h2>
            <p className="text-sm text-muted-foreground">
              These details are managed by administrators.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{profile?.full_name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{profile?.email || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium">{profile?.role || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">{profile?.department_name || profile?.department_id || '—'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Choose your preferred theme.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </DashboardLayout>
  );
}

