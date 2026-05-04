'use client';

import { CheckCircle2 } from 'lucide-react';

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

export function WizardStepper({ steps, currentStep, completedSteps = [] }: WizardStepperProps) {
  return (
    <div className="w-full">
      {/* Desktop stepper */}
      <div className="hidden sm:flex items-center justify-between relative">
        {/* Connector line behind steps */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-blue-600 z-0 transition-all duration-500"
          style={{ width: `${currentStep === 0 ? 0 : (currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, idx) => {
          const isDone    = completedSteps.includes(idx) || idx < currentStep;
          const isActive  = idx === currentStep;
          const isFuture  = idx > currentStep;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                isDone
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : isActive
                  ? 'bg-white border-blue-600 text-blue-600 shadow-md shadow-blue-100'
                  : 'bg-white border-gray-200 text-gray-400'
              }`}>
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`text-xs font-medium text-center whitespace-nowrap ${
                isActive ? 'text-blue-700' : isDone ? 'text-gray-600' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile stepper — compact */}
      <div className="flex sm:hidden items-center justify-between px-1">
        {steps.map((step, idx) => {
          const isDone   = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <div key={step.id} className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                isDone
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : isActive
                  ? 'bg-white border-blue-600 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-300'
              }`}>
                {isDone ? '✓' : idx + 1}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-blue-700' : 'text-gray-400'}`}>
                {step.shortLabel ?? step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
