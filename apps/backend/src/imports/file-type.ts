import { type ImportFileType } from '@finance/contracts';
import { UnsupportedMediaTypeException } from '@nestjs/common';

/**
 * Which uploads the import pipeline accepts, and how it decides.
 *
 * Both the extension **and** the bytes have to agree. Trusting the extension
 * alone lets `payload.exe` renamed to `extrato.csv` reach a parser; trusting
 * the bytes alone turns the endpoint into a content-type oracle for arbitrary
 * uploads. Disagreement is a 415.
 */

const EXTENSION_TO_TYPE: Record<string, ImportFileType> = {
  '.csv': 'csv',
  '.ofx': 'ofx',
  '.qfx': 'ofx',
  '.xlsx': 'xlsx',
  '.xlsm': 'xlsx',
  '.xls': 'xlsx',
};

export const ACCEPTED_IMPORT_EXTENSIONS = Object.keys(EXTENSION_TO_TYPE);

/** How many leading bytes the content sniffer looks at. */
const SNIFF_BYTES = 4096;

/** `PK\x03\x04` — xlsx/xlsm are ZIP containers. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
/** OLE2 compound file — the legacy `.xls` container. */
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

export function extensionOf(fileName: string): string {
  const base = fileName.replace(/\\/g, '/').split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot).toLowerCase() : '';
}

/** Best guess at what the bytes actually are; `null` when nothing fits. */
export function sniffImportFileType(buffer: Buffer): ImportFileType | null {
  if (buffer.length === 0) return null;
  if (buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) return 'xlsx';
  if (buffer.subarray(0, OLE2_MAGIC.length).equals(OLE2_MAGIC)) return 'xlsx';

  const head = buffer.subarray(0, SNIFF_BYTES);
  if (!isProbablyText(head)) return null;

  const text = head.toString('utf8');
  if (/OFXHEADER|<OFX>/i.test(text)) return 'ofx';
  return 'csv';
}

/** Rejects binaries: a NUL byte, or a suspicious amount of control characters. */
function isProbablyText(head: Buffer): boolean {
  let control = 0;
  for (const byte of head) {
    if (byte === 0x00) return false;
    const isPrintableControl = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (byte < 0x20 && !isPrintableControl) control += 1;
  }
  return control / Math.max(head.length, 1) < 0.05;
}

/**
 * Resolves the type of an upload or throws 415.
 *
 * Pure and side-effect free so both the request pipe (which fails fast) and the
 * service (which is unit-tested without HTTP) can call it.
 */
export function resolveImportFileType(fileName: string, buffer: Buffer): ImportFileType {
  const byExtension = EXTENSION_TO_TYPE[extensionOf(fileName)];
  if (!byExtension) {
    throw new UnsupportedMediaTypeException(
      `Formato não suportado. Envie um arquivo ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}.`,
    );
  }

  const sniffed = sniffImportFileType(buffer);
  if (sniffed === null) {
    throw new UnsupportedMediaTypeException(
      'Não foi possível ler o arquivo enviado. Verifique se ele não está corrompido.',
    );
  }
  if (sniffed !== byExtension) {
    throw new UnsupportedMediaTypeException('O conteúdo do arquivo não corresponde à sua extensão.');
  }
  return byExtension;
}

/** Strips any path a client may have sent and caps the length the DB stores. */
export function sanitiseFileName(fileName: string): string {
  const base = (fileName ?? '').replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = Array.from(base)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .trim();
  return (cleaned.length > 0 ? cleaned : 'arquivo').slice(0, 200);
}
