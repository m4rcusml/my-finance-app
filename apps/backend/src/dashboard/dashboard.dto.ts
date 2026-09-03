import {
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
  type BillingCycle,
  CATEGORY_TYPES,
  type Category,
  type CategoryType,
  CIVIL_DATE_PATTERN,
  type CivilDate,
  type CreditCard,
  DASHBOARD_PERIODS,
  type DashboardOverview,
  type DashboardPeriod,
  type DashboardQuery,
  FIXED_TRANSACTION_TYPES,
  type FixedTransaction,
  type FixedTransactionType,
  type IsoTimestamp,
  type Money,
  type MonthlyNet,
  OCCURRENCE_STATUSES,
  type OccurrenceStatus,
  type OccurrenceWithTemplate,
  type PeriodTotals,
  TRANSACTION_SOURCES,
  TRANSACTION_TYPES,
  type TransactionSource,
  type TransactionType,
  type TransactionWithRelations,
  type TrendedValue,
  type YearMonth,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

const CIVIL_DATE_MESSAGE = 'deve ser uma data civil no formato YYYY-MM-DD';

/**
 * Query string of `GET /dashboard`.
 *
 * Only the shape is validated here; calendar validity (`2026-02-31` matches the
 * regex but is not a real day) and the cross-field rules for `custom` are
 * enforced by `DashboardService.resolveWindow`, which answers with a 400 too.
 */
export class DashboardQueryDto implements DashboardQuery {
  @ApiPropertyOptional({
    enum: DASHBOARD_PERIODS,
    default: 'month',
    description:
      'Janela do painel. `week` = segunda a domingo; `month` = 1º ao último dia; `year` = 1º de janeiro a 31 de dezembro; `custom` exige `from` e `to`.',
  })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS, { message: 'period deve ser week, month, year ou custom' })
  period?: DashboardPeriod;

  @ApiPropertyOptional({
    example: '2026-03-15',
    description: 'Dia âncora da janela. Padrão: hoje no fuso configurado da aplicação.',
  })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN, { message: `referenceDate ${CIVIL_DATE_MESSAGE}` })
  referenceDate?: CivilDate;

  @ApiPropertyOptional({
    example: '2026-03-01',
    description: 'Início da janela, inclusivo. Obrigatório quando `period=custom`.',
  })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN, { message: `from ${CIVIL_DATE_MESSAGE}` })
  from?: CivilDate;

  @ApiPropertyOptional({
    example: '2026-03-31',
    description: 'Fim da janela, inclusivo. Obrigatório quando `period=custom`.',
  })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN, { message: `to ${CIVIL_DATE_MESSAGE}` })
  to?: CivilDate;
}

// ---------------------------------------------------------------------------
// Response models (Swagger only — the runtime shape comes from the contracts)
// ---------------------------------------------------------------------------

/** `implements` needs a named type, so the two nested blocks get an alias each. */
type DashboardPeriodWindow = DashboardOverview['period'];
type DashboardTotals = DashboardOverview['totals'];

export class DashboardPeriodDto implements DashboardPeriodWindow {
  @ApiProperty({ enum: DASHBOARD_PERIODS, example: 'month' })
  period!: DashboardPeriod;

  @ApiProperty({ example: '2026-03-01', description: 'Primeiro dia da janela, inclusivo.' })
  from!: CivilDate;

  @ApiProperty({ example: '2026-03-31', description: 'Último dia da janela, inclusivo.' })
  to!: CivilDate;

  @ApiProperty({ example: '2026-03-15', description: 'Dia âncora usado para montar a janela.' })
  referenceDate!: CivilDate;

  @ApiProperty({ example: 'America/Sao_Paulo', description: 'Fuso usado para resolver "hoje".' })
  timezone!: string;
}

export class PeriodTotalsDto implements PeriodTotals {
  @ApiProperty({ example: 8500.0 }) income!: Money;
  @ApiProperty({ example: 6120.35 }) expense!: Money;
  @ApiProperty({ example: 2379.65, description: 'income - expense.' }) net!: Money;
  @ApiProperty({ example: 57 }) transactionCount!: number;
}

export class TrendedValueDto implements TrendedValue {
  @ApiProperty({ example: 8500.0 }) value!: Money;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 12.5,
    description: 'Variação percentual sobre a janela anterior. `null` quando a comparação é indefinida.',
  })
  trending!: number | null;
}

