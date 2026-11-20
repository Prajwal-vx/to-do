import {
  DeadlinePressureLevel,
  EnergyLevel,
  FocusSession,
  Habit,
  Priority,
  Project,
  RescheduleSuggestion,
  ScoreReason,
  Task,
  TaskScore,
  UserSettings,
} from '../types/todo';
import { addDays, diffDays, getTodayStr } from './date';

const PRIORITY_POINTS: Record<Priority, number> = {
  urgent: 40,
  high: 28,
  medium: 15,
  low: 5,
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent priority',
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

export function computeTaskScore(
  task: Task,
  allTasks: Task[],
  today = getTodayStr()
): TaskScore {
  const reasons: ScoreReason[] = [];
  let score = 0;

  const pPts = PRIORITY_POINTS[task.priority];
  score += pPts;
  reasons.push({ label: PRIORITY_LABELS[task.priority], points: pPts });

  if (task.important) {
    score += 12;
    reasons.push({ label: 'Important', points: 12 });
  }
  if (task.urgent) {
    score += 12;
    reasons.push({ label: 'Urgent flag', points: 12 });
  }

  if (task.top3Date === today) {
    score += 32;
    reasons.push({ label: 'Daily Top 3', points: 32 });
  }

  if (task.dueDate) {
    const delta = diffDays(today, task.dueDate);
    if (delta < 0) {
      const overduePts = Math.min(60, 45 + Math.abs(delta) * 3);
      score += overduePts;
      reasons.push({ label: `Overdue (${Math.abs(delta)}d)`, points: overduePts });
    } else if (delta === 0) {
      score += 34;
      reasons.push({ label: 'Due today', points: 34 });
    } else if (delta === 1) {
      score += 22;
      reasons.push({ label: 'Due tomorrow', points: 22 });
    } else if (delta <= 7) {
      score += 12;
      reasons.push({ label: 'Due this week', points: 12 });
    }
  }

  if (task.deadline) {
    const dlDelta = diffDays(today, task.deadline);
    if (dlDelta <= 0) {
      score += 35;
      reasons.push({ label: 'Hard deadline reached', points: 35 });
    } else if (dlDelta <= 2) {
      score += 24;
      reasons.push({ label: `Hard deadline in ${dlDelta}d`, points: 24 });
    }
  }

  if (task.estimatedMinutes > 0 && task.estimatedMinutes <= 15) {
    score += 8;
    reasons.push({ label: 'Quick win (≤15m)', points: 8 });
  }

  if (task.status === 'in_progress') {
    score += 10;
    reasons.push({ label: 'In progress', points: 10 });
  }

  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const blockingTasks = task.dependsOn
    .map((id) => taskMap.get(id))
    .filter(
      (t): t is Task =>
        Boolean(
          t &&
            t.status !== 'done' &&
            t.status !== 'archived' &&
            t.status !== 'trashed'
        )
    );

  const blocked = blockingTasks.length > 0;
  if (blocked) {
    score -= 45;
    reasons.push({ label: `Blocked by ${blockingTasks.length} task(s)`, points: -45 });
  }

  return {
    score,
    reasons,
    blocked,
    blockedByTitles: blockingTasks.map((t) => t.title),
  };
}

export function computeDeadlinePressure(
  task: Task,
  today = getTodayStr()
): { level: DeadlinePressureLevel; label: string; daysRemaining: number | null } {
  const target = task.deadline || task.dueDate;
  if (!target || task.status === 'done' || task.status === 'archived' || task.status === 'trashed') {
    return { level: 'none', label: '', daysRemaining: null };
  }
  const days = diffDays(today, target);
  if (days < 0) {
    return { level: 'critical', label: `${Math.abs(days)}d overdue`, daysRemaining: days };
  }
  if (days === 0 || (days === 1 && task.estimatedMinutes >= 60)) {
    return {
      level: 'critical',
      label: days === 0 ? 'Due today' : 'High pressure (1d)',
      daysRemaining: days,
    };
  }
  if (days <= 2) {
    return { level: 'high', label: `${days}d left`, daysRemaining: days };
  }
  if (days <= 6) {
    return { level: 'steady', label: `${days}d left`, daysRemaining: days };
  }
  return { level: 'calm', label: `${days}d left`, daysRemaining: days };
}

export interface DayWorkload {
  dateStr: string;
  taskCount: number;
  totalMinutes: number;
  status: 'light' | 'balanced' | 'overloaded';
}

export function computeWorkloadBalance(
  tasks: Task[],
  dailyGoal: number,
  today = getTodayStr(),
  days = 7
): DayWorkload[] {
  const active = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const result: DayWorkload[] = [];

  for (let i = 0; i < days; i++) {
    const dateStr = addDays(today, i);
    const dayTasks = active.filter((t) => t.dueDate === dateStr);
    const totalMinutes = dayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
    const taskCount = dayTasks.length;

    let status: DayWorkload['status'] = 'balanced';
    if (taskCount > Math.max(dailyGoal, 5) || totalMinutes > 240) {
      status = 'overloaded';
    } else if (taskCount <= 1 && totalMinutes < 60) {
      status = 'light';
    }
    result.push({ dateStr, taskCount, totalMinutes, status });
  }
  return result;
}

export interface ProductivityScoreReport {
  totalScore: number;
  components: {
    label: string;
    score: number;
    max: number;
    detail: string;
  }[];
}

export function computePersonalProductivityScore(
  tasks: Task[],
  focusSessions: FocusSession[],
  habits: Habit[],
  settings: UserSettings,
  today = getTodayStr()
): ProductivityScoreReport {
  const last7 = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
  const completedThisWeek = tasks.filter(
    (t) => t.completedAt && last7.has(t.completedAt.slice(0, 10))
  ).length;

  // 1. Goal attainment (40 pts)
  const weeklyTarget = Math.max(1, settings.weeklyGoal || settings.dailyGoal * 5);
  const goalScore = Math.min(40, Math.round((completedThisWeek / weeklyTarget) * 40));

  // 2. Focus time (25 pts — target 150m/week)
  const focusMinsWeek = Math.round(
    focusSessions
      .filter((s) => last7.has(s.completedAt.slice(0, 10)))
      .reduce((sum, s) => sum + s.durationSeconds, 0) / 60
  );
  const focusScore = Math.min(25, Math.round((focusMinsWeek / 150) * 25));

  // 3. On-time / Low overdue ratio (20 pts)
  const active = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const overdueCount = active.filter((t) => t.dueDate && t.dueDate < today).length;
  const timelinessScore = Math.max(0, 20 - overdueCount * 4);

  // 4. Habit consistency (15 pts)
  const habitGoalTotal = habits.reduce((s, h) => s + Math.max(1, h.targetPerWeek), 0);
  const habitDoneWeek = habits.reduce(
    (s, h) => s + h.completedDates.filter((d) => last7.has(d)).length,
    0
  );
  const habitScore =
    habitGoalTotal > 0 ? Math.min(15, Math.round((habitDoneWeek / habitGoalTotal) * 15)) : 15;

  return {
    totalScore: goalScore + focusScore + timelinessScore + habitScore,
    components: [
      {
        label: 'Weekly Task Goal',
        score: goalScore,
        max: 40,
        detail: `${completedThisWeek}/${weeklyTarget} tasks completed in 7d`,
      },
      {
        label: 'Focus Sessions',
        score: focusScore,
        max: 25,
        detail: `${focusMinsWeek}/150 focus minutes in 7d`,
      },
      {
        label: 'Schedule Health',
        score: timelinessScore,
        max: 20,
        detail: `${overdueCount} overdue active task(s)`,
      },
      {
        label: 'Habit Consistency',
        score: habitScore,
        max: 15,
        detail: `${habitDoneWeek}/${habitGoalTotal || 0} habit check-ins in 7d`,
      },
    ],
  };
}

export function detectTimeSlotConflicts(tasks: Task[]): Set<string> {
  const conflicts = new Set<string>();
  const slotted = tasks.filter(
    (t) =>
      t.dueDate &&
      t.timeSlot &&
      t.timeSlot.start &&
      t.timeSlot.end &&
      t.status !== 'done' &&
      t.status !== 'archived' &&
      t.status !== 'trashed'
  );

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  for (let i = 0; i < slotted.length; i++) {
    for (let j = i + 1; j < slotted.length; j++) {
      const a = slotted[i];
      const b = slotted[j];
      if (a.dueDate !== b.dueDate) continue;
      const aStart = toMinutes(a.timeSlot!.start);
      const aEnd = Math.max(aStart + 15, toMinutes(a.timeSlot!.end));
      const bStart = toMinutes(b.timeSlot!.start);
      const bEnd = Math.max(bStart + 15, toMinutes(b.timeSlot!.end));
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}

export function detectDuplicateTasks(tasks: Task[]): { normalizedTitle: string; items: Task[] }[] {
  const active = tasks.filter((t) => t.status !== 'trashed');
  const groups = new Map<string, Task[]>();
  active.forEach((t) => {
    const norm = t.title.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!norm) return;
    const arr = groups.get(norm) || [];
    arr.push(t);
    groups.set(norm, arr);
  });
  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([normalizedTitle, items]) => ({ normalizedTitle, items }));
}

export interface ParsedQuickCapture {
  title: string;
  priority: Priority;
  energy: EnergyLevel;
  estimatedMinutes: number;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  tags: string[];
}

export function parseQuickCapture(
  rawInput: string,
  projects: Project[],
  defaultProjectId: string | null = null,
  defaultDueDate: string | null = null
): ParsedQuickCapture {
  let text = rawInput.trim();
  let priority: Priority = 'medium';
  let energy: EnergyLevel = 'medium';
  let estimatedMinutes = 30;
  let dueDate: string | null = defaultDueDate;
  let projectId: string | null = defaultProjectId;
  let projectName: string | null = null;
  const tags: string[] = [];

  const priorityMatch = text.match(/(?:^|\s)!(urgent|high|medium|med|low)\b/i);
  if (priorityMatch) {
    const val = priorityMatch[1].toLowerCase();
    priority = val === 'med' ? 'medium' : (val as Priority);
    text = text.replace(priorityMatch[0], ' ');
  }

  const energyMatch = text.match(/(?:^|\s)\^(high|medium|med|low)\b/i);
  if (energyMatch) {
    const val = energyMatch[1].toLowerCase();
    energy = val === 'med' ? 'medium' : (val as EnergyLevel);
    text = text.replace(energyMatch[0], ' ');
  }

  const durationMatch = text.match(/(?:^|\s)~(\d+)\s*(m|min|mins|h|hr|hrs)\b/i);
  if (durationMatch) {
    const num = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();
    estimatedMinutes = unit.startsWith('h') ? num * 60 : num;
    text = text.replace(durationMatch[0], ' ');
  }

  const today = getTodayStr();
  if (/(?:^|\s)@tomorrow\b/i.test(text)) {
    dueDate = addDays(today, 1);
    text = text.replace(/(?:^|\s)@tomorrow\b/i, ' ');
  } else if (/(?:^|\s)@today\b/i.test(text)) {
    dueDate = today;
    text = text.replace(/(?:^|\s)@today\b/i, ' ');
  } else if (/(?:^|\s)@nextweek\b/i.test(text)) {
    dueDate = addDays(today, 7);
    text = text.replace(/(?:^|\s)@nextweek\b/i, ' ');
  }

  const tagRegex = /(?:^|\s)@([a-zA-Z0-9_-]+)/g;
  let tagMatch: RegExpExecArray | null;
  const matchedTagSnippets: string[] = [];
  while ((tagMatch = tagRegex.exec(text)) !== null) {
    tags.push(tagMatch[1].toLowerCase());
    matchedTagSnippets.push(tagMatch[0]);
  }
  matchedTagSnippets.forEach((snippet) => {
    text = text.replace(snippet, ' ');
  });

  const projectMatch = text.match(/(?:^|\s)#([a-zA-Z0-9_-]+)/);
  if (projectMatch) {
    const query = projectMatch[1].toLowerCase();
    const found = projects.find(
      (p) => p.name.toLowerCase().replace(/\s+/g, '') === query || p.name.toLowerCase().includes(query)
    );
    if (found) {
      projectId = found.id;
      projectName = found.name;
    }
    text = text.replace(projectMatch[0], ' ');
  }

  const isoDateMatch = text.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})\b/);
  if (isoDateMatch) {
    dueDate = isoDateMatch[1];
    text = text.replace(isoDateMatch[0], ' ');
  } else if (/(?:^|\s)\btomorrow\b/i.test(text)) {
    dueDate = addDays(today, 1);
    text = text.replace(/(?:^|\s)\btomorrow\b/i, ' ');
  } else if (/(?:^|\s)\btoday\b/i.test(text)) {
    dueDate = today;
    text = text.replace(/(?:^|\s)\btoday\b/i, ' ');
  } else if (/(?:^|\s)\bnext week\b/i.test(text)) {
    dueDate = addDays(today, 7);
    text = text.replace(/(?:^|\s)\bnext week\b/i, ' ');
  }

  const cleanTitle = text.replace(/\s+/g, ' ').trim();

  return {
    title: cleanTitle || rawInput.trim(),
    priority,
    energy,
    estimatedMinutes: Math.max(5, estimatedMinutes),
    dueDate,
    projectId,
    projectName,
    tags: Array.from(new Set(tags)),
  };
}

