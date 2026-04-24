import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, UserPayload } from 'src/decorators/user.decorator';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { CreateGoalDto, UpdateGoalDto } from './goals.dto';
import { GoalsService } from './goals.service';

@ApiTags('Goals')
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() body: CreateGoalDto) {
    return this.goalsService.createGoal(user.sub, body);
  }

  @Get()
  findAll(@CurrentUser() user: UserPayload, @Query() pagination: PaginationQueryDto) {
    return this.goalsService.findAllByUser(user.sub, pagination.page ?? 1, pagination.limit ?? 20);
  }

  @Get(':id/progress')
  async getProgress(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    const goal = await this.goalsService.findById(user.sub, id);
    return {
      goalId: goal.id,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount ?? 0),
      progress: goal.progress,
      percentage: Number((goal.progress * 100).toFixed(2)),
      deadline: goal.deadline,
    };
  }

  @Get(':id')
  findById(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.goalsService.findById(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() body: UpdateGoalDto) {
    return this.goalsService.updateGoal(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.goalsService.deleteGoal(user.sub, id);
  }
}
