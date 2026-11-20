import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installError, setInstallError] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={async () => {
          try {
            await install();
          } catch {
            setInstallError(true);
            setShowIOSGuide(true);
          }
        }}
        aria-label="Install TaskFlow on this device"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-xs font-medium' : 'px-3 py-1.5 text-xs font-medium'
        }`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowIOSGuide(true)}
        aria-label="Show instructions to install TaskFlow"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 ${compact ? '' : 'px-3'}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowIOSGuide(false); }}>
          <section className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="install-guide-title">
            <h3 id="install-guide-title" className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Install TaskFlow on your {isIOS ? 'iPhone or iPad' : isAndroid ? 'Android phone' : 'device'}
            </h3>
            {installError && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Your browser could not open the automatic install prompt. Follow these steps instead.</p>}
            {isIOS ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Open this page in <strong>Safari</strong>, tap the <strong>Share</strong> button, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
              </p>
            ) : isAndroid ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                In Chrome, tap the <strong>Install</strong> button above. If it is unavailable, open the <strong>⋮</strong> menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Open your browser menu and choose <strong>Install TaskFlow</strong> or <strong>Add to Home Screen</strong>. On a phone, use Safari on iPhone or Chrome on Android.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Once installed, TaskFlow gets its own app icon and can open offline after the first visit.</p>
            <button
              type="button"
              onClick={() => { setShowIOSGuide(false); setInstallError(false); }}
              className="mt-5 w-full min-h-11 rounded-xl accent-bg py-2 text-sm font-semibold text-white"
            >
              Got it
            </button>
          </section>
        </div>
      )}
    </>
  );
};
