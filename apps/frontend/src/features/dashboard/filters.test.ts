import { buildDashboardQuery, shiftMonths, startOfMonthCivil } from './filters';

describe('dashboard civil-date filters', () => {
  it('não reinterpreta o dia civil para montar o início do mês', () => {
    expect(startOfMonthCivil('2026-03-31')).toBe('2026-03-01');
  });

  it('limita o dia ao deslocar para um mês mais curto', () => {
    expect(shiftMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(shiftMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('não dispara consulta para intervalo personalizado incompleto ou invertido', () => {
    expect(buildDashboardQuery({ period: 'custom', referenceDate: '2026-03-10', from: '', to: '' }).query).toBeNull();
    expect(
      buildDashboardQuery({
        period: 'custom',
        referenceDate: '2026-03-10',
        from: '2026-03-20',
        to: '2026-03-01',
      }).query,
    ).toBeNull();
  });

  it('preserva exatamente as datas civis de um intervalo válido', () => {
    expect(
      buildDashboardQuery({
        period: 'custom',
        referenceDate: '2026-03-10',
        from: '2026-03-01',
        to: '2026-03-31',
      }).query,
    ).toEqual({
      period: 'custom',
      referenceDate: '2026-03-10',
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });
});
