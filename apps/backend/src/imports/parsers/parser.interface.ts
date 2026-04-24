export interface ParsedRow {
  [key: string]: unknown;
}

export interface FileParser {
  parse(buffer: Buffer): Promise<ParsedRow[]>;
  supports(mimeType: string, ext: string): boolean;
}
