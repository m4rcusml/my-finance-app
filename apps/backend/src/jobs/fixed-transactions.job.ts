import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { type CivilDate, fromCivilDate, parseCivilDate, toCivilDate, todayIn } from '../common/civil-date';
import type { EnvConfig } from '../config/env';
import {
  dueDateFor,
  type Period,
  periodEnd,
  periodKey,
  periodOf,
  periodWindow,
} from '../fixed-transactions/recurrence';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
export const FIXED_TRANSACTIONS_CRON_NAME = 'fixed-transactions:generate-occurrences';
/** 03:00 in `APP_TIMEZONE`, comfortably after midnight rollovers. */
export const FIXED_TRANSACTIONS_CRON_TIME = '0 3 * * *';

/** Templates fetched per round trip while paging by id cursor. */
export const TEMPLATE_BATCH_SIZE = 200;

/**
 * How far back a run reaches. Every run re-checks the current period plus this
 * many previous ones, so a couple of missed nights (a deploy, a crashed worker,
 * a database failover) self-heals instead of permanently losing a month.
 */
export const BACKFILL_MONTHS = 2;

/** Shortest possible month; used to turn a margin in days into a month count. */
const SHORTEST_MONTH = 28;

/** Belt and braces against a pathological cursor loop. */
const MAX_BATCHES = 10_000;

export interface OccurrenceGenerationSummary {
  /** The civil day the run treated as "today". */
  reference: CivilDate;
  periods: Period[];
  scannedTemplates: number;
  createdOccurrences: number;
  existingOccurrences: number;
  /** Templates whose generation threw. The run continues past each one. */
  failedTemplates: number;
}

/** The template columns generation needs — nothing else is read. */
const TEMPLATE_SELECT = {
  id: true,
  userId: true,
  type: true,
  value: true,
  referenceDay: true,
  marginDays: true,
  accountId: true,
  creditCardId: true,
  categoryId: true,
  description: true,
  createdAt: true,
};

interface TemplateRow {
  id: string;
  userId: string;
  type: 'income' | 'expense';
  value: unknown;
  referenceDay: number;
  marginDays: number;
  accountId: string | null;
  creditCardId: string | null;
  categoryId: string;
  description: string | null;
  createdAt: Date | string;
}

/**
 * Generates the monthly occurrence rows the UI confirms against.
 *
 * Properties this job is built to guarantee:
 *  - **idempotent**: writes go through `upsert` on the
 *    `(fixedTransactionId, periodYear, periodMonth)` unique key, so a rerun, a
 *    retry or two racing instances converge on exactly one row per period;
 *  - **self-healing**: each run also fills in the previous `BACKFILL_MONTHS`
 *    periods, so a missed night is not a lost month;
 *  - **fault-isolated**: one bad template is logged and skipped, never aborting
 *    the run for everybody else;
 *  - **bounded**: templates are paged by id cursor in fixed-size batches, and
 *    existence is resolved with one query per batch rather than one per row.
 */
