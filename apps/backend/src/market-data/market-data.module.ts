import { Module } from '@nestjs/common';
import { MarketAssetsController } from './market-assets.controller';
import { MarketAssetsService } from './market-assets.service';

/**
 * Catálogo manual de ativos (`/market-assets`).
 *
 * Apesar do nome herdado da pasta, este módulo **não é um provedor de dados de
 * mercado**: ele guarda apenas os rótulos de ativos que o próprio usuário
 * cadastra para vincular aos seus investimentos. A V1 não busca cotações, não
 * armazena preços e não mantém histórico de preços.
 */
@Module({
  providers: [MarketAssetsService],
  controllers: [MarketAssetsController],
  exports: [MarketAssetsService],
})
export class MarketDataModule {}
