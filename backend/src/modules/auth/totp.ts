/**
 * TOTP (RFC 6238) — implementación nativa con `crypto`.
 *
 * Compatible con Google Authenticator, Authy, 1Password, etc.
 * Algoritmo: HMAC-SHA1, ventana de 30 segundos, 6 dígitos.
 *
 * No depende de librerías externas para minimizar superficie de auditoría.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALGO   = 'sha1';

// ── Base32 (RFC 4648) — compatible con apps de TOTP ──────────────────────────
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Genera un secret TOTP aleatorio de 20 bytes (160 bits) → 32 caracteres base32.
 * 160 bits es el mínimo recomendado por RFC 6238.
 */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * Construye la URL otpauth:// que se codifica en QR para la app autenticadora.
 *
 *   otpauth://totp/SJQA%20GROUP:user@example.com?secret=BASE32&issuer=SJQA%20GROUP
 */
export function buildOtpauthUrl(params: {
  secret: string;
  accountName: string;   // ej. correo del usuario
  issuer:      string;   // ej. "SJQA GROUP"
}): string {
  const label  = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const secret = encodeURIComponent(params.secret);
  const issuer = encodeURIComponent(params.issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/**
 * Calcula el código TOTP esperado para un secret en un instante dado.
 * Internamente solo lo usa `verify`, exportado para tests.
 */
export function computeCode(secretBase32: string, atUnixTime: number = Math.floor(Date.now() / 1000)): string {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(atUnixTime / STEP_SECONDS);
  // Counter as 8-byte big-endian buffer
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac(ALGO, secret).update(buf).digest();
  // Dynamic truncation (RFC 4226 §5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
             | ((hmac[offset + 1] & 0xff) << 16)
             | ((hmac[offset + 2] & 0xff) << 8)
             |  (hmac[offset + 3] & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/**
 * Verifica un código TOTP contra el secret. Acepta ±1 ventana de 30s para
 * tolerar drift de reloj (norma de la industria).
 *
 * Retorna boolean usando timingSafeEqual para evitar leaks por timing.
 */
export function verify(secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;

  const now = Math.floor(Date.now() / 1000);
  const candidates = [
    computeCode(secretBase32, now - STEP_SECONDS),
    computeCode(secretBase32, now),
    computeCode(secretBase32, now + STEP_SECONDS),
  ];

  const inputBuf = Buffer.from(code, 'utf8');
  for (const c of candidates) {
    const cBuf = Buffer.from(c, 'utf8');
    if (cBuf.length === inputBuf.length && timingSafeEqual(cBuf, inputBuf)) {
      return true;
    }
  }
  return false;
}
