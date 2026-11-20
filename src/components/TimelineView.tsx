import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Project, Task } from '../types/todo';
import { addDays, formatDuration, formatShortDate, getTodayStr } from '../utils/date';

interface TimelineViewProps {
  tasks: Task[];
  projects: Project[];
  onOpenDetail: (taskId: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  tasks,
  projects,
  onOpenDetail,
}) => {
  const today = getTodayStr();
  const [startOffset, setStartOffset] = useState(-2);
  const daysCount = 14;

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const columns = useMemo(
    () => Array.from({ length: daysCount }, (_, i) => addDays(today, startOffset + i)),
    [today, startOffset]
  );

  const scheduledTasks = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.status !== 'archived' &&
            t.status !== 'trashed' &&
            (t.startDate || t.dueDate || t.deadline)
        )
        .sort((a, b) => (a.startDate || a.dueDate || '').localeCompare(b.startDate || b.dueDate || '')),
    [tasks]
  );

  const firstCol = columns[0];
  const lastCol = columns[columns.length - 1];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          14-day schedule timeline displaying start-to-due spans and time commitments.
        </p>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStartOffset((v) => v - 7)}
            className="p-1.5 rounded-lg glass-panel"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setStartOffset(-2)}
            className="px-3 py-1 text-xs font-medium rounded-lg glass-panel"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setStartOffset((v) => v + 7)}
            className="p-1.5 rounded-lg glass-panel"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl glass-panel overflow-x-auto">
        <div className="min-w-[960px]">
          {/* Timeline Header */}
          <div className="grid grid-cols-[240px_1fr] border-b border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5">
            <div className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border-r border-slate-200/70 dark:border-white/10">
              Scheduled Task
            </div>
            <div className="grid grid-cols-14 divide-x divide-slate-200/60 dark:divide-white/10">
              {columns.map((d) => (
                <div
                  key={d}
                  className={`py-2 text-center text-[11px] font-mono tabular-nums ${
                    d === today
                      ? 'accent-soft-bg font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {d.slice(5)}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {scheduledTasks.map((task) => {
              const spanStart = task.startDate || task.dueDate || task.deadline!;
              const spanEnd = task.deadline || task.dueDate || spanStart;
              const proj = task.projectId ? projectMap.get(task.projectId) : undefined;

              const startIdx = Math.max(
                0,
                columns.findIndex((c) => c >= spanStart)
              );
              const endIdxRaw = columns.findIndex((c) => c >= spanEnd);
              const endIdx = endIdxRaw === -1 ? daysCount - 1 : Math.max(startIdx, endIdxRaw);

              const inWindow = !(spanEnd < firstCol || spanStart > lastCol);

              return (
                <div
                  key={task.id}
                  className="grid grid-cols-[240px_1fr] items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                >
                  <button
                    type="button"
                    onClick={() => onOpenDetail(task.id)}
                    className="px-4 py-2.5 text-left border-r border-slate-200 dark:border-slate-800 min-w-0"
                  >
                    <div
                      className={`text-xs font-medium truncate ${
                        task.status === 'done'
                          ? 'line-through text-slate-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {proj ? proj.name : 'Inbox'} · {formatDuration(task.estimatedMinutes)}
                    </div>
                  </button>

                  <div className="grid grid-cols-14 h-full items-center relative py-2 px-0.5">
                    {inWindow && (
                      <button
                        type="button"
                        onClick={() => onOpenDetail(task.id)}
                        style={{
                          gridColumn: `${startIdx + 1} / ${endIdx + 2}`,
                          backgroundColor: proj?.color || 'var(--accent)',
                        }}
                        className={`h-6 rounded-md px-2 text-[11px] font-medium text-white truncate text-left shadow-xs hover:opacity-90 ${
                          task.status === 'done' ? 'opacity-45' : ''
                        }`}
                        title={`${task.title} (${formatShortDate(spanStart)} → ${formatShortDate(spanEnd)})`}
                      >
                        {task.title}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {scheduledTasks.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                No scheduled tasks with start or due dates yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
