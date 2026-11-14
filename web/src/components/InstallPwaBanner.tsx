import React, { useState, useEffect } from 'react';
import { Download, WifiOff, X } from 'lucide-react';

export const InstallPwaBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!sessionStorage.getItem('qelem_pwa_dismissed')) {
        setIsInstallable(true);
      }
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsInstallable(false);
    setDismissed(true);
    sessionStorage.setItem('qelem_pwa_dismissed', 'true');
  };

  return (
    <>
      {/* Offline Toast Banner */}
      {isOffline && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 text-xs text-amber-200 flex items-center justify-center space-x-2 backdrop-blur sticky top-0 z-50">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>You are currently offline. Viewing cached devlogs from IndexedDB.</span>
        </div>
      )}

      {/* PWA Install Banner */}
      {isInstallable && !dismissed && (
        <div className="fixed bottom-16 sm:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-40 bg-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
              ቀ
            </div>
            <div>
              <p className="text-xs font-bold text-white">Install Qelem PWA</p>
              <p className="text-[11px] text-slate-400">Offline devlogs & instant campus access</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 ml-3">
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center space-x-1 shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
