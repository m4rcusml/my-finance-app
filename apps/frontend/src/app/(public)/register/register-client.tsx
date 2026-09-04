'use client';

import {
  isValidEmailAddress,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordPolicyViolation,
} from '@finance/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, errorDetails, errorMessage } from '@/shared/lib/api';
import { useSession } from '@/shared/session/session-provider';
import { AuthShell } from '@/shared/ui/auth-shell';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';

export default function RegisterClient() {
  const router = useRouter();
  const { register } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const normalizedEmail = email.trim();
  const emailError =
    normalizedEmail.length > 0 && !isValidEmailAddress(normalizedEmail) ? 'Informe um e-mail válido.' : null;
  const passwordError = password.length > 0 ? passwordPolicyViolation(password) : null;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const canSubmit =
    normalizedEmail.length > 0 &&
    emailError === null &&
    passwordError === null &&
    confirmation.length > 0 &&
    !mismatch &&
    name.length <= 120;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setError(null);
    setDetails([]);
    setRequestId(null);
    setSubmitting(true);
    try {
      await register(normalizedEmail, password, name.trim() || undefined);
      router.replace('/dashboard');
    } catch (cause) {
      setError(errorMessage(cause));
      setDetails(errorDetails(cause));
      setRequestId(cause instanceof ApiError ? (cause.requestId ?? null) : null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Crie sua conta"
      description="Comece com uma base organizada e segura."
      alternateLabel="Já tem conta?"
      alternateAction="Entrar"
      alternateHref="/login"
    >
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
            {requestId ? <p className="mt-1 text-xs">Identificador da solicitação: {requestId}</p> : null}
          </div>
        ) : null}

        <Field label="Nome" hint="Opcional. Usado apenas para te cumprimentar no painel.">
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              name="name"
              autoComplete="name"
              placeholder="Como devemos chamar você?"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <Field label="E-mail" required error={emailError ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Senha"
          required
          hint={`Entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres; evite senhas comuns.`}
          error={passwordError ?? undefined}
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
    </AuthShell>
  );
}
