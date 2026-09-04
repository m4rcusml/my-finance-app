'use client';

import type { DashboardOverview } from '@finance/contracts';
import { formatMoney } from '@/shared/lib/format';
import { DashboardSection } from './dashboard-section';
import { moneyTone, StatCard } from './stat-card';

type Totals = DashboardOverview['totals'];

/**
 * Balances, split into two sections on purpose.
 *
 * Cash, money parked in investment accounts and the cost basis of the manual
 * portfolio are three different things, and adding them together produces a
 * number the user cannot spend. Each card says in words what it is and whether
 * it is available.
 */
export function TotalsCards({ totals }: { totals: Totals }) {
  return (
    <div className="flex flex-col gap-4">
      <DashboardSection
        title="Saldos"
        description="Apenas o primeiro card é dinheiro disponível para gastar. Os outros dois são patrimônio aplicado e estão fora do caixa."
      >
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Saldo em caixa"
            value={formatMoney(totals.netBalance)}
            hint="Contas correntes, poupança e dinheiro. Disponível para gastar."
            tone={moneyTone(totals.netBalance)}
            featured
            dataTour="financial-overview"
          />
          <StatCard
            label="Em contas de investimento"
            value={formatMoney(totals.investedAccountBalance)}
            hint="Saldo em contas do tipo investimento. Não entra no caixa."
          />
          <StatCard
            label="Carteira investida"
            value={formatMoney(totals.portfolioInvested)}
            hint="Custo de aquisição da carteira manual. Não entra no caixa."
          />
        </dl>
      </DashboardSection>

      <DashboardSection
        title="Cartões de crédito"
        description="Soma de todos os cartões ativos, considerando o ciclo aberto de cada um."
      >
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Limite de crédito"
            value={formatMoney(totals.totalCreditLimit)}
            hint="Limite total contratado."
          />
          <StatCard
            label="Usado no ciclo"
            value={formatMoney(totals.totalCreditUsedThisCycle)}
            hint="Despesas lançadas dentro do ciclo aberto."
          />
          <StatCard
            label="Crédito disponível"
            value={formatMoney(totals.totalCreditAvailable)}
            hint="Limite menos o usado no ciclo. Pode ficar negativo se o limite for estourado."
            tone={totals.totalCreditAvailable < 0 ? 'negative' : 'neutral'}
          />
        </dl>
      </DashboardSection>
    </div>
  );
}
