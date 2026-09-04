import type { CivilDate, InvestmentWithAsset, InvestmentType } from '@finance/contracts';

export function buildContributionSeries(investments: InvestmentWithAsset[], referenceDate: CivilDate) {
  const [year, month] = referenceDate.split('-').map(Number);
  const lastMonth = year * 12 + month - 1;
  const centsByMonth = new Map<string, number>();
  for (const investment of investments) {
    const key = investment.buyDate.slice(0, 7);
    centsByMonth.set(key, (centsByMonth.get(key) ?? 0) + Math.round(investment.investedAmount * 100));
  }
  return Array.from({ length: 6 }, (_, index) => {
    const value = lastMonth - 5 + index;
    const key = `${Math.floor(value / 12)}-${String((value % 12) + 1).padStart(2, '0')}`;
    return { month: key, amount: (centsByMonth.get(key) ?? 0) / 100 };
  });
}

export const INVESTMENT_COLORS: Record<InvestmentType, string> = {
  fixed_income: '#a78bfa',
  etf: '#60a5fa',
  fund: '#34d399',
  crypto: '#fbbf24',
  stock: '#a78bfa',
  fii: '#a78bfa',
  other: '#a78bfa',
};

export function investmentMarker(type: InvestmentType) {
  const variant = type === 'etf' ? 'etf' : type === 'crypto' ? 'crypto' : type === 'fund' ? 'fund' : 'fixed-income';
  return `/assets/figma/patrimonio/asset-${variant}.svg`;
}
