'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorMessage } from '@/shared/lib/api';
import { useSession } from '@/shared/session/session-provider';
import { AuthShell } from '@/shared/ui/auth-shell';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';

export default function LoginClient() {
  const router = useRouter();
  const { login } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (cause) {
      // The API returns the same generic message for unknown e-mail and wrong
      // password, on purpose: telling them apart is an account-enumeration oracle.
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Entre na sua conta"
      description="Acesse seu painel e continue de onde parou."
      alternateLabel="Ainda não tem conta?"
      alternateAction="Criar conta"
      alternateHref="/register"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-danger/60 bg-layer01 p-3 text-sm text-danger-text">
            {error}
          </div>
        ) : null}

        <Field label="E-mail" required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <Field label="Senha" required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        <ActionButton type="submit" loading={submitting} disabled={!email || !password} className="w-full">
          Entrar
        </ActionButton>
      </form>
    </AuthShell>
  );
}
