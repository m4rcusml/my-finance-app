'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/shared/lib/api/errors';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useLoginMutation } from '@/features/auth/mutations';

export default function LoginClient() {
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const loginMutation = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSubmitting = loginMutation.isPending;
  const isDisabled = isSubmitting || !email || !password;

  const errorMessage = useMemo(() => {
    if (!loginMutation.error) return null;
    if (loginMutation.error instanceof ApiError) {
      return loginMutation.error.message;
    }
    return 'Unable to sign in. Please try again.';
  }, [loginMutation.error]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (accessToken) {
      router.replace('/dashboard');
    }
  }, [accessToken, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDisabled) return;
    loginMutation.mutate({ email, password });
  }

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden
        className="absolute -top-24 left-1/2 h-72 w-xl -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.25),transparent_65%)] blur-3xl"
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.2),transparent_70%)] blur-3xl"
      />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70">
              My Finance App
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              See your money clearly and act with confidence.
            </h1>
            <p className="max-w-xl text-base text-white/70 sm:text-lg">
              Track accounts, transactions, and recurring payments with a dashboard built for focus. Sign in to keep
              your cash flow in sync.
            </p>
            <div className="grid max-w-xl gap-4 text-sm text-white/70 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Clean monthly overview with income, expense, and net.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Recurring transactions handled with daily automation.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Secure auth with JWT and user-scoped data.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Purpose-built for personal finance, not generic spreadsheets.
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
              <p className="text-sm text-white/60">Use your credentials to access your dashboard.</p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2 text-sm text-white/80">
                Email
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                  placeholder="you@email.com"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm text-white/80">
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                  placeholder="Your secure password"
                  required
                />
              </label>

              {errorMessage ? (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isDisabled}
                className="flex w-full items-center justify-center rounded-xl bg-linear-to-r from-sky-400 via-cyan-400 to-emerald-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 text-xs text-white/50">Tip: Use a strong password and keep your device secure.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
