'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { MANUAL, MANUAL_META, ROL_NOMBRE, type Rol, type Seccion } from '@/content/manual';
import { Search, Printer, X, AlertTriangle, BookOpen } from 'lucide-react';

/**
 * Manual de uso dentro del sistema.
 *
 * El contenido NO vive aquí: viene de `content/manual.ts`, que es el mismo
 * del que sale el PDF que se reparte. Dos copias del mismo manual terminan
 * siempre igual — una se actualiza y la otra se queda mintiendo.
 *
 * Por defecto se muestra lo que le toca a quien está leyendo: un estudiante
 * no necesita el capítulo de carga masiva de usuarios. Se puede ver todo con
 * un clic, porque un profesor sí quiere saber qué ve su clase.
 */
export default function AyudaPage() {
  const { user } = useAuth();
  // SUPERADMIN no es un rol del manual: ve todo, sin filtrar.
  const esSuper = user?.role === 'SUPERADMIN';
  const rol: Rol = (['ADMIN', 'TEACHER', 'STUDENT'] as const).includes(user?.role as any)
    ? (user!.role as Rol)
    : 'STUDENT';

  const [busqueda, setBusqueda] = useState('');
  const [soloLoMio, setSoloLoMio] = useState(true);

  const capitulos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    const coincide = (s: Seccion) => {
      if (soloLoMio && !esSuper && !s.paraQuien.includes(rol)) return false;
      if (!q) return true;
      const texto = [s.titulo, s.resumen, ...(s.pasos ?? []), ...(s.avisos ?? [])].join(' ').toLowerCase();
      return texto.includes(q);
    };

    return MANUAL
      .map((c) => ({ ...c, secciones: c.secciones.filter(coincide) }))
      .filter((c) => c.secciones.length > 0);
  }, [busqueda, soloLoMio, rol, esSuper]);

  const totalSecciones = capitulos.reduce((n, c) => n + c.secciones.length, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1]">
      <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">

        {/* ── Encabezado ── */}
        <header className="mb-8 rounded-card border border-gray-200/70 bg-white p-6 shadow-card lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-4">
              <Image
                src="/sjqa-logo-transparente.png"
                alt={MANUAL_META.empresa}
                width={64}
                height={28}
                className="h-11 w-auto"
              />
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-900">
                  Manual de uso
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  {MANUAL_META.sistema}
                </h1>
                <p className="text-sm text-gray-500">{MANUAL_META.subtitulo}</p>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="cx-press inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-700 print:hidden"
            >
              <Printer className="h-4 w-4" /> Imprimir o guardar en PDF
            </button>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-gray-600">
            Cómo se usa el sistema, módulo por módulo. Si es tu primera vez, leé el
            capítulo 1 completo: ahorra la mitad de las dudas.
          </p>
        </header>

        {/* ── Búsqueda y filtro ── */}
        <div className="mb-7 flex flex-wrap items-center gap-3 print:hidden">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar: factura, planilla, conciliación…"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-9 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                aria-label="Limpiar"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={soloLoMio}
              onChange={(e) => setSoloLoMio(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Solo lo que me toca ({ROL_NOMBRE[rol] ?? 'mi rol'})
          </label>
        </div>

        {/* ── Índice ── */}
        {!busqueda && (
          <nav className="mb-8 rounded-card border border-gray-200/70 bg-white p-5 shadow-card print:break-after-page">
            <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gray-400">
              Contenido
            </p>
            <ol className="space-y-1.5">
              {capitulos.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className="flex items-baseline gap-2.5 text-sm text-gray-700 transition-colors hover:text-blue-700"
                  >
                    <span className="font-mono text-xs text-gray-400">{c.numero}.</span>
                    <span className="font-medium">{c.titulo}</span>
                    <span className="text-xs text-gray-400">
                      · {c.secciones.length} tema{c.secciones.length !== 1 ? 's' : ''}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {totalSecciones === 0 && (
          <div className="rounded-card border border-gray-200/70 bg-white p-10 text-center shadow-card">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="font-semibold text-gray-700">Nada coincide con «{busqueda}»</p>
            <p className="mt-1 text-sm text-gray-500">
              Probá con otra palabra, o destildá «Solo lo que me toca» para ver el manual completo.
            </p>
          </div>
        )}

        {/* ── Capítulos ── */}
        {capitulos.map((c) => (
          <section key={c.id} id={c.id} className="mb-10 scroll-mt-6 print:break-before-page">
            <div className="mb-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-900">
                Capítulo {c.numero}
              </p>
              <h2 className="text-xl font-extrabold tracking-tight text-gray-900">{c.titulo}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-600">{c.intro}</p>
            </div>

            <div className="space-y-5">
              {c.secciones.map((s) => (
                <article
                  key={s.id}
                  id={s.id}
                  className="scroll-mt-6 rounded-card border border-gray-200/70 bg-white p-5 shadow-card lg:p-6 print:break-inside-avoid"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900">{s.titulo}</h3>
                    {s.paraQuien.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {ROL_NOMBRE[r]}
                      </span>
                    ))}
                  </div>

                  <p className="text-sm leading-relaxed text-gray-600">{s.resumen}</p>

                  {s.pasos && s.pasos.length > 0 && (
                    <ol className="mt-4 space-y-2">
                      {s.pasos.map((paso, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-700">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{paso}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {s.captura && (
                    // Si la captura todavía no se publicó, la imagen se oculta
                    // sola: un recuadro roto es peor que no mostrar nada.
                    <img
                      src={`/manual/${s.captura}`}
                      alt={s.titulo}
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      className="mt-4 w-full rounded-xl border border-gray-200 shadow-sm"
                    />
                  )}

                  {s.avisos && s.avisos.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {s.avisos.map((a, i) => (
                        <p
                          key={i}
                          className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-amber-900"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                          <span>{a}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-10 border-t border-gray-200 pt-5 text-xs text-gray-400">
          {MANUAL_META.sistema} · Manual de uso v{MANUAL_META.version} · Revisado en{' '}
          {MANUAL_META.revisado} · Desarrollado por {MANUAL_META.empresa}
        </footer>
      </div>
    </div>
  );
}
