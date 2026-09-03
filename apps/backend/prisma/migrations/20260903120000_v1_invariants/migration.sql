-- V1 data model.
--
-- This migration is written by hand so the upgrade path from the pre-V1 schema
-- is explicit and non-destructive. It:
--   1. introduces native enums with a single lowercase spelling;
--   2. normalises existing free-text values into those enums;
--   3. turns civil dates (transaction date, real date, buy date, deadline) into
--      `date` columns so they can no longer shift across timezones;
--   4. adds archival columns and the exactly-one-source CHECK constraints,
--      repairing any pre-existing row that violates them instead of failing;
--   5. adds the import batch tables and the refresh-token table.
--
-- No row is ever deleted. Transactions that had neither an account nor a card
-- are attached to a per-user archived placeholder account so their history and
-- their amounts survive while satisfying the new invariant.

-- ---------------------------------------------------------------------------
-- 1. Enum types
-- ---------------------------------------------------------------------------
CREATE TYPE "account_type" AS ENUM ('checking', 'savings', 'investment', 'cash', 'other');
CREATE TYPE "category_type" AS ENUM ('income', 'expense', 'both');
CREATE TYPE "transaction_type" AS ENUM ('income', 'expense');
CREATE TYPE "transaction_source" AS ENUM ('manual', 'imported', 'fixed');
CREATE TYPE "occurrence_status" AS ENUM ('pending', 'confirmed', 'skipped');
CREATE TYPE "investment_type" AS ENUM ('stock', 'fii', 'etf', 'crypto', 'fixed_income', 'fund', 'other');
CREATE TYPE "goal_type" AS ENUM ('saving', 'spending_limit', 'debt_payoff', 'other');
CREATE TYPE "import_origin" AS ENUM ('inter', 'generic');
CREATE TYPE "import_file_type" AS ENUM ('csv', 'ofx', 'xlsx');
CREATE TYPE "import_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'expired');

-- ---------------------------------------------------------------------------
-- 2. users: refresh-token versioning
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. accounts
-- ---------------------------------------------------------------------------
ALTER TABLE "accounts" ADD COLUMN "archived_at" TIMESTAMP(3);
UPDATE "accounts" SET "archived_at" = "updated_at" WHERE "is_active" = false AND "archived_at" IS NULL;

ALTER TABLE "accounts" ALTER COLUMN "type" TYPE "account_type" USING (
  CASE replace(replace(lower(btrim(coalesce("type", ''))), '-', '_'), ' ', '_')
    WHEN 'checking' THEN 'checking'
    WHEN 'savings' THEN 'savings'
    WHEN 'investment' THEN 'investment'
    WHEN 'cash' THEN 'cash'
    ELSE 'other'
  END::"account_type"
);

CREATE INDEX "accounts_user_id_is_active_idx" ON "accounts"("user_id", "is_active");
CREATE INDEX "accounts_user_id_type_idx" ON "accounts"("user_id", "type");

-- ---------------------------------------------------------------------------
-- 4. credit_cards
-- ---------------------------------------------------------------------------
ALTER TABLE "credit_cards" ADD COLUMN "archived_at" TIMESTAMP(3);
UPDATE "credit_cards" SET "archived_at" = "updated_at" WHERE "is_active" = false AND "archived_at" IS NULL;
CREATE INDEX "credit_cards_user_id_is_active_idx" ON "credit_cards"("user_id", "is_active");

-- ---------------------------------------------------------------------------
-- 5. categories
-- ---------------------------------------------------------------------------
ALTER TABLE "categories" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "categories" ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "categories" ALTER COLUMN "type" TYPE "category_type" USING (
  CASE replace(replace(lower(btrim(coalesce("type", ''))), '-', '_'), ' ', '_')
    WHEN 'income' THEN 'income'
    WHEN 'expense' THEN 'expense'
    ELSE 'both'
  END::"category_type"
);

-- De-duplicate (user, name, type) before adding the unique key: keep the oldest
-- row untouched and suffix the newer ones so nothing is lost.
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "user_id", "name", "type" ORDER BY "created_at", "id") AS rn
  FROM "categories"
)
UPDATE "categories" c
SET "name" = c."name" || ' (' || r.rn || ')'
FROM ranked r
WHERE c."id" = r."id" AND r.rn > 1;

