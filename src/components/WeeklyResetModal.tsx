import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { Task, UserSettings } from '../types/todo';
import { addDays, formatShortDate, getTodayStr } from '../utils/date';

interface WeeklyResetModalProps {
  isOpen: boolean;
  tasks: Task[];
  settings: UserSettings;
  onClose: () => void;
  onRescheduleTask: (taskId: string, dueDate: string | null) => void;
  onPromoteFromParkingLot: (taskId: string, dueDate: string) => void;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
}

export const WeeklyResetModal: React.FC<WeeklyResetModalProps> = ({
  isOpen,
  tasks,
  settings,
  onClose,
  onRescheduleTask,
  onPromoteFromParkingLot,
  onUpdateSettings,
}) => {
  const [step, setStep] = useState(0);
  const today = getTodayStr();
  const weekAgo = addDays(today, -7);
  const nextWeekEnd = addDays(today, 7);

  const completedWeek = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.completedAt &&
          t.completedAt.slice(0, 10) >= weekAgo &&
          t.status !== 'trashed'
      ),
    [tasks, weekAgo]
  );

  const unfinishedOverdue = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.status === 'todo' || t.status === 'in_progress') &&
          t.dueDate &&
          t.dueDate < today
      ),
    [tasks, today]
  );

  const parkingLotItems = useMemo(
    () => tasks.filter((t) => t.status === 'parking_lot'),
    [tasks]
  );

  const upcomingWeek = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.status === 'todo' || t.status === 'in_progress') &&
          t.dueDate &&
          t.dueDate >= today &&
          t.dueDate <= nextWeekEnd
      ),
    [tasks, today, nextWeekEnd]
  );

  if (!isOpen) return null;

  const steps = [
    '1. Celebrate Wins',
    '2. Clear Unfinished',
    '3. Review Parking Lot',
    '4. Next Week Targets',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl glass-modal overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 accent-text" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Weekly Reset Ritual
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Weekly Reset"
            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-2.5 border-b border-slate-200/70 dark:border-white/10 flex items-center gap-2 overflow-x-auto">
          {steps.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(idx)}
              className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                step === idx
                  ? 'accent-soft-bg'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl glass-panel">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Completed in last 7 days
                </div>
                <div className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {completedWeek.length} tasks finished
                </div>
              </div>
              <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                {completedWeek.slice(0, 10).map((t) => (
                  <div key={t.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{t.title}</span>
                    </span>
                    <span className="font-mono text-slate-400">
                      {t.completedAt?.slice(0, 10)}
                    </span>
                  </div>
                ))}
                {completedWeek.length === 0 && (
                  <p className="text-xs text-slate-400 py-4">
                    No tasks completed in the last 7 days yet. Every small step counts!
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Give unfinished overdue items a realistic new home or unschedule them.
              </p>
              {unfinishedOverdue.length === 0 ? (
                <div className="py-8 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Zero overdue tasks remaining.
                </div>
              ) : (
                <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                  {unfinishedOverdue.map((t) => (
                    <div
                      key={t.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {t.title}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400 font-mono">
                          Was due {formatShortDate(t.dueDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onRescheduleTask(t.id, today)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md accent-bg"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => onRescheduleTask(t.id, addDays(today, 2))}
                          className="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200"
                        >
                          +2 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => onRescheduleTask(t.id, null)}
                          className="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-white/15 text-slate-500"
                        >
                          Unschedule
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Promote any Parking Lot idea into active work for this coming week.
              </p>
              {parkingLotItems.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Your Parking Lot is empty.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                  {parkingLotItems.map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {t.title}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{t.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPromoteFromParkingLot(t.id, addDays(today, 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/10 shrink-0"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Activate Tomorrow</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl glass-panel space-y-1.5">
                  <label className="block text-xs text-slate-500 dark:text-slate-400">
                    Weekly Task Goal
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.weeklyGoal}
                    onChange={(e) =>
                      onUpdateSettings({ weeklyGoal: Math.max(1, Number(e.target.value) || 15) })
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/60"
                  />
                </div>
                <div className="p-4 rounded-xl glass-panel">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Scheduled Next 7 Days
                  </div>
                  <div className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                    {upcomingWeek.length} tasks
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Upcoming commitments ready:
              </div>
              <div className="divide-y divide-slate-200/60 dark:divide-white/10 max-h-44 overflow-y-auto">
                {upcomingWeek.slice(0, 8).map((t) => (
                  <div key={t.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-800 dark:text-slate-100 truncate">{t.title}</span>
                    <span className="font-mono text-slate-400 shrink-0">
                      {formatShortDate(t.dueDate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-lg accent-bg"
            >
              <span>Next Step</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium rounded-lg accent-bg"
            >
              Finish Weekly Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
