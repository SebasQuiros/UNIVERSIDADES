import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService, AiSuggestDto } from './ai.service';
import { IsString, MaxLength, IsOptional, IsObject, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/auth.guards';

// ── Legacy DTO (backwards compat) ────────────────────────────────────────────
class AskDto {
  @IsString()
  @MaxLength(500)
  question: string;

  @IsString()
  @MaxLength(100)
  tab: string;

  @IsString()
  @MaxLength(200)
  companyName: string;
}

// ── New multi-mode DTO ────────────────────────────────────────────────────────
class SuggestDto implements AiSuggestDto {
  @IsOptional()
  @IsString()
  @IsIn(['journal_help', 'balance_explain', 'account_suggest', 'exercise_hint', 'error_explain', 'chat'])
  mode?: AiSuggestDto['mode'];

  @IsOptional()
  @IsString()
  @MaxLength(36)
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  attemptId?: string;

  @IsOptional()
  @IsObject()
  context: AiSuggestDto['context'];

  // Legacy fields
  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tab?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly svc: AiService) {}

  /**
   * POST /api/v1/ai/suggest
   * Supports both legacy shape { question, tab, companyName } and
   * new shape { mode, companyId, context }.
   * Rate-limited to 10 AI requests per minute per IP.
   */
  @Post('suggest')
  @Throttle({ medium: { ttl: 60_000, limit: 10 } })
  async suggest(@Body() dto: SuggestDto) {
    // Legacy fallback: if no mode/context, treat as a plain chat question
    if (!dto.mode && !dto.context && dto.question) {
      return this.svc.getSuggestion(dto.question, {
        tab: dto.tab ?? 'contabilidad',
        companyName: dto.companyName ?? 'empresa',
      });
    }

    // New multi-mode path
    return this.svc.suggest({
      mode: dto.mode,
      companyId: dto.companyId,
      attemptId: dto.attemptId,
      context: dto.context ?? {
        message: dto.question,
        tab: dto.tab,
        companyName: dto.companyName,
      },
    });
  }
}
