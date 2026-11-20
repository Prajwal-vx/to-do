import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Check, Play } from 'lucide-react';
import { EnergyLevel, LifeCategory, Priority, Project, Task, TaskStatus } from '../types/todo';
import { formatDuration, getTodayStr } from '../utils/date';
import { computeDeadlinePressure } from '../utils/rulesEngine';

interface TableViewProps {
  tasks: Task[];
  projects: Project[];
  searchQuery: string;
  onUpdateTask: (updated: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
}

type TableSortField = 'title' | 'priority' | 'dueDate' | 'estimatedMinutes' | 'status';

const PRIORITY_VAL: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export const TableView: React.FC<TableViewProps> = ({
  tasks,
  projects,
  searchQuery,
  onUpdateTask,
  onToggleComplete,
  onOpenDetail,
  onStartFocus,
}) => {
  const today = getTodayStr();
  const [sortField, setSortField] = useState<TableSortField>('dueDate');
  const [sortAsc, setSortAsc] = useState(true);
  const [includeDone, setIncludeDone] = useState(false);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = tasks.filter((t) => {
      if (t.status === 'archived' || t.status === 'trashed') return false;
      if (!includeDone && t.status === 'done') return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.tags.some((tg) => tg.includes(q))) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'priority') cmp = PRIORITY_VAL[a.priority] - PRIORITY_VAL[b.priority];
      else if (sortField === 'estimatedMinutes') cmp = a.estimatedMinutes - b.estimatedMinutes;
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else {
        const da = a.dueDate || '9999-12-31';
        const db = b.dueDate || '9999-12-31';
        cmp = da.localeCompare(db);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [tasks, searchQuery, includeDone, sortField, sortAsc]);

  const handleSort = (field: TableSortField) => {
    if (sortField === field) setSortAsc((v) => !v);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          High-density spreadsheet view with inline status, priority, energy, and date editing.
        </p>
        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => setIncludeDone(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600"
          />
          <span>Show completed</span>
        </label>
      </div>

      <div className="rounded-xl glass-panel overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[860px]">
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-3 w-8" />
              <th className="py-2.5 px-3 font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('title')}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Task</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium">Project</th>
              <th className="py-2.5 px-3 font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('status')}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Status</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('priority')}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Priority</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium">Energy</th>
              <th className="py-2.5 px-3 font-medium">Life Area</th>
              <th className="py-2.5 px-3 font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('dueDate')}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Due Date</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium text-right">
                <button
                  type="button"
                  onClick={() => handleSort('estimatedMinutes')}
                  className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                >
                  <span>Est / Actual</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium">Pressure</th>
              <th className="py-2.5 px-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((t) => {
              const proj = t.projectId ? projectMap.get(t.projectId) : undefined;
              const pressure = computeDeadlinePressure(t, today);
              const done = t.status === 'done';
              return (
                <tr
                  key={t.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2 px-3">
                    <button
                      type="button"
                      onClick={() => onToggleComplete(t.id)}
                      aria-label={`Toggle ${t.title}`}
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        done
                          ? 'accent-bg border-transparent'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {done && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </button>
                  </td>
                  <td className="py-2 px-3 max-w-[260px]">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(t.id)}
                      className={`text-left font-medium hover:underline truncate block w-full ${
                        done
                          ? 'line-through text-slate-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {t.title}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {proj ? proj.name : 'Inbox'}
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={t.status}
                      onChange={(e) =>
                        onUpdateTask({
                          ...t,
                          status: e.target.value as TaskStatus,
                          completedAt:
                            e.target.value === 'done' ? new Date().toISOString() : null,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                      <option value="parking_lot">Parking Lot</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={t.priority}
                      onChange={(e) =>
                        onUpdateTask({
                          ...t,
                          priority: e.target.value as Priority,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none capitalize"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={t.energy}
                      onChange={(e) =>
                        onUpdateTask({
                          ...t,
                          energy: e.target.value as EnergyLevel,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none capitalize"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={t.lifeCategory}
                      onChange={(e) =>
                        onUpdateTask({
                          ...t,
                          lifeCategory: e.target.value as LifeCategory,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none capitalize"
                    >
                      <option value="projects">Projects</option>
                      <option value="education">Education</option>
                      <option value="personal">Personal</option>
                      <option value="health">Health</option>
                      <option value="responsibilities">Responsibilities</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 font-mono tabular-nums">
                    <input
                      type="date"
                      value={t.dueDate || ''}
                      onChange={(e) =>
                        onUpdateTask({
                          ...t,
                          dueDate: e.target.value || null,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {formatDuration(t.estimatedMinutes)} / {Math.round(t.actualSeconds / 60)}m
                  </td>
                  <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                    {pressure.level !== 'none' && (
                      <span
                        className={
                          pressure.level === 'critical'
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : pressure.level === 'high'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400'
                        }
                      >
                        {pressure.label}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {!done && (
                      <button
                        type="button"
                        onClick={() => onStartFocus(t.id)}
                        title="Focus One"
                        className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
