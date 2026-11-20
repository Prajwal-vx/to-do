import React, { useRef, useState } from 'react';
import {
  Archive,
  Bookmark,
  Check,
  Clock,
  Copy,
  Flag,
  GripVertical,
  Lock,
  MessageSquare,
  Moon,
  Play,
  Repeat,
  RotateCcw,
  Star,
  Trash2,
  Zap,
} from 'lucide-react';
import { EnergyLevel, Priority, Project, Task, TaskScore, ViewDensity } from '../types/todo';
import { formatDuration, formatShortDate, formatTimerSeconds, getTodayStr } from '../utils/date';
import { computeDeadlinePressure } from '../utils/rulesEngine';

interface TaskRowProps {
  task: Task;
  project?: Project;
  scoreInfo?: TaskScore;
  showScoreReason?: boolean;
  compact?: boolean;
  dimmed?: boolean;
  density: ViewDensity;
  isSelected: boolean;
  bulkMode: boolean;
  activeTimerTaskId: string | null;
  activeTimerElapsed: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragOver?: (e: React.DragEvent, taskId: string) => void;
  onDrop?: (e: React.DragEvent, targetTaskId: string) => void;
  onToggleSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleTop3: (taskId: string) => void;
  onToggleFavorite?: (taskId: string) => void;
  onSnoozeTomorrow?: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onToggleTimer: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onTrash: (taskId: string) => void;
  onRestore?: (taskId: string) => void;
  onDeleteForever?: (taskId: string) => void;
}

const PRIORITY_STYLES: Record<Priority, { color: string; label: string }> = {
  urgent: { color: 'text-red-600 dark:text-red-400', label: 'Urgent' },
  high: { color: 'text-amber-600 dark:text-amber-400', label: 'High' },
  medium: { color: 'text-sky-600 dark:text-sky-400', label: 'Medium' },
  low: { color: 'text-slate-400 dark:text-slate-500', label: 'Low' },
};

