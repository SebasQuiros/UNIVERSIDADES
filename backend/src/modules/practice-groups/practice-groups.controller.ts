import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { PracticeGroupsService } from './practice-groups.service';
import { CreateGroupDto, JoinGroupDto } from './dto/practice-groups.dto';

/**
 * PracticeGroupsController — grupos de práctica (Espacio Contador).
 * Todas las rutas requieren usuario autenticado; userId = req.user.id.
 */
@UseGuards(JwtAuthGuard)
@Controller('practice/groups')
export class PracticeGroupsController {
  constructor(private readonly svc: PracticeGroupsService) {}

  // Crear un grupo (el creador aporta su primera empresa de práctica).
  @Post()
  create(@Body() dto: CreateGroupDto, @Request() req: any) {
    return this.svc.createGroup(req.user.id, dto);
  }

  // Unirse a un grupo existente por código.
  // Límite anti fuerza bruta del código de invitación (igual que el join de
  // Sesión de Aula): 10 intentos por minuto.
  // Ver onboarding.controller: 'default' no es ninguno de los throttlers
  // configurados, asi que este limite no se aplicaba.
  @Throttle({ short: { ttl: 60000, limit: 10 }, medium: { ttl: 60000, limit: 10 } })
  @Post('join')
  join(@Body() dto: JoinGroupDto, @Request() req: any) {
    return this.svc.joinGroup(req.user.id, dto);
  }

  // Grupos en los que el usuario tiene al menos una empresa miembro.
  @Get('mine')
  mine(@Request() req: any) {
    return this.svc.listMine(req.user.id);
  }

  // Detalle de un grupo (con sus miembros).
  @Get(':groupId')
  getOne(@Param('groupId') groupId: string, @Request() req: any) {
    return this.svc.getGroup(req.user.id, groupId);
  }

  // Empresas del grupo — para elegir un vendedor al crear una orden.
  @Get(':groupId/companies')
  companies(@Param('groupId') groupId: string, @Request() req: any) {
    return this.svc.groupMemberCompanies(req.user.id, groupId);
  }

  // Sacar del grupo una empresa propia (si queda vacío, el grupo se elimina).
  @Delete(':groupId/members/:companyId')
  leave(
    @Param('groupId') groupId: string,
    @Param('companyId') companyId: string,
    @Request() req: any,
  ) {
    return this.svc.leaveGroup(req.user.id, groupId, companyId);
  }
}
