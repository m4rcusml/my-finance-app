/**
 * Text plumbing shared by the CSV and XLSX parsers.
 *
 * Two of the bugs this file exists to kill:
 *  - a UTF-8 BOM in front of the first header name made every column lookup
 *    miss, so a perfectly good file previewed as zero rows;
 *  - Brazilian bank exports are frequently ISO-8859-1, which decoded as UTF-8
 *    turns `Salário` into `Sal�rio` and breaks the same lookups.
 */

/** Header tokens that identify the real header line of a statement export. */
const HEADER_HINTS = [
  'data',
  'date',
  'dt',
  'valor',
  'value',
  'amount',
  'lancamento',
  'descricao',
  'description',
  'historico',
  'memo',
  'tipo',
  'type',
  'credito',
  'debito',
];

/** Delimiters we are willing to sniff, most specific first. */
const CANDIDATE_DELIMITERS = [';', ',', '\t', '|'] as const;

export type CsvDelimiter = (typeof CANDIDATE_DELIMITERS)[number];

/** Lines scanned while looking for the header; enough for any bank preamble. */
const MAX_PREAMBLE_LINES = 25;

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Decodes an uploaded text file. UTF-8 first; if that produced replacement
 * characters the bytes were almost certainly latin-1 (the default of every
 * Brazilian internet-banking CSV export), so decode again as latin-1.
 */
export function decodeText(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  if (!utf8.includes('\ufffd')) return stripBom(utf8);
  return stripBom(buffer.toString('latin1'));
}

/** Lowercases and removes diacritics so `Lançamento` and `lancamento` match. */
export function normaliseKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase();
}

export function isBlankCell(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

export function isBlankRecord(record: Record<string, unknown>): boolean {
  return Object.values(record).every(isBlankCell);
}

/** Counts a character in a line, ignoring anything inside double quotes. */
export function countOutsideQuotes(line: string, char: string): number {
  let inQuotes = false;
  let count = 0;
  for (const current of line) {
    if (current === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && current === char) count += 1;
  }
  return count;
}

/** Picks the delimiter that appears most often in the header line. */
export function sniffDelimiter(headerLine: string): CsvDelimiter {
  let best: CsvDelimiter = ',';
  let bestCount = 0;
  for (const candidate of CANDIDATE_DELIMITERS) {
    const count = countOutsideQuotes(headerLine, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** True when at least one cell of the row reads like a statement column name. */
export function looksLikeHeader(cells: readonly unknown[]): boolean {
  const filled = cells.filter((cell) => !isBlankCell(cell));
  if (filled.length < 2) return false;
  return filled.some((cell) => {
    const key = normaliseKey(cell);
    return HEADER_HINTS.some((hint) => key === hint || key.startsWith(`${hint} `) || key.includes(hint));
  });
}

/**
 * Finds the header among rows that may be preceded by a bank preamble
 * (`Extrato Conta Corrente`, `Período: ...`, a blank line, then the header).
 * Falls back to the first non-blank row so an unrecognised layout still
 * previews — with per-row errors — instead of silently returning nothing.
 */
export function findHeaderRowIndex(rows: readonly (readonly unknown[])[]): number {
  let firstNonBlank = -1;
  const limit = Math.min(rows.length, MAX_PREAMBLE_LINES);
  for (let index = 0; index < limit; index += 1) {
    const cells = rows[index];
    if (cells.every(isBlankCell)) continue;
    if (firstNonBlank === -1) firstNonBlank = index;
    if (looksLikeHeader(cells)) return index;
  }
  return firstNonBlank;
}

/**
 * Turns a raw header row into usable, unique object keys. Empty names become
 * `coluna_N` and repeats get a numeric suffix, because `columns: true` in
 * csv-parse throws on duplicates and silently overwrites on blanks.
 */
export function normaliseHeader(cells: readonly unknown[]): string[] {
  const seen = new Map<string, number>();
  return cells.map((cell, index) => {
    const base = String(cell ?? '')
      .replace(/^\ufeff/, '')
      .trim();
    const name = base.length > 0 ? base : `coluna_${index + 1}`;
    const previous = seen.get(name) ?? 0;
    seen.set(name, previous + 1);
    return previous === 0 ? name : `${name}_${previous + 1}`;
  });
}
