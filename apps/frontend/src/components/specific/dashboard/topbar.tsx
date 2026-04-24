'use client';

import { useRouter } from 'next/navigation';
import { formatFullDate } from '@/shared/lib/utils';
import { Icon } from '@/components/ui/icon';
import { useAuthStore } from '@/shared/stores/auth-store';

type TopBarProps = {
  userName?: string | null;
  referenceDate?: string;
};

export function TopBar({ userName, referenceDate }: TopBarProps) {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <h1 className="text-4xl font-semibold text-foreground">Bem vindo{userName ? `, ${userName}!` : '!'}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="rounded-full border border-foreground/10 bg-layer01 px-4 py-2 text-muted-foreground">
          {formatFullDate(referenceDate ? new Date(referenceDate) : new Date())}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-full border border-foreground/10 bg-layer01 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Sair"
        >
          <Icon name="User4Outlined" size={20} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}
