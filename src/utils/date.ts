import { RecurrenceRule } from '../types/todo';

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayStr(): string {
  return toDateStr(new Date());
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDateStr(dateStr);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

export function diffDays(fromStr: string, toStr: string): number {
  const from = parseDateStr(fromStr).getTime();
  const to = parseDateStr(toStr).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const today = getTodayStr();
  const delta = diffDays(today, dateStr);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta > 1 && delta <= 6) {
    return parseDateStr(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
  }
  const d = parseDateStr(dateStr);
  const currentYear = new Date().getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== currentYear ? 'numeric' : undefined,
  });
}

export function formatFullDate(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTimerSeconds(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getLastNDates(n: number, endDateStr = getTodayStr()): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    dates.push(addDays(endDateStr, -i));
  }
  return dates;
}

export function getMonthCalendarDays(year: number, monthIndex: number): { dateStr: string; inMonth: boolean }[] {
  const firstDay = new Date(year, monthIndex, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: { dateStr: string; inMonth: boolean }[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(year, monthIndex, -i);
    cells.push({ dateStr: toDateStr(d), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    cells.push({ dateStr: toDateStr(d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = parseDateStr(cells[cells.length - 1].dateStr);
    last.setDate(last.getDate() + 1);
    cells.push({ dateStr: toDateStr(last), inMonth: false });
  }
  return cells;
}

export function computeNextRecurrenceDate(currentDue: string | null, rule: RecurrenceRule): string {
  const baseStr = currentDue || getTodayStr();
  const base = parseDateStr(baseStr);
  const interval = Math.max(1, rule.interval || 1);

  switch (rule.type) {
    case 'daily':
      return addDays(baseStr, interval);
    case 'weekly': {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const sorted = [...rule.daysOfWeek].sort((a, b) => a - b);
        const currentDay = base.getDay();
        const nextSameWeek = sorted.find((d) => d > currentDay);
        if (nextSameWeek !== undefined) {
          return addDays(baseStr, nextSameWeek - currentDay);
        }
        const daysToFirstNextWeek = 7 * interval - currentDay + sorted[0];
        return addDays(baseStr, daysToFirstNextWeek);
      }
      return addDays(baseStr, 7 * interval);
    }
    case 'monthly': {
      const targetMonth = new Date(base.getFullYear(), base.getMonth() + interval, 1);
      const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
      targetMonth.setDate(Math.min(base.getDate(), lastDay));
      return toDateStr(targetMonth);
    }
    case 'yearly': {
      const targetYear = base.getFullYear() + interval;
      const targetMonth = base.getMonth();
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      const next = new Date(targetYear, targetMonth, Math.min(base.getDate(), lastDay));
      return toDateStr(next);
    }
    case 'custom':
      return addDays(baseStr, interval);
    default:
      return baseStr;
  }
}
