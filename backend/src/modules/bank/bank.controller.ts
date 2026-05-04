import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { BankService } from './bank.service';
import { CreateBankTransactionDto, UpdateBankTransactionDto, BulkImportDto } from './dto/bank.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';

@Controller('companies/:companyId/bank')
@UseGuards(JwtAuthGuard)
export class BankController {
  constructor(private readonly svc: BankService) {}

  @Get()
  findAll(@Param('companyId') companyId: string, @Request() req: any) {
    return this.svc.findAll(companyId, req.user.id);
  }

  @Get('summary')
  summary(@Param('companyId') companyId: string, @Request() req: any) {
    return this.svc.summary(companyId, req.user.id);
  }

  @Post('import')
  importBulk(@Param('companyId') companyId: string, @Body() dto: BulkImportDto, @Request() req: any) {
    return this.svc.importBulk(companyId, req.user.id, dto);
  }

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateBankTransactionDto, @Request() req: any) {
    return this.svc.create(companyId, req.user.id, dto);
  }

  @Patch(':id')
  update(@Param('companyId') companyId: string, @Param('id') id: string, @Body() dto: UpdateBankTransactionDto, @Request() req: any) {
    return this.svc.update(companyId, id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('companyId') companyId: string, @Param('id') id: string, @Request() req: any) {
    return this.svc.remove(companyId, id, req.user.id);
  }
}
