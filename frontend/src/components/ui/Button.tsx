import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
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
          'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            // Variants
            'bg-teal-600 hover:bg-teal-700 text-white':
              variant === 'primary',
            'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300':
              variant === 'secondary',
            'text-gray-500 hover:bg-gray-100':
              variant === 'ghost',
            'bg-red-600 hover:bg-red-700 text-white':
              variant === 'danger',
            // Sizes
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