CREATE UNIQUE INDEX "categories_user_id_name_type_key" ON "categories"("user_id", "name", "type");
CREATE INDEX "categories_user_id_is_active_idx" ON "categories"("user_id", "is_active");

-- ---------------------------------------------------------------------------
-- 6. Placeholder account for orphaned rows (created only when needed)
-- ---------------------------------------------------------------------------
INSERT INTO "accounts" ("id", "user_id", "name", "institution", "type", "initial_balance", "is_active", "archived_at", "created_at", "updated_at")
SELECT
  md5('migration-placeholder-' || u."id")::uuid::text,
  u."id",
  'Conta não especificada (migração)',
  'Migração V1',
  'other'::"account_type",
  0,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE EXISTS (
  SELECT 1 FROM "transactions" t
  WHERE t."user_id" = u."id" AND t."account_id" IS NULL AND t."credit_card_id" IS NULL
) OR EXISTS (
  SELECT 1 FROM "fixed_transactions" f
  WHERE f."user_id" = u."id" AND f."account_id" IS NULL AND f."credit_card_id" IS NULL
);

-- ---------------------------------------------------------------------------
-- 7. transactions
-- ---------------------------------------------------------------------------
ALTER TABLE "transactions" ADD COLUMN "import_batch_id" TEXT;

ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "transaction_type" USING (
  CASE WHEN replace(replace(lower(btrim(coalesce("type", ''))), '-', '_'), ' ', '_') = 'income' THEN 'income' ELSE 'expense' END::"transaction_type"
);
ALTER TABLE "transactions" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "source" TYPE "transaction_source" USING (
  CASE replace(replace(lower(btrim(coalesce("source", ''))), '-', '_'), ' ', '_')
    WHEN 'imported' THEN 'imported'
    WHEN 'fixed' THEN 'fixed'
    ELSE 'manual'
  END::"transaction_source"
);
ALTER TABLE "transactions" ALTER COLUMN "source" SET DEFAULT 'manual';

-- Civil date. Values were written as UTC midnight into a `timestamp` column,
-- so a plain cast recovers the intended calendar day exactly.
ALTER TABLE "transactions" ALTER COLUMN "date" TYPE DATE USING ("date"::date);

-- Repair rows that violate exactly-one-source.
UPDATE "transactions" SET "credit_card_id" = NULL
WHERE "account_id" IS NOT NULL AND "credit_card_id" IS NOT NULL;

UPDATE "transactions" t
SET "account_id" = md5('migration-placeholder-' || t."user_id")::uuid::text
WHERE t."account_id" IS NULL AND t."credit_card_id" IS NULL;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_exactly_one_source"
  CHECK (("account_id" IS NOT NULL) <> ("credit_card_id" IS NOT NULL));

-- Same externalId can only be imported once per user.
CREATE UNIQUE INDEX "transactions_user_id_external_id_key"
  ON "transactions"("user_id", "external_id") WHERE "external_id" IS NOT NULL;

CREATE INDEX "transactions_user_id_date_id_idx" ON "transactions"("user_id", "date" DESC, "id");
CREATE INDEX "transactions_user_id_account_id_idx" ON "transactions"("user_id", "account_id");
CREATE INDEX "transactions_user_id_credit_card_id_date_idx" ON "transactions"("user_id", "credit_card_id", "date");
CREATE INDEX "transactions_user_id_category_id_idx" ON "transactions"("user_id", "category_id");
CREATE INDEX "transactions_user_id_source_idx" ON "transactions"("user_id", "source");
CREATE INDEX "transactions_user_id_type_date_idx" ON "transactions"("user_id", "type", "date");

-- History must not vanish when a parent is removed.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_account_id_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_credit_card_id_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_id_fkey"
  FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_category_id_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 8. fixed_transactions
-- ---------------------------------------------------------------------------
ALTER TABLE "fixed_transactions" ADD COLUMN "archived_at" TIMESTAMP(3);
UPDATE "fixed_transactions" SET "archived_at" = "updated_at" WHERE "is_active" = false AND "archived_at" IS NULL;

ALTER TABLE "fixed_transactions" ALTER COLUMN "type" TYPE "transaction_type" USING (
  CASE WHEN replace(replace(lower(btrim(coalesce("type", ''))), '-', '_'), ' ', '_') = 'income' THEN 'income' ELSE 'expense' END::"transaction_type"
);

UPDATE "fixed_transactions" SET "credit_card_id" = NULL
WHERE "account_id" IS NOT NULL AND "credit_card_id" IS NOT NULL;

