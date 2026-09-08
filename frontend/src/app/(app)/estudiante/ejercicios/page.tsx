import { redirect } from 'next/navigation';

/**
 * Red de rescate para `/estudiante/ejercicios`.
 *
 * Esta ruta nunca existió: la lista de ejercicios vive en `/estudiante`. Pero
 * dos notificaciones apuntaban aquí ("nuevo ejercicio asignado" y "mensaje del
 * profesor"), así que el estudiante abría la notificación y se topaba con un
 * 404 — mientras que entrando desde inicio el mismo ejercicio abría bien.
 *
 * El origen ya está corregido: ahora cada notificación lleva al intento
 * concreto. Pero las notificaciones YA GUARDADAS conservan el enlace viejo, y
 * a un estudiante no se le puede pedir que entienda eso. Esta redirección las
 * rescata sin tener que tocar la base, y además cubre cualquier enlace viejo
 * que ande suelto en un correo.
 */
export default function EjerciciosRedirect() {
  redirect('/estudiante');
}
