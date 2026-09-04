'use client';

import type { TransactionType } from '@finance/contracts';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnnualBalanceChart } from '@/components/dashboard/annual-balance-chart';
import { LatestTransactions } from '@/components/dashboard/latest-transactions';
import { PendingOccurrences } from '@/components/dashboard/pending-occurrences';
import { PeriodComparison } from '@/components/dashboard/period-comparison';
import { PeriodSelector } from '@/components/dashboard/period-selector';
import { ResourceOverview } from '@/components/dashboard/resource-overview';
import { TotalsCards } from '@/components/dashboard/totals-cards';
import { buildDashboardQuery, defaultDashboardFilters, type DashboardFilters } from '@/features/dashboard/filters';
import { useDashboardQuery } from '@/features/dashboard/queries';
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog';
import { PageHeader } from '@/shared/ui/app-shell';
import { ActionButton } from '@/shared/ui/form';
import { QueryBoundary } from '@/shared/ui/query-state';
import { useSession } from '@/shared/session/session-provider';

export function DashboardClient() {
  const { user } = useSession();
  const [filters, setFilters] = useState<DashboardFilters>(defaultDashboardFilters);
  const [newTransactionType, setNewTransactionType] = useState<TransactionType | null>(null);
  const built = useMemo(() => buildDashboardQuery(filters), [filters]);
  const dashboardQuery = useDashboardQuery(built.query ?? {}, { enabled: built.query !== null });

  return (
    <section>
      <div>
        <PageHeader
          eyebrow="Visão geral"
          title={
            <>
              Olá{user?.name?.trim() ? `, ${user.name.trim().split(/\s+/)[0]}` : ''}
              <span className="sr-only"> — Dashboard, visão geral</span>
            </>
          }
          description="Acompanhe o que mudou e decida seu próximo passo com números claros."
          actions={<ActionButton onClick={() => setNewTransactionType('expense')}>Nova transação</ActionButton>}
        />
      </div>

      <div className="flex flex-col gap-4">
        <PeriodSelector
          value={filters}
          onChange={setFilters}
          rangeError={built.rangeError}
          appliedPeriod={dashboardQuery.data?.period ?? null}
        />

        {built.query === null ? (
          <div role="alert" className="rounded-xl border border-warning/60 bg-layer01 p-5">
            <h2 className="text-sm font-semibold text-warning-text">Período incompleto</h2>
            <p className="mt-1 text-sm text-muted-foreground">{built.rangeError}</p>
          </div>
        ) : (
          <>
            {dashboardQuery.isFetching && !dashboardQuery.isPending ? (
              <output className="block text-xs text-muted-foreground">Atualizando o painel…</output>
            ) : null}

            <QueryBoundary
              query={dashboardQuery}
              loadingLabel="Carregando o painel…"
              errorTitle="Não foi possível carregar o painel"
            >
              {(dashboard) => (
                <div className="flex flex-col gap-4">
                  <TotalsCards totals={dashboard.totals} />
                  <PeriodComparison totals={dashboard.totals} />
                  <UncategorizedCallout count={dashboard.uncategorizedCount} />
                  <ResourceOverview accounts={dashboard.accounts} creditCards={dashboard.creditCards} />
                  <AnnualBalanceChart entries={dashboard.annualBalance} />
                  <div className="grid items-start gap-4 2xl:grid-cols-2">
                    <PendingOccurrences
                      occurrences={dashboard.pendingOccurrences}
                      accounts={dashboard.accounts}
                      creditCards={dashboard.creditCards}
                    />
                    <LatestTransactions transactions={dashboard.latestTransactions} />
                  </div>
                </div>
              )}
            </QueryBoundary>
          </>
        )}
      </div>

      {newTransactionType ? (
        <TransactionFormDialog
          transaction={null}
          initialType={newTransactionType}
          onClose={() => setNewTransactionType(null)}
        />
      ) : null}
    </section>
  );
}

function UncategorizedCallout({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className="rounded-xl border border-success/50 bg-layer01 p-4 text-sm text-success-text">
        Todos os lançamentos estão categorizados.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/60 bg-layer01 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-warning-text">
          {count} {count === 1 ? 'lançamento precisa' : 'lançamentos precisam'} de categoria
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Categorizar mantém os resumos e comparações úteis.</p>
      </div>
      <Link
        href="/transactions?view=uncategorized"
        className="shrink-0 rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-center text-sm font-medium text-foreground transition hover:bg-layer03"
      >
        Categorizar agora
      </Link>
    </div>
  );
}
