import type { MarketAsset, MarketAssetType, PaginatedResponse } from '@finance/contracts';
import { ConflictException, Injectable } from '@nestjs/common';
import { assertOwned } from '../common/ownership';
import { buildPaginatedResponse, resolvePagination } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMarketAssetDto, UpdateMarketAssetDto } from './market-assets.dto';

/** The shape this service reads out of Prisma; kept structural so the unit tests can fake it. */
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

/** Prisma signals a violated unique index with `P2002`; we never check-then-write. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}

const DUPLICATE_MESSAGE = 'Já existe um ativo com esse símbolo nesta bolsa.';

/**
 * The user's **manually maintained catalogue of assets**.
 *
 * This is a plain address book of labels — symbol, class, exchange, optional
 * name — that investments point at. V1 fetches **no quotes**, stores **no
 * prices** and keeps **no history**: nothing here is or implies market data.
 *
 * Rows are per user (`@@unique([userId, symbol, exchange])`). Every write sets
 * the caller's `userId` and every read matches it strictly, so the ownerless
 * rows left behind by the pre-V1 global catalogue are simply invisible here.
 */
@Injectable()
export class MarketAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMarketAssetDto): Promise<MarketAsset> {
    try {
      const created = await this.prisma.marketAsset.create({
        data: {
          userId,
          symbol: dto.symbol,
          type: dto.type,
          exchange: dto.exchange,
          name: dto.name ?? null,
        },
      });
      return toMarketAsset(created);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(DUPLICATE_MESSAGE);
      throw error;
    }
  }

  async findAll(userId: string, query?: { page?: number; limit?: number }): Promise<PaginatedResponse<MarketAsset>> {
    const { page, limit, skip } = resolvePagination(query);
    const where = { userId };

    const [rows, totalItems] = await Promise.all([
      this.prisma.marketAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ symbol: 'asc' }, { exchange: 'asc' }],
      }),
      this.prisma.marketAsset.count({ where }),
    ]);

    return buildPaginatedResponse(rows.map(toMarketAsset), totalItems, page, limit);
  }

  async findOne(userId: string, assetId: string): Promise<MarketAsset> {
    return toMarketAsset(await this.getOwned(userId, assetId));
  }

  async update(userId: string, assetId: string, dto: UpdateMarketAssetDto): Promise<MarketAsset> {
    await this.getOwned(userId, assetId);

    // PATCH semantics: an omitted key is untouched, `name: null` clears the label.
    const data = {
      ...(dto.symbol !== undefined ? { symbol: dto.symbol } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.exchange !== undefined ? { exchange: dto.exchange } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
    };

    try {
      const updated = await this.prisma.marketAsset.update({ where: { id: assetId }, data });
      return toMarketAsset(updated);
    } catch (error) {
      // The same unique index guards the update; no read-then-write race window.
      if (isUniqueViolation(error)) throw new ConflictException(DUPLICATE_MESSAGE);
      throw error;
    }
  }

  /**
   * Hard delete is allowed only when nothing points at the row — an asset with
   * investments is a live reference, not history to be archived.
   */
  async remove(userId: string, assetId: string): Promise<void> {
    await this.getOwned(userId, assetId);

    const dependents = await this.prisma.investment.count({ where: { marketAssetId: assetId } });
    if (dependents > 0) {
      throw new ConflictException('Ativo em uso por investimentos e não pode ser excluído.');
    }

    await this.prisma.marketAsset.delete({ where: { id: assetId } });
  }

  /** Strict ownership: a legacy row with `userId = null` is never reachable. */
  private async getOwned(userId: string, assetId: string): Promise<MarketAssetRow> {
    const asset = await this.prisma.marketAsset.findUnique({ where: { id: assetId } });
    return assertOwned(asset as MarketAssetRow | null, userId, 'Ativo');
  }
}
