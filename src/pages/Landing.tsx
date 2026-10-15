import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, AlertCircle, Mail, Lock, User, Loader2 } from 'lucide-react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { PasswordResetForm } from '@/components/auth/PasswordResetForm';
import { openCookiePreferences } from '@/components/CookieConsent';

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
    <div className="relative h-screen max-h-screen w-full flex flex-col justify-between bg-slate-950 text-white overflow-hidden select-none">
      {/* Full-bleed background image & scrim */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/cuk.png')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/45 backdrop-blur-[1px]" />

      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] min-h-0 overflow-hidden">
        {/* Left panel - Branding with Fraunces serif and DM Mono eyebrow */}
        <div className="flex items-center justify-center lg:items-end lg:justify-start px-4 pt-3 sm:pt-4 pb-1 sm:pb-2 lg:p-14">
          <div className="max-w-2xl text-center lg:text-left">
            <p className="font-mono text-[9.5px] sm:text-xs uppercase tracking-[0.18em] text-white/80 font-medium mb-1 drop-shadow">
              {INSTITUTION_NAME}
            </p>
            <h1 className="font-serif italic font-light text-lg sm:text-2xl lg:text-5xl leading-tight tracking-[-0.02em] text-white drop-shadow-md">
              Examination <span className="not-italic font-normal">Management</span> Platform
            </h1>
            <div className="hidden lg:flex items-center gap-2.5 mt-3.5">
              <div className="h-px w-8 bg-white/40 shrink-0" />
              <p className="text-[12.5px] text-white/80 drop-shadow">
                Confidential paper authoring, multi-tier review & verification
              </p>
            </div>
          </div>
        </div>

        {/* Right panel - White Auth Card */}
        <div className="flex items-center justify-center p-3 sm:p-5 lg:p-8 min-h-0">
          <div className="w-full max-w-[420px] rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_24px_65px_-12px_rgba(0,0,0,0.38)] ring-1 ring-slate-900/5 backdrop-blur-md p-4 sm:p-6 lg:p-7 max-h-[calc(100vh-100px)] overflow-y-auto">
            <div className="flex flex-col items-center text-center">
              <img
                src="/cuk-favicon.png"
                alt="CUK Logo"
                className="mb-1.5 h-11 w-11 sm:h-14 sm:w-14 object-contain"
              />
              <h2 className="font-serif text-[17px] sm:text-[20px] font-medium text-slate-900 tracking-[-0.015em] leading-snug">
                Secure Examination Paper
                <br />
                <span className="font-serif italic font-normal text-slate-700">Management System</span>
              </h2>
              <p className="mt-1 text-[10px] sm:text-[11px] text-slate-500 font-medium tracking-wide">
                End-to-end encrypted · Activity logged · Role-based access
              </p>
            </div>

            {isPasswordReset ? (
              <div className="mt-3 sm:mt-4">
                <PasswordResetForm
                  onBackToSignIn={() => {
                    isPasswordResetRef.current = false;
                    setIsPasswordReset(false);
                    window.history.replaceState(null, '', window.location.pathname);
                  }}
                />
              </div>
            ) : authError ? (
              <div className="mt-4 space-y-3 sm:space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h3 className="font-serif italic font-light text-lg text-slate-900">Link expired or invalid</h3>
                  <p className="font-mono text-slate-500 mt-1 text-xs">{authError}</p>
                </div>
                <Button
                  className="w-full bg-slate-900 text-white hover:bg-slate-800"
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
                  className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <div className="mt-3 sm:mt-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className={`rounded-md py-1.5 text-xs sm:text-sm font-semibold transition ${
                      !isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className={`rounded-md py-1.5 text-xs sm:text-sm font-semibold transition ${
                      isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="mt-3.5 space-y-2.5 sm:space-y-3 text-left"
                >
                  {isSignUp && (
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          className="h-9.5 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-9.5 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-9.5 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {!isSignUp && (
                      <div className="text-right pt-0.5">
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="font-sans text-[11px] font-medium text-slate-600 hover:text-slate-950 underline underline-offset-2 transition"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}
                  </div>

                  {isSignUp && (
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                        Role
                      </label>
                      <select
                        value={selectedRole}
                        onChange={(event) => setSelectedRole(event.target.value as AppRole | '')}
                        className="h-9.5 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
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
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                        Department
                      </label>
                      <select
                        value={selectedDepartment}
                        onChange={(event) => setSelectedDepartment(event.target.value)}
                        className="h-9.5 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
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
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 font-semibold shadow-md h-10 text-xs sm:text-sm mt-1 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                      </>
                    ) : (
                      <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer - Extreme left copyright & Cookie Preferences centered under right card */}
      <footer className="relative z-10 w-full py-2.5 sm:py-3 text-xs text-white/70 border-t border-white/10 bg-black/35 backdrop-blur-md flex-shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] items-center gap-1.5 sm:gap-2">
          <div className="order-2 lg:order-1 flex items-center justify-center lg:justify-start">
            <p className="text-[10px] sm:text-xs text-white/75 font-normal tracking-normal whitespace-nowrap">
              © {new Date().getFullYear()} Central University of Kashmir. All rights reserved.
            </p>
          </div>
          <div className="order-1 lg:order-2 flex items-center justify-center">
            <button
              type="button"
              onClick={openCookiePreferences}
              className="text-[10.5px] sm:text-xs text-white/80 hover:text-white underline underline-offset-4 transition-colors font-medium tracking-normal"
            >
              Cookie Preferences
            </button>
          </div>
        </div>
      </footer>

      <ForgotPasswordDialog open={showForgotPassword} onOpenChange={setShowForgotPassword} />
    </div>
  );
}
