import {
  Controller, Get, Post,
  Param, UseGuards, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CurrentUser } from '../auth/decorators/auth.decorators';

@Controller('attempts')
@UseGuards(JwtAuthGuard)
export class AttemptsController {
  constructor(private readonly svc: AttemptsService) {}

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    if (user.role !== 'STUDENT') throw new ForbiddenException('Solo los estudiantes tienen estadísticas de progreso');
    return this.svc.getStats(user.id);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.svc.findAll(user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOne(id, user.id, user.role);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.start(id, user.id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.submit(id, user.id);
  }
}
