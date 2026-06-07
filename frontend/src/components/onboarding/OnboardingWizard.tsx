'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Users, FileText, CheckCircle, ArrowRight, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Step {
  icon: React.ElementType;
  color: string;
  title: string;
  description: string;
  action: string;
  href: string;
}

const STEPS: Step[] = [
  {
    icon:        BookOpen,
    color:       'bg-blue-50 text-blue-600',
    title:       'Crea tu primer curso',
    description: 'Organiza tus clases por curso y período. Puedes tener cursos en distintas universidades.',
    action:      'Ir a Mis Cursos',
    href:        '/profesor/cursos',
  },
  {
    icon:        Users,
    color:       'bg-emerald-50 text-emerald-600',
    title:       'Inscribe estudiantes',
    description: 'Abre el curso que creaste y usa el botón "Inscribir estudiante" para añadir alumnos.',
    action:      'Ver mis cursos',
    href:        '/profesor/cursos',
  },
  {
    icon:        FileText,
    color:       'bg-purple-50 text-purple-600',
    title:       'Crea y publica un ejercicio',
    description: 'Diseña ejercicios con rúbricas de evaluación. Al publicar, los estudiantes reciben notificación automática.',
    action:      'Crear ejercicio',
    href:        '/profesor/ejercicios/nuevo',
  },
];

export function OnboardingWizard({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const router  = useRouter();
  const [step, setStep]         = useState(0);
  const [closing, setClosing]   = useState(false);

  function dismiss() {
    setClosing(true);
    localStorage.setItem(`cf_onboarding_${userId}`, 'done');
    setTimeout(() => onComplete(), 200);
  }

  function goToStep(href: string) {
    dismiss();
    router.push(href);
  }

  const current = STEPS[step];
  const Icon    = current.icon;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismiss} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 pt-6 pb-8 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-200" />
              <span className="text-sm font-medium text-blue-100">Bienvenido a ContaSJ</span>
            </div>
            <button onClick={dismiss} className="text-blue-200 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-xl font-bold">Empieza en 3 pasos</h2>
          <p className="text-blue-100 text-sm mt-1">Configura tu espacio en menos de 5 minutos</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-6 -mt-4 mb-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 pt-4 pb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${current.color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Paso {step + 1} de {STEPS.length}</span>
              </div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">{current.title}</h3>
              <p className="text-gray-500 text-sm mt-1 leading-relaxed">{current.description}</p>
            </div>
          </div>

          {/* Checklist of completed steps */}
          <div className="space-y-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm ${i < step ? 'text-emerald-600' : i === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {i < step ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${i === step ? 'border-blue-600' : 'border-gray-300'}`} />
                )}
                {s.title}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1 text-sm"
              onClick={dismiss}
            >
              Saltar tutorial
            </Button>
            <Button
              className="flex-1 text-sm"
              onClick={() => {
                if (step < STEPS.length - 1) {
                  setStep((s) => s + 1);
                } else {
                  goToStep(current.href);
                }
              }}
            >
              {step < STEPS.length - 1 ? (
                <><span>Siguiente</span><ArrowRight className="w-4 h-4" /></>
              ) : (
                <><span>{current.action}</span><ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
