'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardQuery } from '@/features/dashboard/queries';
import { TopBar } from '@/components/specific/dashboard/topbar';
import { BalanceHero } from '@/components/specific/dashboard/balance-hero';
import { AccountsPanel } from '@/components/specific/dashboard/accounts-panel';
import { AnnualBalance } from '@/components/specific/dashboard/annual-balance';
import { FixedTransactionsPanel } from '@/components/specific/dashboard/fixed-transactions-panel';
import { RecentTransactionsPanel } from '@/components/specific/dashboard/recent-transactions-panel';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function DashboardPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(useAuthStore.persist?.hasHydrated());
  const accessToken = useAuthStore((s) => s.accessToken);
  const userName = useAuthStore((s) => s.user?.name);

  const dashboardQuery = useDashboardQuery(undefined, {
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });
    setIsHydrated(useAuthStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isMounted || !isHydrated) return;
    if (!accessToken) router.replace('/login');
  }, [accessToken, isHydrated, isMounted, router]);

  const dashboard = dashboardQuery.data;

  if (!isMounted) return null;

  return (
    <main className="flex-1 flex flex-col space-y-4 h-full">
      <TopBar userName={userName} />

      <div className="flex-1 min-h-0 flex items-stretch gap-6">
        <div className="flex flex-col flex-1 space-y-6">
          <BalanceHero
            totalBalance={dashboard?.totals.totalBalance ?? 0}
            monthly={dashboard?.totals.currentMonth ?? { income: 0, expense: 0, net: 0 }}
            isLoading={dashboardQuery.isLoading}
          />
          <AnnualBalance monthlyNet={[]} />
        </div>
        <div className="flex flex-col flex-1 space-y-6 min-h-0">
          <AccountsPanel accounts={dashboard?.accounts ?? []} />
          <FixedTransactionsPanel transactions={[]} />
          <RecentTransactionsPanel transactions={[]} />
        </div>
      </div>

      {dashboardQuery.isError ? (
        <div className="rounded-2xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
          Falha ao carregar o dashboard. Verifique sua conexao.
        </div>
      ) : null}
    </main>
  );
}
