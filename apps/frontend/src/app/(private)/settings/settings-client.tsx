'use client';

import {
  isValidEmailAddress,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordPolicyViolation,
  type UpdateProfileRequest,
} from '@finance/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BackupClient } from '@/app/(private)/backup/backup-client';
import { categoriesApi, errorDetails, errorMessage, usersApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSession } from '@/shared/session/session-provider';
import { useAuthStore } from '@/shared/stores/auth-store';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';
import { restartTour } from '@/shared/ui/onboarding';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';
import { useToast } from '@/shared/ui/toast';
import { QueryBoundary } from '@/shared/ui/query-state';

const DELETE_CONFIRMATION = 'EXCLUIR MINHA CONTA';

export type SettingsView = 'overview' | 'profile' | 'security' | 'data';

export function SettingsClient({ view = 'profile' }: { view?: SettingsView }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Preferências"
        title="Configurações"
        description="Perfil, organização dos dados e segurança em um só lugar."
      />
      <SegmentedTabs
        label="Seções de configurações"
        active={view}
        tabs={[
          { value: 'overview', label: 'Visão geral', href: '/settings' },
          { value: 'profile', label: 'Perfil', href: '/settings?view=profile' },
          { value: 'categories', label: 'Categorias', href: '/transactions?view=categories' },
          { value: 'data', label: 'Dados e backup', href: '/settings?view=data' },
          { value: 'security', label: 'Segurança', href: '/settings?view=security' },
        ]}
      />
      {view === 'overview' ? <SettingsOverview /> : null}
      {view === 'profile' ? (
        <>
          <ProfileSection />
          <TutorialSection />
        </>
      ) : null}
      {view === 'security' ? (
        <>
          <PasswordSection />
          <DeleteAccountSection />
        </>
      ) : null}
      {view === 'data' ? <BackupClient embedded /> : null}
    </div>
  );
}

function SettingsOverview() {
  const { user, sessionKey } = useSession();
  const categories = useQuery({
    queryKey: [...queryKeys.categories.all(sessionKey), 'settings-overview'],
    queryFn: async () => {
      const [active, all] = await Promise.all([
        categoriesApi.list({ limit: 4 }),
        categoriesApi.list({ includeArchived: true, limit: 1 }),
      ]);
      return { active, archived: all.meta.totalItems - active.meta.totalItems };
    },
  });
  const name = user?.name?.trim() || 'Minha conta';
  return (
    <>
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <section className="min-h-64 min-w-0 rounded-2xl border border-border bg-layer01 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-primary">Perfil</p>
          <h2 className="mt-3 text-md font-semibold">Informações pessoais</h2>
          <div className="my-6 flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-md font-bold">
              {name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">pt-BR · America/Sao_Paulo</p>
            <SettingsLink href="/settings?view=profile">Editar perfil</SettingsLink>
          </div>
        </section>
        <section className="min-h-64 min-w-0 rounded-2xl border border-border bg-layer01 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-primary">Categorias</p>
          <h2 className="mt-3 text-md font-semibold">Organize seus lançamentos</h2>
          <QueryBoundary query={categories} loadingLabel="Carregando categorias…">
            {({ active, archived }) => (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  {active.meta.totalItems} ativas · {archived} arquivadas
                </p>
                <div className="my-6 flex min-h-9 flex-wrap gap-2">
                  {active.data.length ? (
                    active.data.map((item) => (
                      <span key={item.id} className="rounded-full border border-border bg-layer02 px-3 py-2 text-xs">
                        {item.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Crie suas categorias para organizar receitas e despesas.
                    </p>
                  )}
                </div>
              </>
            )}
          </QueryBoundary>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-64 text-xs text-muted-foreground">
              Categorias com histórico são arquivadas, não removidas.
            </p>
            <SettingsLink href="/transactions?view=categories">Gerenciar</SettingsLink>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-layer01 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-success-text">Dados e backup</p>
          <BackupClient embedded compact />
        </section>
        <section className="rounded-2xl border border-border bg-layer01 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-danger-text">Segurança</p>
          <h2 className="mt-3 text-md font-semibold">Acesso e conta</h2>
          <div className="my-5 rounded-xl border border-border bg-layer02/40 p-4">
            <h3 className="font-semibold">Alterar senha</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Use pelo menos {MIN_PASSWORD_LENGTH} caracteres e evite senhas comuns.
            </p>
            <div className="mt-4 flex justify-end">
              <SettingsLink href="/settings?view=security">Alterar senha</SettingsLink>
            </div>
          </div>
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-4">
            <h3 className="font-semibold text-danger-text">Excluir minha conta</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Remove permanentemente seus dados financeiros. A próxima etapa exige senha e a confirmação EXCLUIR MINHA
              CONTA.
            </p>
            <div className="mt-4">
              <SettingsLink href="/settings?view=security#excluir-conta">Revisar exclusão da conta</SettingsLink>
            </div>
          </div>
        </section>
      </div>
      <TutorialSection />
    </>
  );
}

function SettingsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-layer02 px-4 py-2 text-sm font-semibold text-muted-primary hover:bg-layer03"
    >
      {children}
    </Link>
  );
}

function TutorialSection() {
  const { user } = useSession();

  return (
    <section aria-labelledby="tutorial-interface" className="rounded-2xl border border-border bg-layer01 p-4 sm:p-6">
      <h2 id="tutorial-interface" className="font-semibold text-foreground">
        Tutorial da interface
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Reabra o guia passo a passo para rever o dashboard, as movimentações e as áreas do seu patrimônio.
      </p>
      <ActionButton
        variant="secondary"
        className="mt-4"
        onClick={() => {
          if (!user?.id) return;
          restartTour(user.id);
        }}
      >
        Refazer tutorial
      </ActionButton>
    </section>
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

    if (!isValidEmailAddress(normalizedEmail)) {
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
    const policyViolation = passwordPolicyViolation(newPassword);
    if (policyViolation) {
      setLocalError(policyViolation);
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

        <Field
          label="Nova senha"
          required
          hint={`Entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres; evite senhas comuns.`}
        >
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
