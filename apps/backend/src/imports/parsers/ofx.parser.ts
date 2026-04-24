import { XMLParser } from 'fast-xml-parser';
import type { FileParser, ParsedRow } from './parser.interface';

export class OfxParser implements FileParser {
  supports(mimeType: string, ext: string): boolean {
    return mimeType === 'application/x-ofx' || mimeType === 'text/x-ofx' || ext === '.ofx';
  }

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const content = buffer.toString('utf-8');
    // OFX files are SGML/XML hybrid. Extract the XML portion after the header.
    const xmlStart = content.indexOf('<OFX>');
    if (xmlStart === -1) {
      return [];
    }
    const xmlContent = content.slice(xmlStart);

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      trimValues: true,
    });
    const parsed = parser.parse(xmlContent) as Record<string, unknown>;

    const ofxRoot = parsed.OFX as Record<string, unknown> | undefined;
    if (!ofxRoot) {
      return [];
    }

    // Navigate to BANKMSGSRSV1 or CREDITCARDMSGSRSV1 → STMTRS → BANKTRANLIST → STMTTRN
    const bankMsg = (ofxRoot.BANKMSGSRSV1 ?? ofxRoot.CREDITCARDMSGSRSV1) as Record<string, unknown> | undefined;
    if (!bankMsg) {
      return [];
    }

    const stmtTrnRs = bankMsg.STMTTRNRS ?? bankMsg.CCSTMTTRNRS;
    const stmtRs = (stmtTrnRs as Record<string, unknown> | undefined)?.STMTRS as Record<string, unknown> | undefined;
    if (!stmtRs) {
      return [];
    }

    const tranList = stmtRs.BANKTRANLIST as Record<string, unknown> | undefined;
    if (!tranList) {
      return [];
    }

    const stmtTrn = tranList.STMTTRN as Record<string, unknown> | Record<string, unknown>[] | undefined;

    if (!stmtTrn) {
      return [];
    }

    const transactions = Array.isArray(stmtTrn) ? stmtTrn : [stmtTrn];

    return transactions.map((trn) => ({
      date: trn.DTPOSTED,
      description: trn.MEMO ?? trn.NAME,
      value: trn.TRNAMT,
      type: trn.TRNTYPE,
      externalId: trn.FITID,
    }));
  }
}
