import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-screen">
      <section className="relative min-h-screen bg-slate-900 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cuk.png')" }}
        />
        <div className="absolute inset-0 bg-black/35" />

        <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left panel */}
          <div className="flex items-end p-10 md:p-16">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70 mb-3">
                Central University of Kashmir
              </p>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight">
                Central University of Kashmir
              </h1>
              <p className="mt-3 text-lg text-white/80">
                Official Examination Management Platform
              </p>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex items-center justify-center p-8 md:p-12">
            <div className="w-full max-w-md rounded-xl border border-white/15 bg-black/40 p-8 backdrop-blur">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 h-20 w-20 rounded-full bg-white/10 p-2">
                  <img
                    src="/cuk-favicon.png"
                    alt="CUK Logo"
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                  Central University of Kashmir
                </p>
                <h2 className="mt-3 text-2xl md:text-3xl font-semibold">
                  CUK Secure Examination Paper
                  <br />
                  Management System
                </h2>
              </div>

              <div className="mt-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    Login
                  </label>
                  <input
                    type="text"
                    placeholder="User Name"
                    className="h-11 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Credentials"
                    className="h-11 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-white/40 bg-transparent"
                  />
                  Keep me signed in
                </label>

                <Link to="/auth">
                  <Button className="w-full" size="lg">
                    Sign In
                  </Button>
                </Link>

                <p className="text-center text-xs text-white/70">
                  Secure | Auditable | Role-Based Access
                </p>

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
