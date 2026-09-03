import type { ImportFileType } from '@finance/contracts';
import { CsvParser } from './csv.parser';
import { OfxParser } from './ofx.parser';
import type { FileParser } from './parser.interface';
import { XlsxParser } from './xlsx.parser';

/**
 * Parsers are keyed by the **resolved** file type, not by the client-supplied
 * MIME type. Browsers send `application/octet-stream` for `.ofx` about as often
 * as they send anything useful, so `file-type.ts` decides from the extension
 * plus the actual bytes and this factory just dispatches.
 */
const PARSERS: Record<ImportFileType, FileParser> = {
  csv: new CsvParser(),
  ofx: new OfxParser(),
  xlsx: new XlsxParser(),
};

export function getParser(fileType: ImportFileType): FileParser {
  return PARSERS[fileType];
}
