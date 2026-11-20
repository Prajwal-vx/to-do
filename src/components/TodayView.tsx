import React, { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Clock,
  Eye,
  Flame,
  ListFilter,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  DashboardWidget,
  EnergyLevel,
  FocusSession,
  Habit,
  Priority,
  Project,
  Task,
  UserSettings,
} from '../types/todo';
import { formatDuration, formatFullDate, formatShortDate, getTodayStr } from '../utils/date';
import {
  computePersonalProductivityScore,
  computeStreakStats,
  computeTaskScore,
  computeWorkloadBalance,
  parseQuickCapture,
} from '../utils/rulesEngine';
import { TaskRow } from './TaskRow';

interface TodayViewProps {
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  focusSessions: FocusSession[];
  settings: UserSettings;
  searchQuery: string;
  activeTimerTaskId: string | null;
  activeTimerElapsed: number;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onQuickCreate: (input: {
    title: string;
    priority: Priority;
    energy: EnergyLevel;
    estimatedMinutes: number;
    dueDate: string | null;
    projectId: string | null;
    tags: string[];
    pinTop3: boolean;
  }) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleTop3: (taskId: string) => void;
  onToggleFavorite: (taskId: string) => void;
  onSnoozeTomorrow: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onToggleTimer: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onTrash: (taskId: string) => void;
  onReorderTasks: (sourceId: string, targetId: string) => void;
  onToggleHabitDate: (habitId: string, dateStr: string) => void;
  onOpenReschedule: () => void;
  onBulkAction: (ids: string[], action: 'complete' | 'today' | 'tomorrow' | 'archive' | 'trash') => void;
}

type DashboardTaskFilter = 'all' | 'today' | 'upcoming' | 'important' | 'completed';

