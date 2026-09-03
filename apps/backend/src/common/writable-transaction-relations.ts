import type { TransactionType } from '@finance/contracts';
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { assertOwned } from './ownership';

export interface WritableTransactionRelations {
  accountId: string | null;
  creditCardId: string | null;
  categoryId: string | null;
  type: TransactionType;
}

/** Exactly one origin is mandatory for every ledger write. */
export function assertExactlyOneTransactionSource(accountId: string | null, creditCardId: string | null): void {
  if (accountId && creditCardId) {
    throw new BadRequestException('Informe apenas uma origem: conta ou cartão de crédito.');
  }
  if (!accountId && !creditCardId) {
    throw new BadRequestException('Informe a origem do lançamento: conta ou cartão de crédito.');
  }
}

/**
 * Locks and validates every relation that will be attached to a new ledger row.
 *
 * The lock and the insert must use the same transaction client. An archive or
 * delete that wins first is therefore observed here; one that starts later
 * waits until the ledger write commits. This closes the check/use window while
 * preserving 404 for missing and cross-tenant ids.
 */
export async function assertTransactionRelationsWritable(
  tx: Prisma.TransactionClient,
  userId: string,
  ids: WritableTransactionRelations,
): Promise<void> {
  if (ids.accountId) {
    await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${ids.accountId}::text FOR UPDATE`;
    const account = await tx.account.findUnique({
      where: { id: ids.accountId },
      select: { id: true, userId: true, isActive: true },
    });
    if (!assertOwned(account, userId, 'Conta').isActive) {
      throw new BadRequestException('Esta conta está arquivada e não aceita novos lançamentos.');
    }
  }

  if (ids.creditCardId) {
    await tx.$queryRaw`SELECT id FROM credit_cards WHERE id = ${ids.creditCardId}::text FOR UPDATE`;
    const creditCard = await tx.creditCard.findUnique({
      where: { id: ids.creditCardId },
      select: { id: true, userId: true, isActive: true },
    });
    if (!assertOwned(creditCard, userId, 'Cartão de crédito').isActive) {
      throw new BadRequestException('Este cartão está arquivado e não aceita novos lançamentos.');
    }
  }

  if (ids.categoryId) {
    await tx.$queryRaw`SELECT id FROM categories WHERE id = ${ids.categoryId}::text FOR UPDATE`;
    const category = await tx.category.findUnique({
      where: { id: ids.categoryId },
      select: { id: true, userId: true, isActive: true, type: true },
    });
    const ownedCategory = assertOwned(category, userId, 'Categoria');
    if (!ownedCategory.isActive) {
      throw new BadRequestException('Esta categoria está arquivada. Escolha outra.');
    }
    if (ownedCategory.type !== 'both' && ownedCategory.type !== ids.type) {
      throw new BadRequestException('A categoria selecionada não é compatível com o tipo do lançamento.');
    }
  }
}
