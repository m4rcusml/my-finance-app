import { Module } from '@nestjs/common';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';

/**
 * Carteira manual de investimentos (custo de aquisição apenas).
 *
 * `InvestmentsService` é exportado porque o dashboard consome
 * `getPortfolioSummary(userId)` para o total aportado.
 */
@Module({
  providers: [InvestmentsService],
  controllers: [InvestmentsController],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
