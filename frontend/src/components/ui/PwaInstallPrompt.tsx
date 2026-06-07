'use client';

import { useEffect, useState } from 'react';

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
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-[#0F2657] px-4 py-3 text-white shadow-lg"
    >
      {/* Icon + text */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl shrink-0" aria-hidden="true">📱</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">ContaSJ</p>
          <p className="text-xs text-blue-200 leading-tight">
            Instala la app para acceso rápido sin internet
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#0F2657] hover:bg-blue-50 transition-colors"
        >
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="rounded-md p-1.5 text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
