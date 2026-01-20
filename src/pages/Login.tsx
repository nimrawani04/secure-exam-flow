import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserRole } from '@/types';
import { Shield, User, GraduationCap, Building, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const roles: { id: UserRole; label: string; description: string; icon: typeof User }[] = [
  { id: 'teacher', label: 'Teacher', description: 'Upload and manage exam papers', icon: GraduationCap },
  { id: 'hod', label: 'Head of Department', description: 'Review and approve papers', icon: User },
  { id: 'exam_cell', label: 'Examination Cell', description: 'Manage exams and access papers', icon: Building },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('teacher');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password, selectedRole);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero text-primary-foreground p-12 flex-col justify-between">
        <div>
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center shadow-glow">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-bold text-xl">ExamSecure</h1>
              <p className="text-xs opacity-70">Paper Management System</p>
            </div>
          </Link>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-4xl font-bold mb-4">
              Secure. Transparent.
              <br />
              <span className="text-accent">Compliant.</span>
            </h2>
            <p className="text-lg text-primary-foreground/70 max-w-md">
              The complete solution for managing exam papers with end-to-end security and full audit trails.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '100%', label: 'Encrypted' },
              { value: '24/7', label: 'Monitoring' },
              { value: 'NAAC', label: 'Compliant' },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10">
                <div className="text-2xl font-bold text-accent">{stat.value}</div>
                <div className="text-sm opacity-70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm opacity-50">© 2024 ExamSecure. All rights reserved.</p>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center">
                <Shield className="w-7 h-7 text-accent-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-xl">ExamSecure</h1>
                <p className="text-xs text-muted-foreground">Paper Management System</p>
              </div>
            </Link>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Sign in to access your dashboard</p>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select your role</Label>
            <div className="grid grid-cols-3 gap-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-center transition-all duration-200',
                    selectedRole === role.id
                      ? 'border-accent bg-accent/10 shadow-glow'
                      : 'border-border hover:border-accent/50 hover:bg-accent/5'
                  )}
                >
                  <role.icon className={cn(
                    'w-6 h-6 mx-auto mb-2',
                    selectedRole === role.id ? 'text-accent' : 'text-muted-foreground'
                  )} />
                  <div className={cn(
                    'text-sm font-medium',
                    selectedRole === role.id ? 'text-accent' : 'text-foreground'
                  )}>
                    {role.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-sm text-accent hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            For demo, use any email and password
          </p>
        </div>
      </div>
    </div>
  );
}
