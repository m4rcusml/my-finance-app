import type { CivilDate, ImportFileType, Money, TransactionType } from '@finance/contracts';
import { isCivilDate } from '../../common/civil-date';
import { roundMoney } from '../../common/money';
import type { FileParser, RawImportRow } from './parser.interface';
import { decodeText } from './parser.utils';

/**
 * OFX statements, both flavours.
 *
 * OFX 1.x is SGML: aggregates are closed (`<STMTTRN> ... </STMTTRN>`) but leaf
 * tags are not (`<TRNAMT>-45.90` runs to end of line). OFX 2.x is well-formed
 * XML. Feeding the first one to an XML parser — which is what the previous
 * implementation did — either throws or silently yields nothing, and its
 * hard-coded `STMTRS` path meant **every credit-card statement (`CCSTMTRS`)
 * imported zero rows**.
 *
 * Scanning for `STMTTRN` blocks and reading their leaf tags with a single
 * regex handles both flavours and both aggregates without branching.
 */
export class OfxParser implements FileParser {
  readonly fileType: ImportFileType = 'ofx';

  async parse(buffer: Buffer): Promise<RawImportRow[]> {
    const content = decodeText(buffer);
    const start = content.search(/<OFX>/i);
    const body = start >= 0 ? content.slice(start) : content;

    const rows: RawImportRow[] = [];
    for (const match of body.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
      const fields = readLeafTags(match[1]);
      const amount = parseOfxAmount(fields.TRNAMT);
      const date = parseOfxDate(fields.DTPOSTED);

      rows.push({
        rowNumber: rows.length + 1,
        data: {
          // On an unparseable date the raw text is passed through so the row is
          // reported as "data inválida" instead of vanishing from the preview.
          date: date ?? fields.DTPOSTED ?? null,
          description: fields.MEMO ?? fields.NAME ?? null,
          value: amount ?? fields.TRNAMT ?? null,
          type: resolveOfxType(amount, fields.TRNTYPE),
          externalId: fields.FITID ?? null,
          trnType: fields.TRNTYPE ?? null,
        },
      });
    }
    return rows;
  }
}

/**
 * Reads `<TAG>value` pairs out of one transaction block. Works for the SGML
 * form (value runs to the newline) and the XML form (value runs to `</TAG>`),
 * because both stop at the next `<`. Aggregate opening tags carry no text and
 * are skipped; the first occurrence of a tag wins.
 */
function readLeafTags(block: string): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  const pattern = /<([A-Za-z0-9._]+)>([^<\r\n]*)/g;
  let match = pattern.exec(block);
  while (match !== null) {
    const tag = match[1].toUpperCase();
    const value = match[2].trim();
    if (value.length > 0 && fields[tag] === undefined) fields[tag] = value;
    match = pattern.exec(block);
  }
  return fields;
}

/**
 * `DTPOSTED` in the wild: `20260401`, `20260401120000`, `20260401120000.000`
 * and `20260401120000[-3:BRT]`. The stamp is already local to the stated
 * timezone, so the civil date is simply its first eight digits.
 */
export function parseOfxDate(raw: string | undefined): CivilDate | null {
  if (!raw) return null;
  const match = /^\s*(\d{4})(\d{2})(\d{2})/.exec(raw);
  if (!match) return null;
  const candidate = `${match[1]}-${match[2]}-${match[3]}`;
  return isCivilDate(candidate) ? candidate : null;
}

/**
 * `TRNAMT` is spec'd as a plain decimal with `.` or `,` as the separator and no
 * grouping, so it is parsed strictly rather than through the loose CSV parser
 * (which would read `-1.500` as minus fifteen hundred).
 */
export function parseOfxAmount(raw: string | undefined): Money | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
}

/** `TRNTYPE` values whose direction is unambiguous. */
const TRN_TYPE_DIRECTION: Record<string, TransactionType> = {
  CREDIT: 'income',
  DEP: 'income',
  DIRECTDEP: 'income',
  INT: 'income',
  DIV: 'income',
  DEBIT: 'expense',
  PAYMENT: 'expense',
  DIRECTDEBIT: 'expense',
  REPEATPMT: 'expense',
  FEE: 'expense',
  SRVCHG: 'expense',
  ATM: 'expense',
  POS: 'expense',
  CHECK: 'expense',
};

/**
 * Direction of an OFX transaction.
 *
 * A negative `TRNAMT` is always money leaving. A positive one is money in,
 * unless `TRNTYPE` says otherwise — some banks (and most card issuers) export
 * every amount positive and rely entirely on the type code.
 */
export function resolveOfxType(amount: Money | null, trnType: string | undefined): TransactionType | null {
  const hint = trnType ? (TRN_TYPE_DIRECTION[trnType.trim().toUpperCase()] ?? null) : null;
  if (amount === null) return hint;
  if (amount < 0) return 'expense';
  if (amount > 0) return hint ?? 'income';
  return hint;
}
