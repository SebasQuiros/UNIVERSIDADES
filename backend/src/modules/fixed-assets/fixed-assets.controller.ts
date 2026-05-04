import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { FixedAssetsService } from './fixed-assets.service';
import { CreateFixedAssetDto } from './dto/fixed-assets.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/fixed-assets')
export class FixedAssetsController {
  constructor(private readonly svc: FixedAssetsService) {}

  @Get()
  findAll(@Param('companyId') companyId: string, @Request() req: any) {
    return this.svc.findAll(companyId, req.user.id);
  }

  @Get('summary')
  summary(@Param('companyId') companyId: string, @Request() req: any) {
    return this.svc.getSummary(companyId, req.user.id);
  }

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateFixedAssetDto, @Request() req: any) {
    return this.svc.create(companyId, dto, req.user.id);
  }

  @Post(':assetId/depreciate')
  depreciate(
    @Param('companyId') companyId: string,
    @Param('assetId') assetId: string,
    @Body('period') period: string,
    @Request() req: any,
  ) {
    return this.svc.depreciate(companyId, assetId, period, req.user.id);
  }
}
