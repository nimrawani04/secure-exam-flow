import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
<<<<<<< HEAD
import { PasswordResetForm } from '@/components/auth/PasswordResetForm';
=======
import { openCookiePreferences } from '@/components/CookieConsent';
>>>>>>> 3f5e88cc834d190ec051186c46d5445a82bafc17

interface Department {
  id: string;
  name: string;
  code: string;
}

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'hod', label: 'Head of Department' },
  { value: 'exam_cell', label: 'Examination Cell' },
];

const INSTITUTION_NAME = 'Central University of Kashmir';
const PLATFORM_NAME = 'Examination Management Platform';

export default function Landing() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reset') === 'true' || window.location.hash.includes('type=recovery');
  });
  // Ref mirror so the redirect effect never fires mid-reset (avoids state race)
  const isPasswordResetRef = useRef(isPasswordReset);
  const [authError, setAuthError] = useState<string | null>(() => {
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      return hashParams.get('error_description')?.replace(/\+/g, ' ') || 'Authentication error occurred';
    }
    return null;
  });
  const { signIn, signUp, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle password-recovery and auth-error callbacks in place (single / entry point)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        isPasswordResetRef.current = true;
        setIsPasswordReset(true);
      }
    });

    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || params.get('reset') === 'true') {
      isPasswordResetRef.current = true;
      setIsPasswordReset(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  // Redirect signed-in users to dashboard (but NOT during password reset)
  useEffect(() => {
    if (isAuthenticated && !isPasswordResetRef.current) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await (supabase.rpc as any)('list_public_departments');

      if (!error && data) {
        setDepartments(data);
      }
    };
    fetchDepartments();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          toast({ title: 'Error', description: 'Please enter your full name', variant: 'destructive' });
          return;
        }
        if (!selectedRole) {
          toast({ title: 'Error', description: 'Please select a role', variant: 'destructive' });
          return;
        }
        if (selectedRole !== 'exam_cell' && !selectedDepartment) {
          toast({ title: 'Error', description: 'Please select a department', variant: 'destructive' });
          return;
        }

        const { error, needsEmailVerification } = await signUp(
          email,
          password,
          fullName,
          selectedRole as AppRole,
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
            toast({
              title: 'Invalid credentials',
              description: 'Please check your email and password.',
              variant: 'destructive',
            });
          } else {
            toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
          }
        } else {
          navigate('/dashboard');
        }
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden sm:h-screen sm:overflow-hidden">
      <section className="relative min-h-screen sm:h-screen bg-slate-900 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cuk.png')" }}
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 grid min-h-screen sm:h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left panel */}
          <div
            className={`flex items-start lg:items-end justify-start p-4 sm:p-6 lg:p-16 ${
              isSignUp ? 'lg:pb-28' : ''
            }`}
          >
            <div className="max-w-2xl">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/70 mb-2">
                {INSTITUTION_NAME}
              </p>
              <h1 className="text-base sm:text-xl lg:text-4xl font-semibold leading-tight uppercase">
                {PLATFORM_NAME}
              </h1>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex items-start lg:items-center justify-center p-4 sm:p-6 lg:p-12">
            <div className="w-full max-w-md rounded-xl border border-white/20 bg-black/50 p-4 sm:p-6 lg:p-8 max-h-none overflow-visible sm:max-h-[92vh] sm:overflow-y-auto sm:backdrop-blur">
              <div className="flex flex-col items-center text-center">
                <img
                  src="/cuk-favicon.png"
                  alt="CUK Logo"
                  className="mb-2 h-16 w-16 object-contain sm:h-20 sm:w-20 lg:h-32 lg:w-32"
                />
                <h2 className="mt-1 text-sm sm:text-base lg:text-2xl font-semibold uppercase">
                  Secure Examination Paper
                  <br />
                  Management System
                </h2>
                <p className="mt-2 text-[10px] sm:text-xs text-white/80">
                  End-to-end encrypted | Activity logged | Role-based access
                </p>
              </div>

              {isPasswordReset ? (
                <div className="mt-4">
                  <PasswordResetForm
                    onBackToSignIn={() => {
                      isPasswordResetRef.current = false;
                      setIsPasswordReset(false);
                      window.history.replaceState(null, '', window.location.pathname);
                    }}
                  />
                </div>
              ) : authError ? (
                <div className="mt-4 space-y-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-7 h-7 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Link expired or invalid</h2>
                    <p className="text-white/70 mt-1 text-xs">{authError}</p>
                  </div>
                  <Button
                    className="w-full bg-white text-slate-900 hover:bg-white/90"
                    onClick={() => {
                      setAuthError(null);
                      setShowForgotPassword(true);
                      window.history.replaceState(null, '', window.location.pathname);
                    }}
                  >
                    Request a new reset link
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      window.history.replaceState(null, '', window.location.pathname);
                    }}
                    className="text-xs text-white/70 hover:text-white"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
              <>

              <div className="mt-4 grid grid-cols-2 rounded-lg border border-white/20 bg-slate-900/40 p-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className={`rounded-md py-2 text-sm font-semibold transition ${
                    !isSignUp ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className={`rounded-md py-2 text-sm font-semibold transition ${
                    isSignUp ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-3 sm:mt-4 space-y-3 sm:space-y-4"
              >
                {isSignUp && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="h-9 sm:h-10 w-full rounded-md border border-white/30 bg-white/15 px-3 text-sm text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                      Email
                    </label>
                  <input
                    type="email"
                      placeholder="Enter your email address"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-9 sm:h-10 w-full rounded-md border border-white/30 bg-white/15 px-3 text-sm text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-9 sm:h-10 w-full rounded-md border border-white/30 bg-white/15 px-3 pr-10 text-sm text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!isSignUp && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-white/70 hover:text-white"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                      Role
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(event) => setSelectedRole(event.target.value as AppRole | '')}
                      className="h-9 sm:h-10 w-full rounded-md border border-white/30 bg-white/15 px-3 text-sm text-white focus:border-white/60 focus:outline-none"
                    >
                      <option value="" disabled className="text-slate-900">
                        Select role
                      </option>
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value} className="text-slate-900">
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isSignUp && selectedRole && selectedRole !== 'exam_cell' && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                      Department
                    </label>
                    <select
                      value={selectedDepartment}
                      onChange={(event) => setSelectedDepartment(event.target.value)}
                      className="h-9 sm:h-10 w-full rounded-md border border-white/30 bg-white/15 px-3 text-sm text-white focus:border-white/60 focus:outline-none"
                      required
                    >
                      <option value="" className="text-slate-900">
                        Select department
                      </option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id} className="text-slate-900">
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Button
                  className="w-full bg-white text-slate-900 hover:bg-white/90"
                  size="lg"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (isSignUp ? 'Creating account...' : 'Signing in...') : isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
              </>
              )}
            </div>
          </div>
        </div>
      </section>
      
      <footer className="w-full py-4 text-center text-xs text-muted-foreground bg-background/80 border-t backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4">
          <p>© {new Date().getFullYear()} Central University of Kashmir. All rights reserved.</p>
          <button
            type="button"
            onClick={openCookiePreferences}
            className="hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Cookie Preferences
          </button>
        </div>
      </footer>

      <ForgotPasswordDialog open={showForgotPassword} onOpenChange={setShowForgotPassword} />
    </div>
  );
}
