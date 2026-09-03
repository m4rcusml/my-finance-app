import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/pagination.dto';
import { CurrentUser, type UserPayload } from '../decorators/user.decorator';
import {
  CreateGoalDto,
  GoalProgressDto,
  GoalResponseDto,
  PaginatedGoalsDto,
  UpdateGoalDto,
  UpdateGoalProgressDto,
} from './goals.dto';
import { GoalsService } from './goals.service';

/**
 * Objetivos financeiros com progresso **manual**.
 *
 * `currentAmount` é sempre digitado pelo usuário; a V1 nunca calcula progresso a
 * partir de transações. `relatedCategoryId` e `relatedAccountId` servem apenas
 * como rótulos e não influenciam o progresso.
 */
@ApiTags('goals')
@ApiBearerAuth('access-token')
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um objetivo' })
  @ApiCreatedResponse({ type: GoalResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos.' })
  @ApiNotFoundResponse({ description: 'Conta ou categoria vinculada não encontrada.' })
  create(@CurrentUser() user: UserPayload, @Body() body: CreateGoalDto) {
    return this.goalsService.create(user.sub, body);
  }

  @Get()
  @ApiOperation({ summary: 'Lista objetivos' })
  @ApiOkResponse({ type: PaginatedGoalsDto })
  findAll(@CurrentUser() user: UserPayload, @Query() query: PaginationQueryDto) {
    return this.goalsService.findAll(user.sub, query);
  }

  @Get(':id/progress')
  @ApiOperation({
    summary: 'Progresso de um objetivo',
    description: 'progress vai de 0 a 1 e é sempre manual — não vem de transações.',
  })
  @ApiOkResponse({ type: GoalProgressDto })
  @ApiNotFoundResponse({ description: 'Objetivo não encontrado.' })
  async getProgress(@CurrentUser() user: UserPayload, @Param('id') id: string): Promise<GoalProgressDto> {
    const goal = await this.goalsService.findOne(user.sub, id);
    return {
      goalId: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      progress: goal.progress,
      percentage: Math.round(goal.progress * 100 * 100) / 100,
      deadline: goal.deadline,
      progressSource: goal.progressSource,
    };
  }

  @Patch(':id/progress')
  @ApiOperation({
    summary: 'Atualiza o progresso informado manualmente',
    description: 'Atalho para alterar apenas currentAmount, com as mesmas validações do PATCH completo.',
  })
  @ApiOkResponse({ type: GoalResponseDto })
  @ApiBadRequestResponse({ description: 'currentAmount inválido.' })
  @ApiNotFoundResponse({ description: 'Objetivo não encontrado.' })
  updateProgress(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() body: UpdateGoalProgressDto,
  ) {
    return this.goalsService.updateProgress(user.sub, id, body.currentAmount);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um objetivo' })
  @ApiOkResponse({ type: GoalResponseDto })
  @ApiNotFoundResponse({ description: 'Objetivo não encontrado.' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.goalsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza um objetivo',
    description: 'Chaves omitidas ficam intactas; deadline, relatedCategoryId e relatedAccountId aceitam null.',
  })
  @ApiOkResponse({ type: GoalResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos.' })
  @ApiNotFoundResponse({ description: 'Objetivo, conta ou categoria não encontrado.' })
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateGoalDto) {
    return this.goalsService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um objetivo' })
  @ApiNoContentResponse({ description: 'Objetivo excluído.' })
  @ApiNotFoundResponse({ description: 'Objetivo não encontrado.' })
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.goalsService.remove(user.sub, id);
  }
}
