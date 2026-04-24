import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { ConfirmImportDto, PreviewImportDto } from './imports.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @CurrentUser() user: UserPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
      }),
    )
    file: any,
    @Body() dto: PreviewImportDto,
  ) {
    return await this.importsService.preview(user.sub, file, dto);
  }

  @Post('confirm')
  async confirm(@CurrentUser() user: UserPayload, @Body() dto: ConfirmImportDto) {
    return await this.importsService.confirm(user.sub, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: UserPayload, @Query() pagination: PaginationQueryDto) {
    return await this.importsService.findAll(user.sub, pagination.page ?? 1, pagination.limit ?? 20);
  }

  @Get(':id')
  async findById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return await this.importsService.findById(user.sub, id);
  }
}