const ENERGY_LABELS: Record<EnergyLevel, string> = {
  low: 'Low energy',
  medium: 'Med energy',
  high: 'High energy',
};

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  project,
  scoreInfo,
  showScoreReason = false,
  compact = false,
  dimmed = false,
  density,
  isSelected,
  bulkMode,
  activeTimerTaskId,
  activeTimerElapsed,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onToggleSelect,
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
  onRestore,
  onDeleteForever,
}) => {
  const today = getTodayStr();
  const isDone = task.status === 'done';
  const isArchivedOrTrashed = task.status === 'archived' || task.status === 'trashed';
  const isTop3Today = task.top3Date === today;
  const isOverdue = !isDone && !isArchivedOrTrashed && task.dueDate && task.dueDate < today;
  const isTimerRunning = activeTimerTaskId === task.id;
  const subtasksTotal = task.subtasks.length;
  const subtasksDone = task.subtasks.filter((s) => s.completed).length;
  const subtaskPct = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;
  const pressure = computeDeadlinePressure(task, today);

  // Touch Swipe gestures (right = complete, left = snooze/delete)
  const touchStartX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isArchivedOrTrashed) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || isArchivedOrTrashed) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 10) {
      setSwipeOffset(Math.max(-110, Math.min(110, delta)));
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    if (swipeOffset > 75) {
      onToggleComplete(task.id);
    } else if (swipeOffset < -75) {
      if (onSnoozeTomorrow && !isDone) onSnoozeTomorrow(task.id);
      else onTrash(task.id);
    }
    touchStartX.current = null;
    setSwipeOffset(0);
  };

  const padY = density === 'compact' ? 'py-2' : 'py-3';

  return (
    <div
      className="dashboard-task-row relative overflow-hidden border-b border-slate-200/60 dark:border-white/10"
      data-compact={compact ? 'true' : undefined}
      data-priority={task.priority}
    >
      {/* Swipe Reveal Indicators */}
      {swipeOffset > 15 && (
        <div className="absolute inset-y-0 left-0 px-4 flex items-center text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 pointer-events-none">
          Complete
        </div>
      )}
      {swipeOffset < -15 && (
        <div className="absolute inset-y-0 right-0 px-4 flex items-center text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 pointer-events-none">
          {onSnoozeTomorrow && !isDone ? 'Snooze Tomorrow' : 'Delete'}
        </div>
      )}

      <div
        draggable={draggable && !isArchivedOrTrashed}
        onDragStart={(e) => onDragStart?.(e, task.id)}
        onDragOver={(e) => {
          if (draggable) e.preventDefault();
          onDragOver?.(e, task.id);
        }}
        onDrop={(e) => onDrop?.(e, task.id)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
        className={`group flex items-start gap-2.5 px-3 sm:px-4 ${padY} hover:bg-white/60 dark:hover:bg-white/5 transition-all ${
          isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
        } ${dimmed ? 'opacity-50 hover:opacity-100' : ''}`}
      >
        {draggable && !isArchivedOrTrashed && (
          <div
            className="mt-1 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0 hidden sm:block"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {bulkMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            aria-label={`Select ${task.title}`}
            className="mt-1.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 accent-indigo-600 shrink-0 cursor-pointer"
          />
        )}

        {!isArchivedOrTrashed && (
          <button
            type="button"
            onClick={() => onToggleComplete(task.id)}
            aria-label={isDone ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
            className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
              isDone
                ? 'accent-bg border-transparent'
                : task.priority === 'urgent'
                ? 'border-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                : task.priority === 'high'
                ? 'border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                : 'border-slate-300 dark:border-slate-600 hover:border-slate-500 dark:hover:border-slate-400'
            }`}
          >
            {isDone && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => onOpenDetail(task.id)}
              className={`text-left text-sm font-medium leading-snug hover:underline decoration-slate-300 dark:decoration-slate-600 underline-offset-2 ${
                isDone
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {task.title}
            </button>

            <div className="flex items-center gap-0.5 shrink-0">
              {isTimerRunning && (
                <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums mr-1">
                  {formatTimerSeconds(task.actualSeconds + activeTimerElapsed)}
                </span>
              )}

              {!isArchivedOrTrashed && !isDone && (
                <>
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(task.id)}
                      title={task.isFavorite ? 'Remove favorite' : 'Favorite task'}
                      aria-label="Toggle favorite"
                      className={`p-1.5 rounded-md transition-colors ${
                        task.isFavorite
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-indigo-600'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${task.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onToggleTop3(task.id)}
                    title={isTop3Today ? 'Remove from Focus 3' : 'Pin to Focus 3'}
                    aria-label={isTop3Today ? 'Remove from Focus 3' : 'Pin to Focus 3'}
                    className={`p-1.5 rounded-md transition-colors ${
                      isTop3Today
                        ? 'text-amber-500'
                        : 'text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-amber-500'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isTop3Today ? 'fill-amber-500' : ''}`} />
                  </button>

                  {onSnoozeTomorrow && (
                    <button
                      type="button"
                      onClick={() => onSnoozeTomorrow(task.id)}
                      title="Snooze until Tomorrow"
                      aria-label="Snooze until Tomorrow"
                      className="p-1.5 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-900 dark:hover:text-white"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onStartFocus(task.id)}
                    title="Enter Focus Mode"
                    aria-label="Enter Focus Mode"
                    className="p-1.5 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleTimer(task.id)}
                    title={isTimerRunning ? 'Pause timer' : 'Start timer'}
                    aria-label={isTimerRunning ? 'Pause timer' : 'Start timer'}
                    className={`p-1.5 rounded-md transition-colors ${
                      isTimerRunning
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {!isArchivedOrTrashed ? (
                <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onDuplicate(task.id)}
                    title="Duplicate task"
                    aria-label="Duplicate task"
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onArchive(task.id)}
                    title="Archive task"
                    aria-label="Archive task"
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onTrash(task.id)}
                    title="Move to Trash"
                    aria-label="Move to Trash"
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {onRestore && (
                    <button
                      type="button"
                      onClick={() => onRestore(task.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-white/10 rounded"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                  )}
                  {onDeleteForever && (
                    <button
                      type="button"
                      onClick={() => onDeleteForever(task.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            {project ? (
              <span className="task-meta-project inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span>{project.name}</span>
              </span>
            ) : (
              <span className="task-meta-project">Inbox</span>
            )}

            {task.dueDate && (
              <>
                <span className="task-meta-separator task-meta-separator-before-date" aria-hidden="true">·</span>
                <span
                  className={`task-meta-date tabular-nums ${
                    isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''
                  }`}
                >
                  {formatShortDate(task.dueDate)}
                  {task.timeSlot ? ` ${task.timeSlot.start}` : ''}
                </span>
              </>
            )}

            {pressure.level === 'critical' || pressure.level === 'high' ? (
              <>
                <span className="task-meta-separator" aria-hidden="true">·</span>
                <span
                  className={`task-meta-pressure font-mono tabular-nums ${
                    pressure.level === 'critical'
                      ? 'text-red-600 dark:text-red-400 font-medium'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  Pressure: {pressure.label}
                </span>
              </>
            ) : null}

            <span className="task-meta-separator" aria-hidden="true">·</span>
            <span className={`task-meta-priority inline-flex items-center gap-1 ${PRIORITY_STYLES[task.priority].color}`}>
              <Flag className="w-3 h-3" />
              <span>{PRIORITY_STYLES[task.priority].label}</span>
            </span>

            <span className="task-meta-separator" aria-hidden="true">·</span>
            <span className="task-meta-energy inline-flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>{ENERGY_LABELS[task.energy]}</span>
            </span>

            <span className="task-meta-separator" aria-hidden="true">·</span>
            <span className="task-meta-duration font-mono tabular-nums">{formatDuration(task.estimatedMinutes)}</span>

            {subtasksTotal > 0 && (
              <>
                <span className="task-meta-separator" aria-hidden="true">·</span>
                <span className="task-meta-subtasks tabular-nums">
                  {subtasksDone}/{subtasksTotal} steps
                </span>
              </>
            )}

            {task.comments.length > 0 && (
              <>
                <span className="task-meta-separator" aria-hidden="true">·</span>
                <span className="task-meta-extra inline-flex items-center gap-1 tabular-nums">
                  <MessageSquare className="w-3 h-3" />
                  <span>{task.comments.length}</span>
                </span>
              </>
            )}

            {task.recurrence.type !== 'none' && (
              <>
                <span className="task-meta-separator" aria-hidden="true">·</span>
                <span className="task-meta-extra inline-flex items-center gap-1 capitalize">
                  <Repeat className="w-3 h-3" />
                  <span>{task.recurrence.type}</span>
                </span>
              </>
            )}

            {scoreInfo?.blocked && (
              <>
                <span className="task-meta-separator" aria-hidden="true">·</span>
                <span
                  className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"
                  title={`Blocked by: ${scoreInfo.blockedByTitles.join(', ')}`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Blocked</span>
                </span>
              </>
            )}

            {task.tags.length > 0 && (
              <>
                <span className="task-meta-separator" aria-hidden="true">·</span>
                <span className="task-meta-tags text-slate-500 dark:text-slate-400">
                  {task.tags.map((t) => `@${t}`).join(' ')}
                </span>
              </>
            )}
          </div>

          {compact && task.description && (
            <p className="task-compact-description mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {task.description}
            </p>
          )}

          {/* Subtask Progress Bar */}
          {subtasksTotal > 0 && (
            <div className="task-subtask-progress mt-1.5 flex items-center gap-2 max-w-xs">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full accent-bg transition-all"
                  style={{ width: `${subtaskPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono tabular-nums text-slate-400">
                {subtaskPct}%
              </span>
            </div>
          )}

          {showScoreReason && scoreInfo && (
            <div className="task-score-reasons mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2">
              <span className="font-mono font-medium accent-text tabular-nums">
                {scoreInfo.score} pts
              </span>
              <span aria-hidden="true">—</span>
              <span>
                {scoreInfo.reasons
                  .map((r) => `${r.label} (${r.points > 0 ? `+${r.points}` : r.points})`)
                  .join(' · ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
