import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: any = null;
  private configured = false;

  constructor(private readonly config: ConfigService) {
    this.init();
  }

  private async init() {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP no configurado — emails desactivados. Agrega SMTP_HOST, SMTP_USER, SMTP_PASS al .env');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(this.config.get('SMTP_PORT') || '587'),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: { user, pass },
      });
      this.configured = true;
      this.logger.log(`✉️  SMTP configurado: ${host}`);
    } catch (e) {
      this.logger.error('Error al inicializar SMTP: ' + e.message);
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.configured || !this.transporter) return;
    try {
      const from = this.config.get<string>('SMTP_FROM') || 'SJQA GROUP <noreply@sjqagroup.com>';
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log(`✉️  Email enviado a ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Error enviando email a ${to}: ${err.message}`);
    }
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  gradedHtml(studentName: string, exerciseTitle: string, score: number, maxScore: number, feedback?: string) {
    const pct = Math.round((score / maxScore) * 100);
    const color = pct >= 70 ? '#166534' : pct >= 50 ? '#92400e' : '#991b1b';
    const bg    = pct >= 70 ? '#f0fdf4'  : pct >= 50 ? '#fffbeb'  : '#fef2f2';
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px">
  <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="color:#1e40af;margin:0 0 4px;font-size:1.25rem">SJQA GROUP</h2>
    <p style="color:#6b7280;font-size:0.8rem;margin:0 0 20px">Sistema Educativo Contable</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px">
    <h3 style="color:#111827;margin:0 0 8px">Hola ${studentName},</h3>
    <p style="color:#374151;margin:0 0 16px">Tu ejercicio <strong>${exerciseTitle}</strong> fue calificado.</p>
    <div style="background:${bg};border-radius:8px;padding:20px;margin:0 0 16px;text-align:center">
      <p style="font-size:2.5rem;font-weight:bold;color:${color};margin:0">${score} <span style="font-size:1rem;color:#6b7280">/ ${maxScore}</span></p>
      <p style="color:#6b7280;margin:4px 0 0;font-size:0.875rem">${pct}% — ${pct >= 70 ? '¡Aprobado!' : pct >= 50 ? 'En proceso' : 'No aprobado'}</p>
    </div>
    ${feedback ? `<div style="background:#f8fafc;border-left:3px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 16px"><p style="margin:0;color:#374151;font-size:0.875rem"><strong>Retroalimentación:</strong> ${feedback}</p></div>` : ''}
    <p style="color:#6b7280;font-size:0.8rem;margin:24px 0 0">Ingresa a SJQA GROUP para ver el detalle completo.</p>
  </div>
</div>`;
  }

  newUserCredentialsHtml(name: string, email: string, tempPassword: string, platformName = 'SJQA GROUP — Sistema Educativo Contable') {
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px">
  <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="color:#1e40af;margin:0 0 4px;font-size:1.25rem">${platformName}</h2>
    <p style="color:#6b7280;font-size:0.8rem;margin:0 0 20px">Sistema Educativo Contable</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px">
    <h3 style="color:#111827;margin:0 0 8px">Bienvenido/a, ${name}</h3>
    <p style="color:#374151;margin:0 0 16px">Tu cuenta ha sido creada. A continuación encontrarás tus credenciales de acceso inicial:</p>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:0 0 16px">
      <p style="margin:0 0 8px;color:#374151"><strong>Correo:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${email}</code></p>
      <p style="margin:0;color:#374151"><strong>Contraseña temporal:</strong> <code style="background:#fef3c7;padding:4px 10px;border-radius:4px;font-size:1.1rem;letter-spacing:0.05em;font-weight:bold;color:#92400e">${tempPassword}</code></p>
    </div>
    <div style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px">
      <p style="margin:0;color:#7f1d1d;font-size:0.875rem">⚠️ Por seguridad, deberás <strong>cambiar tu contraseña</strong> la primera vez que inicies sesión.</p>
    </div>
    <p style="color:#6b7280;font-size:0.8rem;margin:0">Si no solicitaste esta cuenta, ignora este correo o contacta a tu administrador.</p>
  </div>
</div>`;
  }

  // ── University Welcome (onboarding) ───────────────────────────
  universityWelcomeHtml(params: {
    adminName:      string;
    adminEmail:     string;
    universityName: string;
    tempPassword:   string;
    planName:       string;
    maxStudents:    number;
    loginUrl:       string;
  }): string {
    const { adminName, adminEmail, universityName, tempPassword, planName, maxStudents, loginUrl } = params;
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px">
  <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="color:#1B2E6E;margin:0;font-size:1.5rem;font-weight:900">SJQA GROUP</h1>
      <p style="color:#6b7280;font-size:0.8rem;margin:4px 0 0">Plataforma Educativa de Contabilidad</p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px">

    <!-- Saludo -->
    <h2 style="color:#111827;margin:0 0 8px;font-size:1.1rem">Bienvenido/a, ${adminName}</h2>
    <p style="color:#374151;margin:0 0 20px;line-height:1.6">
      La universidad <strong>${universityName}</strong> ha sido registrada exitosamente en SJQA GROUP.
      A continuación encontrará sus credenciales de acceso inicial como administrador.
    </p>

    <!-- Credenciales -->
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:0 0 16px">
      <p style="margin:0 0 4px;color:#374151;font-weight:700;font-size:0.9rem">Sus credenciales de acceso:</p>
      <p style="margin:8px 0 4px;color:#374151"><strong>URL:</strong> <a href="${loginUrl}" style="color:#1B2E6E">${loginUrl}</a></p>
      <p style="margin:4px 0 4px;color:#374151"><strong>Email:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${adminEmail}</code></p>
      <p style="margin:4px 0 0;color:#374151"><strong>Contraseña temporal:</strong> <code style="background:#fef3c7;padding:4px 10px;border-radius:4px;font-size:1.1rem;letter-spacing:0.08em;font-weight:bold;color:#92400e">${tempPassword}</code></p>
    </div>

    <!-- Advertencia seguridad -->
    <div style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px">
      <p style="margin:0;color:#7f1d1d;font-size:0.875rem">
        Por seguridad, deberá <strong>cambiar su contraseña</strong> la primera vez que inicie sesión.
      </p>
    </div>

    <!-- Plan contratado -->
    <div style="background:#eff6ff;border-radius:8px;padding:16px;margin:0 0 20px">
      <p style="margin:0;color:#1e40af;font-weight:700;font-size:0.9rem">Plan contratado</p>
      <p style="margin:4px 0 0;color:#374151">${planName} — hasta <strong>${maxStudents} estudiantes</strong></p>
    </div>

    <!-- Soporte -->
    <p style="color:#6b7280;font-size:0.8rem;margin:0">
      Si tiene alguna pregunta, contáctenos en
      <a href="mailto:soporte@sjqagroup.com" style="color:#1B2E6E">soporte@sjqagroup.com</a>
    </p>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">
    <p style="color:#9ca3af;font-size:0.72rem;margin:0;text-align:center">
      SJQA GROUP — Plataforma Educativa de Contabilidad
    </p>
  </div>
</div>`;
  }

  // ── Password reset ─────────────────────────────────────────────
  passwordResetHtml(name: string, resetUrl: string) {
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px">
  <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="color:#1e40af;margin:0 0 4px;font-size:1.25rem">SJQA GROUP</h2>
    <p style="color:#6b7280;font-size:0.8rem;margin:0 0 20px">Recuperación de contraseña</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px">
    <h3 style="color:#111827;margin:0 0 8px">Hola ${name},</h3>
    <p style="color:#374151;margin:0 0 16px;line-height:1.6">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta.
      Haz clic en el botón a continuación para crear una nueva contraseña.
      Este enlace expira en <strong>1 hora</strong>.
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="${resetUrl}"
         style="display:inline-block;background:#1B2E6E;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">
        Restablecer contraseña
      </a>
    </div>
    <p style="color:#6b7280;font-size:0.8rem;margin:0 0 4px">Si el botón no funciona, copia este enlace en tu navegador:</p>
    <p style="color:#1B2E6E;font-size:0.75rem;margin:0;word-break:break-all">${resetUrl}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">
    <p style="color:#9ca3af;font-size:0.72rem;margin:0">
      Si <strong>no solicitaste</strong> este cambio, puedes ignorar este correo.
      Tu contraseña actual seguirá siendo válida.
    </p>
  </div>
</div>`;
  }

  // ── Email verification ─────────────────────────────────────────
  emailVerificationHtml(name: string, verifyUrl: string) {
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px">
  <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="color:#1e40af;margin:0 0 4px;font-size:1.25rem">SJQA GROUP</h2>
    <p style="color:#6b7280;font-size:0.8rem;margin:0 0 20px">Verificación de correo</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px">
    <h3 style="color:#111827;margin:0 0 8px">Hola ${name},</h3>
    <p style="color:#374151;margin:0 0 16px;line-height:1.6">
      Para activar tu cuenta de SJQA GROUP, confirma que este correo es tuyo
      haciendo clic en el botón.
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="${verifyUrl}"
         style="display:inline-block;background:#059669;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">
        Verificar mi correo
      </a>
    </div>
    <p style="color:#6b7280;font-size:0.8rem;margin:0 0 4px">Si el botón no funciona, copia este enlace en tu navegador:</p>
    <p style="color:#1B2E6E;font-size:0.75rem;margin:0;word-break:break-all">${verifyUrl}</p>
  </div>
</div>`;
  }

  exerciseAssignedHtml(studentName: string, exerciseTitle: string, courseName: string, dueDate?: string) {
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px">
  <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="color:#1e40af;margin:0 0 4px;font-size:1.25rem">SJQA GROUP</h2>
    <p style="color:#6b7280;font-size:0.8rem;margin:0 0 20px">Sistema Educativo Contable</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px">
    <h3 style="color:#111827;margin:0 0 8px">Hola ${studentName},</h3>
    <p style="color:#374151;margin:0 0 16px">Tienes un nuevo ejercicio disponible en <strong>${courseName}</strong>.</p>
    <div style="background:#eff6ff;border-radius:8px;padding:16px;margin:0 0 16px">
      <p style="font-weight:bold;color:#1e40af;margin:0 0 4px">📝 ${exerciseTitle}</p>
      ${dueDate ? `<p style="color:#6b7280;margin:0;font-size:0.875rem">📅 Fecha límite: <strong>${dueDate}</strong></p>` : ''}
    </div>
    <p style="color:#374151;font-size:0.875rem;margin:0 0 8px">Ingresa a SJQA GROUP para comenzar el ejercicio.</p>
    <p style="color:#6b7280;font-size:0.8rem;margin:0">¡Mucho éxito!</p>
  </div>
</div>`;
  }
}
