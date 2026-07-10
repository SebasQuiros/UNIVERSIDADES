import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * primary   → degradado azul de marca (acción principal)
   * gold      → degradado dorado (acción destacada / celebración)
   * secondary → superficie clara con borde (acción neutra)
   * outline   → contorno azul sobre fondo blanco
   * ghost     → sin fondo (acción terciaria)
   * danger    → rojo (acción destructiva)
   */
  variant?: 'primary' | 'gold' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none',
          {
            // Variantes
            'text-white bg-gradient-to-br from-blue-600 to-[#1B2E6E] shadow-[0_6px_20px_rgba(27,46,110,0.28)] hover:shadow-[0_10px_28px_rgba(27,46,110,0.4)] hover:-translate-y-0.5':
              variant === 'primary',
            'text-white bg-gradient-to-br from-[#D4A017] to-[#B8860B] shadow-[0_6px_20px_rgba(184,134,11,0.3)] hover:shadow-[0_10px_28px_rgba(184,134,11,0.42)] hover:-translate-y-0.5 focus-visible:ring-gold-500':
              variant === 'gold',
            'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300':
              variant === 'secondary',
            'bg-white text-blue-700 border border-blue-600 hover:bg-blue-50':
              variant === 'outline',
            'text-gray-600 hover:bg-gray-100':
              variant === 'ghost',
            'text-white bg-red-600 hover:bg-red-700 shadow-sm':
              variant === 'danger',
            // Tamaños
            'px-3 py-1.5 text-xs': size === 'sm',
            'px-4 py-2 text-sm':   size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