UPDATE "fixed_transactions" f
SET "account_id" = md5('migration-placeholder-' || f."user_id")::uuid::text
WHERE f."account_id" IS NULL AND f."credit_card_id" IS NULL;

-- Drop dangling references before the FKs go on (these columns had none before).
UPDATE "fixed_transactions" f SET "account_id" = NULL
WHERE f."account_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."id" = f."account_id");
UPDATE "fixed_transactions" f SET "credit_card_id" = NULL
WHERE f."credit_card_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "credit_cards" c WHERE c."id" = f."credit_card_id");
UPDATE "fixed_transactions" f
SET "account_id" = md5('migration-placeholder-' || f."user_id")::uuid::text
WHERE f."account_id" IS NULL AND f."credit_card_id" IS NULL;

ALTER TABLE "fixed_transactions" ADD CONSTRAINT "fixed_transactions_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_transactions" ADD CONSTRAINT "fixed_transactions_credit_card_id_fkey"
  FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_transactions" ADD CONSTRAINT "fixed_transactions_exactly_one_source"
  CHECK (("account_id" IS NOT NULL) <> ("credit_card_id" IS NOT NULL));

ALTER TABLE "fixed_transactions" DROP CONSTRAINT IF EXISTS "fixed_transactions_category_id_fkey";
ALTER TABLE "fixed_transactions" ADD CONSTRAINT "fixed_transactions_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "fixed_transactions_user_id_is_active_idx" ON "fixed_transactions"("user_id", "is_active");

-- ---------------------------------------------------------------------------
-- 9. fixed_transaction_occurrences
-- ---------------------------------------------------------------------------
ALTER TABLE "fixed_transaction_occurrences" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "fixed_transaction_occurrences" ALTER COLUMN "status" TYPE "occurrence_status" USING (
  CASE replace(replace(lower(btrim(coalesce("status", ''))), '-', '_'), ' ', '_')
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'skipped' THEN 'skipped'
    ELSE 'pending'
  END::"occurrence_status"
);
ALTER TABLE "fixed_transaction_occurrences" ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "fixed_transaction_occurrences" ALTER COLUMN "real_date" TYPE DATE USING ("real_date"::date);

-- Snapshot columns, backfilled from the current template so existing history
-- keeps the values it was generated with.
ALTER TABLE "fixed_transaction_occurrences" ADD COLUMN "due_date" DATE;
ALTER TABLE "fixed_transaction_occurrences" ADD COLUMN "type" "transaction_type";
ALTER TABLE "fixed_transaction_occurrences" ADD COLUMN "value" DECIMAL(15,2);
ALTER TABLE "fixed_transaction_occurrences" ADD COLUMN "description" TEXT;
ALTER TABLE "fixed_transaction_occurrences" ADD COLUMN "category_id" TEXT;
ALTER TABLE "fixed_transaction_occurrences" ADD COLUMN "account_id" TEXT;
ALTER TABLE "fixed_transaction_occurrences" ADD COLUMN "credit_card_id" TEXT;

UPDATE "fixed_transaction_occurrences" o
SET
  "type" = f."type",
  "value" = f."value",
  "description" = f."description",
  "category_id" = f."category_id",
  "account_id" = f."account_id",
  "credit_card_id" = f."credit_card_id",
  "due_date" = make_date(
    o."period_year",
    o."period_month",
    LEAST(
      f."reference_day",
      EXTRACT(DAY FROM (make_date(o."period_year", o."period_month", 1) + INTERVAL '1 month - 1 day'))::int
    )
  )
FROM "fixed_transactions" f
WHERE f."id" = o."fixed_transaction_id";

ALTER TABLE "fixed_transaction_occurrences" ALTER COLUMN "due_date" SET NOT NULL;
ALTER TABLE "fixed_transaction_occurrences" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "fixed_transaction_occurrences" ALTER COLUMN "value" SET NOT NULL;
ALTER TABLE "fixed_transaction_occurrences" ALTER COLUMN "category_id" SET NOT NULL;

ALTER TABLE "fixed_transaction_occurrences" ADD CONSTRAINT "fixed_transaction_occurrences_exactly_one_source"
  CHECK (("account_id" IS NOT NULL) <> ("credit_card_id" IS NOT NULL));
