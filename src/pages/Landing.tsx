import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

export default function Landing() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('teacher');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          toast({ title: 'Error', description: 'Please enter your full name', variant: 'destructive' });
          return;
        }
        if (selectedRole !== 'exam_cell' && !selectedDepartment) {
          toast({ title: 'Error', description: 'Please select a department', variant: 'destructive' });
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
    <div className="h-screen overflow-hidden">
      <section className="relative h-screen bg-slate-900 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cuk.png')" }}
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 grid h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left panel */}
          <div className="flex items-start lg:items-end justify-start p-4 sm:p-6 lg:p-16">
            <div className="max-w-2xl">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/70 mb-2">
                Central University of Kashmir
              </p>
              <h1 className="text-base sm:text-xl lg:text-4xl font-semibold leading-tight uppercase">
                Examination Management Platform
              </h1>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex items-start lg:items-center justify-center p-4 sm:p-6 lg:p-12">
            <div className="w-full max-w-md rounded-xl border border-white/20 bg-black/50 p-4 sm:p-6 lg:p-8 backdrop-blur max-h-[92vh] overflow-y-auto">
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
                  End-to-end encrypted • Activity logged • Role-based access
                </p>
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
                      placeholder="Dr. John Smith"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="h-9 sm:h-10 w-full rounded-md border border-white/30 bg-white/15 px-3 text-sm text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    Login
                  </label>
                  <input
                    type="email"
                    placeholder="Username / Email"
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
                      placeholder="Password"
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
                      <Link to="/auth" className="text-xs text-white/70 hover:text-white">
                        Forgot Password?
                      </Link>
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
                      onChange={(event) => setSelectedRole(event.target.value as AppRole)}
                      className="h-9 sm:h-10 w-full rounded-md border border-white/30 bg-white/15 px-3 text-sm text-white focus:border-white/60 focus:outline-none"
                    >
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value} className="text-slate-900">
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isSignUp && selectedRole !== 'exam_cell' && (
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

                {!isSignUp && (
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-white/40 bg-transparent"
                    />
                    Keep me signed in
                  </label>
                )}

                <Button
                  className="w-full bg-white text-slate-900 hover:bg-white/90"
                  size="lg"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (isSignUp ? 'Creating account...' : 'Signing in...') : isSignUp ? 'Create Account' : 'Sign In'}
                </Button>

                <p className="text-center text-sm text-white/80">
                  {isSignUp ? 'Already have an account?' : 'Don\'t have an account?'}{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp((prev) => !prev)}
                    className="underline"
                  >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
