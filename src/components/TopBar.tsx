import React from 'react';
import {
  Bell,
  HelpCircle,
  Lock,
  Menu,
  Play,
  Plus,
  Printer,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import { LanguageCode } from '../types/todo';
import { tLabel } from '../utils/i18n';

interface TopBarProps {
  title: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenMobileSidebar: () => void;
  onOpenQuickCapture: () => void;
  onStartFocusMode: () => void;
  onOpenBriefing: () => void;
  onOpenHelp: () => void;
  canUndo: boolean;
  onUndo: () => void;
  hasPinLock: boolean;
  onLockApp: () => void;
  language: LanguageCode;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  searchQuery,
  onSearchChange,
  onOpenMobileSidebar,
  onOpenQuickCapture,
  onStartFocusMode,
  onOpenBriefing,
  onOpenHelp,
  canUndo,
  onUndo,
  hasPinLock,
  onLockApp,
  language,
  searchInputRef,
}) => {
  return (
    <header className="h-14 px-4 sm:px-6 glass-chrome border-b sticky top-0 z-30 flex items-center justify-between gap-4 sm:gap-6 no-print">
      {/* Left: Mobile Menu + View Title */}
      <div className="topbar-mobile-menu flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="topbar-view-title font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white truncate">
          {title}
        </h1>
      </div>

      {/* Center: Instant Search */}
      <div className="topbar-search flex-1 max-w-[580px] hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={tLabel(language, 'searchPlaceholder')}
            className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:bg-white/90 dark:focus:bg-white/10 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Functional Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg whitespace-nowrap shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenBriefing}
          title={tLabel(language, 'briefing')}
          aria-label={tLabel(language, 'briefing')}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors shrink-0"
        >
          <Bell className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          title="Print current view"
          aria-label="Print current view"
          className="hidden sm:inline-flex p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors shrink-0"
        >
          <Printer className="w-4 h-4" />
        </button>

        {hasPinLock && (
          <button
            type="button"
            onClick={onLockApp}
            title="Lock Application"
            aria-label="Lock Application"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors shrink-0"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenHelp}
          title="Shortcuts & Help"
          aria-label="Shortcuts & Help"
          className="hidden sm:inline-flex p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors shrink-0"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onStartFocusMode}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200/80 dark:border-white/15 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{tLabel(language, 'focusMode')}</span>
        </button>

        <button
          type="button"
          onClick={onOpenQuickCapture}
          aria-label={tLabel(language, 'quickCapture')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg accent-bg transition-colors whitespace-nowrap shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>{tLabel(language, 'quickCapture')}</span>
        </button>
      </div>
    </header>
  );
};
