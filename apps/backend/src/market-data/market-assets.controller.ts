import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { CreateMarketAssetDto, UpdateMarketAssetDto } from './market-assets.dto';
import { MarketAssetsService } from './market-assets.service';

@Controller('market-assets')
export class MarketAssetsController {
  constructor(private readonly marketAssetsService: MarketAssetsService) {}

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() body: CreateMarketAssetDto) {
    return this.marketAssetsService.createMarketAsset(user.sub, body);
  }

  @Get()
  findAll(@CurrentUser() user: UserPayload, @Query() pagination: PaginationQueryDto) {
    return this.marketAssetsService.findAll(user.sub, pagination.page ?? 1, pagination.limit ?? 20);
  }

  @Get(':id')
  findById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.marketAssetsService.findById(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateMarketAssetDto) {
    return this.marketAssetsService.updateMarketAsset(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.marketAssetsService.deleteMarketAsset(user.sub, id);
  }
}
