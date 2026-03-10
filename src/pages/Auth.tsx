import { useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
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
  const [isPasswordReset, setIsPasswordReset] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    return params.get('reset') === 'true' || hash.includes('type=recovery');
  });
  // Ref to track recovery state synchronously (avoids race with redirect effect)
  const isPasswordResetRef = useRef(isPasswordReset);
  const updatePasswordReset = (value: boolean) => {
    isPasswordResetRef.current = value;
    setIsPasswordReset(value);
  };
  const [authError, setAuthError] = useState<string | null>(() => {
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      return hashParams.get('error_description')?.replace(/\+/g, ' ') || 'Authentication error occurred';
    }
    return null;
  });
  
  const { signIn, signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Listen for PASSWORD_RECOVERY event from Supabase auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        updatePasswordReset(true);
      }
    });

    // Check hash fragment for recovery type (Supabase appends #type=recovery)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      updatePasswordReset(true);
    }

    // Also check if we arrived via reset link (URL has ?reset=true)
    if (searchParams.get('reset') === 'true') {
      updatePasswordReset(true);
    }

    return () => subscription.unsubscribe();
  }, [searchParams]);

  // Redirect authenticated users to dashboard (but NOT during password reset)
  useEffect(() => {
    if (isAuthenticated && !isPasswordResetRef.current) {
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

        const { error, needsEmailVerification } = await signUp(
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
          if (needsEmailVerification) {
            toast({
              title: 'Check your email',
              description: 'We sent a verification link to your registered email address.',
            });
            setIsSignUp(false);
          } else {
            toast({ title: 'Account created!', description: 'Welcome to ExamSecure.' });
            navigate('/dashboard');
          }
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
      <div className="hidden lg:flex lg:w-[62%] relative overflow-hidden">
        <img
          src="/cuk.png"
          alt="Central University of Kashmir"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-start sm:items-center justify-end p-4 sm:p-8 lg:pr-16 lg:pl-12 bg-muted/30 overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center mb-6 lg:mb-8">
            <Link to="/">
              <img src="/cuk-favicon.png" alt="CUK Logo" className="w-20 h-20 lg:w-24 lg:h-24 object-contain drop-shadow-md" />
            </Link>
          </div>

          {isPasswordReset ? (
            <PasswordResetForm />
          ) : (
            <>
              {authError ? (
                <div className="space-y-6">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Link expired or invalid</h2>
                      <p className="text-muted-foreground mt-2 text-sm">
                        {authError}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        setAuthError(null);
                        setShowForgotPassword(true);
                        // Clean URL hash
                        window.history.replaceState(null, '', window.location.pathname);
                      }}
                      className="w-full h-12"
                    >
                      Request a new reset link
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAuthError(null);
                        window.history.replaceState(null, '', window.location.pathname);
                      }}
                      className="w-full h-12"
                    >
                      Back to sign in
                    </Button>
                  </div>
                </div>
              ) : (
              <>
              <div className="text-center">
                <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight">{isSignUp ? 'Create account' : 'Welcome back'}</h2>
                <p className="text-muted-foreground mt-3 text-base">
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

              <form onSubmit={handleSubmit} className="space-y-5">
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
                  <Input
                    id="password"
                    type="password"
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
                      <SelectTrigger>
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

                <Button type="submit" className="w-full h-13 rounded-xl shadow-md text-base font-medium" disabled={isLoading}>
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
            </>
          )}
        </div>
      </div>

      <ForgotPasswordDialog open={showForgotPassword} onOpenChange={setShowForgotPassword} />
    </div>
  );
}
