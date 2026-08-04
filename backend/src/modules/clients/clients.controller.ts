import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/clients.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/clients')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.findOne(companyId, id);
  }

  /** Ficha del cliente: datos, resumen comercial, documentos y cobros. */
  @Get(':id/resumen')
  resumen(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Query('anio') anio?: string,
  ) {
    return this.svc.resumen(companyId, id, anio ? Number(anio) : undefined);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('companyId') companyId: string, @Body() dto: CreateClientDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.svc.update(companyId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.deactivate(companyId, id);
  }
}