export class DashboardTrendsDto {
  @ApiProperty({ type: TrendedValueDto }) income!: TrendedValueDto;
  @ApiProperty({ type: TrendedValueDto }) expense!: TrendedValueDto;
  @ApiProperty({ type: TrendedValueDto }) net!: TrendedValueDto;
}

export class DashboardTotalsDto implements DashboardTotals {
  @ApiProperty({ example: 12450.9, description: 'Saldo em contas que não são do tipo `investment`.' })
  netBalance!: Money;

  @ApiProperty({ example: 30000.0, description: 'Saldo mantido em contas do tipo `investment`.' })
  investedAccountBalance!: Money;

  @ApiProperty({ example: 45000.0, description: 'Custo de aquisição da carteira manual de investimentos.' })
  portfolioInvested!: Money;

  @ApiProperty({ example: 15000.0 }) totalCreditLimit!: Money;
  @ApiProperty({ example: 2310.44, description: 'Soma do uso do ciclo aberto de cada cartão.' })
  totalCreditUsedThisCycle!: Money;
  @ApiProperty({ example: 12689.56 }) totalCreditAvailable!: Money;

  @ApiProperty({ type: PeriodTotalsDto }) current!: PeriodTotalsDto;

  @ApiProperty({ type: PeriodTotalsDto, description: 'Janela imediatamente anterior, do mesmo tamanho.' })
  previous!: PeriodTotalsDto;

  @ApiProperty({ type: DashboardTrendsDto }) trends!: DashboardTrendsDto;
}

export class MonthlyNetDto implements MonthlyNet {
  @ApiProperty({ example: '2026-03', description: 'Rótulo `YYYY-MM`.' }) month!: YearMonth;
  @ApiProperty({ example: 8500.0 }) income!: Money;
  @ApiProperty({ example: 6120.35 }) expense!: Money;
  @ApiProperty({ example: 2379.65 }) net!: Money;
}

export class DashboardAccountDto implements Account {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Conta corrente' }) name!: string;
  @ApiProperty({ example: 'Banco Inter' }) institution!: string;
  @ApiProperty({ enum: ACCOUNT_TYPES, example: 'checking' }) type!: AccountType;
  @ApiProperty({ example: 1000.0 }) initialBalance!: Money;
  @ApiProperty({ example: 1540.25 }) balance!: Money;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ type: String, nullable: true, example: null }) archivedAt!: IsoTimestamp | null;
  @ApiProperty({ example: '2026-01-05T12:00:00.000Z' }) createdAt!: IsoTimestamp;
  @ApiProperty({ example: '2026-01-05T12:00:00.000Z' }) updatedAt!: IsoTimestamp;
}

export class BillingCycleDto implements BillingCycle {
  @ApiProperty({ example: '2026-03-11' }) start!: CivilDate;
  @ApiProperty({ example: '2026-04-10' }) end!: CivilDate;
}

export class DashboardCreditCardDto implements CreditCard {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Cartão Gold' }) name!: string;
  @ApiProperty({ example: 'Banco Inter' }) institution!: string;
  @ApiProperty({ example: 5000.0 }) limitTotal!: Money;
  @ApiProperty({ type: Number, nullable: true, example: 10, minimum: 1, maximum: 31 })
  closingDay!: number | null;
  @ApiProperty({ example: 1200.0 }) cycleUsedAmount!: Money;
  @ApiProperty({ example: 3800.0 }) availableAmount!: Money;
  @ApiProperty({ type: BillingCycleDto }) currentCycle!: BillingCycleDto;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ type: String, nullable: true, example: null }) archivedAt!: IsoTimestamp | null;
  @ApiProperty({ example: '2026-01-05T12:00:00.000Z' }) createdAt!: IsoTimestamp;
  @ApiProperty({ example: '2026-01-05T12:00:00.000Z' }) updatedAt!: IsoTimestamp;
}

export class CategoryRefDto implements Pick<Category, 'id' | 'name' | 'type'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Mercado' }) name!: string;
  @ApiProperty({ enum: CATEGORY_TYPES, example: 'expense' }) type!: CategoryType;
}

export class AccountRefDto implements Pick<Account, 'id' | 'name'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Conta corrente' }) name!: string;
}

