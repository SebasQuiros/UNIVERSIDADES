import {
  Controller, Get, Post,
  Param, Query, UseGuards, HttpCode, HttpStatus, ForbiddenException,
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

  @Get('gamification')
  getGamification(@CurrentUser() user: any) {
    if (user.role !== 'STUDENT') throw new ForbiddenException('Solo los estudiantes tienen perfil de gamificación');
    return this.svc.getGamification(user.id, user.universityId);
  }

  // ?mine=true — fuerza "solo mis propios intentos" sin importar el rol.
  // Lo usa el espacio Educación cuando lo abre un profesor (vista previa
  // como estudiante): sin esto, el profesor vería mezclados los intentos
  // de TODOS sus estudiantes en vez de solo el suyo propio.
  @Get()
  findAll(@Query('mine') mine: string, @CurrentUser() user: any) {
    return this.svc.findAll(user.id, user.role, mine === 'true');
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

  // Reabrir un intento entregado/calificado (solo profe del curso o admin).
  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.reopen(id, user.id, user.role);
  }
}
