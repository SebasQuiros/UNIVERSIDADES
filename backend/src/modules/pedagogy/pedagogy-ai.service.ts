import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PedagogyService } from './pedagogy.service';

/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-ignore — carga defensiva idéntica a AiService: si el SDK no está
// instalado, el módulo degrada a fallback determinista en lugar de romper.
const AnthropicPkg = (() => { try { return require('@anthropic-ai/sdk'); } catch { return null; } })();

export interface TutorOpts {
  attemptId?: string;
  companyId?: string;
  eventId?: string;
}

export interface TutorResult {
  level: 'TUTOR';
  question: string;
  explanation: string;
}

export interface MentorResult {
  level: 'MENTOR';
  message: string;
  suggestedFocus: string;
}

// Plantillas socráticas deterministas por tipo de evento. Se usan como
// FALLBACK cuando no hay API key / SDK, para que el tutor nunca falle en duro.
const SOCRATIC_TEMPLATES: Record<string, { question: string; explanation: string }> = {
  PEDAGOGY_RUBRIC_FAILED: {
    question: '¿Qué evidencia tendría que mostrar tu empresa para cumplir este criterio, y qué te falta hoy?',
    explanation: 'Un criterio no cumplido no es un castigo: es una pista. Revisa qué esperaba la rúbrica y compáralo con lo que registraste.',
  },
  PEDAGOGY_UNBALANCED: {
    question: 'Si la partida doble exige que todo débito tenga su crédito, ¿por qué crees que tu asiento no cuadra?',
    explanation: 'En contabilidad de partida doble, la suma de débitos SIEMPRE iguala la de créditos. Una diferencia indica una línea faltante o un monto mal digitado.',
  },
  PEDAGOGY_NEGATIVE_STOCK: {
    question: '¿Puede una bodega tener menos de cero unidades? ¿Qué te dice eso sobre el orden de tus movimientos?',
    explanation: 'El inventario nunca puede ser negativo. Revisa si vendiste antes de comprar o si duplicaste una salida.',
  },
  PEDAGOGY_IVA_OMITTED: {
    question: '¿Toda venta gravada genera IVA por pagar a Hacienda? ¿Registraste esa obligación?',
    explanation: 'El IVA repercutido en ventas gravadas es una cuenta por pagar al fisco. Omitirlo subestima tus pasivos.',
  },
  PEDAGOGY_HIGH_DEBT: {
    question: '¿Qué proporción de tu financiamiento viene de terceros y no de patrimonio? ¿Es sostenible?',
    explanation: 'Un apalancamiento alto aumenta el riesgo financiero. Compara pasivo total contra patrimonio para dimensionarlo.',
  },
};

const GENERIC_TEMPLATE = {
  question: '¿Qué principio contable está en juego aquí y cómo lo aplicarías paso a paso?',
  explanation: 'Antes de corregir, identifica el principio: partida doble, devengo, prudencia o correlación. La regla te guía a la solución.',
};

/**
 * PedagogyAiService — el VERBALIZADOR (LLM).
 *
 * Reutiliza EXACTAMENTE el patrón de AiService (carga defensiva de
 * @anthropic-ai/sdk vía require, lectura de ANTHROPIC_API_KEY con
 * ConfigService, modelo Haiku 4.5). NUNCA decide errores ni computa nada:
 * el motor determinista (PedagogyService) ya decidió QUÉ pasó; aquí sólo se
 * pone en palabras con método socrático. Si no hay IA disponible, devuelve un
 * fallback determinista para no fallar en duro.
 */
