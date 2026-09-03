import {
  excelSerialToCivilDate,
  parseCivilDateValue,
  parseMoneyValue,
  parseTypeHint,
} from './value.parser';

describe('parseMoneyValue', () => {
  describe('separator notations', () => {
    it.each([
      ['1.234,56', 1234.56],
      ['1234,56', 1234.56],
      ['1234.56', 1234.56],
      ['1,234.56', 1234.56],
      ['1.234.567,89', 1234567.89],
      ['1,234,567.89', 1234567.89],
      ['0,00', 0],
      ['0.5', 0.5],
      ['12', 12],
    ])('parses %s as %s', (input, expected) => {
      expect(parseMoneyValue(input)).toBe(expected);
    });

    it('never multiplies a dot-decimal by 100 (the old parser stripped every dot)', () => {
      expect(parseMoneyValue('1234.56')).not.toBe(123456);
      expect(parseMoneyValue('45.90')).toBe(45.9);
    });

    it('reads a lone dot before three digits as a thousands separator', () => {
      expect(parseMoneyValue('1.234')).toBe(1234);
    });
  });

  describe('currency and sign', () => {
    it.each([
      ['R$ 1.234,56', 1234.56],
      ['R$1.234,56', 1234.56],
      ['  R$ 12,34  ', 12.34],
      ['-45,90', -45.9],
      ['R$ -1.000,00', -1000],
      ['(45,90)', -45.9],
      ['(R$ 1.234,56)', -1234.56],
      ['45,90-', -45.9],
    ])('parses %s as %s', (input, expected) => {
      expect(parseMoneyValue(input)).toBe(expected);
    });
  });

  describe('non-values', () => {
    it.each([['', null], ['   ', null], ['abc', null], ['-', null], ['R$', null]])(
      'returns null for %p',
      (input, expected) => {
        expect(parseMoneyValue(input)).toBe(expected);
      },
    );

    it('returns null (not 0) so the row can be reported instead of imported', () => {
      expect(parseMoneyValue('sem valor')).toBeNull();
      expect(parseMoneyValue(null)).toBeNull();
      expect(parseMoneyValue(undefined)).toBeNull();
      expect(parseMoneyValue({})).toBeNull();
    });

    it('rejects amounts wider than numeric(15,2)', () => {
      expect(parseMoneyValue('99999999999999,99')).toBeNull();
    });
  });

  describe('numbers', () => {
    it('passes a numeric cell through, rounded to cents', () => {
      expect(parseMoneyValue(1234.56)).toBe(1234.56);
      expect(parseMoneyValue(-45.905)).toBe(-45.9);
    });

    it('rejects NaN and Infinity', () => {
      expect(parseMoneyValue(Number.NaN)).toBeNull();
      expect(parseMoneyValue(Number.POSITIVE_INFINITY)).toBeNull();
    });
  });
});

describe('parseCivilDateValue', () => {
  it.each([
    ['01/04/2026', '2026-04-01'],
    ['1/4/2026', '2026-04-01'],
    ['01-04-2026', '2026-04-01'],
    ['01.04.2026', '2026-04-01'],
    ['2026-04-01', '2026-04-01'],
    ['29/02/2028', '2028-02-29'],
  ])('parses %s as %s', (input, expected) => {
    expect(parseCivilDateValue(input)).toBe(expected);
  });

  it('rejects calendar-invalid days at preview time', () => {
    expect(parseCivilDateValue('31/02/2026')).toBeNull();
    expect(parseCivilDateValue('29/02/2026')).toBeNull();
    expect(parseCivilDateValue('31/04/2026')).toBeNull();
    expect(parseCivilDateValue('2026-02-31')).toBeNull();
    expect(parseCivilDateValue('00/01/2026')).toBeNull();
    expect(parseCivilDateValue('01/13/2026')).toBeNull();
  });

  it('returns null for anything unparseable', () => {
    expect(parseCivilDateValue('')).toBeNull();
    expect(parseCivilDateValue('ontem')).toBeNull();
    expect(parseCivilDateValue(null)).toBeNull();
    expect(parseCivilDateValue(undefined)).toBeNull();
  });

  it('reads a Date instance', () => {
    expect(parseCivilDateValue(new Date('2026-04-01T00:00:00.000Z'))).toBe('2026-04-01');
    expect(parseCivilDateValue(new Date('nope'))).toBeNull();
  });

  it('reads Excel numeric serials, as numbers and as strings', () => {
    expect(parseCivilDateValue(45292)).toBe('2024-01-01');
    expect(parseCivilDateValue('45292')).toBe('2024-01-01');
    expect(parseCivilDateValue(46113)).toBe('2026-04-01');
    // A serial with a time fraction still names its day.
    expect(parseCivilDateValue(46113.75)).toBe('2026-04-01');
  });
});

describe('excelSerialToCivilDate', () => {
  it('handles the 1900 leap-year bug', () => {
    expect(excelSerialToCivilDate(1)).toBe('1900-01-01');
    expect(excelSerialToCivilDate(59)).toBe('1900-02-28');
    // 1900-02-29 never existed; Excel thinks it did.
    expect(excelSerialToCivilDate(60)).toBeNull();
    expect(excelSerialToCivilDate(61)).toBe('1900-03-01');
  });

  it('rejects serials outside the representable range', () => {
    expect(excelSerialToCivilDate(0)).toBeNull();
    expect(excelSerialToCivilDate(-5)).toBeNull();
    expect(excelSerialToCivilDate(2_958_466)).toBeNull();
    // A plain YYYYMMDD number is not a serial.
    expect(excelSerialToCivilDate(20260401)).toBeNull();
  });
});

describe('parseTypeHint', () => {
  it.each([
    ['Entrada', 'income'],
    ['RECEITA', 'income'],
    ['Crédito', 'income'],
    ['credito', 'income'],
    ['C', 'income'],
    ['Saída', 'expense'],
    ['despesa', 'expense'],
    ['Débito', 'expense'],
    ['DEBIT', 'expense'],
    ['D', 'expense'],
  ])('maps %s to %s', (input, expected) => {
    expect(parseTypeHint(input)).toBe(expected);
  });

  it('returns null when the column says something it cannot map', () => {
    expect(parseTypeHint('Compra à vista')).toBeNull();
    expect(parseTypeHint('Parcela 2/3')).toBeNull();
    expect(parseTypeHint('')).toBeNull();
    expect(parseTypeHint(null)).toBeNull();
  });
});
