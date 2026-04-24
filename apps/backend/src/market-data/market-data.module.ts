import { Module } from '@nestjs/common';
import { MarketAssetsController } from './market-assets.controller';
import { MarketAssetsService } from './market-assets.service';

@Module({
  providers: [MarketAssetsService],
  controllers: [MarketAssetsController],
  exports: [MarketAssetsService],
})
export class MarketDataModule {}
