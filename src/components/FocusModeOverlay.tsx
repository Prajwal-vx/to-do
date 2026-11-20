import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  X,
} from 'lucide-react';
import { Project, Task, UserSettings } from '../types/todo';
import { formatDuration, formatTimerSeconds } from '../utils/date';
import { playGentleChime } from '../utils/sound';

interface FocusModeOverlayProps {
  isOpen: boolean;
  task: Task | null;
  project?: Project;
  settings: UserSettings;
  onClose: () => void;
  onUpdateTask: (updated: Task) => void;
  onCompleteAndNext: (taskId: string, elapsedSeconds: number) => void;
  onSkipNext: () => void;
  onLogFocusSession: (
    taskId: string | null,
    taskTitle: string,
    durationSeconds: number,
    mode: 'pomodoro' | 'stopwatch' | 'custom'
  ) => void;
}

type TimerMode = 'pomodoro' | 'break' | 'stopwatch';

export const FocusModeOverlay: React.FC<FocusModeOverlayProps> = ({
  isOpen,
  task,
  project,
  settings,
  onClose,
  onUpdateTask,
  onCompleteAndNext,
  onSkipNext,
  onLogFocusSession,
}) => {
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [running, setRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(settings.pomodoroMinutes * 60);
  const [elapsedInSession, setElapsedInSession] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setRunning(false);
      return;
    }
    setElapsedInSession(0);
    if (mode === 'pomodoro') setRemainingSeconds(settings.pomodoroMinutes * 60);
    else if (mode === 'break') setRemainingSeconds(settings.shortBreakMinutes * 60);
    else setRemainingSeconds(0);
  }, [isOpen, mode, settings.pomodoroMinutes, settings.shortBreakMinutes, task?.id]);

  useEffect(() => {
    if (!running || !isOpen) return;
    const timer = window.setInterval(() => {
      setElapsedInSession((prev) => prev + 1);
      if (mode === 'stopwatch') {
        setRemainingSeconds((prev) => prev + 1);
      } else {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setRunning(false);
            playGentleChime(settings.soundEnabled);
            if (mode === 'pomodoro' && task) {
              onLogFocusSession(task.id, task.title, settings.pomodoroMinutes * 60, 'pomodoro');
            }
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, isOpen, mode, settings.soundEnabled, settings.pomodoroMinutes, task, onLogFocusSession]);

  if (!isOpen) return null;

  const handleExit = () => {
    if (elapsedInSession >= 15 && task && mode !== 'break') {
      onLogFocusSession(
        task.id,
        task.title,
        elapsedInSession,
        mode === 'pomodoro' ? 'pomodoro' : 'stopwatch'
      );
    }
    setRunning(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 workspace-shell flex flex-col">
      {/* Minimal Distraction-Free Top Strip */}
      <div className="h-14 px-6 glass-chrome border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>Focus Mode</span>
          {project && (
            <>
              <span>·</span>
              <span className="text-slate-800 dark:text-slate-200">{project.name}</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg glass-panel text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit Focus</span>
        </button>
      </div>

      {/* Centered Single-Task Workspace */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-6 py-10">
        {!task ? (
          <div className="max-w-md text-center space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              All active tasks are complete.
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Take a well-earned break or capture your next goal.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium rounded-lg accent-bg"
            >
              Return to Workspace
            </button>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-8">
            {/* Timer Mode Switch + Display */}
            <div className="text-center space-y-4">
              <div className="inline-flex p-1 rounded-lg glass-panel">
                {(
                  [
                    ['pomodoro', `Pomodoro (${settings.pomodoroMinutes}m)`],
                    ['break', `Break (${settings.shortBreakMinutes}m)`],
                    ['stopwatch', 'Stopwatch'],
                  ] as [TimerMode, string][]
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setRunning(false);
                      setMode(m);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      mode === m
                        ? 'accent-bg'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="font-mono text-6xl sm:text-7xl font-semibold text-slate-900 dark:text-white tabular-nums tracking-tight">
                {formatTimerSeconds(remainingSeconds)}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRunning((r) => !r)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg accent-bg"
                >
                  {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{running ? 'Pause' : 'Start Timer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setElapsedInSession(0);
                    setRemainingSeconds(
                      mode === 'pomodoro'
                        ? settings.pomodoroMinutes * 60
                        : mode === 'break'
                        ? settings.shortBreakMinutes * 60
                        : 0
                    );
                  }}
                  aria-label="Reset timer"
                  className="p-2.5 rounded-lg glass-panel text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Single Task Card */}
            <div className="rounded-2xl glass-panel p-6 space-y-5">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Est. {formatDuration(task.estimatedMinutes)} ·{' '}
                  <span className="capitalize">{task.priority}</span> priority ·{' '}
                  <span className="capitalize">{task.energy}</span> energy
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {task.title}
                </h2>
                {task.description && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>

              {task.subtasks.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Steps ({task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length})
                  </div>
                  {task.subtasks.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() =>
                        onUpdateTask({
                          ...task,
                          subtasks: task.subtasks.map((s) =>
                            s.id === sub.id ? { ...s, completed: !s.completed } : s
                          ),
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      className="w-full flex items-center gap-3 text-left py-1.5"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          sub.completed
                            ? 'accent-bg border-transparent'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {sub.completed && <Check className="w-3 h-3" />}
                      </span>
                      <span
                        className={`text-sm ${
                          sub.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {sub.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {task.links.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 text-xs">
                  {task.links.map((lnk) => (
                    <a
                      key={lnk.id}
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 accent-text hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{lnk.label}</span>
                    </a>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    onSkipNext();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Skip to Next</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    onCompleteAndNext(task.id, elapsedInSession);
                    setElapsedInSession(0);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete & Next Task</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