@Injectable()
export class FixedTransactionsJob {
  private readonly logger = new Logger(FixedTransactionsJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * The decorator needs its timezone at class-definition time, before Nest has
   * a ConfigService, so it reads the raw variable; `run` uses the validated
   * value. They come from the same place, and `validateEnv` rejects a bad zone
   * at boot, so the two cannot disagree in a process that actually started.
   */
  @Cron(FIXED_TRANSACTIONS_CRON_TIME, {
    name: FIXED_TRANSACTIONS_CRON_NAME,
    timeZone: process.env.APP_TIMEZONE?.trim() || DEFAULT_TIME_ZONE,
    waitForCompletion: true,
  })
  async handleCron(): Promise<void> {
    if (this.config.get('ENABLE_CRON', { infer: true }) === false) {
      this.logger.debug('ENABLE_CRON=false; geração de ocorrências ignorada.');
      return;
    }

    try {
      const summary = await this.run();
      this.logger.log(
        `Ocorrências geradas para ${summary.reference}: ${summary.createdOccurrences} criadas, ` +
          `${summary.existingOccurrences} já existentes, ${summary.scannedTemplates} templates, ` +
          `${summary.failedTemplates} com falha.`,
      );
    } catch (error) {
      // A cron tick must never reject into the scheduler's unhandled path.
      this.logger.error('Falha geral na geração de ocorrências.', error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * Runs one generation pass. `reference` exists so tests (and a manual
   * backfill) can pin the day; production always resolves it from the
   * configured timezone and never from `new Date()` directly.
   */
  async run(reference?: CivilDate): Promise<OccurrenceGenerationSummary> {
    const timeZone = this.config.get('APP_TIMEZONE', { infer: true }) ?? DEFAULT_TIME_ZONE;
    const today = reference ? parseCivilDate(reference, 'reference') : todayIn(timeZone);
    const periods = periodWindow(periodOf(today), BACKFILL_MONTHS);

    const summary: OccurrenceGenerationSummary = {
      reference: today,
      periods,
      scannedTemplates: 0,
      createdOccurrences: 0,
      existingOccurrences: 0,
      failedTemplates: 0,
    };

    let cursor: string | null = null;
    for (let batchIndex = 0; batchIndex < MAX_BATCHES; batchIndex += 1) {
      const batch = await this.fetchTemplateBatch(cursor);
      if (batch.length === 0) break;

      summary.scannedTemplates += batch.length;
      const existing = await this.loadExistingKeys(batch, periods);

      for (const template of batch) {
        await this.generateForTemplate(template, periods, existing, summary);
      }

      if (batch.length < TEMPLATE_BATCH_SIZE) break;
      cursor = batch[batch.length - 1].id;
    }

    return summary;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** One query per batch for every user — never one query per user. */
  private async fetchTemplateBatch(cursor: string | null): Promise<TemplateRow[]> {
    if (cursor === null) {
      return this.prisma.fixedTransaction.findMany({
        where: { isActive: true },
        select: TEMPLATE_SELECT,
        orderBy: { id: 'asc' },
        take: TEMPLATE_BATCH_SIZE,
      });
    }

    return this.prisma.fixedTransaction.findMany({
      where: { isActive: true },
      select: TEMPLATE_SELECT,
      orderBy: { id: 'asc' },
      take: TEMPLATE_BATCH_SIZE,
      cursor: { id: cursor },
      skip: 1,
    });
  }

  /** Which (template, period) pairs already exist — resolved in a single query. */
  private async loadExistingKeys(batch: TemplateRow[], periods: Period[]): Promise<Set<string>> {
    const ids = batch.map((template) => template.id);
    const rows = await this.prisma.fixedTransactionOccurrence.findMany({
      where: {
        fixedTransactionId: { in: ids },
        OR: periods.map((period) => ({ periodYear: period.year, periodMonth: period.month })),
      },
      select: { fixedTransactionId: true, periodYear: true, periodMonth: true },
      take: ids.length * periods.length,
    });

    return new Set(
      rows.map((row) => periodKey(row.fixedTransactionId, { year: row.periodYear, month: row.periodMonth })),
    );
  }

  private async generateForTemplate(
    template: TemplateRow,
    periods: Period[],
    existing: Set<string>,
    summary: OccurrenceGenerationSummary,
  ): Promise<void> {
    try {
      for (const period of this.periodsFor(template, periods)) {
        const key = periodKey(template.id, period);
        if (existing.has(key)) {
          summary.existingOccurrences += 1;
          continue;
        }

        const created = await this.upsertOccurrence(template, period);
        if (created) summary.createdOccurrences += 1;
        else summary.existingOccurrences += 1;
        existing.add(key);
      }
    } catch (error) {
      // One broken template (a category deleted out from under it, say) must not
      // cost every other user their month.
      summary.failedTemplates += 1;
      this.logger.error(
        `Falha ao gerar ocorrências do lançamento fixo ${template.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * The periods this template is eligible for: the margin window it can still
   * be booked in, minus anything that ended before the template existed (a
   * template created today must not sprout back-dated pending rows).
   */
  private periodsFor(template: TemplateRow, periods: Period[]): Period[] {
    const monthsBack = Math.max(BACKFILL_MONTHS, Math.ceil(template.marginDays / SHORTEST_MONTH));
    const createdOn = toCivilDate(template.createdAt);
    return periods.slice(0, monthsBack + 1).filter((period) => periodEnd(period) >= createdOn);
  }

  /** @returns `true` when this call created the row, `false` when it already existed. */
  private async upsertOccurrence(template: TemplateRow, period: Period): Promise<boolean> {
    const dueDate = fromCivilDate(dueDateFor(period, template.referenceDay));

    try {
      await this.prisma.fixedTransactionOccurrence.upsert({
        where: {
          fixedTransactionId_periodYear_periodMonth: {
            fixedTransactionId: template.id,
            periodYear: period.year,
            periodMonth: period.month,
          },
        },
        create: {
          fixedTransactionId: template.id,
          userId: template.userId,
          periodYear: period.year,
          periodMonth: period.month,
          status: 'pending',
          dueDate,
          type: template.type,
          value: template.value as number,
          description: template.description,
          categoryId: template.categoryId,
          accountId: template.accountId,
          creditCardId: template.creditCardId,
        },
        // Deliberately empty: an existing period is left exactly as the user
        // left it — never re-opened, never re-snapshotted.
        update: {},
        select: { id: true },
      });
      return true;
    } catch (error) {
      // Two instances racing on the same period: the loser's INSERT trips the
      // unique index. That is the intended outcome, not a failure.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'P2002' || code === '23505';
}
