'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Users, FileText, ArrowRight, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SceneWelcome } from '@/components/illustrations';
import { cn } from '@/lib/utils';

interface Step {
  icon: React.ElementType;
  /** Tinte del IconTile (hex de marca). */
  tint: string;
  title: string;
  description: string;
  action: string;
  href: string;
}

const STEPS: Step[] = [
  {
    icon:        BookOpen,
    tint:        '#2563EB',
    title:       'Crea tu primer curso',
    description: 'Organiza tus clases por curso y período. Puedes tener cursos en distintas universidades.',
    action:      'Ir a Mis Cursos',
    href:        '/profesor/cursos',
  },
  {
    icon:        Users,
    tint:        '#059669',
    title:       'Inscribe estudiantes',
    description: 'Abre el curso que creaste y usa el botón "Inscribir estudiante" para añadir alumnos.',
    action:      'Ver mis cursos',
    href:        '/profesor/cursos',
  },
  {
    icon:        FileText,
    tint:        '#B8860B',
    title:       'Crea y publica un ejercicio',
    description: 'Diseña ejercicios con rúbricas de evaluación. Al publicar, los estudiantes reciben notificación automática.',
    action:      'Crear ejercicio',
    href:        '/profesor/ejercicios/nuevo',
  },
];

// Textura de puntos sutil para la cabecera (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
};

// Check dibujado (trazo animado con cx-draw) para los pasos ya completados.
function DrawnCheck() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#ECFDF5" stroke="#34D399" strokeWidth="1.5" />
      <path
        d="M7.5 12.4l3 3 6-6.6"
        pathLength={1}
        className="cx-draw"
        stroke="#059669"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const isLast  = step === STEPS.length - 1;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={dismiss} />

      <div className="relative w-full max-w-md rounded-card border border-gray-200/70 bg-white shadow-2xl overflow-hidden cx-pop">

        {/* Cabecera — azul noche con la escena de bienvenida */}
        <div className="relative overflow-hidden px-6 pt-6 pb-10 text-white bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
          <div aria-hidden className="pointer-events-none absolute -right-3 -bottom-3 opacity-95">
            <SceneWelcome size={132} className={isLast ? 'cx-tada' : 'cx-float'} key={isLast ? 'final' : 'walk'} />
          </div>

          <div className="relative flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold-500 cx-wiggle-loop" />
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500">
                Bienvenido a ContaSJ
              </span>
            </div>
            <button
              onClick={dismiss}
              aria-label="Cerrar tutorial"
              className="text-blue-200 hover:text-white transition-colors cx-press"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative max-w-[62%]">
            <h2 className="text-xl font-extrabold tracking-tight">Empieza en 3 pasos</h2>
            <p className="text-blue-200/80 text-sm mt-1.5 leading-relaxed">
              Deja tu espacio listo en menos de 5 minutos.
            </p>
          </div>
        </div>

        {/* Indicador de pasos */}
        <div className="relative flex items-center gap-2 px-6 -mt-5 mb-1">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              onClick={() => setStep(i)}
              aria-label={`Ir al paso ${i + 1}: ${s.title}`}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-all duration-500',
                i <= step
                  ? 'bg-gradient-to-r from-gold-600 to-gold-500 shadow-[0_0_0_1px_rgba(184,134,11,0.25)]'
                  : 'bg-white/25',
              )}
            />
          ))}
        </div>

        {/* Contenido del paso */}
        <div className="px-6 pt-6 pb-6">
          <div key={step} className="flex items-start gap-4 mb-6 cx-pop cx-hop-parent">
            <div className="cx-hop">
              <IconTile icon={Icon} tint={current.tint} size={52} />
            </div>
            <div className="min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900 mb-1">
                Paso {step + 1} de {STEPS.length}
              </p>
              <h3 className="font-bold text-gray-900 text-lg leading-tight tracking-tight">{current.title}</h3>
              <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">{current.description}</p>
            </div>
          </div>

          {/* Lista de pasos con su estado */}
          <div className="space-y-2 mb-6 rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className={cn(
                  'flex items-center gap-3 text-sm cx-pop',
                  `cx-d${i + 1}`,
                  i < step
                    ? 'text-emerald-700'
                    : i === step
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-400',
                )}
              >
                {i < step ? (
                  <DrawnCheck />
                ) : (
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0',
                      i === step ? 'border-blue-600 bg-blue-50' : 'border-gray-300',
                    )}
                  />
                )}
                {s.title}
              </div>
            ))}
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1 text-sm cx-press"
              onClick={dismiss}
            >
              Saltar tutorial
            </Button>
            <Button
              variant={isLast ? 'gold' : 'primary'}
              className="flex-1 text-sm cx-press"
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
