import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Hourglass,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { CountdownItem, LifeCategory, Project, Task } from '../types/todo';
import {
  addDays,
  diffDays,
  formatDuration,
  formatFullDate,
  formatShortDate,
  getMonthCalendarDays,
  getTodayStr,
  parseDateStr,
  toDateStr,
} from '../utils/date';
import { exportTasksICS, parseTasksFromICS } from '../utils/exportImport';
import { detectTimeSlotConflicts } from '../utils/rulesEngine';

interface CalendarViewProps {
  tasks: Task[];
  projects: Project[];
  countdowns: CountdownItem[];
  defaultWorkspaceId: string;
  onToggleComplete: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onCreateTaskOnDate: (title: string, dateStr: string, timeStart?: string) => void;
  onImportTasks: (imported: Omit<Task, 'id' | 'order'>[], sourceLabel: string) => void;
  onAddCountdown: (title: string, targetDate: string, category: LifeCategory) => void;
  onDeleteCountdown: (id: string) => void;
  onNotify: (msg: string) => void;
}

type CalMode = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'agenda';
const WEEK_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  projects,
  countdowns,
  defaultWorkspaceId,
  onToggleComplete,
  onOpenDetail,
  onStartFocus,
  onCreateTaskOnDate,
  onImportTasks,
  onAddCountdown,
  onDeleteCountdown,
  onNotify,
}) => {
  const today = getTodayStr();
  const initial = new Date();
  const icsInputRef = useRef<HTMLInputElement | null>(null);

  const [calMode, setCalMode] = useState<CalMode>('monthly');
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTimeStart, setNewTimeStart] = useState('');

  // Countdown form
  const [cntTitle, setCntTitle] = useState('');
  const [cntDate, setCntDate] = useState(addDays(today, 14));
  const [cntCat, setCntCat] = useState<LifeCategory>('projects');

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const conflictIds = useMemo(() => detectTimeSlotConflicts(tasks), [tasks]);
  const cells = useMemo(() => getMonthCalendarDays(year, month), [year, month]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (t.status === 'archived' || t.status === 'trashed' || !t.dueDate) return;
      const list = map.get(t.dueDate) || [];
      list.push(t);
      map.set(t.dueDate, list);
    });
    return map;
  }, [tasks]);

  const selectedDayTasks = useMemo(() => {
    const list = tasksByDate.get(selectedDate) || [];
    return [...list].sort((a, b) => {
      if (a.timeSlot && b.timeSlot) return a.timeSlot.start.localeCompare(b.timeSlot.start);
      if (a.timeSlot) return -1;
      if (b.timeSlot) return 1;
      return a.order - b.order;
    });
  }, [tasksByDate, selectedDate]);

  const weekDates = useMemo(() => {
    const d = parseDateStr(selectedDate);
    const startOffset = -d.getDay();
    return Array.from({ length: 7 }, (_, i) => addDays(selectedDate, startOffset + i));
  }, [selectedDate]);

  const agendaDates = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(today, i))
      .map((dateStr) => ({ dateStr, items: tasksByDate.get(dateStr) || [] }))
      .filter((entry) => entry.items.length > 0);
  }, [today, tasksByDate]);

  const monthTitle =
    calMode === 'yearly'
      ? String(year)
      : new Date(year, month, 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });

  const shiftRange = (delta: number) => {
    if (calMode === 'yearly') {
      setYear((y) => y + delta);
    } else if (calMode === 'weekly') {
      const next = addDays(selectedDate, delta * 7);
      setSelectedDate(next);
      const parsed = parseDateStr(next);
      setYear(parsed.getFullYear());
      setMonth(parsed.getMonth());
    } else if (calMode === 'daily') {
      const next = addDays(selectedDate, delta);
      setSelectedDate(next);
      const parsed = parseDateStr(next);
      setYear(parsed.getFullYear());
      setMonth(parsed.getMonth());
    } else {
      const d = new Date(year, month + delta, 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  };

  const handleAddOnDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onCreateTaskOnDate(newTaskTitle.trim(), selectedDate, newTimeStart || undefined);
    setNewTaskTitle('');
    setNewTimeStart('');
  };

  const handleImportICS = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const imported = parseTasksFromICS(txt, defaultWorkspaceId);
      if (imported.length === 0) {
        onNotify('No VEVENT entries found in .ics file.');
      } else {
        onImportTasks(imported, 'ICS Calendar');
      }
    } catch {
      onNotify('Failed to parse .ics file.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {calMode === 'daily' ? formatFullDate(selectedDate) : monthTitle}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftRange(-1)}
              aria-label="Previous"
              className="p-1.5 rounded-lg glass-panel text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setYear(now.getFullYear());
                setMonth(now.getMonth());
                setSelectedDate(today);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-lg glass-panel text-slate-700 dark:text-slate-200"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftRange(1)}
              aria-label="Next"
              className="p-1.5 rounded-lg glass-panel text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded-lg glass-panel text-xs">
            {(
              [
                ['daily', 'Day'],
                ['weekly', 'Week'],
                ['monthly', 'Month'],
                ['yearly', 'Year'],
                ['agenda', 'Agenda'],
              ] as [CalMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setCalMode(m)}
                className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                  calMode === m ? 'accent-bg' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => icsInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg glass-panel text-slate-700 dark:text-slate-200"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import .ics</span>
          </button>
          <input
            ref={icsInputRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={handleImportICS}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => exportTasksICS(tasks)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg glass-panel text-slate-700 dark:text-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .ics</span>
          </button>
        </div>
      </div>

      {/* Conflict Alert Banner */}
      {conflictIds.size > 0 && (
        <div className="px-4 py-2.5 rounded-xl border border-amber-300/70 dark:border-amber-800/60 bg-amber-50/75 dark:bg-amber-950/30 backdrop-blur-md text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong className="tabular-nums">{conflictIds.size} tasks</strong> have overlapping time blocks on the calendar.
          </span>
        </div>
      )}

      {/* Main Split: Calendar View + Selected Day Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 rounded-xl glass-panel overflow-hidden">
          {calMode === 'monthly' && (
            <>
              <div className="grid grid-cols-7 border-b border-slate-200/60 dark:border-white/10 bg-white/40 dark:bg-white/5">
                {WEEK_HEADERS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-slate-200/60 dark:divide-white/10">
                {cells.map((cell) => {
                  const dayTasks = tasksByDate.get(cell.dateStr) || [];
                  const activeCount = dayTasks.filter((t) => t.status !== 'done').length;
                  const isToday = cell.dateStr === today;
                  const isSelected = cell.dateStr === selectedDate;
                  const hasConflict = dayTasks.some((t) => conflictIds.has(t.id));
                  const dayNum = Number(cell.dateStr.slice(8, 10));

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`min-h-[84px] sm:min-h-[96px] p-1.5 text-left flex flex-col justify-between transition-colors ${
                        !cell.inMonth
                          ? 'opacity-45 text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-100'
                      } ${
                        isSelected
                          ? 'ring-2 ring-inset ring-indigo-500 dark:ring-indigo-400 bg-indigo-500/10'
                          : 'hover:bg-white/50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${
                            isToday ? 'accent-bg font-semibold' : ''
                          }`}
                        >
                          {dayNum}
                        </span>
                        <div className="flex items-center gap-1">
                          {hasConflict && (
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          )}
                          {activeCount > 0 && (
                            <span className="text-[11px] font-mono tabular-nums text-slate-400">
                              {activeCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-0.5 w-full mt-1">
                        {dayTasks.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            className={`text-[11px] truncate leading-tight ${
                              t.status === 'done'
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : cell.dateStr < today
                                ? 'text-red-600 dark:text-red-400 font-medium'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {t.timeSlot ? `${t.timeSlot.start} ` : ''}
                            {t.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            +{dayTasks.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {calMode === 'weekly' && (
            <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 dark:divide-white/10 min-h-[380px]">
              {weekDates.map((dStr) => {
                const items = tasksByDate.get(dStr) || [];
                const isSelected = dStr === selectedDate;
                return (
                  <div
                    key={dStr}
                    onClick={() => setSelectedDate(dStr)}
                    className={`p-2.5 space-y-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/40 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-1.5">
                      <span
                        className={`text-xs font-medium ${
                          dStr === today ? 'accent-text font-semibold' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {formatShortDate(dStr)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {dStr.slice(8)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetail(t.id);
                          }}
                          className={`w-full text-left p-1.5 rounded-md border text-[11px] ${
                            conflictIds.has(t.id)
                              ? 'border-amber-400 bg-amber-500/10'
                              : 'border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5'
                          }`}
                        >
                          <div className={t.status === 'done' ? 'line-through text-slate-400' : 'font-medium truncate'}>
                            {t.title}
                          </div>
                          {t.timeSlot && (
                            <div className="font-mono text-[10px] text-slate-400">
                              {t.timeSlot.start}–{t.timeSlot.end}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calMode === 'daily' && (
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Hourly & Unslotted Agenda for {formatFullDate(selectedDate)}</span>
                <span className="font-mono tabular-nums">{selectedDayTasks.length} tasks</span>
              </div>
              {selectedDayTasks.length === 0 ? (
                <p className="py-12 text-center text-xs text-slate-400">
                  No tasks scheduled for this date. Use the schedule form on the right to add one.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                  {selectedDayTasks.map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-slate-500 w-24 shrink-0">
                          {t.timeSlot ? `${t.timeSlot.start}–${t.timeSlot.end}` : 'Anytime'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenDetail(t.id)}
                          className={`text-sm font-medium text-left truncate hover:underline ${
                            t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {t.title}
                        </button>
                        {conflictIds.has(t.id) && (
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                            · Conflict
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-400 shrink-0">
                        {formatDuration(t.estimatedMinutes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {calMode === 'yearly' && (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 12 }, (_, mIdx) => {
                const mName = new Date(year, mIdx, 1).toLocaleDateString('en-US', { month: 'short' });
                const prefix = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
                const count = tasks.filter(
                  (t) => t.dueDate?.startsWith(prefix) && t.status !== 'trashed' && t.status !== 'archived'
                ).length;
                return (
                  <button
                    key={mIdx}
                    type="button"
                    onClick={() => {
                      setMonth(mIdx);
                      setCalMode('monthly');
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      mIdx === month
                        ? 'accent-soft-bg border-transparent'
                        : 'border-slate-200/70 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="font-display text-sm font-semibold">{mName}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                      {count} scheduled
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {calMode === 'agenda' && (
            <div className="p-5 space-y-4 max-h-[540px] overflow-y-auto">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                14-Day Forward Agenda
              </div>
              {agendaDates.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">
                  No scheduled tasks over the next 14 days.
                </p>
              ) : (
                agendaDates.map(({ dateStr, items }) => (
                  <div key={dateStr} className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200/60 dark:border-white/10 pb-1 flex justify-between">
                      <span>{formatFullDate(dateStr)}</span>
                      <span className="font-mono text-slate-400">{items.length}</span>
                    </div>
                    {items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpenDetail(t.id)}
                        className="w-full py-1.5 px-2 rounded hover:bg-white/50 dark:hover:bg-white/5 flex items-center justify-between text-xs text-left"
                      >
                        <span className={t.status === 'done' ? 'line-through text-slate-400' : 'font-medium'}>
                          {t.timeSlot ? `${t.timeSlot.start} · ` : ''}
                          {t.title}
                        </span>
                        <span className="font-mono text-slate-400">{formatDuration(t.estimatedMinutes)}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected Day Schedule + Quick Schedule Panel */}
        <div className="space-y-5">
          <div className="rounded-xl glass-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200/60 dark:border-white/10">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Day Schedule</span>
              </div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {formatFullDate(selectedDate)}
              </h3>
            </div>

            <div className="divide-y divide-slate-200/60 dark:divide-white/10 max-h-[340px] overflow-y-auto">
              {selectedDayTasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  No tasks scheduled for this date.
                </div>
              ) : (
                selectedDayTasks.map((task) => {
                  const done = task.status === 'done';
                  const proj = task.projectId ? projectMap.get(task.projectId) : undefined;
                  const hasConflict = conflictIds.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className="px-4 py-3 flex items-start justify-between gap-2 hover:bg-white/40 dark:hover:bg-white/5"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => onToggleComplete(task.id)}
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            done
                              ? 'accent-bg border-transparent'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {done && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(task.id)}
                            className={`text-left text-sm font-medium leading-snug block truncate ${
                              done
                                ? 'line-through text-slate-400'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {task.title}
                          </button>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                            {task.timeSlot
                              ? `${task.timeSlot.start}–${task.timeSlot.end}`
                              : 'Anytime'}
                            {' · '}
                            {formatDuration(task.estimatedMinutes)}
                            {proj ? ` · ${proj.name}` : ''}
                            {hasConflict && (
                              <span className="text-amber-600 dark:text-amber-400"> · Overlap</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {!done && (
                        <button
                          type="button"
                          onClick={() => onStartFocus(task.id)}
                          title="Focus"
                          className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleAddOnDate}
              className="p-3 border-t border-slate-200/60 dark:border-white/10 bg-white/40 dark:bg-white/5 space-y-2"
            >
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={`Add task for ${selectedDate}...`}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <input
                  type="time"
                  value={newTimeStart}
                  onChange={(e) => setNewTimeStart(e.target.value)}
                  className="px-2 py-1 text-xs font-mono rounded border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
                />
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg accent-bg disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule</span>
                </button>
              </div>
            </form>
          </div>

          {/* Countdown Manager */}
          <div className="rounded-xl glass-panel p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
              <Hourglass className="w-3.5 h-3.5 accent-text" />
              <span>Deadline Countdowns</span>
            </div>

            <div className="space-y-2">
              {countdowns.map((c) => {
                const days = diffDays(today, c.targetDate);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/50 dark:border-white/10 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {c.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {toDateStr(parseDateStr(c.targetDate))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          days < 0
                            ? 'text-slate-400'
                            : days <= 3
                            ? 'text-red-600 dark:text-red-400'
                            : 'accent-text'
                        }`}
                      >
                        {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteCountdown(c.id)}
                        aria-label={`Delete countdown ${c.title}`}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {countdowns.length === 0 && (
                <p className="text-xs text-slate-400">No countdown milestones added yet.</p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!cntTitle.trim()) return;
                onAddCountdown(cntTitle.trim(), cntDate, cntCat);
                setCntTitle('');
              }}
              className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-white/10"
            >
              <input
                type="text"
                value={cntTitle}
                onChange={(e) => setCntTitle(e.target.value)}
                placeholder="Milestone or event countdown..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
              />
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={cntDate}
                  onChange={(e) => setCntDate(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
                />
                <select
                  value={cntCat}
                  onChange={(e) => setCntCat(e.target.value as LifeCategory)}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
                >
                  <option value="projects">Projects</option>
                  <option value="education">Education</option>
                  <option value="personal">Personal</option>
                  <option value="health">Health</option>
                </select>
                <button
                  type="submit"
                  disabled={!cntTitle.trim()}
                  className="px-3 py-1 text-xs font-medium rounded-lg accent-bg disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
