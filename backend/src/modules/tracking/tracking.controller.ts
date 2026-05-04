import {
  Controller, Post, Get,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackEventDto, TabSwitchDto } from './dto/tracking.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CurrentUser } from '../auth/decorators/auth.decorators';

@Controller('attempts')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(private readonly svc: TrackingService) {}

  @Post(':id/track')
  @HttpCode(HttpStatus.OK)
  track(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: TrackEventDto,
  ) {
    return this.svc.track(id, user.id, dto);
  }

  @Post(':id/ping')
  @HttpCode(HttpStatus.OK)
  ping(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.ping(id, user.id);
  }

  @Post(':id/tab-switch')
  @HttpCode(HttpStatus.OK)
  tabSwitch(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: TabSwitchDto,
  ) {
    return this.svc.trackTabSwitch(id, user.id, dto.count ?? 1, dto.timestamp);
  }

  @Get(':id/progress')
  getProgress(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getProgress(id, user.id, user.role);
  }

  @Get(':id/activity')
  getActivity(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getActivity(id, user.id, user.role);
  }
}
