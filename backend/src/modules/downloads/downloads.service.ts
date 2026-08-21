import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Enlaces de descarga firmados y de vida corta.
 *
 * Por qué existe esto: el XML de una factura se bajaba armando un Blob en el
 * navegador y disparando un clic sintético DESPUÉS de un `await`. Para
 * Chromium eso es una descarga sin gesto del usuario, y para las extensiones
 * de su lista "permitir solo con gesto" — .xml entre ellas — la marca como
 * peligrosa: "este archivo podría dañar el dispositivo". El PDF y el Excel no
 * salían marcados porque su tipo no está en esa lista, lo que explica que
 * pasara solo con el XML.
 *
 * Con un enlace firmado el botón vuelve a ser un `<a href download>` normal:
 * el clic es del usuario, la respuesta viene del servidor con su
 * Content-Type y su Content-Disposition, y no hay Blob de por medio.
 *
 * La firma es HMAC con una clave que TIENE que ser la misma en todas las
 * instancias — ver `resolverSecreto`.
 */
@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  /**
   * Clave de firma. Tiene que ser LA MISMA en todas las instancias.
   *
   * Estaba como `crypto.randomBytes(32)` por proceso. Con una sola instancia
   * funciona; con dos —que es lo que hace falta para una carga real, y lo que
   * pasa tambien durante un despliegue sin corte— el enlace lo firma una y lo
   * verifica la otra, la firma no calza, y el estudiante ve "Enlace de
   * descarga invalido" en unas descargas si y en otras no, sin ningun patron.
   * Ese tipo de falla intermitente es de las mas caras de diagnosticar.
   *
   * Se deriva de un secreto que ya existe y ya es igual en todas las
   * instancias, para no depender de que alguien recuerde configurar una
   * variable nueva. Nunca se usa el secreto en crudo: se firma con su hash.
   */
  private readonly secreto = DownloadsService.resolverSecreto();

  private static resolverSecreto(): string {
    const propio = process.env.DOWNLOAD_SECRET;
    if (propio) return propio;

    const compartido =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_JWT_SECRET ||
      process.env.DATABASE_URL;

    if (compartido) {
      return crypto.createHash('sha256')
        .update('descargas-firmadas:' + compartido)
        .digest('hex');
    }

    // Sin nada compartido: se firma con algo aleatorio y se avisa fuerte,
    // porque en cuanto haya mas de una instancia las descargas fallan a
    // medias y el sintoma no va a apuntar aca.
    new Logger(DownloadsService.name).warn(
      'DOWNLOAD_SECRET sin definir y sin secreto compartido del que derivarlo: ' +
      'los enlaces de descarga solo funcionaran con UNA instancia. ' +
      'Defini DOWNLOAD_SECRET en el entorno antes de escalar.',
    );
    return crypto.randomBytes(32).toString('hex');
  }

  private static readonly VIDA_SEGUNDOS = 1800;   // 30 min

  private b64(buf: Buffer | string) {
    return Buffer.from(buf).toString('base64url');
  }

  private firma(cuerpo: string) {
    return crypto.createHmac('sha256', this.secreto).update(cuerpo).digest('base64url');
  }

  /** Token opaco que autoriza UNA descarga concreta. */
  firmar(payload: { companyId: string; recursoId: string; tipo: string }): string {
    const cuerpo = this.b64(JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + DownloadsService.VIDA_SEGUNDOS,
    }));
    return `${cuerpo}.${this.firma(cuerpo)}`;
  }

  verificar(token: string): { companyId: string; recursoId: string; tipo: string } {
    const [cuerpo, firma] = String(token ?? '').split('.');
    if (!cuerpo || !firma) throw new BadRequestException('Enlace de descarga inválido.');

    // Comparación en tiempo constante: comparar firmas con === filtra
    // información sobre la firma correcta a través del tiempo de respuesta.
    const esperada = Buffer.from(this.firma(cuerpo));
    const recibida = Buffer.from(firma);
    if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) {
      throw new BadRequestException('Enlace de descarga inválido.');
    }

    let datos: any;
    try { datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')); }
    catch { throw new BadRequestException('Enlace de descarga inválido.'); }

    if (!datos?.exp || datos.exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('El enlace de descarga venció. Recargá la página.');
    }
    return { companyId: datos.companyId, recursoId: datos.recursoId, tipo: datos.tipo };
  }
}
