import {
  Injectable,
  Logger,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente del Admin API de Supabase Auth (GoTrue).
 *
 * Usa la `service_role` key (NUNCA exponer al frontend) para crear/borrar/buscar
 * usuarios de identidad. La app sigue guardando su propio `User` (rol, empresa,
 * universidad) en Postgres, enlazado por `authId` = id del usuario en Supabase.
 *
 * Se apoya en el `fetch` global (Node 18+); no agrega dependencias nativas.
 */
@Injectable()
export class SupabaseAdminService implements OnModuleInit {
  private readonly logger = new Logger('SupabaseAdmin');
  private readonly url: string;
  private readonly serviceKey: string;

  constructor(private readonly config: ConfigService) {
    this.url = (this.config.get<string>('SUPABASE_URL') || '').replace(/\/$/, '');
    this.serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
  }

  onModuleInit() {
    if (!this.url || !this.serviceKey) {
      this.logger.warn(
        'SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas — la creación de usuarios fallará.',
      );
    }
  }

  private headers() {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Crea un usuario en Supabase Auth y devuelve su id (= `sub` del JWT).
   * Por defecto confirma el email (email_confirm) para que pueda loguear sin
   * verificación manual — apropiado para cuentas creadas por admin/seed.
   * Si el email ya existe, devuelve el id existente (idempotente).
   */
  async createUser(params: {
    email: string;
    password: string;
    emailConfirm?: boolean;
    userMetadata?: Record<string, unknown>;
  }): Promise<string> {
    const res = await fetch(`${this.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        email_confirm: params.emailConfirm ?? true,
        user_metadata: params.userMetadata ?? {},
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      return data.id;
    }

    // Email ya registrado → recuperar el id existente (idempotencia).
    if (res.status === 422 || res.status === 409) {
      const existing = await this.findIdByEmail(params.email);
      if (existing) return existing;
    }

    const detail = await res.text().catch(() => '');
    throw new InternalServerErrorException(
      `Supabase createUser falló (${res.status}): ${detail}`,
    );
  }

  /**
   * Busca el id de Supabase de un usuario por email, PAGINANDO el listado admin
   * (GoTrue recorta `per_page`; una sola página rompe la idempotencia a escala).
   * Devuelve null si no existe.
   */
  async findIdByEmail(email: string): Promise<string | null> {
    const target = email.toLowerCase();
    const perPage = 200;
    for (let page = 1; page <= 100; page++) {
      const res = await fetch(
        `${this.url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        { headers: this.headers() },
      );
      if (!res.ok) return null;
      const data: any = await res.json();
      const users: any[] = data.users || (Array.isArray(data) ? data : []);
      const match = users.find((u) => (u.email || '').toLowerCase() === target);
      if (match) return match.id;
      if (users.length < perPage) break; // última página alcanzada
    }
    return null;
  }

  /** Borra un usuario de Supabase Auth. No falla si ya no existe (404). */
  async deleteUser(authId: string): Promise<void> {
    if (!authId) return;
    const res = await fetch(`${this.url}/auth/v1/admin/users/${authId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) {
      const detail = await res.text().catch(() => '');
      throw new InternalServerErrorException(
        `Supabase deleteUser falló (${res.status}): ${detail}`,
      );
    }
  }
}
