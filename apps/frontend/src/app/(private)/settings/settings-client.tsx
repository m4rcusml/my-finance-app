'use client';

import type { UpdateProfileRequest } from '@finance/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { errorDetails, errorMessage, usersApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSession } from '@/shared/session/session-provider';
import { useAuthStore } from '@/shared/stores/auth-store';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';
import { useToast } from '@/shared/ui/toast';

const MIN_PASSWORD_LENGTH = 10;
const DELETE_CONFIRMATION = 'EXCLUIR MINHA CONTA';

export function SettingsClient() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Atualize seus dados de acesso ou encerre sua conta." />
      <ProfileSection />
      <PasswordSection />
      <DeleteAccountSection />
    </div>
  );
}

function ProfileSection() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, sessionKey } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setCurrentPassword('');
    setLocalError(null);
  }, [user]);

  const mutation = useMutation({
    mutationFn: (body: UpdateProfileRequest) => usersApi.update(body),
    onSuccess: async (profile) => {
      useAuthStore.getState().updateUser(profile);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(sessionKey) });
      setCurrentPassword('');
      toast.success('Perfil atualizado.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const normalizedEmail = email.trim().toLowerCase();
  const emailChanged = normalizedEmail !== (user?.email ?? '').toLowerCase();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setLocalError('Informe um e-mail válido.');
      return;
    }
    if (emailChanged && !currentPassword) {
      setLocalError('Informe sua senha atual para alterar o e-mail.');
      return;
    }

    mutation.mutate({
      name: name.trim() || null,
      email: normalizedEmail,
      ...(emailChanged ? { currentPassword } : {}),
    });
  }

  return (
    <section aria-labelledby="dados-perfil" className="rounded-xl border border-border bg-layer01 p-4 sm:p-6">
      <h2 id="dados-perfil" className="font-semibold text-foreground">
        Perfil
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">A senha atual só é exigida quando o endereço de e-mail muda.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 flex max-w-xl flex-col gap-4">
        {localError ? <LocalError message={localError} /> : null}
        {mutation.isError ? <MutationError error={mutation.error} /> : null}

        <Field label="Nome" hint="Opcional. Deixe vazio para remover o nome de exibição.">
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={mutation.isPending}
              maxLength={120}
            />
          )}
        </Field>

        <Field label="E-mail" required>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={mutation.isPending}
              required
            />
          )}
        </Field>

        {emailChanged ? (
          <Field label="Senha atual" required hint="Confirma que é você antes de mover o acesso para outro e-mail.">
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="password"
                name="currentPasswordForEmail"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={mutation.isPending}
                required
              />
            )}
          </Field>
        ) : null}

        <div>
          <ActionButton type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
            Salvar perfil
          </ActionButton>
        </div>
      </form>
    </section>
  );
}

function PasswordSection() {
  const toast = useToast();
  const { logout } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => usersApi.changePassword({ currentPassword, newPassword }),
    onSuccess: async () => {
      toast.success('Senha alterada. Entre novamente com a nova senha.');
      await logout();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!currentPassword) {
      setLocalError('Informe sua senha atual.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (newPassword !== confirmation) {
      setLocalError('A confirmação não coincide com a nova senha.');
      return;
    }
    if (newPassword === currentPassword) {
      setLocalError('Escolha uma senha diferente da atual.');
      return;
    }
    mutation.mutate();
  }

  return (
    <section aria-labelledby="trocar-senha" className="rounded-xl border border-border bg-layer01 p-4 sm:p-6">
      <h2 id="trocar-senha" className="font-semibold text-foreground">
        Trocar senha
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        A alteração encerra todas as sessões. Você precisará entrar novamente neste e nos outros dispositivos.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 flex max-w-xl flex-col gap-4">
        {localError ? <LocalError message={localError} /> : null}
        {mutation.isError ? <MutationError error={mutation.error} /> : null}

        <Field label="Senha atual" required>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={mutation.isPending}
              required
            />
          )}
        </Field>

        <Field label="Nova senha" required hint={`Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={mutation.isPending}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          )}
        </Field>

        <Field label="Confirmar nova senha" required>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="password"
              name="newPasswordConfirmation"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={mutation.isPending}
              required
            />
          )}
        </Field>

        <div>
          <ActionButton type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
            Alterar senha e sair
          </ActionButton>
        </div>
      </form>
    </section>
  );
}

function DeleteAccountSection() {
  const toast = useToast();
  const { logout } = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => usersApi.remove({ password, confirmation }),
    onSuccess: async () => {
      setConfirmOpen(false);
      toast.success('Conta excluída.');
      await logout();
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast.error(errorMessage(error));
    },
  });

  function requestDeletion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!password) {
      setLocalError('Informe sua senha para excluir a conta.');
      return;
    }
    if (confirmation !== DELETE_CONFIRMATION) {
      setLocalError(`Digite exatamente “${DELETE_CONFIRMATION}”.`);
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <section aria-labelledby="excluir-conta" className="rounded-xl border border-danger/60 bg-layer01 p-4 sm:p-6">
      <h2 id="excluir-conta" className="font-semibold text-danger-text">
        Excluir conta
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Esta ação apaga permanentemente seu usuário e todo o grafo financeiro. Exporte um backup antes se quiser
        conservar uma cópia local.
      </p>

      <form onSubmit={requestDeletion} noValidate className="mt-5 flex max-w-xl flex-col gap-4">
        {localError ? <LocalError message={localError} /> : null}
        {mutation.isError ? <MutationError error={mutation.error} /> : null}

        <Field label="Senha da conta" required>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="password"
              name="deletePassword"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={mutation.isPending}
              required
            />
          )}
        </Field>

        <Field label={`Digite ${DELETE_CONFIRMATION}`} required hint="Maiúsculas e espaços precisam coincidir.">
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              name="deleteConfirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={mutation.isPending}
              required
            />
          )}
        </Field>

        <div>
          <ActionButton
            type="submit"
            variant="danger"
            disabled={mutation.isPending || !password || confirmation !== DELETE_CONFIRMATION}
          >
            Excluir minha conta
          </ActionButton>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir permanentemente esta conta?"
        message="Todos os dados serão apagados de forma definitiva. Esta é a última confirmação e a operação não pode ser desfeita."
        confirmLabel="Sim, excluir permanentemente"
        destructive
        busy={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

function LocalError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3 text-sm text-danger-text">
      {message}
    </p>
  );
}

function MutationError({ error }: { error: unknown }) {
  const details = errorDetails(error);
  return (
    <div role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3">
      <p className="text-sm text-danger-text">{errorMessage(error)}</p>
      {details.length > 0 ? (
        <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
