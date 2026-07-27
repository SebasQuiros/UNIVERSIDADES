import {
  Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { NegotiationsService } from './negotiations.service';
import { CreateNegotiationDto, PostEntryDto } from './dto/negotiations.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CurrentUser } from '../auth/decorators/auth.decorators';

@Controller('negotiations')
@UseGuards(JwtAuthGuard)
export class NegotiationsController {
  constructor(private readonly svc: NegotiationsService) {}

  @Get()
  list(@CurrentUser() user: any, @Query('sessionId') sessionId?: string) {
    return this.svc.listForUser(user.id, sessionId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getOne(id, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: any, @Body() dto: CreateNegotiationDto) {
    return this.svc.create(user.id, dto);
  }

  @Post(':id/entries')
  @HttpCode(HttpStatus.CREATED)
  postEntry(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: PostEntryDto) {
    return this.svc.postEntry(id, user.id, dto);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.accept(id, user.id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.close(id, user.id, 'RECHAZADA');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.close(id, user.id, 'CANCELADA');
  }
}
