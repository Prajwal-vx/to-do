import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50/85 dark:bg-amber-950/85 backdrop-blur-md px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-200 shadow-lg no-print">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Local IndexedDB workspace active</span>
    </div>
  );
};
