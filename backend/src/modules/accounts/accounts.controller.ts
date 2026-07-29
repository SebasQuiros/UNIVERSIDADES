import {
  Controller, Get, Post, Patch,
  Body, Param, UseGuards, HttpCode, HttpStatus,
  UploadedFile, UseInterceptors, BadRequestException, Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SPREADSHEET_UPLOAD } from '../../common/upload/spreadsheet-upload';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/accounts.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/accounts')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  /** POST .../accounts/import — importa catálogo desde un archivo Excel. */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', SPREADSHEET_UPLOAD))
  importExcel(
    @Param('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file?.buffer) throw new BadRequestException('No se recibió ningún archivo.');
    return this.svc.importFromExcel(companyId, file.buffer, file.originalname, req.user?.id);
  }

  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.findOne(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('companyId') companyId: string, @Body() dto: CreateAccountDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.svc.update(companyId, id, dto);
  }
}
