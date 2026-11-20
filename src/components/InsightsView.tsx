import React, { useMemo, useState } from 'react';
import { Activity, Award, Check, Flame, Plus, Target, Timer, Trash2 } from 'lucide-react';
import { FocusSession, Habit, LifeCategory, Project, Task, UserSettings } from '../types/todo';
import {
  addDays,
  formatDuration,
  formatShortDate,
  formatTimerSeconds,
  getLastNDates,
  getTodayStr,
} from '../utils/date';
import { computePersonalProductivityScore, computeStreakStats } from '../utils/rulesEngine';

interface InsightsViewProps {
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  focusSessions: FocusSession[];
  settings: UserSettings;
  onToggleHabitDate: (habitId: string, dateStr: string) => void;
  onCreateHabit: (title: string, targetPerWeek: number) => void;
  onDeleteHabit: (habitId: string) => void;
  onOpenDetail: (taskId: string) => void;
}

type ReportRange = 'daily' | 'weekly' | 'monthly';

const LIFE_AREA_LABELS: { key: LifeCategory; label: string; color: string }[] = [
  { key: 'projects', label: 'Projects & Work', color: '#4f46e5' },
  { key: 'education', label: 'Education & Study', color: '#0284c7' },
  { key: 'personal', label: 'Personal Life', color: '#8b5cf6' },
  { key: 'health', label: 'Health & Vitality', color: '#059669' },
  { key: 'responsibilities', label: 'Responsibilities', color: '#d97706' },
];

