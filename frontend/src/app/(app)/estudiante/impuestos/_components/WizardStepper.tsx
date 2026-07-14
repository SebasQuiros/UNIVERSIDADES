'use client';

export interface WizardStep {
  id: string;
  label: string;
  shortLabel?: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: number; // 0-based index
  completedSteps?: number[]; // 0-based indices
}

/**
 * Check "dibujado" — el trazo se anima al montarse (cx-draw). Como el círculo
 * se remonta al cambiar de estado, el check se dibuja justo al completar el paso.
 */
function DrawnCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 12.5 L10 17.5 L19 7"
        pathLength={1}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="cx-draw"
      />
    </svg>
  );
}

export function WizardStepper({ steps, currentStep, completedSteps = [] }: WizardStepperProps) {
  // Progreso del conector — mismo cálculo que antes (solo presentación).
  // `Math.max(..., 1)` evita dividir entre 0 (→ Infinity) con un único paso.
  const progress = currentStep === 0
    ? 0
    : (currentStep / Math.max(steps.length - 1, 1)) * 100;

  return (
    <div className="w-full">
      {/* ── Stepper de escritorio ── */}
      <div className="relative hidden sm:flex items-start justify-between">
        {/* Conector punteado (camino por recorrer) */}
        <div
          aria-hidden
          className="absolute top-5 left-0 right-0 z-0 border-t-2 border-dashed border-gray-200"
        />
        {/* Conector recorrido — azul de marca hacia el dorado del paso activo */}
        <div
          aria-hidden
          className="absolute top-5 left-0 z-0 h-[3px] -translate-y-[1px] rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #1B2E6E 0%, #2563EB 55%, #D4A017 100%)',
          }}
        />

        {steps.map((step, idx) => {
          const isDone   = completedSteps.includes(idx) || idx < currentStep;
          const isActive = idx === currentStep;
          const state    = isDone ? 'done' : isActive ? 'active' : 'todo';

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              {/* La `key` cambia con el estado → el nodo se remonta y re-dispara
                  la animación (cx-pop al activarse, cx-draw al completarse). */}
              <div
                key={state}
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-300',
                  isDone
                    ? 'cx-pop border-transparent bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-white shadow-[0_6px_16px_rgba(27,46,110,0.28)]'
                    : isActive
                    ? 'cx-pop border-gold-600 bg-white text-gold-700 shadow-[0_6px_18px_rgba(184,134,11,0.28)] ring-4 ring-gold-50'
                    : 'border-gray-200 bg-white text-gray-400',
                ].join(' ')}
              >
                {isDone
                  ? <DrawnCheck className="h-5 w-5" />
                  : <span className="text-sm font-extrabold tabular-nums">{idx + 1}</span>}
              </div>
              <span
                className={[
                  'whitespace-nowrap text-center text-xs transition-colors',
                  isActive
                    ? 'font-bold uppercase tracking-wide text-gold-900'
                    : isDone
                    ? 'font-semibold text-gray-600'
                    : 'font-medium text-gray-400',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Stepper móvil — compacto ── */}
      <div className="relative flex items-start justify-between px-1 sm:hidden">
        <div
          aria-hidden
          className="absolute top-4 left-1 right-1 z-0 border-t-2 border-dashed border-gray-200"
        />
        {steps.map((step, idx) => {
          const isDone   = idx < currentStep;
          const isActive = idx === currentStep;
          const state    = isDone ? 'done' : isActive ? 'active' : 'todo';

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-1">
              <div
                key={state}
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full border-2',
                  isDone
                    ? 'cx-pop border-transparent bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-white'
                    : isActive
                    ? 'cx-pop border-gold-600 bg-white text-gold-700 ring-2 ring-gold-50'
                    : 'border-gray-200 bg-white text-gray-300',
                ].join(' ')}
              >
                {isDone
                  ? <DrawnCheck className="h-4 w-4" />
                  : <span className="text-xs font-extrabold tabular-nums">{idx + 1}</span>}
              </div>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-gold-700' : 'text-gray-400'}`}>
                {step.shortLabel ?? step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
