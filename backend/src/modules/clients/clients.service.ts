import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/clients.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.client.findMany({
      where:   { companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async create(companyId: string, dto: CreateClientDto) {
    // Validate no duplicate identification within same company
    const existing = await this.prisma.client.findFirst({
      where: { companyId, identification: dto.identification, isActive: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un cliente con la identificación "${dto.identification}" en esta empresa.`,
      );
    }

    return this.prisma.client.create({
      data: {
        companyId,
        name:           dto.name,
        identification: dto.identification,
        idType:         dto.idType,
        email:          dto.email   ?? null,
        phone:          dto.phone   ?? null,
        address:        dto.address ?? null,
        creditDays:     dto.creditDays  ?? 0,
        creditLimit:    dto.creditLimit ?? 0,
        isActive:       true,
      },
    });
  }

  async update(companyId: string, clientId: string, dto: UpdateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    return this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(dto.name        && { name:        dto.name        }),
        ...(dto.email       !== undefined && { email:       dto.email       }),
        ...(dto.phone       !== undefined && { phone:       dto.phone       }),
        ...(dto.address     !== undefined && { address:     dto.address     }),
        ...(dto.creditDays  !== undefined && { creditDays:  dto.creditDays  }),
        ...(dto.creditLimit !== undefined && { creditLimit: dto.creditLimit }),
        updatedAt: new Date(),
      },
    });
  }

  async deactivate(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    return this.prisma.client.update({
      where: { id: clientId },
      data:  { isActive: false, updatedAt: new Date() },
    });
  }
}