@Injectable()
export class PedagogyAiService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pedagogy: PedagogyService,
  ) {}

  // ── Cliente Anthropic (mismo setup que AiService) ───────────────────────────
  private getClient(): any | null {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey || !AnthropicPkg) return null;
    const AnthropicClass = AnthropicPkg.default ?? AnthropicPkg;
    return new AnthropicClass({ apiKey });
  }

  /** Llama a Claude y devuelve el texto plano, o null si algo falla. */
  private async ask(system: string, user: string, maxTokens = 400): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const content = response.content?.[0];
      if (content?.type === 'text') return content.text as string;
      return null;
    } catch {
      // Cualquier fallo de red / cuota → degradamos a fallback determinista.
      return null;
    }
  }

  // ── tutor — nivel por-ejercicio ─────────────────────────────────────────────
  async tutor(studentId: string, opts: TutorOpts = {}): Promise<TutorResult> {
    // 1) Reúne el/los evento(s) relevantes (deterministas).
    let events: Array<{ type: string; message: string | null; context: any; area: string | null }> = [];

    if (opts.eventId) {
      const ev = await this.prisma.pedagogicalEvent.findFirst({
        where: { id: opts.eventId, studentId },
        select: { type: true, message: true, context: true, area: true },
      });
      if (ev) events = [ev];
    } else {
      const recent = await this.pedagogy.listEvents(studentId, {
        attemptId: opts.attemptId,
        unresolvedOnly: true,
        limit: 5,
      });
      events = recent.map(e => ({ type: e.type, message: e.message, context: e.context, area: e.area }));
    }

    const profile = await this.pedagogy.getOrCreateProfile(studentId);
    const primary = events[0];

    // 2) Prompt determinista para Claude (profe socrático costarricense).
    const system = [
      'Eres un profesor universitario costarricense de contabilidad (NIIF, normativa de Hacienda CR).',
      'Usas el MÉTODO SOCRÁTICO: desarrollas criterio en el estudiante.',
      'NUNCA das la respuesta directa ni corriges el asiento por él.',
      'Primero haces UNA pregunta guía que lo haga pensar; luego explicas el PRINCIPIO contable en juego.',
      'Adaptas la profundidad al perfil: si domina el tema, reta; si es débil, refuerza lo básico.',
      'Respondes SIEMPRE en español, en tono cálido y respetuoso. Máximo 180 palabras.',
      'Devuelves EXACTAMENTE dos bloques, uno por línea:',
      'PREGUNTA: <tu pregunta socrática>',
      'EXPLICACION: <el principio contable, sin dar la solución>',
    ].join('\n');

    const errorsSummary = this._recurringSummary(profile);
    const masterySummary = this._masterySummary(profile);

    const user = [
      'Situación de aprendizaje detectada por el motor determinista (no la inventes):',
      primary
        ? `- Tipo: ${primary.type}${primary.area ? ` | Área: ${primary.area}` : ''}`
        : '- (Sin evento específico; guía general del ejercicio.)',
      primary?.message ? `- Resumen: ${primary.message}` : '',
      primary?.context ? `- Detalle determinista: ${JSON.stringify(primary.context).slice(0, 500)}` : '',
      events.length > 1 ? `- Hay ${events.length} criterios pendientes en este intento.` : '',
      '',
      'Perfil del estudiante:',
      `- Errores recurrentes: ${errorsSummary}`,
      `- Dominio por área: ${masterySummary}`,
      '',
      'Genera la PREGUNTA socrática y la EXPLICACION del principio. No des la respuesta.',
    ].filter(Boolean).join('\n');

    const raw = await this.ask(system, user, 400);
    if (raw) {
      const parsed = this._parseTwoBlocks(raw);
      if (parsed) return { level: 'TUTOR', ...parsed };
    }

    // 3) Fallback determinista (plantilla socrática por tipo de evento).
    const tpl = (primary && SOCRATIC_TEMPLATES[primary.type]) || GENERIC_TEMPLATE;
    const explanation = primary?.message
      ? `${primary.message}. ${tpl.explanation}`
      : tpl.explanation;
    return { level: 'TUTOR', question: tpl.question, explanation };
  }

  // ── mentor — nivel cruzado (varios ejercicios) ──────────────────────────────
  async mentor(studentId: string): Promise<MentorResult> {
    const profile = await this.pedagogy.getOrCreateProfile(studentId);

    const errorsSummary = this._recurringSummary(profile);
    const masterySummary = this._masterySummary(profile);
    const strengths = Array.isArray(profile.strengths) ? (profile.strengths as any[]) : [];
    const strengthsSummary = strengths.length
      ? strengths.map(s => (typeof s === 'string' ? s : s.area)).filter(Boolean).join(', ')
      : 'aún por evidenciar';

    const system = [
      'Eres un MENTOR de contabilidad universitaria costarricense.',
      'Miras el progreso GLOBAL del estudiante (varios ejercicios), no un caso puntual.',
      'Escribes una nota de progreso breve, motivadora y honesta, y propones UN foco de mejora.',
      'Respondes SIEMPRE en español. Máximo 150 palabras.',
      'Devuelves EXACTAMENTE dos bloques, uno por línea:',
      'NOTA: <nota de progreso personalizada>',
      'FOCO: <la única cosa en que debería concentrarse ahora>',
    ].join('\n');

    const user = [
      'Perfil del estudiante (derivado de datos reales, determinista):',
      `- Fortalezas: ${strengthsSummary}`,
      `- Dominio por área: ${masterySummary}`,
      `- Errores recurrentes: ${errorsSummary}`,
      '',
      'Escribe la NOTA de progreso y el FOCO sugerido.',
    ].join('\n');

    const raw = await this.ask(system, user, 350);
    if (raw) {
      const parsed = this._parseNoteFocus(raw);
      if (parsed) return { level: 'MENTOR', message: parsed.message, suggestedFocus: parsed.suggestedFocus };
    }

    // Fallback determinista basado en el perfil.
    const recurring = this._topRecurring(profile);
    const suggestedFocus = recurring
      ? `Refuerza "${this._humanizeType(recurring.type)}" — es tu error más frecuente (${recurring.count} veces).`
      : 'Sigue practicando ejercicios calificados para construir tu perfil de dominio.';
    const message = strengths.length
      ? `Vas construyendo bases sólidas en ${strengthsSummary}. Mantén el ritmo y ataca tus puntos débiles con intención.`
      : 'Estás empezando a construir tu perfil. Cada ejercicio calificado suma evidencia de tu dominio; sigue adelante.';
    return { level: 'MENTOR', message, suggestedFocus };
  }

  // ── Helpers deterministas ───────────────────────────────────────────────────
  private _recurringSummary(profile: any): string {
    const arr = Array.isArray(profile.recurringErrors) ? profile.recurringErrors : [];
    if (!arr.length) return 'ninguno registrado';
    return arr
      .slice(0, 5)
      .map((r: any) => `${this._humanizeType(r.type)} (${r.count})`)
      .join(', ');
  }

  private _masterySummary(profile: any): string {
    const m = profile.competencyMastery && typeof profile.competencyMastery === 'object'
      ? profile.competencyMastery
      : {};
    const entries = Object.entries(m);
    if (!entries.length) return 'sin datos aún';
    return entries.map(([area, pct]) => `${area}: ${pct}%`).join(', ');
  }

  private _topRecurring(profile: any): { type: string; count: number } | null {
    const arr = Array.isArray(profile.recurringErrors) ? profile.recurringErrors : [];
    if (!arr.length) return null;
    return [...arr].sort((a: any, b: any) => b.count - a.count)[0];
  }

  private _humanizeType(type: string): string {
    return String(type)
      .replace(/^PEDAGOGY_/, '')
      .toLowerCase()
      .replace(/_/g, ' ');
  }

  /** Parsea "PREGUNTA: ...\nEXPLICACION: ..." tolerando variaciones. */
  private _parseTwoBlocks(raw: string): { question: string; explanation: string } | null {
    const q = raw.match(/PREGUNTA\s*:\s*([\s\S]*?)(?:\n\s*EXPLICACION\s*:|$)/i);
    const e = raw.match(/EXPLICACION\s*:\s*([\s\S]*)$/i);
    const question = q?.[1]?.trim();
    const explanation = e?.[1]?.trim();
    if (question && explanation) return { question, explanation };
    // Si el modelo no respetó el formato, degradamos a fallback.
    return null;
  }

  /** Parsea "NOTA: ...\nFOCO: ...". */
  private _parseNoteFocus(raw: string): { message: string; suggestedFocus: string } | null {
    const n = raw.match(/NOTA\s*:\s*([\s\S]*?)(?:\n\s*FOCO\s*:|$)/i);
    const f = raw.match(/FOCO\s*:\s*([\s\S]*)$/i);
    const message = n?.[1]?.trim();
    const suggestedFocus = f?.[1]?.trim();
    if (message && suggestedFocus) return { message, suggestedFocus };
    return null;
  }
}
