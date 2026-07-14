'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Do not show if already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Do not show if user dismissed before
    if (localStorage.getItem('pwa-install-dismissed') === 'true') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 text-white shadow-soft bg-gradient-to-r from-csq-dark via-csq-dark-2 to-csq-mid cx-pop"
    >
      {/* Filo dorado superior */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />

      {/* Icono + texto */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/10 border border-white/15">
          <Smartphone className="w-5 h-5 text-blue-200 cx-bounce" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight truncate tracking-tight">ContaSJ</p>
          <p className="text-xs text-blue-200/80 leading-tight">
            Instala la app para acceso rápido, incluso sin internet.
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-br from-gold-600 to-gold-700 shadow-gold transition-all hover:-translate-y-0.5 cx-press"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Cerrar aviso de instalación"
          className="rounded-xl p-1.5 text-blue-200 hover:text-white hover:bg-white/10 transition-colors cx-press"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
