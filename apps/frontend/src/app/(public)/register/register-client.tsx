'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { useSession } from '@/shared/session/session-provider';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';

const MIN_PASSWORD_LENGTH = 10;

export default function RegisterClient() {
  const router = useRouter();
  const { register } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const canSubmit = email.length > 0 && password.length >= MIN_PASSWORD_LENGTH && !mismatch;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setError(null);
    setDetails([]);
    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      router.replace('/dashboard');
    } catch (cause) {
      setError(errorMessage(cause));
      setDetails(errorDetails(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div>
        <h1 className="text-xl font-semibold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus dados ficam no banco PostgreSQL configurado para esta instalação.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-danger/60 bg-layer01 p-3 text-sm text-danger-text">
            <p>{error}</p>
            {details.length > 0 ? (
              <ul className="mt-1 list-inside list-disc">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <Field label="Nome" hint="Opcional. Usado apenas para te cumprimentar no painel.">
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

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

        <Field
          label="Senha"
          required
          hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}
          error={passwordTooShort ? `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        <Field label="Confirmar senha" required error={mismatch ? 'As senhas não coincidem.' : undefined}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              name="passwordConfirmation"
              autoComplete="new-password"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          )}
        </Field>

        <ActionButton type="submit" loading={submitting} disabled={!canSubmit} className="w-full">
          Criar conta
        </ActionButton>
      </form>

      <p className="text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-muted-primary underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </main>
  );
}
