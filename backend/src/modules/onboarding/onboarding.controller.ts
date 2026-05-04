import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OnboardingService } from './onboarding.service';
import { CreateUniversityOnboardingDto } from './dto/onboarding.dto';
import { Public } from '../auth/decorators/auth.decorators';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ── GET /api/v1/onboarding/plans ─────────────────────────────
  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Obtener planes disponibles' })
  @ApiResponse({ status: 200, description: 'Lista de planes activos con precios y características' })
  getPlans() {
    return this.onboardingService.getPlans();
  }

  // ── POST /api/v1/onboarding/university ────────────────────────
  @Post('university')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  // Rate limit: max 3 requests per IP per hour
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @ApiOperation({ summary: 'Registrar nueva universidad (onboarding público)' })
  @ApiResponse({ status: 201, description: 'Universidad registrada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o email ya registrado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes — máx. 3 por hora' })
  async registerUniversity(@Body() dto: CreateUniversityOnboardingDto) {
    return this.onboardingService.registerUniversity(dto);
  }
}
