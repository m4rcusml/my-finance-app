import { type MonthlyNet, toYearMonth } from '@finance/contracts';
import { render, screen, within } from '@testing-library/react';
import { formatMonthLabel } from '@/shared/lib/format';
import { AnnualBalanceChart } from './annual-balance-chart';

const entries: MonthlyNet[] = Array.from({ length: 12 }, (_, index) => {
  const monthIndex = 2025 * 12 + 9 + index;
  return {
    month: toYearMonth(`${Math.floor(monthIndex / 12)}-${String((monthIndex % 12) + 1).padStart(2, '0')}`),
    income: index === 2 ? 200 : 0,
    expense: index === 11 ? 125.9 : 0,
    net: index === 2 ? 200 : index === 11 ? -125.9 : 0,
  };
});

describe('gráfico anual responsivo', () => {
  it('preserva os doze meses, incluindo o último, e os valores completos na alternativa acessível', () => {
    render(<AnnualBalanceChart entries={entries} />);
    const table = screen.getByRole('table', { name: 'Receitas, despesas e saldo mês a mês nos últimos 12 meses' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(13);
    for (const entry of entries) {
      expect(within(table).getByRole('rowheader', { name: formatMonthLabel(entry.month) })).toBeInTheDocument();
    }
    expect(rows[1]).toHaveTextContent('outubro de 2025');
    expect(rows[12]).toHaveTextContent('setembro de 2026');
    expect(
      within(rows[12])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['R$\u00a00,00', 'R$\u00a0125,90', '-R$\u00a0125,90']);
    expect(screen.getByText('Maior valor do período: R$ 200,00')).toBeInTheDocument();
  });

  it('mantém os meses sem movimento na tabela e comunica o estado vazio', () => {
    render(<AnnualBalanceChart entries={entries.map((entry) => ({ ...entry, income: 0, expense: 0, net: 0 }))} />);
    expect(screen.getByText('Sem movimentação registrada nos últimos 12 meses.')).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(12);
    expect(screen.getAllByRole('cell')).toHaveLength(36);
    expect(screen.getAllByRole('cell').every((cell) => cell.textContent === 'R$\u00a00,00')).toBe(true);
  });
});
