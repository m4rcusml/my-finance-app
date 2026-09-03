import type {
  Investment,
  InvestmentType,
  InvestmentWithAsset,
  MarketAsset,
  MarketAssetType,
  PaginatedResponse,
  PortfolioSummary,
} from '@finance/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { fromCivilDate, parseCivilDate, toCivilDate } from '../common/civil-date';
import { roundMoney, sumMoney, toMoney, toQuantity } from '../common/money';
import { assertOwned } from '../common/ownership';
import { buildPaginatedResponse, resolvePagination } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInvestmentDto, ListInvestmentsQueryDto, UpdateInvestmentDto } from './investments.dto';

/** Structural view of the rows this service reads, so the unit tests can fake them. */
interface MarketAssetRow {
  id: string;
  userId: string | null;
  symbol: string;
  type: string;
  exchange: string;
  name: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface InvestmentRow {
  id: string;
  userId: string;
  marketAssetId: string | null;
  broker: string;
  type: string;
  quantity: unknown;
  buyPrice: unknown;
  investedAmount: unknown;
  buyDate: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  marketAsset?: MarketAssetRow | null;
}

function toIso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function toMarketAsset(row: MarketAssetRow): MarketAsset {
  return {
    id: row.id,
    symbol: row.symbol,
    type: row.type as MarketAssetType,
    exchange: row.exchange,
    name: row.name ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function toInvestment(row: InvestmentRow): Investment {
  return {
    id: row.id,
    marketAssetId: row.marketAssetId ?? null,
    broker: row.broker,
    type: row.type as InvestmentType,
    quantity: toQuantity(row.quantity),
    buyPrice: toMoney(row.buyPrice),
    investedAmount: toMoney(row.investedAmount),
    buyDate: toCivilDate(row.buyDate),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function toInvestmentWithAsset(row: InvestmentRow): InvestmentWithAsset {
  return {
    ...toInvestment(row),
    marketAsset: row.marketAsset ? toMarketAsset(row.marketAsset) : null,
  };
}

/** `investedAmount` may drift from `quantity × buyPrice` by at most one cent. */
const TOLERANCE_CENTS = 1;

/**
 * The user's manual investment book.
 *
 * Everything here is **cost basis**: what was bought, from which broker, on
 * which civil day and for how much. V1 has no price feed, so this service never
 * computes a current value, a profit or a return — see `getPortfolioSummary`.
 */
@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateInvestmentDto): Promise<InvestmentWithAsset> {
    const marketAssetId = dto.marketAssetId ?? null;
    if (marketAssetId !== null) await this.assertAssetOwned(userId, marketAssetId);

    const buyDate = parseCivilDate(dto.buyDate, 'buyDate');
    const investedAmount = this.resolveInvestedAmount(dto.quantity, dto.buyPrice, dto.investedAmount);

    const created = await this.prisma.investment.create({
      data: {
        userId,
        marketAssetId,
        broker: dto.broker,
        type: dto.type,
        quantity: dto.quantity,
        buyPrice: dto.buyPrice,
        investedAmount,
        buyDate: fromCivilDate(buyDate),
      },
      include: { marketAsset: true },
    });

    return toInvestmentWithAsset(created as unknown as InvestmentRow);
  }

  async findAll(userId: string, query?: ListInvestmentsQueryDto): Promise<PaginatedResponse<InvestmentWithAsset>> {
    const { page, limit, skip } = resolvePagination(query);
    const where = {
      userId,
      ...(query?.type ? { type: query.type } : {}),
      ...(query?.marketAssetId ? { marketAssetId: query.marketAssetId } : {}),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.investment.findMany({
        where,
        include: { marketAsset: true },
        skip,
        take: limit,
        orderBy: [{ buyDate: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.investment.count({ where }),
    ]);

    return buildPaginatedResponse(
      (rows as unknown as InvestmentRow[]).map(toInvestmentWithAsset),
      totalItems,
      page,
      limit,
    );
  }

  async findOne(userId: string, investmentId: string): Promise<InvestmentWithAsset> {
    return toInvestmentWithAsset(await this.getOwned(userId, investmentId));
  }

  /**
   * PATCH: omitted keys stay untouched, `marketAssetId: null` detaches the asset.
   * The final quantity/price/amount triple is assembled first and only then
   * checked, so a patch that changes just the price is validated against the
   * quantity that will actually be stored.
   */
  async update(userId: string, investmentId: string, dto: UpdateInvestmentDto): Promise<InvestmentWithAsset> {
    const current = await this.getOwned(userId, investmentId);

    const quantity = dto.quantity ?? toQuantity(current.quantity);
    const buyPrice = dto.buyPrice ?? toMoney(current.buyPrice);
    const investedAmount =
      dto.investedAmount !== undefined
        ? this.resolveInvestedAmount(quantity, buyPrice, dto.investedAmount)
        : dto.quantity !== undefined || dto.buyPrice !== undefined
          ? this.resolveInvestedAmount(quantity, buyPrice, undefined)
          : toMoney(current.investedAmount);

    let marketAssetId: string | null | undefined;
    if (dto.marketAssetId !== undefined) {
      marketAssetId = dto.marketAssetId;
      if (marketAssetId !== null) await this.assertAssetOwned(userId, marketAssetId);
    }

    const buyDate = dto.buyDate !== undefined ? parseCivilDate(dto.buyDate, 'buyDate') : undefined;

    const updated = await this.prisma.investment.update({
      where: { id: investmentId },
      data: {
        ...(marketAssetId !== undefined ? { marketAssetId } : {}),
        ...(dto.broker !== undefined ? { broker: dto.broker } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.buyPrice !== undefined ? { buyPrice: dto.buyPrice } : {}),
        ...(buyDate !== undefined ? { buyDate: fromCivilDate(buyDate) } : {}),
        investedAmount,
      },
      include: { marketAsset: true },
    });

    return toInvestmentWithAsset(updated as unknown as InvestmentRow);
  }

  /** Nothing references an investment row, so a hard delete destroys no history. */
  async remove(userId: string, investmentId: string): Promise<void> {
    await this.getOwned(userId, investmentId);
    await this.prisma.investment.delete({ where: { id: investmentId } });
  }

  /**
   * Portfolio totals **by cost basis**, aggregated in the database with
   * `groupBy` instead of loading every row.
   *
   * V1 stores no prices, so there is deliberately no current value, no profit
   * and no return percentage here — `totalInvested` is money put in, nothing
   * more. The dashboard consumes this method directly.
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const grouped = await this.prisma.investment.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { investedAmount: true },
      _count: { _all: true },
    });

    const byType = (
      grouped as unknown as { type: string; _sum: { investedAmount: unknown }; _count: { _all: number } }[]
    )
      .map((group) => ({
        type: group.type as InvestmentType,
        totalInvested: toMoney(group._sum?.investedAmount),
        positions: group._count?._all ?? 0,
      }))
      .sort((a, b) => a.type.localeCompare(b.type));

    return {
      totalInvested: sumMoney(byType.map((entry) => entry.totalInvested)),
      positions: byType.reduce((total, entry) => total + entry.positions, 0),
      byType,
    };
  }

  private async getOwned(userId: string, investmentId: string): Promise<InvestmentRow> {
    const investment = await this.prisma.investment.findUnique({
      where: { id: investmentId },
      include: { marketAsset: true },
    });
    return assertOwned(investment as unknown as InvestmentRow | null, userId, 'Investimento');
  }

  /**
   * The asset must belong to the **caller**. Looking it up without the user id
   * was the cross-tenant hole: any id from any tenant used to validate.
   */
  private async assertAssetOwned(userId: string, marketAssetId: string): Promise<void> {
    const asset = await this.prisma.marketAsset.findUnique({ where: { id: marketAssetId } });
    assertOwned(asset as { userId: string | null } | null, userId, 'Ativo');
  }

  /**
   * `investedAmount` defaults to `round(quantity × buyPrice, 2)`. When the
   * client sends it, it must agree with that product to the cent.
   */
  private resolveInvestedAmount(quantity: number, buyPrice: number, supplied: number | undefined): number {
    const expected = roundMoney(quantity * buyPrice);
    if (supplied === undefined) return expected;

    const provided = roundMoney(supplied);
    if (Math.abs(Math.round(provided * 100) - Math.round(expected * 100)) > TOLERANCE_CENTS) {
      throw new BadRequestException(
        `investedAmount deve ser igual a quantity × buyPrice (esperado ${expected.toFixed(2)}).`,
      );
    }
    return provided;
  }
}
