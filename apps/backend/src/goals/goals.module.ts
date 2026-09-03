import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

/**
 * Objetivos financeiros com progresso manual.
 *
 * O módulo não depende de Accounts nem de Categories: as duas relações são
 * apenas rótulos e a checagem de posse é feita direto no Prisma, evitando
 * acoplamento entre módulos.
 */
@Module({
  providers: [GoalsService],
  controllers: [GoalsController],
  exports: [GoalsService],
})
export class GoalsModule {}
