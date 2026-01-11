'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiError } from '@/shared/lib/api/errors';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useLoginMutation, useRegisterMutation } from '@/features/auth/mutations';
import { Button } from '@/components/ui/button/button';
import { Label } from '@/components/ui/label/label';

export default function RegisterClient() {
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSubmitting = registerMutation.isPending || loginMutation.isPending;
  const isDisabled = isSubmitting || !email || !password;

  const errorMessage = useMemo(() => {
    const error = registerMutation.error || loginMutation.error;
    if (!error) return null;
    if (error instanceof ApiError) {
      return error.message;
    }
    return 'Ocorreu um erro. Tente novamente.';
  }, [registerMutation.error, loginMutation.error]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (accessToken) {
      router.replace('/dashboard');
    }
  }, [accessToken, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDisabled) return;

    try {
      await registerMutation.mutateAsync({ email, password });
      await loginMutation.mutateAsync({ email, password });
    } catch {
      // Errors are handled by the query state
    }
  }

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-layer00 text-foreground">
      <div
        aria-hidden
        className="absolute -top-24 left-1/2 h-72 w-xl -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/3 rounded-full bg-muted-primary/20 blur-3xl"
      />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <Label
              tone="layer01"
              className="border border-foreground/10 uppercase tracking-[0.3em] text-muted-foreground"
            >
              My Finance App
            </Label>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-xxl">
              Comece a controlar sua vida financeira hoje.
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-md">
              Crie sua conta gratuita e tenha acesso a um painel completo para gerenciar suas receitas, despesas e
              objetivos.
            </p>
            <div className="grid max-w-xl gap-4 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-2xl border border-foreground/10 bg-layer01 p-4">Cadastro rápido e simples.</div>
              <div className="rounded-2xl border border-foreground/10 bg-layer01 p-4">
                Segurança total dos seus dados.
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-layer01 p-4">Acesse de qualquer lugar.</div>
              <div className="rounded-2xl border border-foreground/10 bg-layer01 p-4">
                Ferramentas poderosas de análise.
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-foreground/10 bg-layer01 p-8 shadow-2xl shadow-layer00/60">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Crie sua conta</h2>
              <p className="text-sm text-muted-foreground">Preencha os dados abaixo para começar.</p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2 text-sm text-muted-foreground">
                E-mail
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="voce@email.com"
                  required
                />
              </label>

              <label className="block space-y-2 text-sm text-muted-foreground">
                Senha
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Sua senha segura"
                  required
                  minLength={6}
                />
              </label>

              {errorMessage ? (
                <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
                  {errorMessage}
                </div>
              ) : null}

              <Button type="submit" disabled={isDisabled} size="large" className="w-full">
                {registerMutation.isPending
                  ? 'Criando conta...'
                  : loginMutation.isPending
                    ? 'Entrando...'
                    : 'Criar conta'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-semibold text-primary hover:text-muted-primary hover:underline">
                Entre agora
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