export interface TaskRadarReport {
  overdue: Task[];
  upcomingDeadlines: Task[];
  neglected: Task[];
  heavyDays: { dateStr: string; count: number; totalMinutes: number; tasks: Task[] }[];
}

export function analyzeTaskRadar(
  tasks: Task[],
  dailyGoal: number,
  today = getTodayStr()
): TaskRadarReport {
  const active = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');

  const overdue = active
    .filter((t) => t.dueDate && diffDays(today, t.dueDate) < 0)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  const upcomingDeadlines = active
    .filter((t) => {
      const target = t.deadline || t.dueDate;
      if (!target) return false;
      const d = diffDays(today, target);
      return d >= 0 && d <= 3 && (Boolean(t.deadline) || t.priority === 'urgent' || t.priority === 'high');
    })
    .sort((a, b) => {
      const da = a.deadline || a.dueDate || '';
      const db = b.deadline || b.dueDate || '';
      return da.localeCompare(db);
    });

  const nowMs = Date.now();
  const neglected = active
    .filter((t) => {
      const lastTouch = new Date(t.updatedAt || t.createdAt).getTime();
      const ageDays = (nowMs - lastTouch) / (1000 * 60 * 60 * 24);
      return ageDays >= 7;
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  const byDate = new Map<string, Task[]>();
  active.forEach((t) => {
    if (!t.dueDate) return;
    const d = diffDays(today, t.dueDate);
    if (d >= 0 && d <= 14) {
      const arr = byDate.get(t.dueDate) || [];
      arr.push(t);
      byDate.set(t.dueDate, arr);
    }
  });

  const heavyDays = Array.from(byDate.entries())
    .map(([dateStr, dayTasks]) => ({
      dateStr,
      count: dayTasks.length,
      totalMinutes: dayTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0),
      tasks: dayTasks,
    }))
    .filter((day) => day.count > Math.max(dailyGoal, 5) || day.totalMinutes >= 240)
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return { overdue, upcomingDeadlines, neglected, heavyDays };
}

export function generateRescheduleSuggestions(
  tasks: Task[],
  dailyGoal: number,
  today = getTodayStr()
): RescheduleSuggestion[] {
  const active = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const suggestions: RescheduleSuggestion[] = [];

  const loadMap = new Map<string, number>();
  for (let i = 0; i < 10; i++) {
    loadMap.set(addDays(today, i), 0);
  }
  active.forEach((t) => {
    if (t.dueDate && loadMap.has(t.dueDate)) {
      loadMap.set(t.dueDate, (loadMap.get(t.dueDate) || 0) + t.estimatedMinutes);
    }
  });

  const findLightestDay = (startOffset: number, endOffset: number): string => {
    let bestDay = addDays(today, startOffset);
    let lowestLoad = Infinity;
    for (let i = startOffset; i <= endOffset; i++) {
      const candidate = addDays(today, i);
      const load = loadMap.get(candidate) || 0;
      if (load < lowestLoad) {
        lowestLoad = load;
        bestDay = candidate;
      }
    }
    return bestDay;
  };

  const overdueTasks = active
    .filter((t) => t.dueDate && diffDays(today, t.dueDate) < 0)
    .sort((a, b) => PRIORITY_POINTS[b.priority] - PRIORITY_POINTS[a.priority]);

  overdueTasks.forEach((task) => {
    const isUrgentOrHigh = task.priority === 'urgent' || task.priority === 'high';
    const targetDay = isUrgentOrHigh ? today : findLightestDay(1, 4);
    loadMap.set(targetDay, (loadMap.get(targetDay) || 0) + task.estimatedMinutes);

    suggestions.push({
      id: `rs-${task.id}`,
      taskId: task.id,
      taskTitle: task.title,
      currentDueDate: task.dueDate,
      suggestedDueDate: targetDay,
      reason: isUrgentOrHigh
        ? `Overdue ${task.priority}-priority task — pull into Today to resolve promptly.`
        : `Overdue ${task.priority}-priority task — slot into lighter day (${targetDay}) to avoid crowding Today.`,
      category: 'overdue',
    });
  });

  for (let i = 0; i <= 5; i++) {
    const dayStr = addDays(today, i);
    const dayTasks = active
      .filter((t) => t.dueDate === dayStr && t.top3Date !== today)
      .sort((a, b) => PRIORITY_POINTS[a.priority] - PRIORITY_POINTS[b.priority]);

    const totalMins = dayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
    if (dayTasks.length > Math.max(dailyGoal, 5) || totalMins > 270) {
      const movable = dayTasks.filter((t) => !t.deadline && t.priority !== 'urgent').slice(0, 2);
      movable.forEach((task) => {
        if (suggestions.some((s) => s.taskId === task.id)) return;
        const targetDay = findLightestDay(i + 1, i + 5);
        if (targetDay !== dayStr) {
          loadMap.set(targetDay, (loadMap.get(targetDay) || 0) + task.estimatedMinutes);
          suggestions.push({
            id: `rs-${task.id}`,
            taskId: task.id,
            taskTitle: task.title,
            currentDueDate: task.dueDate,
            suggestedDueDate: targetDay,
            reason: `${dayStr} is overloaded (${dayTasks.length} tasks, ${totalMins}m). Shift to ${targetDay} for sustainable pacing.`,
            category: 'overload',
          });
        }
      });
    }
  }

  const nowMs = Date.now();
  const neglectedUnscheduled = active.filter((t) => {
    if (t.dueDate || suggestions.some((s) => s.taskId === t.id)) return false;
    const age = (nowMs - new Date(t.updatedAt || t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return age >= 7;
  });

  neglectedUnscheduled.slice(0, 4).forEach((task) => {
    const targetDay = findLightestDay(1, 6);
    loadMap.set(targetDay, (loadMap.get(targetDay) || 0) + task.estimatedMinutes);
    suggestions.push({
      id: `rs-${task.id}`,
      taskId: task.id,
      taskTitle: task.title,
      currentDueDate: null,
      suggestedDueDate: targetDay,
      reason: `Untouched for 7+ days without a date — give it a clear home on ${targetDay}.`,
      category: 'neglected',
    });
  });

  return suggestions;
}

export interface StreakStats {
  activeDaysTotal: number;
  currentMomentumStreak: number;
  bestStreak: number;
  completedThisWeek: number;
  activeDaysThisWeek: number;
  totalCompletedTasks: number;
  milestonesUnlocked: { id: string; label: string; detail: string }[];
  nextMilestone: { label: string; current: number; target: number } | null;
}

export function computeStreakStats(tasks: Task[], today = getTodayStr()): StreakStats {
  const completedTasks = tasks.filter((t) => t.completedAt);
  const activeDaySet = new Set<string>();

  completedTasks.forEach((t) => {
    if (t.completedAt) {
      activeDaySet.add(t.completedAt.slice(0, 10));
    }
  });

  const sortedDays = Array.from(activeDaySet).sort();

  let currentMomentumStreak = 0;
  let cursor = today;
  if (!activeDaySet.has(today)) {
    const yesterday = addDays(today, -1);
    if (activeDaySet.has(yesterday)) {
      cursor = yesterday;
    } else {
      cursor = '';
    }
  }

  if (cursor) {
    let gapAllowed = 1;
    let checkDate = cursor;
    for (let i = 0; i < 365; i++) {
      if (activeDaySet.has(checkDate)) {
        currentMomentumStreak += 1;
        gapAllowed = 1;
        checkDate = addDays(checkDate, -1);
      } else if (gapAllowed > 0 && activeDaySet.has(addDays(checkDate, -1))) {
        gapAllowed -= 1;
        checkDate = addDays(checkDate, -1);
      } else {
        break;
      }
    }
  }

  let bestStreak = currentMomentumStreak;
  if (sortedDays.length > 0) {
    let run = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const gap = diffDays(sortedDays[i - 1], sortedDays[i]);
      if (gap <= 2) {
        run += 1;
        if (run > bestStreak) bestStreak = run;
      } else {
        run = 1;
      }
    }
  }

  const last7 = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
  const activeDaysThisWeek = Array.from(last7).filter((d) => activeDaySet.has(d)).length;
  const completedThisWeek = completedTasks.filter(
    (t) => t.completedAt && last7.has(t.completedAt.slice(0, 10))
  ).length;

  const totalCompleted = completedTasks.length;
  const milestoneThresholds = [
    { id: 'm-1', target: 1, label: 'First Step', detail: 'Completed your first task' },
    { id: 'm-5', target: 5, label: 'Momentum Builder', detail: '5 tasks completed' },
    { id: 'm-10', target: 10, label: 'Double Digits', detail: '10 tasks completed' },
    { id: 'm-25', target: 25, label: 'Quarter Century', detail: '25 tasks completed' },
    { id: 'm-50', target: 50, label: 'Steady Finisher', detail: '50 tasks completed' },
    { id: 'm-100', target: 100, label: 'Centurion', detail: '100 tasks completed' },
  ];

  const milestonesUnlocked = milestoneThresholds
    .filter((m) => totalCompleted >= m.target)
    .map(({ id, label, detail }) => ({ id, label, detail }));

  const nextM = milestoneThresholds.find((m) => totalCompleted < m.target);

  return {
    activeDaysTotal: activeDaySet.size,
    currentMomentumStreak,
    bestStreak,
    completedThisWeek,
    activeDaysThisWeek,
    totalCompletedTasks: totalCompleted,
    milestonesUnlocked,
    nextMilestone: nextM
      ? { label: nextM.label, current: totalCompleted, target: nextM.target }
      : null,
  };
}
