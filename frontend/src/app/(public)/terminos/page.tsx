import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Términos y condiciones.
 *
 * El formulario de registro obligaba a aceptar unos términos cuyo enlace daba
 * 404. Pedirle a una institución que acepte un contrato que no puede leer no
 * es un detalle cosmético: es lo primero que un decano va a abrir.
 *
 * Este texto describe lo que el sistema realmente hace hoy —aislamiento por
 * institución, datos de práctica, sin valor fiscal— y no promete nada que el
 * producto no cumpla. Debe revisarlo alguien con criterio legal antes de
 * firmar un contrato de verdad.
 */
export const metadata: Metadata = {
  title: 'Términos y condiciones · ContaSJ',
  description: 'Términos de uso de la plataforma educativa contable ContaSJ.',
};

const ACTUALIZADO = '21 de agosto de 2026';

function Seccion({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-gray-900">
        <span className="mr-2 font-mono text-sm text-gray-400">{n}.</span>
        {titulo}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-[#FBF8F1] px-5 py-12">
      <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200/70 bg-white px-6 py-10 shadow-sm sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900">
          Documento legal
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">
          Términos y condiciones de uso
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          ContaSJ — plataforma educativa contable · Última actualización: {ACTUALIZADO}
        </p>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            ContaSJ es una herramienta educativa.
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Los documentos, declaraciones y estados financieros que genera son
            simulaciones para aprender. <strong>No tienen validez fiscal ni legal</strong> y
            no deben presentarse ante el Ministerio de Hacienda ni ante ninguna
            autoridad.
          </p>
        </div>

        <Seccion n={1} titulo="Qué es este servicio">
          <p>
            ContaSJ es una plataforma donde estudiantes de contabilidad operan
            empresas simuladas: emiten facturas, registran compras, llevan
            inventario, procesan planilla y producen estados financieros. Todo
            ocurre en un entorno de práctica.
          </p>
          <p>
            El servicio se contrata por institución educativa. La institución
            designa a una persona administradora, que es quien crea las cuentas
            de sus profesores y estudiantes.
          </p>
        </Seccion>

        <Seccion n={2} titulo="Sin valor fiscal">
          <p>
            Las facturas electrónicas, los XML, los comprobantes y las
            declaraciones (D-101, D-104) que produce el sistema son
            <strong> ejercicios académicos</strong>. Reproducen la estructura de los
            documentos reales de Costa Rica con fines didácticos, pero no se
            transmiten a Hacienda, no llevan firma digital válida y no
            constituyen respaldo tributario, contable ni legal de ninguna
            operación.
          </p>
          <p>
            El cálculo de impuestos que muestra la plataforma es una simulación
            educativa y no constituye asesoría fiscal.
          </p>
        </Seccion>

        <Seccion n={3} titulo="Cuentas y responsabilidad">
          <p>
            Cada persona es responsable de su cuenta y de mantener su
            contraseña en reserva. La institución es responsable de las cuentas
            que crea y de darlas de baja cuando corresponda.
          </p>
          <p>
            Las contraseñas temporales que genera el sistema se muestran una
            sola vez a quien crea la cuenta. Se recomienda cambiarlas en el
            primer ingreso.
          </p>
        </Seccion>

        <Seccion n={4} titulo="Datos: de quién son y quién los ve">
          <p>
            Los datos académicos y de práctica pertenecen a la institución
            educativa que los genera. ContaSJ los procesa para prestar el
            servicio.
          </p>
          <p>
            <strong>Cada institución está aislada de las demás.</strong> Ninguna
            institución puede ver los datos, cursos, estudiantes ni empresas de
            otra. Dentro de una institución, un estudiante solo ve sus propias
            empresas; sus profesores ven las de sus cursos.
          </p>
          <p>
            No se venden ni se ceden datos a terceros. Los subprocesadores de
            infraestructura (alojamiento, base de datos, autenticación) tratan
            los datos únicamente para operar el servicio.
          </p>
        </Seccion>

        <Seccion n={5} titulo="Uso aceptable">
          <p>
            No se permite intentar acceder a datos de otra institución o de otra
            persona, interferir con el funcionamiento del servicio, ni usar la
            plataforma para emitir documentos que se presenten como reales ante
            terceros.
          </p>
        </Seccion>

        <Seccion n={6} titulo="Disponibilidad">
          <p>
            El servicio se ofrece tal cual, con la mayor disponibilidad
            razonable. Puede haber ventanas de mantenimiento e interrupciones.
            Se recomienda a las instituciones no depender de la plataforma como
            único registro de una evaluación: las calificaciones y evidencias
            pueden exportarse.
          </p>
        </Seccion>

        <Seccion n={7} titulo="Cancelación">
          <p>
            La institución puede solicitar la baja del servicio y la exportación
            o eliminación de sus datos en cualquier momento, escribiendo al
            contacto de soporte de su contrato.
          </p>
        </Seccion>

        <Seccion n={8} titulo="Cambios en estos términos">
          <p>
            Si estos términos cambian de forma sustancial, se avisará a las
            personas administradoras de cada institución antes de que apliquen.
          </p>
        </Seccion>

        <div className="mt-10 border-t border-gray-100 pt-6">
          <Link href="/registro" className="text-sm font-semibold text-blue-700 hover:underline">
            ← Volver al registro
          </Link>
        </div>
      </article>
    </main>
  );
}