export const InsightsView: React.FC<InsightsViewProps> = ({
  tasks,
  projects,
  habits,
  focusSessions,
  settings,
  onToggleHabitDate,
  onCreateHabit,
  onDeleteHabit,
  onOpenDetail,
}) => {
  const today = getTodayStr();
  const [range, setRange] = useState<ReportRange>('daily');
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitTarget, setNewHabitTarget] = useState(5);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const streak = useMemo(() => computeStreakStats(tasks, today), [tasks, today]);
  const prodScore = useMemo(
    () => computePersonalProductivityScore(tasks, focusSessions, habits, settings, today),
    [tasks, focusSessions, habits, settings, today]
  );
  const last7Days = useMemo(() => getLastNDates(7, today), [today]);

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.completedAt && t.status !== 'trashed')
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    [tasks]
  );

  const totalFocusSeconds = useMemo(
    () => focusSessions.reduce((sum, s) => sum + s.durationSeconds, 0),
    [focusSessions]
  );

  // Weekly & Monthly goal progress
  const currentMonthPrefix = today.slice(0, 7);
  const completedThisMonth = useMemo(
    () => completedTasks.filter((t) => t.completedAt?.startsWith(currentMonthPrefix)).length,
    [completedTasks, currentMonthPrefix]
  );

  // Estimated vs. Actual comparison
  const estimationStats = useMemo(() => {
    const tracked = completedTasks.filter((t) => t.actualSeconds > 0 && t.estimatedMinutes > 0);
    const estTotalMin = tracked.reduce((s, t) => s + t.estimatedMinutes, 0);
    const actualTotalMin = Math.round(
      tracked.reduce((s, t) => s + t.actualSeconds, 0) / 60
    );
    return { count: tracked.length, estTotalMin, actualTotalMin };
  }, [completedTasks]);

  // Life Balance distribution
  const lifeBalance = useMemo(() => {
    const nonTrashed = tasks.filter((t) => t.status !== 'trashed');
    const maxCount = Math.max(
      1,
      ...LIFE_AREA_LABELS.map(
        (area) => nonTrashed.filter((t) => t.lifeCategory === area.key).length
      )
    );
    return LIFE_AREA_LABELS.map((area) => {
      const items = nonTrashed.filter((t) => t.lifeCategory === area.key);
      const done = items.filter((t) => t.status === 'done').length;
      return {
        ...area,
        total: items.length,
        done,
        barPct: Math.round((items.length / maxCount) * 100),
      };
    });
  }, [tasks]);

  // Chart buckets
  const chartBuckets = useMemo(() => {
    if (range === 'daily') {
      return getLastNDates(10, today).map((d) => {
        const count = completedTasks.filter((t) => t.completedAt?.slice(0, 10) === d).length;
        const focusMin = Math.round(
          focusSessions
            .filter((s) => s.completedAt.slice(0, 10) === d)
            .reduce((sum, s) => sum + s.durationSeconds, 0) / 60
        );
        return { key: d, label: d.slice(5), count, focusMin };
      });
    }

    if (range === 'weekly') {
      return Array.from({ length: 6 }, (_, idx) => {
        const end = addDays(today, -(5 - idx) * 7);
        const start = addDays(end, -6);
        const count = completedTasks.filter((t) => {
          const d = t.completedAt?.slice(0, 10) || '';
          return d >= start && d <= end;
        }).length;
        const focusMin = Math.round(
          focusSessions
            .filter((s) => {
              const d = s.completedAt.slice(0, 10);
              return d >= start && d <= end;
            })
            .reduce((sum, s) => sum + s.durationSeconds, 0) / 60
        );
        return { key: start, label: start.slice(5), count, focusMin };
      });
    }

    const now = new Date();
    return Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const count = completedTasks.filter((t) => t.completedAt?.startsWith(prefix)).length;
      const focusMin = Math.round(
        focusSessions
          .filter((s) => s.completedAt.startsWith(prefix))
          .reduce((sum, s) => sum + s.durationSeconds, 0) / 60
      );
      return { key: prefix, label, count, focusMin };
    });
  }, [range, today, completedTasks, focusSessions]);

  const maxChartCount = Math.max(1, ...chartBuckets.map((b) => b.count));

  const timelineGroups = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; focus: FocusSession[] }>();
    completedTasks.forEach((t) => {
      const dateStr = t.completedAt!.slice(0, 10);
      const entry = map.get(dateStr) || { tasks: [], focus: [] };
      entry.tasks.push(t);
      map.set(dateStr, entry);
    });
    focusSessions.forEach((s) => {
      const dateStr = s.completedAt.slice(0, 10);
      const entry = map.get(dateStr) || { tasks: [], focus: [] };
      entry.focus.push(s);
      map.set(dateStr, entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14);
  }, [completedTasks, focusSessions]);

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitTitle.trim()) return;
    onCreateHabit(newHabitTitle.trim(), newHabitTarget);
    setNewHabitTitle('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl glass-panel">
          <div className="text-xs text-slate-500 dark:text-slate-400">Momentum Streak</div>
          <div className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1 flex items-center gap-2">
            <span>{streak.currentMomentumStreak} days</span>
            <Flame className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-xs text-slate-400 mt-1">Rest days never erase progress</div>
        </div>

        <div className="p-4 rounded-xl glass-panel">
          <div className="text-xs text-slate-500 dark:text-slate-400">Weekly Goal</div>
          <div className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {streak.completedThisWeek}/{settings.weeklyGoal}
          </div>
          <div className="text-xs text-slate-400 mt-1 tabular-nums">
            Active {streak.activeDaysThisWeek}/7 days
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel">
          <div className="text-xs text-slate-500 dark:text-slate-400">Monthly Goal</div>
          <div className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {completedThisMonth}/{settings.monthlyGoal}
          </div>
          <div className="text-xs text-slate-400 mt-1 tabular-nums">
            {Math.min(100, Math.round((completedThisMonth / Math.max(1, settings.monthlyGoal)) * 100))}% attained
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Focus Time</div>
          <div className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {formatDuration(Math.round(totalFocusSeconds / 60))}
          </div>
          <div className="text-xs text-slate-400 mt-1 tabular-nums">
            {focusSessions.length} logged sessions
          </div>
        </div>
      </div>

      {/* Personal Productivity Score & Life Balance Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 accent-text" />
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Personal Productivity Score
              </h3>
            </div>
            <span className="font-display text-2xl font-bold accent-text tabular-nums">
              {prodScore.totalScore}/100
            </span>
          </div>

          <div className="space-y-3">
            {prodScore.components.map((comp) => (
              <div key={comp.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {comp.label}
                  </span>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {comp.score}/{comp.max} · {comp.detail}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full accent-bg"
                    style={{ width: `${Math.round((comp.score / comp.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 accent-text" />
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Life Balance Dashboard
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Timer className="w-3.5 h-3.5" />
              <span>
                Est vs. Actual:{' '}
                <strong className="font-mono text-slate-800 dark:text-slate-100">
                  {formatDuration(estimationStats.estTotalMin)} / {formatDuration(estimationStats.actualTotalMin)}
                </strong>
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {lifeBalance.map((area) => (
              <div key={area.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {area.label}
                  </span>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {area.done}/{area.total} done
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${area.barPct}%`, backgroundColor: area.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Productivity Chart + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 rounded-xl glass-panel p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Completion Output
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks completed and focus minutes recorded across time.
              </p>
            </div>
            <div className="inline-flex p-0.5 rounded-lg glass-panel self-start">
              {(
                [
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly'],
                  ['monthly', 'Monthly'],
                ] as [ReportRange, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                    range === key ? 'accent-bg' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-52 flex items-end gap-2 sm:gap-3 pt-4">
            {chartBuckets.map((bucket) => {
              const pct = Math.round((bucket.count / maxChartCount) * 100);
              return (
                <div
                  key={bucket.key}
                  className="flex-1 flex flex-col items-center justify-end h-full gap-1.5"
                >
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {bucket.count}
                  </span>
                  <div className="w-full max-w-[36px] flex-1 flex items-end bg-slate-200/60 dark:bg-white/10 rounded-md overflow-hidden">
                    <div
                      className="w-full accent-bg rounded-t-md transition-all"
                      style={{ height: `${Math.max(bucket.count > 0 ? 8 : 0, pct)}%` }}
                      title={`${bucket.label}: ${bucket.count} tasks, ${bucket.focusMin}m focus`}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 truncate max-w-full">
                    {bucket.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl glass-panel p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Milestones Celebrated
              </h3>
            </div>

            {streak.milestonesUnlocked.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete your first task to unlock your initial milestone.
              </p>
            ) : (
              <div className="space-y-2">
                {streak.milestonesUnlocked.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/50 dark:border-white/10 last:border-0"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {m.label}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">{m.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {streak.nextMilestone && (
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Next: {streak.nextMilestone.label}
                </span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                  {streak.nextMilestone.current}/{streak.nextMilestone.target}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full accent-bg transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (streak.nextMilestone.current / streak.nextMilestone.target) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Habit Tracker Grid */}
      <section className="rounded-xl glass-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Habit Consistency Tracker
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track daily rituals over the rolling 7-day window without streak anxiety.
            </p>
          </div>
          <form onSubmit={handleAddHabit} className="flex items-center gap-2">
            <input
              type="text"
              value={newHabitTitle}
              onChange={(e) => setNewHabitTitle(e.target.value)}
              placeholder="New habit..."
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
            />
            <select
              value={newHabitTarget}
              onChange={(e) => setNewHabitTarget(Number(e.target.value))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
            >
              {[3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}d/wk
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newHabitTitle.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg accent-bg disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4 font-medium">Habit</th>
                {last7Days.map((d) => (
                  <th key={d} className="py-2 px-2 text-center font-mono tabular-nums font-medium">
                    {d.slice(5)}
                  </th>
                ))}
                <th className="py-2 pl-4 text-right font-medium">Weekly Goal</th>
                <th className="py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-white/10">
              {habits.map((habit) => {
                const weekCount = last7Days.filter((d) => habit.completedDates.includes(d)).length;
                return (
                  <tr key={habit.id} className="hover:bg-white/40 dark:hover:bg-white/5">
                    <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-100">
                      {habit.title}
                    </td>
                    {last7Days.map((d) => {
                      const done = habit.completedDates.includes(d);
                      return (
                        <td key={d} className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => onToggleHabitDate(habit.id, d)}
                            aria-label={`${habit.title} on ${d}`}
                            className={`w-6 h-6 rounded-md inline-flex items-center justify-center border transition-colors ${
                              done
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-white/15 hover:border-slate-400'
                            }`}
                          >
                            {done && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {weekCount}/{habit.targetPerWeek}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteHabit(habit.id)}
                        aria-label={`Delete habit ${habit.title}`}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Completion Timeline */}
      <section className="rounded-xl glass-panel p-5 space-y-4">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Completion Timeline
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chronological record of finished tasks and focus sessions (daily target: {settings.dailyGoal}).
          </p>
        </div>

        {timelineGroups.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Completed tasks and focus sessions will appear here chronologically.
          </p>
        ) : (
          <div className="space-y-5">
            {timelineGroups.map(([dateStr, group]) => (
              <div key={dateStr} className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-1.5">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {formatShortDate(dateStr)} ·{' '}
                    <span className="font-mono font-normal text-slate-400">{dateStr}</span>
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {group.tasks.length} completed
                    {group.focus.length > 0 ? ` · ${group.focus.length} focus sessions` : ''}
                  </span>
                </div>

                <div className="space-y-1.5 pl-2">
                  {group.tasks.map((t) => {
                    const proj = t.projectId ? projectMap.get(t.projectId) : undefined;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-xs py-1 gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenDetail(t.id)}
                          className="text-left font-medium text-slate-700 dark:text-slate-200 hover:underline truncate"
                        >
                          {t.title}
                        </button>
                        <span className="text-slate-400 shrink-0 font-mono tabular-nums">
                          {proj ? `${proj.name} · ` : ''}
                          {t.actualSeconds > 0
                            ? formatTimerSeconds(t.actualSeconds)
                            : formatDuration(t.estimatedMinutes)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
