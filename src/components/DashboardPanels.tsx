import React from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Quote,
  Sparkles,
  Star,
} from 'lucide-react';
import type { Task } from '../types/todo';
import { getTodayStr } from '../utils/date';

interface DashboardPanelsProps {
  tasks: Task[];
  onOpenCalendar: () => void;
  onOpenInsights: () => void;
}

interface DashboardWelcomeProps {
  tasks: Task[];
  profileName?: string;
}

export const DashboardWelcome: React.FC<DashboardWelcomeProps> = ({ tasks, profileName }) => {
  const today = getTodayStr();
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';
  const activeTasks = tasks.filter(
    (task) => task.status === 'todo' || task.status === 'in_progress'
  );
  const completedCount = tasks.filter((task) => task.status === 'done').length;
  const importantCount = activeTasks.filter(
    (task) =>
      task.important || task.priority === 'urgent' || task.priority === 'high'
  ).length;

  const cards = [
    {
      label: 'Total tasks',
      value: tasks.length,
      icon: CheckCircle2,
      color: 'blue',
      note: `↑ ${completedCount} completed`,
    },
    {
      label: 'Pending',
      value: activeTasks.length,
      icon: Clock3,
      color: 'amber',
      note: 'Ready when you are',
    },
    {
      label: 'Completed',
      value: completedCount,
      icon: Check,
      color: 'green',
      note: 'You’re making progress',
    },
    {
      label: 'Important',
      value: importantCount,
      icon: Star,
      color: 'violet',
      note: 'Your top priorities',
    },
  ];

  return (
    <div className="dashboard-welcome-wrap">
      <section className="dashboard-welcome">
        <span className="welcome-date">
          <CalendarDays size={14} />
          {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <p>Good {greeting},</p>
        <h2>{profileName?.trim().split(/\s+/)[0] || 'there'}!</h2>
        <span className="welcome-subtitle">
          <Sparkles size={15} /> Small steps make big changes.
        </span>
        <div className="mountain-art" aria-hidden="true">
          <img src="/mountains.svg" alt="" />
        </div>
      </section>

      <section className="dashboard-stats" aria-label="Task summary">
        {cards.map(({ label, value, icon: Icon, color, note }) => (
          <article className="dashboard-stat" key={label}>
            <span className={`stat-icon stat-${color}`}>
              <Icon size={19} />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
            <small>{note}</small>
          </article>
        ))}
      </section>
    </div>
  );
};

export const DashboardPanels: React.FC<DashboardPanelsProps> = ({
  tasks,
  onOpenCalendar,
  onOpenInsights,
}) => {
  const activeCount = tasks.filter(
    (task) => task.status === 'todo' || task.status === 'in_progress'
  ).length;
  const completedCount = tasks.filter((task) => task.status === 'done').length;
  const productivity = tasks.length
    ? Math.min(100, Math.round((completedCount / tasks.length) * 100))
    : 0;

  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();
  const firstWeekday = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).getDay();
  const monthLabel = now.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <aside className="dashboard-rail">
      <section className="rail-card calendar-card">
        <div className="rail-heading">
          <span>
            <CalendarDays size={17} /> Calendar
          </span>
          <button type="button" onClick={onOpenCalendar}>
            View all <ArrowRight size={14} />
          </button>
        </div>
        <div className="calendar-month">{monthLabel}</div>
        <div className="calendar-grid calendar-weekdays">
          {'SMTWTFS'.split('').map((day, index) => (
            <span key={`${day}${index}`}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {Array.from({ length: firstWeekday }, (_, index) => (
            <span key={`blank${index}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(
            (day) => (
              <button
                key={day}
                type="button"
                onClick={onOpenCalendar}
                className={day === now.getDate() ? 'calendar-today' : ''}
              >
                {day}
              </button>
            )
          )}
        </div>
      </section>

      <section className="rail-card quick-stats-card">
        <div className="rail-heading">
          <span>
            <Activity size={17} /> Quick stats
          </span>
          <button type="button" onClick={onOpenInsights} className="quick-view-link">View details <ArrowRight size={13} /></button>
        </div>
        <div className="quick-stats-body">
          <div
            className="quick-stat-ring"
            style={{ '--progress': `${productivity * 3.6}deg` } as React.CSSProperties}
          >
            <div><strong>{productivity}%</strong></div>
          </div>
          <div className="quick-stats-data">
            <span>Tasks completed</span>
            <strong>{completedCount} of {tasks.length}</strong>
            <div
              className="rail-progress"
              role="progressbar"
              aria-label="Tasks completed"
              aria-valuenow={productivity}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${productivity}%` }} />
            </div>
            <span>{activeCount} active</span>
          </div>
        </div>
        <div className="rail-footnote">
          {completedCount} completed · {activeCount} to go
        </div>
      </section>

      <section className="rail-card quote-card" aria-label="Daily reminder">
        <Quote className="quote-mark" size={26} aria-hidden="true" />
        <blockquote>Progress comes from the next small step.</blockquote>
        <span>Make space for what matters.</span>
      </section>

    </aside>
  );
};
