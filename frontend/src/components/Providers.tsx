'use client';

import { useEffect } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import toast, { Toaster } from 'react-hot-toast';

function WelcomeToast() {
  useEffect(() => {
    const name = sessionStorage.getItem('welcomeName');
    if (name) {
      sessionStorage.removeItem('welcomeName');
      toast.success(`Bienvenido, ${name}`);
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
    <AuthProvider>
      <WelcomeToast />
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
        }}
      />
    </AuthProvider>
    </ThemeProvider>
  );
}
