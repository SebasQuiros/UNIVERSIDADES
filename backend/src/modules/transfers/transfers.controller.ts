import {
  Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/transfers.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CurrentUser } from '../auth/decorators/auth.decorators';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly svc: TransfersService) {}

  /** Conceptos disponibles y qué asiento genera cada uno. */
  @Get('concepts')
  concepts() {
    return this.svc.concepts();
  }

  /** Historial de una empresa (enviadas y recibidas). */
  @Get('company/:companyId')
  list(@Param('companyId') companyId: string, @CurrentUser() user: any) {
    return this.svc.listForCompany(companyId, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: any, @Body() dto: CreateTransferDto) {
    return this.svc.create(user.id, dto);
  }
}
