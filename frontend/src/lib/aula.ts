/**
 * ¿En qué aula de Multiempresa está parado el usuario?
 *
 * Vive acá, y no dentro de cada componente, porque la regla la necesitan al
 * menos tres lugares: el menú lateral, el selector de espacios de arriba a la
 * derecha y el workspace. Cuando cada uno tenía la suya, el menú decía
 * "Espacio Multiempresa" y el selector de al lado decía "Educación" en la
 * misma pantalla.
 *
 * El aula se reconoce por dos caminos: la ruta de la sesión, o el parámetro
 * `?aula=` que acompaña al estudiante cuando opera los libros de su grupo.
 */
const UUID = /^[0-9a-fA-F-]{36}$/;

export function detectarAula(
  pathname: string,
  searchParams?: { get(k: string): string | null } | null,
): string | null {
  const m = pathname.match(/^\/estudiante\/sesion\/([0-9a-fA-F-]{36})/);
  if (m) return m[1];
  const q = searchParams?.get('aula');
  return q && UUID.test(q) ? q : null;
}

/** ¿Estamos en el espacio Multiempresa, por la razón que sea? */
export function esEspacioMultiempresa(
  pathname: string,
  searchParams?: { get(k: string): string | null } | null,
): boolean {
  return pathname.startsWith('/estudiante/multiempresa') || !!detectarAula(pathname, searchParams);
}
