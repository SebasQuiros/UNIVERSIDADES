import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-ignore
const AnthropicPkg = (() => { try { return require('@anthropic-ai/sdk'); } catch { return null; } })();

export type AiMode =
  | 'journal_help'
  | 'balance_explain'
  | 'account_suggest'
  | 'exercise_hint'
  | 'error_explain'
  | 'chat';

export interface AiContext {
  // journal_help
  debitAccount?: string;
  creditAccount?: string;
  amount?: number;
  description?: string;
  // balance_explain
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  netIncome?: number;
  isBalanced?: boolean;
  // account_suggest
  transactionDescription?: string;
  // error_explain
  errorMessage?: string;
  // chat
  message?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  // legacy / generic
  tab?: string;
  companyName?: string;
}

export interface AiSuggestDto {
  mode?: AiMode;
  companyId?: string;
  attemptId?: string;
  context: AiContext;
  // Legacy fields (backwards compat)
  question?: string;
  tab?: string;
  companyName?: string;
}

@Injectable()
export class AiService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  // ── Legacy endpoint kept intact ─────────────────────────────────────────────
  async getSuggestion(question: string, context: { tab: string; companyName: string }): Promise<string> {
    return this.suggest({
      mode: 'chat',
      context: {
        message: question,
        tab: context.tab,
        companyName: context.companyName,
      },
    });
  }

  // ── Main multi-mode method ───────────────────────────────────────────────────
  async suggest(dto: AiSuggestDto): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Asistente IA no configurado. Configura ANTHROPIC_API_KEY en el servidor.');
    }
    if (!AnthropicPkg) {
      throw new BadRequestException('Módulo de IA no instalado en el servidor.');
    }

    const AnthropicClass = AnthropicPkg.default ?? AnthropicPkg;
    const client = new AnthropicClass({ apiKey });

    const mode: AiMode = dto.mode ?? 'chat';
    const ctx = dto.context ?? {};

    // Build system prompt per mode
    const systemPrompt = this.buildSystemPrompt(mode, ctx);

    // Build user message per mode
    const userMessage = await this.buildUserMessage(mode, ctx, dto.companyId);

    // Build messages array (chat mode supports history)
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    if (mode === 'chat' && ctx.history && ctx.history.length > 0) {
      // Include last 10 exchanges to stay within token budget
      const recent = ctx.history.slice(-20);
      for (const h of recent) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await client.messages.create({
      // Haiku 4.5 — más barato y mejor que el viejo Haiku 3 que estaba antes.
      // Para upgrade a Sonnet (mejor reasoning, más caro): claude-sonnet-4-6
      model: 'claude-haiku-4-5-20251001',
      max_tokens: mode === 'chat' ? 512 : 400,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type === 'text') return content.text;
    return 'No se pudo obtener una respuesta.';
  }

  // ── System prompts ───────────────────────────────────────────────────────────
  private buildSystemPrompt(mode: AiMode, ctx: AiContext): string {
    switch (mode) {
      case 'journal_help':
        return `Eres un profesor experto en contabilidad costarricense bajo NIIF.
El estudiante está registrando un asiento contable. Analiza si es correcto
y explica por qué en términos simples. Si hay un error, muestra el asiento
correcto. Usa el formato: ✅/❌ + explicación breve + ejemplo correcto si aplica.
Responde siempre en español. Máximo 250 palabras.`;

      case 'balance_explain':
        return `Eres un tutor de contabilidad. El estudiante tiene su Balance General
con estos datos. Explica en 3-4 oraciones simples: 1) Si está cuadrado o no
y por qué, 2) Qué significa la diferencia si existe, 3) Qué debe revisar.
Responde siempre en español. Sé claro y directo.`;

      case 'account_suggest':
        return `Eres un experto en el Plan de Cuentas costarricense. Dado una
descripción de transacción, sugiere: la cuenta a debitar, la cuenta a
acreditar, y una breve explicación. Responde en formato:
📥 Débito: [código] — [nombre]
📤 Crédito: [código] — [nombre]
💡 Porque: [explicación en 1-2 oraciones]
Usa códigos del plan de cuentas de Costa Rica (NIIF). Responde en español.`;

      case 'exercise_hint':
        return `Eres un tutor socrático. El estudiante está atascado en un ejercicio
contable. Da una pista útil que lo ayude a pensar, pero NO des la respuesta
directamente. Haz una pregunta guía o señala el principio contable relevante.
Responde siempre en español. Máximo 150 palabras.`;

      case 'error_explain':
        return `Eres un asistente que explica errores del sistema contable en
términos simples para estudiantes. Traduce este error técnico a una
explicación clara de qué salió mal y cómo corregirlo.
Responde siempre en español. Máximo 150 palabras. Sé empático y positivo.`;

      case 'chat':
      default: {
        const companyName = ctx.companyName
          ? `El estudiante trabaja en la empresa simulada "${(ctx.companyName).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-&.,]/g, '').slice(0, 80)}".`
          : '';
        const tabInfo = ctx.tab
          ? ` Actualmente está en la sección "${(ctx.tab).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]/g, '').slice(0, 50)}".`
          : '';
        return `Eres ContaBot, el asistente de SJQA GROUP. Eres experto en
contabilidad costarricense, NIIF, facturación electrónica del Ministerio
de Hacienda de Costa Rica. Ayudas a estudiantes universitarios de contabilidad.
Responde siempre en español, de forma clara y didáctica. Si no sabes algo,
dilo honestamente. Máximo 300 palabras. ${companyName}${tabInfo}`;
      }
    }
  }

  // ── User messages ────────────────────────────────────────────────────────────
  private async buildUserMessage(mode: AiMode, ctx: AiContext, companyId?: string): Promise<string> {
    let companyContext = '';

    if (companyId) {
      companyContext = await this.fetchCompanyContext(companyId);
    }

    switch (mode) {
      case 'journal_help': {
        const parts: string[] = ['Analiza este asiento contable:'];
        if (ctx.debitAccount)  parts.push(`Débito: ${ctx.debitAccount}`);
        if (ctx.creditAccount) parts.push(`Crédito: ${ctx.creditAccount}`);
        if (ctx.amount != null) parts.push(`Monto: ₡${ctx.amount.toLocaleString('es-CR')}`);
        if (ctx.description)   parts.push(`Descripción: ${ctx.description}`);
        if (companyContext)    parts.push(`\nContexto de la empresa:\n${companyContext}`);
        return parts.join('\n');
      }

      case 'balance_explain': {
        const parts: string[] = ['Analiza este Balance General:'];
        if (ctx.totalAssets != null)      parts.push(`Total Activos: ₡${ctx.totalAssets.toLocaleString('es-CR')}`);
        if (ctx.totalLiabilities != null) parts.push(`Total Pasivos: ₡${ctx.totalLiabilities.toLocaleString('es-CR')}`);
        if (ctx.totalEquity != null)      parts.push(`Total Patrimonio: ₡${ctx.totalEquity.toLocaleString('es-CR')}`);
        if (ctx.netIncome != null)        parts.push(`Utilidad Neta: ₡${ctx.netIncome.toLocaleString('es-CR')}`);
        if (ctx.isBalanced != null)       parts.push(`¿Está cuadrado?: ${ctx.isBalanced ? 'Sí' : 'No'}`);
        if (companyContext)               parts.push(`\nContexto:\n${companyContext}`);
        return parts.join('\n');
      }

      case 'account_suggest': {
        const desc = ctx.transactionDescription || ctx.description || 'transacción sin descripción';
        return `¿Qué cuentas debo usar para registrar esta transacción?\n"${desc}"${companyContext ? `\n\nContexto de la empresa:\n${companyContext}` : ''}`;
      }

      case 'exercise_hint': {
        const msg = ctx.message || ctx.description || 'estoy atascado en el ejercicio';
        return `Necesito una pista para: "${msg}"${companyContext ? `\n\nContexto:\n${companyContext}` : ''}`;
      }

      case 'error_explain': {
        const err = ctx.errorMessage || ctx.message || 'error desconocido';
        return `Explícame este error del sistema contable:\n"${err}"`;
      }

      case 'chat':
      default: {
        return ctx.message || '¿En qué puedo ayudarte?';
      }
    }
  }

  // ── Company context fetcher ──────────────────────────────────────────────────
  private async fetchCompanyContext(companyId: string): Promise<string> {
    try {
      const [company, recentEntries, accounts] = await Promise.all([
        this.prisma.company.findUnique({
          where: { id: companyId },
          select: { name: true, currency: true },
        }),
        this.prisma.journalEntry.findMany({
          where: { companyId },
          include: {
            lines: {
              include: { account: { select: { code: true, name: true, type: true } } },
            },
          },
          orderBy: { entryDate: 'desc' },
          take: 5,
        }),
        this.prisma.account.findMany({
          where: { companyId, isActive: true, isHeader: false },
          select: { code: true, name: true, type: true },
          orderBy: { code: 'asc' },
          take: 20,
        }),
      ]);

      const lines: string[] = [];

      if (company) {
        lines.push(`Empresa: ${company.name} (moneda: ${company.currency})`);
      }

      if (accounts.length > 0) {
        lines.push(`\nCuentas disponibles (muestra):`);
        for (const a of accounts) {
          lines.push(`  ${a.code} — ${a.name} [${a.type}]`);
        }
      }

      if (recentEntries.length > 0) {
        lines.push(`\nÚltimos asientos registrados:`);
        for (const entry of recentEntries) {
          lines.push(`  #${entry.entryNumber}: ${entry.description}`);
          for (const line of entry.lines) {
            const debit  = Number(line.debit);
            const credit = Number(line.credit);
            if (debit > 0)  lines.push(`    Déb ${line.account.code} ${line.account.name}: ₡${debit.toLocaleString('es-CR')}`);
            if (credit > 0) lines.push(`    Cré ${line.account.code} ${line.account.name}: ₡${credit.toLocaleString('es-CR')}`);
          }
        }
      }

      return lines.join('\n');
    } catch {
      // If context fetch fails, continue without it
      return '';
    }
  }
}