ALTER TABLE "fixed_transaction_occurrences" ADD CONSTRAINT "fixed_transaction_occurrences_confirmed_has_transaction"
  CHECK (("status" <> 'confirmed') OR ("transaction_id" IS NOT NULL AND "real_date" IS NOT NULL));

-- One occurrence per booked transaction: a concurrent double-confirm loses.
CREATE UNIQUE INDEX "fixed_transaction_occurrences_transaction_id_key"
  ON "fixed_transaction_occurrences"("transaction_id");
CREATE INDEX "fixed_transaction_occurrences_user_id_status_idx"
  ON "fixed_transaction_occurrences"("user_id", "status");
CREATE INDEX "fixed_transaction_occurrences_user_id_period_year_period_month_idx"
  ON "fixed_transaction_occurrences"("user_id", "period_year", "period_month");

ALTER TABLE "fixed_transaction_occurrences" ADD CONSTRAINT "fixed_transaction_occurrences_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_transaction_occurrences" ADD CONSTRAINT "fixed_transaction_occurrences_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_transaction_occurrences" ADD CONSTRAINT "fixed_transaction_occurrences_credit_card_id_fkey"
  FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deleting a template must not cascade-delete its history.
ALTER TABLE "fixed_transaction_occurrences" DROP CONSTRAINT IF EXISTS "fixed_transaction_occurrences_fixed_transaction_id_fkey";
ALTER TABLE "fixed_transaction_occurrences" ADD CONSTRAINT "fixed_transaction_occurrences_fixed_transaction_id_fkey"
  FOREIGN KEY ("fixed_transaction_id") REFERENCES "fixed_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_transaction_occurrences" DROP CONSTRAINT IF EXISTS "fixed_transaction_occurrences_transaction_id_fkey";
ALTER TABLE "fixed_transaction_occurrences" ADD CONSTRAINT "fixed_transaction_occurrences_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 10. market_assets / investments
-- ---------------------------------------------------------------------------
ALTER TABLE "market_assets" ALTER COLUMN "type" TYPE "investment_type" USING (
  CASE replace(replace(lower(btrim(coalesce("type", ''))), '-', '_'), ' ', '_')
    WHEN 'stock' THEN 'stock'
    WHEN 'fii' THEN 'fii'
    WHEN 'etf' THEN 'etf'
    WHEN 'crypto' THEN 'crypto'
    WHEN 'fixed_income' THEN 'fixed_income'
    WHEN 'fund' THEN 'fund'
    ELSE 'other'
  END::"investment_type"
);

-- Give ownerless legacy assets the owner of whoever actually holds them.
UPDATE "market_assets" m
SET "user_id" = i."user_id"
FROM (SELECT DISTINCT ON ("market_asset_id") "market_asset_id", "user_id"
      FROM "investments" WHERE "market_asset_id" IS NOT NULL
      ORDER BY "market_asset_id", "created_at") i
WHERE m."id" = i."market_asset_id" AND m."user_id" IS NULL;

-- Ownership was previously unenforced: detach investments pointing at another
-- user's asset rather than leaking data across tenants. Nothing is deleted.
UPDATE "investments" i SET "market_asset_id" = NULL
FROM "market_assets" m
WHERE i."market_asset_id" = m."id" AND m."user_id" IS DISTINCT FROM i."user_id";

DROP INDEX IF EXISTS "market_assets_symbol_exchange_key";
CREATE UNIQUE INDEX "market_assets_user_id_symbol_exchange_key"
  ON "market_assets"("user_id", "symbol", "exchange");
-- Keeps legacy ownerless rows unique too (NULLs are distinct in a plain index).
CREATE UNIQUE INDEX "market_assets_legacy_global_symbol_exchange_key"
  ON "market_assets"("symbol", "exchange") WHERE "user_id" IS NULL;
CREATE INDEX "market_assets_user_id_idx" ON "market_assets"("user_id");

ALTER TABLE "investments" ALTER COLUMN "type" TYPE "investment_type" USING (
  CASE replace(replace(lower(btrim(coalesce("type", ''))), '-', '_'), ' ', '_')
    WHEN 'stock' THEN 'stock'
    WHEN 'fii' THEN 'fii'
    WHEN 'etf' THEN 'etf'
    WHEN 'crypto' THEN 'crypto'
    WHEN 'fixed_income' THEN 'fixed_income'
    WHEN 'fund' THEN 'fund'
    ELSE 'other'
  END::"investment_type"
);
ALTER TABLE "investments" ALTER COLUMN "buy_date" TYPE DATE USING ("buy_date"::date);
CREATE INDEX "investments_user_id_buy_date_idx" ON "investments"("user_id", "buy_date");
CREATE INDEX "investments_user_id_type_idx" ON "investments"("user_id", "type");

