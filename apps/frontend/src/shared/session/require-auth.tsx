'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingState } from '@/shared/ui/query-state';
import { useSession } from './session-provider';

/**
 * Single gate for every private route.
 *
 * Previously each page did (or, for four of them, did not do) its own check,
 * which meant logged-out visitors saw the full UI and a burst of doomed
 * requests fired before the session had hydrated. Here nothing below renders —
 * and therefore no query mounts — until `status` leaves `unknown`.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <LoadingState label={status === 'unknown' ? 'Verificando sua sessão…' : 'Redirecionando para o login…'} />
      </div>
    );
  }

  return <>{children}</>;
}

/** Mirror image: keeps a signed-in user out of /login and /register. */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  if (status === 'unknown') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <LoadingState label="Verificando sua sessão…" />
      </div>
    );
  }

  return <>{children}</>;
}
