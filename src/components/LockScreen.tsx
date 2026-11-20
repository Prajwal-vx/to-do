import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { sha256Hex } from '../utils/crypto';

interface LockScreenProps {
  pinHash: string;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ pinHash, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hashed = await sha256Hex(pin);
    if (hashed === pinHash) {
      setError('');
      setPin('');
      onUnlock();
    } else {
      setError('Incorrect PIN. Please try again.');
    }
  };

  return (
    <div className="min-h-screen workspace-shell flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl glass-modal p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg accent-soft-bg flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-display text-base font-bold text-slate-900 dark:text-white">
              TO-DO Locked
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your local application PIN to continue.
            </p>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter PIN..."
          className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300/80 dark:border-white/15 bg-white/75 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-slate-500"
        />

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!pin}
          className="w-full py-2 text-xs font-medium rounded-lg accent-bg disabled:opacity-40"
        >
          Unlock Workspace
        </button>
      </form>
    </div>
  );
};