ALTER TABLE "investments" DROP CONSTRAINT IF EXISTS "investments_market_asset_id_fkey";
ALTER TABLE "investments" ADD CONSTRAINT "investments_market_asset_id_fkey"
  FOREIGN KEY ("market_asset_id") REFERENCES "market_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 11. goals
-- ---------------------------------------------------------------------------
ALTER TABLE "goals" ALTER COLUMN "type" TYPE "goal_type" USING (
  CASE replace(replace(lower(btrim(coalesce("type", ''))), '-', '_'), ' ', '_')
    WHEN 'saving' THEN 'saving'
    WHEN 'savings' THEN 'saving'
    WHEN 'spending_limit' THEN 'spending_limit'
    WHEN 'debt_payoff' THEN 'debt_payoff'
    ELSE 'other'
  END::"goal_type"
);
UPDATE "goals" SET "current_amount" = 0 WHERE "current_amount" IS NULL;
ALTER TABLE "goals" ALTER COLUMN "current_amount" SET NOT NULL;
ALTER TABLE "goals" ALTER COLUMN "current_amount" SET DEFAULT 0;
ALTER TABLE "goals" ALTER COLUMN "deadline" TYPE DATE USING ("deadline"::date);
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");

ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "goals_related_account_id_fkey";
ALTER TABLE "goals" ADD CONSTRAINT "goals_related_account_id_fkey"
  FOREIGN KEY ("related_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "goals_related_category_id_fkey";
ALTER TABLE "goals" ADD CONSTRAINT "goals_related_category_id_fkey"
  FOREIGN KEY ("related_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 12. imports
-- ---------------------------------------------------------------------------
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "origin" "import_origin" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" "import_file_type" NOT NULL,
    "file_hash" TEXT NOT NULL,
    "status" "import_status" NOT NULL DEFAULT 'pending',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_batches_user_id_status_idx" ON "import_batches"("user_id", "status");
CREATE INDEX "import_batches_expires_at_idx" ON "import_batches"("expires_at");
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "import_batch_rows" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "type" "transaction_type",
    "value" DECIMAL(15,2),
    "date" DATE,
    "description" TEXT,
    "external_id" TEXT,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "errors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_batch_rows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "import_batch_rows_batch_id_row_number_key" ON "import_batch_rows"("batch_id", "row_number");
CREATE INDEX "import_batch_rows_batch_id_idx" ON "import_batch_rows"("batch_id");
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "imported_files" ADD COLUMN "batch_id" TEXT;
ALTER TABLE "imported_files" ALTER COLUMN "origin" TYPE "import_origin" USING (
  CASE WHEN replace(replace(lower(btrim(coalesce("origin", ''))), '-', '_'), ' ', '_') = 'inter' THEN 'inter' ELSE 'generic' END::"import_origin"
);
ALTER TABLE "imported_files" ALTER COLUMN "file_type" TYPE "import_file_type" USING (
  CASE replace(replace(lower(btrim(coalesce("file_type", ''))), '-', '_'), ' ', '_')
    WHEN 'ofx' THEN 'ofx'
    WHEN 'xlsx' THEN 'xlsx'
    WHEN 'xls' THEN 'xlsx'
    ELSE 'csv'
  END::"import_file_type"
);
ALTER TABLE "imported_files" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "imported_files" ALTER COLUMN "status" TYPE "import_status" USING (
  CASE replace(replace(lower(btrim(coalesce("status", ''))), '-', '_'), ' ', '_')
    WHEN 'pending' THEN 'pending'
    WHEN 'processing' THEN 'processing'
    WHEN 'failed' THEN 'failed'
    WHEN 'expired' THEN 'expired'
    ELSE 'completed'
  END::"import_status"
);
ALTER TABLE "imported_files" ALTER COLUMN "status" SET DEFAULT 'processing';
CREATE UNIQUE INDEX "imported_files_batch_id_key" ON "imported_files"("batch_id");
CREATE INDEX "imported_files_user_id_imported_at_idx" ON "imported_files"("user_id", "imported_at");
ALTER TABLE "imported_files" ADD CONSTRAINT "imported_files_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
