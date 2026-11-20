import React from 'react';
import { Keyboard, ShieldCheck, Sparkles, X } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl glass-modal overflow-hidden flex flex-col max-h-[86vh]">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Welcome to TO-DO — Quick Guide & Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 accent-text" />
              <span>Capture Everything. Organize Your Life. Focus on What Matters.</span>
            </div>
            <p>
              Use <strong>Daily Top 3</strong> to pick your 3 critical outcomes,{' '}
              <strong>Time Available Mode</strong> (5m / 15m / 30m / 60m) to match gaps in your schedule, and{' '}
              <strong>Focus One</strong> for distraction-free Pomodoro execution.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 accent-text" />
              <span>Keyboard Shortcuts & Quick Capture Syntax</span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded-lg glass-panel">
                <strong>Cmd/Ctrl + K</strong> or <strong>N</strong> — Quick Capture
              </div>
              <div className="p-2 rounded-lg glass-panel">
                <strong>/</strong> — Instant Search
              </div>
              <div className="p-2 rounded-lg glass-panel">
                <strong>Cmd/Ctrl + Z</strong> — Undo Last Action
              </div>
              <div className="p-2 rounded-lg glass-panel">
                <strong>Esc</strong> — Close Drawer / Modal
              </div>
            </div>
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Inline tokens: !urgent !high !low · ~15m ~1h · ^low ^high (energy) · #project · @tag · today / tomorrow
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Honest Local-First Privacy</span>
            </div>
            <p>
              All tasks, attachments, habits, and focus sessions stay offline in your browser&apos;s IndexedDB. Use JSON, AES-GCM encrypted backups, CSV, `.ics` calendars, and Project Share Packages to move data across devices without external servers or accounts.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200/70 dark:border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg accent-bg"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
