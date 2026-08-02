import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DeliveryNotesService } from './delivery-notes.service';
import { CreateDeliveryNoteDto, UpdateDeliveryNoteStatusDto } from './dto/delivery-notes.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

/**
 * Remisiones (delivery notes). Mismo patrón que suppliers: el companyId viaja
 * en la ruta y CompanyOwnerGuard verifica que el usuario sea dueño de esa
 * empresa — es lo que impide que un estudiante lea datos de otra institución.
 */
@Controller('companies/:companyId/delivery-notes')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class DeliveryNotesController {
  constructor(private readonly svc: DeliveryNotesService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.findOne(cid, id);
  }

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateDeliveryNoteDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryNoteStatusDto,
  ) {
    return this.svc.changeStatus(cid, id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.cancel(cid, id);
  }

  @Delete(':id')
  remove(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.remove(cid, id);
  }
}
