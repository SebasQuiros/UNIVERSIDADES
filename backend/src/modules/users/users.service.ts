import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, OAuthProvider } from '@prisma/client';

interface CreateUserData {
  name:          string;
  email:         string;
  passwordHash:  string | null;
  role:          Role;
  universityId:  string | null;
  oauthProvider?: OAuthProvider;
  oauthId?:       string;
  avatarUrl?:     string;
  emailVerified?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        university: { select: { id: true, name: true, shortName: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { passwordHash, resetToken, resetTokenExpires, ...safe } = user;
    return safe;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async create(data: CreateUserData) {
    return this.prisma.user.create({
      data: {
        name:          data.name,
        email:         data.email.toLowerCase().trim(),
        passwordHash:  data.passwordHash,
        role:          data.role,
        universityId:  data.universityId,
        oauthProvider: data.oauthProvider || OAuthProvider.LOCAL,
        oauthId:       data.oauthId || null,
        avatarUrl:     data.avatarUrl || null,
        emailVerified: data.emailVerified || false,
        isActive:      true,
      },
    });
  }

  async update(id: string, data: { name?: string; avatarUrl?: string }) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        updatedAt: new Date(),
      },
    });
    const { passwordHash, resetToken, resetTokenExpires, ...safe } = user;
    return safe;
  }

  async toggleActive(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive, updatedAt: new Date() },
    });

    const { passwordHash, ...safe } = updated;
    return safe;
  }

  async findAll(filters: { universityId?: string; role?: Role; search?: string }) {
    return this.prisma.user.findMany({
      where: {
        ...(filters.universityId && { universityId: filters.universityId }),
        ...(filters.role && { role: filters.role }),
        ...(filters.search && {
          OR: [
            { name:  { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, emailVerified: true, lastLogin: true,
        createdAt: true, oauthProvider: true,
        university: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
