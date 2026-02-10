import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export default function Landing() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden">
      <section className="relative min-h-screen bg-slate-900 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cuk.png')" }}
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left panel */}
          <div className="flex items-end p-10 md:p-16">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.35em] text-white/70 mb-4">
                Central University of Kashmir
              </p>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight uppercase">
                Examination Management Platform
              </h1>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex items-center justify-center p-8 md:p-12">
            <div className="w-full max-w-md rounded-xl border border-white/20 bg-black/50 p-10 backdrop-blur">
              <div className="flex flex-col items-center text-center">
                <img
                  src="/cuk-favicon.png"
                  alt="CUK Logo"
                  className="mb-4 h-32 w-32 object-contain md:h-36 md:w-36"
                />
                <h2 className="mt-1 text-xl md:text-2xl font-semibold uppercase">
                  Secure Examination Paper
                  <br />
                  Management System
                </h2>
                <p className="mt-3 text-xs text-white/80">
                  End-to-end encrypted • Activity logged • Role-based access
                </p>
              </div>

              <div className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    Login
                  </label>
                  <input
                    type="text"
                    placeholder="Username / Email"
                    className="h-11 w-full rounded-md border border-white/30 bg-white/15 px-3 text-sm text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none"
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
                      className="h-11 w-full rounded-md border border-white/30 bg-white/15 px-3 pr-10 text-sm text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none"
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
                  <div className="text-right">
                    <Link to="/auth" className="text-xs text-white/70 hover:text-white">
                      Forgot Password?
                    </Link>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-white/40 bg-transparent"
                  />
                  Keep me signed in
                </label>

                <Link to="/auth" className="mt-2 block">
                  <Button className="w-full bg-white text-slate-900 hover:bg-white/90" size="lg">
                    Sign In
                  </Button>
                </Link>

                <p className="text-center text-sm text-white/80">
                  Don&apos;t have an account?{' '}
                  <Link to="/auth" className="underline">
                    Sign Up
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
