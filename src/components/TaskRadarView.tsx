import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Compass,
  Hourglass,
  Wand2,
} from 'lucide-react';
import { Project, Task } from '../types/todo';
import { diffDays, formatDuration, formatShortDate, getTodayStr } from '../utils/date';
import { analyzeTaskRadar } from '../utils/rulesEngine';

interface TaskRadarViewProps {
  tasks: Task[];
  projects: Project[];
  dailyGoal: number;
  onOpenDetail: (taskId: string) => void;
  onOpenReschedule: () => void;
}

export const TaskRadarView: React.FC<TaskRadarViewProps> = ({
  tasks,
  projects,
  dailyGoal,
  onOpenDetail,
  onOpenReschedule,
}) => {
  const today = getTodayStr();
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const radar = useMemo(() => analyzeTaskRadar(tasks, dailyGoal, today), [tasks, dailyGoal, today]);

  // Compute deterministic polar coordinates for visual Radar SVG
  const radarNodes = useMemo(() => {
    const active = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
    return active.slice(0, 32).map((task, idx) => {
      let radius = 128; // default outer ring
      let ringColor = '#64748b';
      if (task.dueDate) {
        const d = diffDays(today, task.dueDate);
        if (d < 0) {
          radius = 28;
          ringColor = '#dc2626';
        } else if (d <= 2) {
          radius = 62;
          ringColor = '#d97706';
        } else if (d <= 7) {
          radius = 96;
          ringColor = '#4f46e5';
        } else {
          radius = 128;
        }
      }
      // Deterministic angle from index & priority
      const angle = ((idx * 137.5) % 360) * (Math.PI / 180);
      const x = 160 + Math.cos(angle) * radius;
      const y = 160 + Math.sin(angle) * radius;
      return { task, x, y, ringColor };
    });
  }, [tasks, today]);

  const renderTaskMiniList = (
    list: Task[],
    emptyMsg: string,
    accentClass: string
  ) => {
    if (list.length === 0) {
      return <p className="text-xs text-slate-400 dark:text-slate-500 py-4">{emptyMsg}</p>;
    }
    return (
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {list.map((t) => {
          const proj = t.projectId ? projectMap.get(t.projectId) : undefined;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenDetail(t.id)}
              className="w-full py-2.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-1 rounded transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {t.title}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {proj ? proj.name : 'Inbox'} · {formatDuration(t.estimatedMinutes)} ·{' '}
                  <span className="capitalize">{t.priority}</span>
                </div>
              </div>
              <span className={`text-xs font-mono tabular-nums shrink-0 ${accentClass}`}>
                {formatShortDate(t.deadline || t.dueDate)}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Scan overdue risks, approaching deadlines, neglected work, and overloaded days at a glance.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenReschedule}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg accent-bg whitespace-nowrap shrink-0 self-start"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Run Reschedule Assistant</span>
        </button>
      </div>

      {/* Top Overview: Visual Radar SVG + Summary Counters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="rounded-xl glass-panel p-5 flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>Urgency Horizon</span>
            </span>
            <span className="text-[11px] text-slate-400">Click dot to inspect</span>
          </div>

          <svg viewBox="0 0 320 320" className="w-full max-w-[270px] h-auto">
            <circle cx="160" cy="160" r="135" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="3 3" />
            <circle cx="160" cy="160" r="98" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <circle cx="160" cy="160" r="64" fill="none" stroke="currentColor" className="text-amber-200 dark:text-amber-900/60" />
            <circle cx="160" cy="160" r="32" fill="none" stroke="currentColor" className="text-red-200 dark:text-red-900/60" />

            <line x1="160" y1="20" x2="160" y2="300" stroke="currentColor" className="text-slate-100 dark:text-slate-800/70" />
            <line x1="20" y1="160" x2="300" y2="160" stroke="currentColor" className="text-slate-100 dark:text-slate-800/70" />

            <text x="160" y="156" textAnchor="middle" className="fill-red-600 dark:fill-red-400 text-[9px] font-medium">
              Overdue
            </text>
            <text x="160" y="92" textAnchor="middle" className="fill-amber-600 dark:fill-amber-400 text-[9px]">
              48h
            </text>
            <text x="160" y="56" textAnchor="middle" className="fill-slate-400 text-[9px]">
              7d
            </text>

            {radarNodes.map(({ task, x, y, ringColor }) => (
              <g
                key={task.id}
                onClick={() => onOpenDetail(task.id)}
                className="cursor-pointer"
              >
                <title>{task.title}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={task.priority === 'urgent' ? 6.5 : task.priority === 'high' ? 5.5 : 4.5}
                  fill={ringColor}
                  className="hover:opacity-80 transition-opacity"
                />
              </g>
            ))}
          </svg>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-600" /> Overdue
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-600" /> ≤ 48h
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600" /> This Week
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-500" /> Later / Unscheduled
            </span>
          </div>
        </div>

        {/* 4 Signal Summary Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Overdue */}
          <div className="rounded-xl glass-panel p-4 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Overdue Tasks</span>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {radar.overdue.length}
              </span>
            </div>
            <div className="flex-1">
              {renderTaskMiniList(
                radar.overdue.slice(0, 5),
                'No overdue tasks — schedule is clean.',
                'text-red-600 dark:text-red-400'
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="rounded-xl glass-panel p-4 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                <CalendarClock className="w-4 h-4" />
                <span>Approaching Deadlines (72h)</span>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {radar.upcomingDeadlines.length}
              </span>
            </div>
            <div className="flex-1">
              {renderTaskMiniList(
                radar.upcomingDeadlines.slice(0, 5),
                'No critical deadlines within 72 hours.',
                'text-amber-600 dark:text-amber-400'
              )}
            </div>
          </div>

          {/* Neglected */}
          <div className="rounded-xl glass-panel p-4 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Hourglass className="w-4 h-4 text-slate-500" />
                <span>Neglected (7+ days idle)</span>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {radar.neglected.length}
              </span>
            </div>
            <div className="flex-1">
              {renderTaskMiniList(
                radar.neglected.slice(0, 5),
                'All active tasks have been touched recently.',
                'text-slate-500 dark:text-slate-400'
              )}
            </div>
          </div>

          {/* Heavy Workload Days */}
          <div className="rounded-xl glass-panel p-4 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Heavy Workload Days</span>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {radar.heavyDays.length}
              </span>
            </div>
            <div className="flex-1">
              {radar.heavyDays.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-4">
                  Workload across the next 14 days looks balanced.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {radar.heavyDays.map((day) => (
                    <div key={day.dateStr} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {formatShortDate(day.dateStr)}
                        </span>
                        <span className="text-slate-400 ml-1.5 font-mono">{day.dateStr}</span>
                      </div>
                      <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400 font-medium">
                        {day.count} tasks · {formatDuration(day.totalMinutes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