export class CreditCardRefDto implements Pick<CreditCard, 'id' | 'name'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Cartão Gold' }) name!: string;
}

export class DashboardTransactionDto implements TransactionWithRelations {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: TRANSACTION_TYPES, example: 'expense' }) type!: TransactionType;
  @ApiProperty({ example: 120.5 }) value!: Money;
  @ApiProperty({ example: '2026-03-14' }) date!: CivilDate;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) accountId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) creditCardId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) categoryId!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Supermercado' }) description!: string | null;
  @ApiProperty({ enum: TRANSACTION_SOURCES, example: 'manual' }) source!: TransactionSource;
  @ApiProperty({ type: String, nullable: true, example: null }) externalId!: string | null;
  @ApiProperty({ example: '2026-03-14T18:02:00.000Z' }) createdAt!: IsoTimestamp;
  @ApiProperty({ example: '2026-03-14T18:02:00.000Z' }) updatedAt!: IsoTimestamp;
  @ApiProperty({ type: CategoryRefDto, nullable: true }) category!: CategoryRefDto | null;
  @ApiProperty({ type: AccountRefDto, nullable: true }) account!: AccountRefDto | null;
  @ApiProperty({ type: CreditCardRefDto, nullable: true }) creditCard!: CreditCardRefDto | null;
}

export class FixedTransactionRefDto implements Pick<FixedTransaction, 'id' | 'description' | 'referenceDay'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true, example: 'Aluguel' }) description!: string | null;
  @ApiProperty({ example: 5, minimum: 1, maximum: 31 }) referenceDay!: number;
}

export class DashboardOccurrenceDto implements OccurrenceWithTemplate {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) fixedTransactionId!: string;
  @ApiProperty({ example: 2026 }) periodYear!: number;
  @ApiProperty({ example: 3, minimum: 1, maximum: 12 }) periodMonth!: number;
  @ApiProperty({ enum: OCCURRENCE_STATUSES, example: 'pending' }) status!: OccurrenceStatus;
  @ApiProperty({ type: String, nullable: true, example: null }) realDate!: CivilDate | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) transactionId!: string | null;
  @ApiProperty({ example: '2026-03-05' }) dueDate!: CivilDate;
  @ApiProperty({ enum: FIXED_TRANSACTION_TYPES, example: 'expense' }) type!: FixedTransactionType;
  @ApiProperty({ example: 2500.0 }) value!: Money;
  @ApiProperty({ type: String, nullable: true, example: 'Aluguel' }) description!: string | null;
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) accountId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) creditCardId!: string | null;
  @ApiProperty({ example: '2026-03-01T03:00:00.000Z' }) createdAt!: IsoTimestamp;
  @ApiProperty({ example: '2026-03-01T03:00:00.000Z' }) updatedAt!: IsoTimestamp;
  @ApiProperty({ type: FixedTransactionRefDto }) fixedTransaction!: FixedTransactionRefDto;
  @ApiProperty({ type: CategoryRefDto, nullable: true }) category!: CategoryRefDto | null;
}

export class DashboardOverviewDto implements DashboardOverview {
  @ApiProperty({ type: DashboardPeriodDto }) period!: DashboardPeriodDto;
  @ApiProperty({ type: DashboardTotalsDto }) totals!: DashboardTotalsDto;
  @ApiProperty({ type: [DashboardAccountDto] }) accounts!: DashboardAccountDto[];
  @ApiProperty({ type: [DashboardCreditCardDto] }) creditCards!: DashboardCreditCardDto[];

  @ApiProperty({
    type: [DashboardTransactionDto],
    description: 'Os 5 lançamentos mais recentes, do mais novo ao mais antigo.',
  })
  latestTransactions!: DashboardTransactionDto[];

  @ApiProperty({
    type: [DashboardOccurrenceDto],
    description: 'Até 10 ocorrências fixas pendentes dentro da janela atual.',
  })
  pendingOccurrences!: DashboardOccurrenceDto[];

  @ApiProperty({
    type: [MonthlyNetDto],
    description: 'Exatamente 12 meses terminando no mês de referência, com meses sem movimento zerados.',
  })
  annualBalance!: MonthlyNetDto[];

  @ApiProperty({ example: 3, description: 'Lançamentos sem categoria do usuário.' })
  uncategorizedCount!: number;
}
