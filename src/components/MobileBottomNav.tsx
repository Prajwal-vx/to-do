import React from 'react';
import { CalendarDays, House, Menu, Plus, Search } from 'lucide-react';
import type { ViewType } from '../types/todo';

interface MobileBottomNavProps {
  activeView: ViewType;
  searchOpen: boolean;
  onSelectView: (view: ViewType) => void;
  onToggleSearch: () => void;
  onQuickCapture: () => void;
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  searchOpen,
  onSelectView,
  onToggleSearch,
  onQuickCapture,
  onOpenMenu,
}) => (
  <nav className="mobile-bottom-nav no-print" aria-label="Quick navigation">
    <button
      type="button"
      aria-label="Home"
      aria-current={activeView === 'home' ? 'page' : undefined}
      className={activeView === 'home' ? 'is-active' : ''}
      onClick={() => onSelectView('home')}
    >
      <House aria-hidden="true" />
      <span>Home</span>
    </button>
    <button
      type="button"
      aria-label={searchOpen ? 'Close search' : 'Search tasks'}
      aria-pressed={searchOpen}
      className={searchOpen ? 'is-active' : ''}
      onClick={onToggleSearch}
    >
      <Search aria-hidden="true" />
      <span>Search</span>
    </button>
    <button
      type="button"
      aria-label="Quick Capture: add a task"
      className="mobile-bottom-add"
      onClick={onQuickCapture}
    >
      <Plus aria-hidden="true" />
      <span>Add</span>
    </button>
    <button
      type="button"
      aria-label="Today"
      aria-current={activeView === 'today' ? 'page' : undefined}
      className={activeView === 'today' ? 'is-active' : ''}
      onClick={() => onSelectView('today')}
    >
      <CalendarDays aria-hidden="true" />
      <span>Today</span>
    </button>
    <button type="button" aria-label="Open menu" onClick={onOpenMenu}>
      <Menu aria-hidden="true" />
      <span>Menu</span>
    </button>
  </nav>
);
