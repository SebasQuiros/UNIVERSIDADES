import { PageSpinner } from '@/components/ui/Spinner';

// El loading.tsx del padre (estudiante/) es un grid de tarjetas que no encaja con el
// workspace de pestañas del ejercicio. Aquí usamos el loader de página reutilizable.
export default function EjercicioWorkspaceLoading() {
  return <PageSpinner />;
}
