import React, { useMemo, useState } from 'react';
import { Bell, Clock, Moon, Sun, X } from 'lucide-react';
import { Task, UserSettings } from '../types/todo';
import { addDays, formatDuration, getTodayStr } from '../utils/date';

interface DailyBriefingModalProps {
  isOpen: boolean;
  tasks: Task[];
  settings: UserSettings;
  onClose: () => void;
  onOpenDetail: (taskId: string) => void;
  onSnoozeTask: (taskId: string, newDueDate: string) => void;
  onDismissReminder: (taskId: string, reminderId: string) => void;
  onSnoozeReminder: (taskId: string, reminderId: string, minutes: number) => void;
}

export const DailyBriefingModal: React.FC<DailyBriefingModalProps> = ({
  isOpen,
  tasks,
  settings,
  onClose,
  onOpenDetail,
  onSnoozeTask,
  onDismissReminder,
  onSnoozeReminder,
}) => {
  const [mode, setMode] = useState<'morning' | 'evening' | 'reminders'>(
    new Date().getHours() < 16 ? 'morning' : 'evening'
  );
  const today = getTodayStr();
  const tomorrow = addDays(today, 1);

  const active = useMemo(
    () => tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress'),
    [tasks]
  );

  const dueToday = useMemo(
    () => active.filter((t) => t.dueDate === today),
    [active, today]
  );

  const overdue = useMemo(
    () => active.filter((t) => t.dueDate && t.dueDate < today),
    [active, today]
  );

  const completedToday = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === 'done' && t.completedAt && t.completedAt.slice(0, 10) === today
      ),
    [tasks, today]
  );

  const dueTomorrow = useMemo(
    () => active.filter((t) => t.dueDate === tomorrow),
    [active, tomorrow]
  );

  const pendingReminders = useMemo(() => {
    const items: { task: Task; reminderId: string; triggerAt: string; fired: boolean }[] = [];
    active.forEach((task) => {
      (task.reminders || []).forEach((rem) => {
        items.push({ task, reminderId: rem.id, triggerAt: rem.triggerAt, fired: rem.fired });
      });
    });
    return items.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt));
  }, [active]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl glass-modal overflow-hidden flex flex-col max-h-[86vh]">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'morning' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : mode === 'evening' ? (
              <Moon className="w-4 h-4 accent-text" />
            ) : (
              <Bell className="w-4 h-4 accent-text" />
            )}
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Daily Summary & Reminder Center
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Daily Summary"
            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-2.5 border-b border-slate-200/70 dark:border-white/10 flex items-center gap-1.5">
          {(
            [
              ['morning', 'Morning Briefing'],
              ['evening', 'Evening Shutdown'],
              ['reminders', `Reminders (${pendingReminders.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`px-3 py-1 text-xs font-medium rounded-lg ${
                mode === key
                  ? 'accent-soft-bg'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {mode === 'morning' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl glass-panel">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Due Today</div>
                  <div className="font-display text-xl font-bold tabular-nums">{dueToday.length}</div>
                </div>
                <div className="p-3 rounded-xl glass-panel">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Est. Time</div>
                  <div className="font-display text-xl font-bold tabular-nums">
                    {formatDuration(dueToday.reduce((s, t) => s + t.estimatedMinutes, 0))}
                  </div>
                </div>
                <div className="p-3 rounded-xl glass-panel">
                  <div className="text-[11px] text-red-600 dark:text-red-400">Overdue</div>
                  <div className="font-display text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    {overdue.length}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Today&apos;s Agenda
                </h3>
                {dueToday.length === 0 ? (
                  <p className="text-xs text-slate-400">No tasks scheduled for today yet.</p>
                ) : (
                  <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                    {dueToday.map((t) => (
                      <div key={t.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenDetail(t.id);
                            onClose();
                          }}
                          className="text-left font-medium text-slate-800 dark:text-slate-100 hover:underline truncate"
                        >
                          {t.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSnoozeTask(t.id, tomorrow)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-white/15 text-slate-500 hover:text-slate-800 shrink-0"
                        >
                          Snooze Tomorrow
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {mode === 'evening' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl glass-panel">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Finished Today</div>
                  <div className="font-display text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {completedToday.length}/{settings.dailyGoal}
                  </div>
                </div>
                <div className="p-3 rounded-xl glass-panel">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Tomorrow Preview</div>
                  <div className="font-display text-xl font-bold tabular-nums">
                    {dueTomorrow.length} tasks
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Rollover Remaining Today Tasks
                </h3>
                {dueToday.length === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    All tasks scheduled for today are complete.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                    {dueToday.map((t) => (
                      <div key={t.id} className="py-2 flex items-center justify-between text-xs gap-2">
                        <span className="text-slate-800 dark:text-slate-100 truncate">{t.title}</span>
                        <button
                          type="button"
                          onClick={() => onSnoozeTask(t.id, tomorrow)}
                          className="px-2.5 py-1 rounded-md accent-bg shrink-0"
                        >
                          Move to Tomorrow
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {mode === 'reminders' && (
            <div className="space-y-2">
              {settings.quietHoursEnabled && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Quiet hours active: {settings.quietHoursStart} – {settings.quietHoursEnd}
                </p>
              )}
              {pendingReminders.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  No scheduled reminders on active tasks. Add multiple reminders inside any task drawer.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                  {pendingReminders.map((item) => (
                    <div
                      key={item.reminderId}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {item.task.title}
                        </div>
                        <div className="text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(item.triggerAt).toLocaleString()}</span>
                          {item.fired && <span>· Triggered</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSnoozeReminder(item.task.id, item.reminderId, 15)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-white/15"
                        >
                          +15m
                        </button>
                        <button
                          type="button"
                          onClick={() => onSnoozeReminder(item.task.id, item.reminderId, 60)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-white/15"
                        >
                          +1h
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismissReminder(item.task.id, item.reminderId)}
                          className="px-2 py-1 rounded text-red-600 dark:text-red-400"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
