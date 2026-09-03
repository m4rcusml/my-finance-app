/**
 * `embedded-postgres` is ESM-only and publishes its types through package
 * exports. This project intentionally remains CommonJS with legacy `node`
 * module resolution, so TypeScript cannot discover that declaration even
 * though Node's dynamic import resolves the runtime package correctly.
 */
declare module 'embedded-postgres' {
  export default class EmbeddedPostgres {
    constructor(options: Record<string, unknown>);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
  }
}
