import React, { useMemo } from 'react';
import { ArrowRight, Check, Wand2, X } from 'lucide-react';
import { RescheduleSuggestion, Task } from '../types/todo';
import { formatShortDate, getTodayStr } from '../utils/date';
import { generateRescheduleSuggestions } from '../utils/rulesEngine';

interface RescheduleModalProps {
  isOpen: boolean;
  tasks: Task[];
  dailyGoal: number;
  onClose: () => void;
  onApplySuggestion: (suggestion: RescheduleSuggestion) => void;
  onApplyAll: (suggestions: RescheduleSuggestion[]) => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  tasks,
  dailyGoal,
  onClose,
  onApplySuggestion,
  onApplyAll,
}) => {
  const today = getTodayStr();
  const suggestions = useMemo(
    () => (isOpen ? generateRescheduleSuggestions(tasks, dailyGoal, today) : []),
    [isOpen, tasks, dailyGoal, today]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl glass-modal rounded-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 accent-text" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Reschedule Assistant
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reschedule Assistant"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Transparent rule-based suggestions analyzing overdue tasks, overloaded days, and unscheduled idle work.
          </p>

          {suggestions.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Your schedule is balanced.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No overdue items, overloaded days, or neglected tasks require rescheduling right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-white/10 glass-panel rounded-xl overflow-hidden">
              {suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {sug.taskTitle}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">
                        {sug.currentDueDate ? formatShortDate(sug.currentDueDate) : 'Unscheduled'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="accent-text font-medium">
                        {formatShortDate(sug.suggestedDueDate)} ({sug.suggestedDueDate})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{sug.reason}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onApplySuggestion(sug)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200/80 dark:border-white/15 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-white/10 whitespace-nowrap shrink-0 self-start sm:self-center"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {suggestions.length} suggestions
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg"
            >
              Close
            </button>
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onApplyAll(suggestions);
                  onClose();
                }}
                className="px-4 py-1.5 text-xs font-medium rounded-lg accent-bg"
              >
                Apply All ({suggestions.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