export const TodayView: React.FC<TodayViewProps> = ({
  tasks,
  projects,
  habits,
  focusSessions,
  settings,
  searchQuery,
  activeTimerTaskId,
  activeTimerElapsed,
  onUpdateSettings,
  onQuickCreate,
  onToggleComplete,
  onToggleTop3,
  onToggleFavorite,
  onSnoozeTomorrow,
  onOpenDetail,
  onStartFocus,
  onToggleTimer,
  onDuplicate,
  onArchive,
  onTrash,
  onReorderTasks,
  onToggleHabitDate,
  onOpenReschedule,
  onBulkAction,
}) => {
  const today = getTodayStr();
  const nowIso = new Date().toISOString();
  const [inlineInput, setInlineInput] = useState('');
  const [timeAvailable, setTimeAvailable] = useState<number | null>(null);
  const [taskFilter, setTaskFilter] = useState<DashboardTaskFilter>('all');
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | 'all'>('all');
  const [smartShortlistOn, setSmartShortlistOn] = useState<boolean>(
    settings.dashboardWidgets.includes('shortlist')
  );
  const [dimOthers, setDimOthers] = useState(false);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.status === 'todo' || t.status === 'in_progress') &&
          (!t.snoozedUntil || t.snoozedUntil <= nowIso)
      ),
    [tasks, nowIso]
  );

  const scoredMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeTaskScore>>();
    activeTasks.forEach((t) => {
      map.set(t.id, computeTaskScore(t, tasks, today));
    });
    return map;
  }, [activeTasks, tasks, today]);

  const top3Tasks = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.top3Date === today &&
            t.status !== 'archived' &&
            t.status !== 'trashed' &&
            t.status !== 'parking_lot'
        )
        .slice(0, 3),
    [tasks, today]
  );

  const overdueTasks = useMemo(
    () => activeTasks.filter((t) => t.dueDate && t.dueDate < today),
    [activeTasks, today]
  );

  const completedTodayCount = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === 'done' && t.completedAt && t.completedAt.slice(0, 10) === today
      ).length,
    [tasks, today]
  );

  const streakStats = useMemo(() => computeStreakStats(tasks, today), [tasks, today]);
  const prodScore = useMemo(
    () => computePersonalProductivityScore(tasks, focusSessions, habits, settings, today),
    [tasks, focusSessions, habits, settings, today]
  );
  const workload = useMemo(
    () => computeWorkloadBalance(tasks, settings.dailyGoal, today, 7),
    [tasks, settings.dailyGoal, today]
  );

  const visibleTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let pool =
      timeAvailable !== null
        ? activeTasks.filter((t) => {
            const score = scoredMap.get(t.id);
            return t.estimatedMinutes <= timeAvailable && !score?.blocked;
          })
        : taskFilter === 'today'
        ? activeTasks.filter((t) => (t.dueDate && t.dueDate <= today) || t.top3Date === today)
        : taskFilter === 'upcoming'
        ? activeTasks.filter((t) => t.dueDate && t.dueDate > today)
        : taskFilter === 'important'
        ? activeTasks.filter((t) => t.important || t.priority === 'urgent' || t.priority === 'high')
        : taskFilter === 'completed'
        ? tasks.filter((t) => t.status === 'done')
        : activeTasks;

    if (energyFilter !== 'all') {
      pool = pool.filter((t) => t.energy === energyFilter);
    }

    if (q) {
      pool = pool.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
      );
    }

    if (smartShortlistOn || timeAvailable !== null) {
      return [...pool].sort(
        (a, b) => (scoredMap.get(b.id)?.score || 0) - (scoredMap.get(a.id)?.score || 0)
      );
    }

    return [...pool].sort((a, b) => a.order - b.order);
  }, [activeTasks, tasks, scoredMap, timeAvailable, taskFilter, energyFilter, searchQuery, smartShortlistOn, today]);

  const filterCounts: Record<DashboardTaskFilter, number> = {
    all: activeTasks.length,
    today: activeTasks.filter((t) => (t.dueDate && t.dueDate <= today) || t.top3Date === today).length,
    upcoming: activeTasks.filter((t) => t.dueDate && t.dueDate > today).length,
    important: activeTasks.filter((t) => t.important || t.priority === 'urgent' || t.priority === 'high').length,
    completed: tasks.filter((t) => t.status === 'done').length,
  };

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineInput.trim()) return;
    const parsed = parseQuickCapture(inlineInput, projects, null, today);
    onQuickCreate({
      ...parsed,
      pinTop3: false,
    });
    setInlineInput('');
  };

  const toggleWidget = (widget: DashboardWidget) => {
    const exists = settings.dashboardWidgets.includes(widget);
    const next = exists
      ? settings.dashboardWidgets.filter((w) => w !== widget)
      : [...settings.dashboardWidgets, widget];
    onUpdateSettings({ dashboardWidgets: next });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const showTop3 = settings.dashboardWidgets.includes('top3');
  const showTimeBar = settings.dashboardWidgets.includes('timeAvailable');
  const showHabits = settings.dashboardWidgets.includes('habits');
  const showStreak = settings.dashboardWidgets.includes('streak');
  const showScore = settings.dashboardWidgets.includes('score');
  const showWorkload = settings.dashboardWidgets.includes('workload');

  const top3CompletedCount = top3Tasks.filter((t) => t.status === 'done').length;
  const hasFocus3Active = top3Tasks.some((t) => t.status !== 'done');

  return (
    <div className="today-dashboard-content max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {formatFullDate(today)}
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
            Focus Workspace
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showStreak && (
            <div className="px-3 py-1.5 rounded-lg glass-panel text-xs flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-medium text-slate-800 dark:text-slate-100 tabular-nums">
                {streakStats.currentMomentumStreak}-day streak
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                {completedTodayCount}/{settings.dailyGoal} today
              </span>
            </div>
          )}

          {showScore && (
            <div
              className="px-3 py-1.5 rounded-lg glass-panel text-xs flex items-center gap-2"
              title={prodScore.components.map((c) => `${c.label}: ${c.score}/${c.max}`).join(' · ')}
            >
              <Activity className="w-3.5 h-3.5 accent-text" />
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                Score {prodScore.totalScore}/100
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowWidgetConfig((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg glass-panel text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {/* Customizable Dashboard Widgets */}
      {showWidgetConfig && (
        <div className="p-4 rounded-xl glass-panel flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Dashboard Widgets:
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['top3', 'Focus 3'],
                ['timeAvailable', 'Time Available'],
                ['shortlist', 'Smart Shortlist Default'],
                ['score', 'Productivity Score'],
                ['workload', 'Workload Balance'],
                ['habits', 'Daily Habits'],
                ['streak', 'Streak & Goal'],
              ] as [DashboardWidget, string][]
            ).map(([key, label]) => {
              const active = settings.dashboardWidgets.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleWidget(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    active
                      ? 'accent-soft-bg border-transparent'
                      : 'border-slate-200/70 dark:border-white/15 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Overdue Recovery Notice */}
      {overdueTasks.length > 0 && (
        <div className="dashboard-overdue-notice px-4 py-3 rounded-xl border border-amber-300/70 dark:border-amber-700/50 bg-amber-50/75 dark:bg-amber-950/30 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-amber-950 dark:text-amber-200">
            <span className="font-medium tabular-nums">{overdueTasks.length} overdue</span>{' '}
            {overdueTasks.length === 1 ? 'task needs' : 'tasks need'} rescheduling. Use the Recovery Planner to rebalance cleanly.
          </div>
          <button
            type="button"
            onClick={onOpenReschedule}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Recovery Planner</span>
          </button>
        </div>
      )}

      {/* Focus 3 / Daily Top 3 Spotlight */}
      {showTop3 && (
        <section className="dashboard-focus-widget rounded-xl glass-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200/60 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Focus 3 · Today&apos;s Essential Shortlist
              </h3>
              <span className="text-xs text-slate-400 tabular-nums">
                · {top3CompletedCount}/{top3Tasks.length || 3} finished
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDimOthers((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{dimOthers ? 'Dimming other tasks' : 'All tasks full brightness'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/60 dark:divide-white/10">
            {[0, 1, 2].map((slotIdx) => {
              const t = top3Tasks[slotIdx];
              if (!t) {
                return (
                  <div
                    key={slotIdx}
                    className="p-4 flex flex-col justify-center items-start text-xs text-slate-400 dark:text-slate-500 min-h-[88px]"
                  >
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      Focus Slot {slotIdx + 1} open
                    </span>
                    <span className="mt-0.5">Click ★ on any task to pin here.</span>
                  </div>
                );
              }
              const done = t.status === 'done';
              const proj = t.projectId ? projectMap.get(t.projectId) : undefined;
              return (
                <div
                  key={t.id}
                  className="p-4 flex flex-col justify-between gap-2 min-h-[88px] hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleComplete(t.id)}
                      aria-label={`Toggle ${t.title}`}
                      className={`mt-0.5 w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 ${
                        done
                          ? 'accent-bg border-transparent'
                          : 'border-slate-300 dark:border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {done && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDetail(t.id)}
                      className={`text-left text-sm font-medium leading-snug ${
                        done
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {t.title}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pl-7">
                    <span className="truncate">
                      {proj ? proj.name : 'Inbox'} · {formatDuration(t.estimatedMinutes)}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {!done && (
                        <button
                          type="button"
                          onClick={() => onStartFocus(t.id)}
                          title="Focus One"
                          className="p-1 hover:text-slate-900 dark:hover:text-white rounded"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleTop3(t.id)}
                        title="Unpin from Focus 3"
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Workload Balance 7-Day Strip */}
      {showWorkload && (
        <section className="dashboard-workload-widget rounded-xl glass-panel p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-display text-xs font-semibold text-slate-700 dark:text-slate-200">
              7-Day Workload Balance
            </h3>
            <span className="text-[11px] text-slate-400">
              Goal: {settings.dailyGoal} tasks/day
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {workload.map((day) => (
              <div
                key={day.dateStr}
                className={`p-2 rounded-lg border text-center ${
                  day.status === 'overloaded'
                    ? 'border-red-300/70 dark:border-red-800/60 bg-red-500/10'
                    : day.status === 'balanced'
                    ? 'border-emerald-300/60 dark:border-emerald-800/50 bg-emerald-500/10'
                    : 'border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5'
                }`}
              >
                <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  {formatShortDate(day.dateStr)}
                </div>
                <div className="font-mono text-xs font-semibold tabular-nums mt-0.5">
                  {day.taskCount} · {formatDuration(day.totalMinutes)}
                </div>
                <div className="text-[10px] capitalize text-slate-500 dark:text-slate-400">
                  {day.status}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inline Quick Add */}
      <form
        onSubmit={handleInlineSubmit}
        className="dashboard-quick-add flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel focus-within:ring-2 focus-within:ring-indigo-500/40 transition-all"
      >
        <Plus className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={inlineInput}
          onChange={(e) => setInlineInput(e.target.value)}
        placeholder="Add a new task…"
          className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inlineInput.trim()}
          className="dashboard-add-button px-3 py-2 text-xs font-semibold rounded-lg accent-bg whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </form>

      {/* Time Available Mode + Energy + Smart Shortlist Toolbar */}
      {showTimeBar && (
        <div className="dashboard-time-toolbar flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="dashboard-filter-pills" role="group" aria-label="Filter dashboard tasks">
            {(
              [
                ['all', 'All'],
                ['today', 'Today'],
                ['upcoming', 'Upcoming'],
                ['important', 'Important'],
                ['completed', 'Completed'],
              ] as [DashboardTaskFilter, string][]
            ).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                aria-pressed={taskFilter === filter}
                className={`dashboard-filter-pill ${taskFilter === filter ? 'is-active' : ''}`}
                onClick={() => {
                  setTaskFilter(filter);
                  setTimeAvailable(null);
                }}
              >
                {label}<span>{filterCounts[filter]}</span>
              </button>
            ))}
          </div>
          <div className="dashboard-time-available glass-panel">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <select
              aria-label="Filter by time available"
              value={timeAvailable ?? ''}
              onChange={(e) => setTimeAvailable(e.target.value ? Number(e.target.value) : null)}
              className="dashboard-time-select"
            >
              <option value="">Any time</option>
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>

          <div className="dashboard-time-controls flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg glass-panel text-xs">
              <Zap className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={energyFilter}
                onChange={(e) => setEnergyFilter(e.target.value as EnergyLevel | 'all')}
                className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">All energy</option>
                <option value="low">Low effort</option>
                <option value="medium">Medium effort</option>
                <option value="high">High effort</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setSmartShortlistOn((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                smartShortlistOn
                  ? 'accent-soft-bg border-transparent'
                  : 'glass-panel text-slate-600 dark:text-slate-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Shortlist</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkMode((v) => !v);
                setSelectedIds([]);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                bulkMode
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                  : 'glass-panel text-slate-600 dark:text-slate-300'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Select</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Toolbar */}
      {bulkMode && selectedIds.length > 0 && (
        <div className="px-4 py-2.5 rounded-xl glass-panel flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-800 dark:text-slate-100 tabular-nums">
            {selectedIds.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'complete');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md accent-bg font-medium"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'tomorrow');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/15"
            >
              Snooze Tomorrow
            </button>
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'archive');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/15"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'trash');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md bg-red-600 text-white"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      <section className="dashboard-task-list rounded-xl glass-panel overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {timeAvailable !== null
              ? `Tasks fitting in ≤ ${timeAvailable} minutes`
              : smartShortlistOn
              ? 'Smart Priority Shortlist (rule-ranked)'
              : `${taskFilter[0].toUpperCase()}${taskFilter.slice(1)} tasks`}
          </span>
          <span className="tabular-nums">{visibleTasks.length} tasks</span>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {timeAvailable !== null
                ? `No unblocked tasks fit inside ${timeAvailable} minutes right now.`
                : 'Your Today list is clear.'}
            </p>
            <p className="text-xs text-slate-400">
              Use Quick Add above or adjust filters to see more tasks.
            </p>
          </div>
        ) : (
          <div>
            {visibleTasks.map((task) => {
              const isDimmed = dimOthers && hasFocus3Active && task.top3Date !== today;
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  compact
                  project={task.projectId ? projectMap.get(task.projectId) : undefined}
                  scoreInfo={scoredMap.get(task.id)}
                  showScoreReason={smartShortlistOn}
                  dimmed={isDimmed}
                  density={settings.density}
                  isSelected={selectedIds.includes(task.id)}
                  bulkMode={bulkMode}
                  activeTimerTaskId={activeTimerTaskId}
                  activeTimerElapsed={activeTimerElapsed}
                  draggable={!smartShortlistOn && timeAvailable === null}
                  onDragStart={(_, id) => setDraggedTaskId(id)}
                  onDrop={(_, targetId) => {
                    if (draggedTaskId && draggedTaskId !== targetId) {
                      onReorderTasks(draggedTaskId, targetId);
                    }
                    setDraggedTaskId(null);
                  }}
                  onToggleSelect={toggleSelect}
                  onToggleComplete={onToggleComplete}
                  onToggleTop3={onToggleTop3}
                  onToggleFavorite={onToggleFavorite}
                  onSnoozeTomorrow={onSnoozeTomorrow}
                  onOpenDetail={onOpenDetail}
                  onStartFocus={onStartFocus}
                  onToggleTimer={onToggleTimer}
                  onDuplicate={onDuplicate}
                  onArchive={onArchive}
                  onTrash={onTrash}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Daily Habits Strip */}
      {showHabits && habits.length > 0 && (
        <section className="dashboard-habits-widget rounded-xl glass-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Daily Habits
            </h3>
            <span className="text-xs text-slate-400 tabular-nums">
              {habits.filter((h) => h.completedDates.includes(today)).length}/{habits.length} done today
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {habits.map((habit) => {
              const checked = habit.completedDates.includes(today);
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => onToggleHabitDate(habit.id, today)}
                  className={`px-3 py-2.5 rounded-lg border text-left flex items-center gap-2.5 transition-colors ${
                    checked
                      ? 'border-emerald-300/70 dark:border-emerald-700/50 bg-emerald-500/15'
                      : 'border-slate-200/70 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      checked
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </span>
                  <span
                    className={`text-xs font-medium truncate ${
                      checked
                        ? 'text-emerald-900 dark:text-emerald-200'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {habit.title}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
