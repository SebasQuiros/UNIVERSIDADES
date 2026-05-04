import {
  Controller, Get, Post, Patch, Body, Param,
  Query, HttpCode, HttpStatus, ConflictException,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/auth.decorators';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
@Roles('SUPERADMIN')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  findAll(
    @Query('universityId') universityId?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll({
      universityId: universityId || undefined,
      role: role as Role | undefined,
      search: search || undefined,
    });
  }

  /**
   * GET /users/by-email — usado por el panel de profesores para resolver
   * un email de estudiante a su `userId` cuando agregan miembros a una
   * empresa grupal.
   *
   * Aislamiento de universidad:
   *   - SUPERADMIN: puede consultar cualquier email.
   *   - TEACHER/ADMIN: solo usuarios de su MISMA universidad. Esto evita
   *     enumeración cross-tenant de cuentas.
   *
   * Devuelve solo `{ id, name, email }`, no expone rol ni hash de password.
   */
  @Get('by-email')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  async findByEmail(
    @Query('email') email: string,
    @Request() req: any,
  ) {
    if (!email) return null;
    const user = await this.svc.findByEmail(email.trim());
    if (!user) return null;
    // Aislamiento por universidad (SUPERADMIN bypassa).
    const role = req?.user?.role;
    const myUniversityId = req?.user?.universityId ?? null;
    if (role !== 'SUPERADMIN' && myUniversityId && user.universityId !== myUniversityId) {
      return null; // mismo response que "no existe" — no leakea
    }
    return { id: user.id, name: user.name, email: user.email };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateUserDto) {
    const existing = await this.svc.findByEmail(body.email);
    if (existing) throw new ConflictException('El correo electrónico ya está registrado');
    const passwordHash = await bcrypt.hash(body.password, 10);
    return this.svc.create({
      name:         body.name,
      email:        body.email,
      passwordHash,
      role:         body.role as Role,
      universityId: body.universityId ?? null,
      emailVerified: true,
    });
  }

  @Patch(':id/toggle')
  @HttpCode(HttpStatus.OK)
  toggle(@Param('id') id: string) {
    return this.svc.toggleActive(id, 'superadmin');
  }
}
