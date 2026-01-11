'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/shared/lib/api/errors';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useLoginMutation } from '@/features/auth/mutations';
import { Button } from '@/components/ui/button/button';
import { Label } from '@/components/ui/label/label';

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
    return 'Não foi possível entrar. Tente novamente.';
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
              Visualize seu dinheiro com clareza e aja com confiança.
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-md">
              Acompanhe contas, transações e pagamentos recorrentes com um painel feito para focar. Entre para manter
              seu fluxo de caixa sincronizado.
            </p>
            <div className="grid max-w-xl gap-4 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-2xl border border-foreground/10 bg-layer01 p-4">
                Visão mensal limpa com receitas, despesas e saldo.
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-layer01 p-4">
                Transações recorrentes gerenciadas com automação diária.
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-layer01 p-4">
                Autenticação segura com JWT e dados isolados por usuário.
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-layer01 p-4">
                Feito para finanças pessoais, não planilhas genéricas.
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-foreground/10 bg-layer01 p-8 shadow-2xl shadow-layer00/60">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Bem-vindo de volta</h2>
              <p className="text-sm text-muted-foreground">Use suas credenciais para acessar o painel.</p>
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Sua senha segura"
                  required
                />
              </label>

              {errorMessage ? (
                <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
                  {errorMessage}
                </div>
              ) : null}

              <Button type="submit" disabled={isDisabled} size="large" className="w-full">
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-6 text-xs text-muted-foreground">
              Dica: Use uma senha forte e mantenha seu dispositivo seguro.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
