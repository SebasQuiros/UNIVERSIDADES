'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { Building2, ChevronRight, BookOpen, Clock } from 'lucide-react';

interface CompanyWithAttempt {
  id: string;
  name: string;
  legalId: string | null;
  email: string | null;
  createdAt: string;
  attempt: {
    id: string;
    status: string;
    exercise: { id: string; title: string; course: { name: string } | null };
  } | null;
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<CompanyWithAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CompanyWithAttempt[]>('/api/v1/companies');
      setCompanies(data);
    } catch {
      toast.error('Error al cargar empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Mis Empresas</h2>
        <p className="text-gray-500 text-sm mt-1">
          {companies.length} empresa{companies.length !== 1 ? 's' : ''} creada{companies.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-700 font-semibold">Sin empresas creadas</h3>
          <p className="text-gray-500 text-sm mt-1 mb-4">
            Las empresas se crean al iniciar un ejercicio
          </p>
          <Link href="/estudiante">
            <Button variant="secondary">Ver mis ejercicios</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((company) => (
            <div
              key={company.id}
              className="group bg-white border border-gray-200 hover:border-gray-300 shadow-sm rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
                  {company.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-gray-800 truncate">
                    {company.name}
                  </h3>
                  {company.legalId && (
                    <p className="text-xs text-gray-500 mt-0.5">Cédula: {company.legalId}</p>
                  )}
                  {company.email && (
                    <p className="text-xs text-gray-500 truncate">{company.email}</p>
                  )}
                </div>
              </div>

              {/* Linked exercise */}
              {company.attempt && (
                <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-600 truncate">{company.attempt.exercise.title}</p>
                  </div>
                  {company.attempt.exercise.course && (
                    <p className="text-xs text-gray-400 pl-5">{company.attempt.exercise.course.name}</p>
                  )}
                  <div className="flex items-center gap-2 pl-5">
                    <StatusBadge status={company.attempt.status as any} />
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" /> {formatDate(company.createdAt)}
                </span>
                {company.attempt && (
                  <Link href={`/estudiante/ejercicio/${company.attempt.id}`}>
                    <Button size="sm" variant="secondary">
                      Abrir <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
