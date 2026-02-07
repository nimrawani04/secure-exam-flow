import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { PasswordResetForm } from '@/components/auth/PasswordResetForm';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { Shield, User, GraduationCap, Building, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Department {
  id: string;
  name: string;
  code: string;
}

const roles: { id: AppRole; label: string; description: string; icon: typeof User }[] = [
  { id: 'teacher', label: 'Teacher', description: 'Upload and manage exam papers', icon: GraduationCap },
  { id: 'hod', label: 'Head of Department', description: 'Review and approve papers', icon: User },
  { id: 'exam_cell', label: 'Examination Cell', description: 'Manage exams and access papers', icon: Building },
];

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('teacher');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  
  const { signIn, signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Listen for PASSWORD_RECOVERY event from Supabase auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordReset(true);
      }
    });

    // Also check if we arrived via reset link (URL has ?reset=true)
    if (searchParams.get('reset') === 'true') {
      // The hash fragment contains the recovery token; Supabase processes it
      // and fires PASSWORD_RECOVERY. We wait for that event above.
      // But also set the flag in case the event already fired before this component mounted.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsPasswordReset(true);
        }
      });
    }

    return () => subscription.unsubscribe();
  }, [searchParams]);

  // Redirect authenticated users to dashboard (but NOT during password reset)
  useEffect(() => {
    if (isAuthenticated && !isPasswordReset) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isPasswordReset, navigate]);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (!error && data) {
        setDepartments(data);
      }
    };
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          toast({ title: 'Error', description: 'Please enter your full name', variant: 'destructive' });
          setIsLoading(false);
          return;
        }
        if (selectedRole !== 'exam_cell' && !selectedDepartment) {
          toast({ title: 'Error', description: 'Please select a department', variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(
          email,
          password,
          fullName,
          selectedRole,
          selectedRole !== 'exam_cell' ? selectedDepartment : undefined
        );

        if (error) {
          if (error.message.includes('already registered')) {
            toast({ title: 'Account exists', description: 'This email is already registered. Please sign in.', variant: 'destructive' });
          } else {
            toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Account created!', description: 'Welcome to ExamSecure.' });
          navigate('/dashboard');
        }
      } else {
        const { error } = await signIn(email, password);

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({ title: 'Invalid credentials', description: 'Please check your email and password.', variant: 'destructive' });
          } else {
            toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
          }
        } else {
          navigate('/dashboard');
        }
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred. Please try again.', variant: 'destructive' });
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

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
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

          {isPasswordReset ? (
            <PasswordResetForm />
          ) : (
            <>
              <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold">{isSignUp ? 'Create account' : 'Welcome back'}</h2>
                <p className="text-muted-foreground mt-2">
                  {isSignUp ? 'Sign up to get started' : 'Sign in to access your dashboard'}
                </p>
              </div>

              {isSignUp && (
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
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Dr. John Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                )}

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
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-accent hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12"
                  />
                  {isSignUp && <PasswordStrengthIndicator password={password} />}
                </div>

                {isSignUp && selectedRole !== 'exam_cell' && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select your department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button type="submit" className="w-full h-12" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {isSignUp ? 'Creating account...' : 'Signing in...'}
                    </>
                  ) : (
                    isSignUp ? 'Create account' : 'Sign in'
                  )}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {isSignUp ? (
                    <>Already have an account? <span className="text-accent font-medium">Sign in</span></>
                  ) : (
                    <>Don't have an account? <span className="text-accent font-medium">Sign up</span></>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ForgotPasswordDialog open={showForgotPassword} onOpenChange={setShowForgotPassword} />
    </div>
  );
}
