/**
 * Hard limits for the backup slice.
 *
 * They live here (and not in `src/config`) because they are structural
 * properties of the payload format rather than deployment knobs: the only
 * environment-driven limit is `MAX_BACKUP_BYTES`, which the service reads from
 * `EnvConfig`.
 */

/** Rows fetched per page while exporting. Keeps a large ledger off one query. */
export const EXPORT_PAGE_SIZE = 500;

/**
 * Refuse to export a table larger than this instead of silently truncating it.
 * A half-written backup is far more dangerous than a failed one.
 */
export const MAX_EXPORT_ROWS_PER_TABLE = 200_000;

/** Cap on rows accepted per collection in a restore payload. */
export const MAX_RESTORE_ROWS_PER_COLLECTION = 100_000;

/** Rows per `createMany` call during a restore. */
export const RESTORE_WRITE_CHUNK_SIZE = 1_000;

/** Ids per `IN (...)` lookup when reconciling a merge. */
export const RESTORE_LOOKUP_CHUNK_SIZE = 1_000;

/** Validation problems reported before the list is summarised. */
export const MAX_VALIDATION_PROBLEMS = 50;

/** A full restore can touch a lot of rows; give the transaction room. */
export const RESTORE_TRANSACTION_TIMEOUT_MS = 180_000;
export const RESTORE_TRANSACTION_MAX_WAIT_MS = 15_000;

/** `numeric(15,2)` — 13 integer digits plus 2 decimals. */
export const MAX_MONEY_ABS = 9_999_999_999_999.99;
export const MONEY_DECIMALS = 2;

/** `numeric(15,8)` — 7 integer digits plus 8 decimals. */
export const MAX_QUANTITY_ABS = 9_999_999.99999999;
export const QUANTITY_DECIMALS = 8;

/** Free-text ceiling; the columns are unbounded `text` but a backup is not. */
export const MAX_TEXT_LENGTH = 500;

/** Ids are uuids in practice; the cap only stops absurd payloads. */
export const MAX_ID_LENGTH = 191;

export const MIN_PERIOD_YEAR = 1900;
export const MAX_PERIOD_YEAR = 2999;
