import React, { useState } from 'react';
import {
  Archive,
  Bell,
  Bookmark,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  MessageSquare,
  Moon,
  Paperclip,
  Play,
  Plus,
  Send,
  Star,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import {
  EnergyLevel,
  LifeCategory,
  Priority,
  Project,
  RecurrenceType,
  Task,
  TaskStatus,
} from '../types/todo';
import { addDays, formatTimerSeconds, getTodayStr } from '../utils/date';

interface TaskDetailDrawerProps {
  task: Task | null;
  allTasks: Task[];
  projects: Project[];
  activeTimerTaskId: string | null;
  activeTimerElapsed: number;
  onClose: () => void;
  onUpdateTask: (updated: Task) => void;
  onSaveAsTemplate: (task: Task) => void;
  onToggleTimer: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onTrash: (taskId: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  allTasks,
  projects,
  activeTimerTaskId,
  activeTimerElapsed,
  onClose,
  onUpdateTask,
  onSaveAsTemplate,
  onToggleTimer,
  onStartFocus,
  onDuplicate,
  onArchive,
  onTrash,
}) => {
  const [newSubtask, setNewSubtask] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [depToAdd, setDepToAdd] = useState('');
  const [newReminderInput, setNewReminderInput] = useState('');
  const [newComment, setNewComment] = useState('');

  if (!task) return null;

  const today = getTodayStr();
  const isTop3Today = task.top3Date === today;
  const isTimerRunning = activeTimerTaskId === task.id;
  const totalTrackedSeconds =
    task.actualSeconds + (isTimerRunning ? activeTimerElapsed : 0);

  const selectedProject = projects.find((p) => p.id === task.projectId);
  const subtasksDone = task.subtasks.filter((s) => s.completed).length;
  const subtaskPct =
    task.subtasks.length > 0 ? Math.round((subtasksDone / task.subtasks.length) * 100) : 0;

  const patch = (fields: Partial<Task>, activityNote?: string) => {
    const nowIso = new Date().toISOString();
    const nextLog = activityNote
      ? [
          { id: `act-${Date.now()}`, actor: 'You', action: activityNote, timestamp: nowIso },
          ...(task.activityLog || []),
        ].slice(0, 30)
      : task.activityLog || [];

    onUpdateTask({
      ...task,
      ...fields,
      activityLog: nextLog,
      updatedAt: nowIso,
    });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    patch(
      {
        subtasks: [
          ...task.subtasks,
          { id: `sub-${Date.now()}`, title: newSubtask.trim(), completed: false },
        ],
      },
      `Added step "${newSubtask.trim()}"`
    );
    setNewSubtask('');
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTag.trim().replace(/^@/, '').toLowerCase();
    if (!cleaned || task.tags.includes(cleaned)) return;
    patch({ tags: [...task.tags, cleaned] });
    setNewTag('');
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkUrl.trim()) return;
    const url = newLinkUrl.startsWith('http') ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`;
    patch({
      links: [
        ...task.links,
        { id: `lnk-${Date.now()}`, label: newLinkLabel.trim() || url, url },
      ],
    });
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderInput) return;
    const iso = new Date(newReminderInput).toISOString();
    const next = [
      ...(task.reminders || []),
      { id: `rem-${Date.now()}`, triggerAt: iso, fired: false },
    ];
    patch({ reminders: next, reminderAt: iso, reminderFired: false }, 'Added scheduled reminder');
    setNewReminderInput('');
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const nowIso = new Date().toISOString();
    patch(
      {
        comments: [
          ...(task.comments || []),
          { id: `cmt-${Date.now()}`, author: 'You', text: newComment.trim(), createdAt: nowIso },
        ],
      },
      'Added comment'
    );
    setNewComment('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 4 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      patch(
        {
          attachments: [
            ...task.attachments,
            {
              id: `att-${Date.now()}`,
              name: file.name,
              size: file.size,
              type: file.type,
              dataUrl: String(reader.result || ''),
            },
          ],
        },
        `Attached "${file.name}"`
      );
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const availableDeps = allTasks.filter(
    (t) =>
      t.id !== task.id &&
      t.status !== 'trashed' &&
      t.status !== 'archived' &&
      !task.dependsOn.includes(t.id) &&
      !t.dependsOn.includes(task.id)
  );

  const availableParents = allTasks.filter(
    (t) => t.id !== task.id && t.status !== 'trashed' && t.status !== 'archived'
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end no-print">
      <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs" onClick={onClose} />
      <aside className="relative z-10 w-full max-w-xl glass-modal border-l h-full flex flex-col">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <select
              value={task.status}
              onChange={(e) => {
                const nextStatus = e.target.value as TaskStatus;
                patch(
                  {
                    status: nextStatus,
                    completedAt: nextStatus === 'done' ? new Date().toISOString() : null,
                  },
                  `Status changed to ${nextStatus}`
                );
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-white/5 text-slate-800 dark:text-slate-100"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Completed</option>
              <option value="parking_lot">Parking Lot</option>
            </select>

            <button
              type="button"
              onClick={() =>
                patch({ top3Date: isTop3Today ? null : today }, isTop3Today ? 'Unpinned Focus 3' : 'Pinned to Focus 3')
              }
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
                isTop3Today
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isTop3Today ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>Focus 3</span>
            </button>

            <button
              type="button"
              onClick={() => patch({ isFavorite: !task.isFavorite })}
              aria-label="Favorite task"
              className={`p-1.5 rounded-md border border-slate-200 dark:border-white/15 ${
                task.isFavorite ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${task.isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onStartFocus(task.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md accent-bg"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Focus</span>
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(task.id)}
              title="Duplicate"
              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                onArchive(task.id);
                onClose();
              }}
              title="Archive"
              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                onTrash(task.id);
                onClose();
              }}
              title="Trash"
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="space-y-3">
            <input
              type="text"
              value={task.title}
              onChange={(e) => patch({ title: e.target.value })}
              className="w-full font-display text-lg font-semibold bg-transparent text-slate-900 dark:text-white focus:outline-none border-b border-transparent focus:border-slate-300 dark:focus:border-white/20 pb-1"
            />
            <textarea
              value={task.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
              placeholder="Add description, notes, or context..."
              className="w-full text-sm bg-white/50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-lg p-3 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
            />

            {/* Eisenhower Axes */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(task.important)}
                  onChange={(e) => patch({ important: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span>Important (Matrix)</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(task.urgent)}
                  onChange={(e) => patch({ urgent: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span>Urgent (Matrix)</span>
              </label>
              <button
                type="button"
                onClick={() => onSaveAsTemplate(task)}
                className="ml-auto text-xs accent-text font-medium hover:underline"
              >
                Save as Template
              </button>
            </div>
          </div>

          {/* Core Properties */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Project
              </label>
              <select
                value={task.projectId || ''}
                onChange={(e) => patch({ projectId: e.target.value || null, sectionId: null })}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              >
                <option value="">Inbox</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Life Balance Category
              </label>
              <select
                value={task.lifeCategory}
                onChange={(e) => patch({ lifeCategory: e.target.value as LifeCategory })}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              >
                <option value="projects">Projects & Work</option>
                <option value="education">Education & Study</option>
                <option value="personal">Personal Life</option>
                <option value="health">Health & Vitality</option>
                <option value="responsibilities">Responsibilities</option>
              </select>
            </div>

            {selectedProject && selectedProject.sections.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Section
                </label>
                <select
                  value={task.sectionId || ''}
                  onChange={(e) => patch({ sectionId: e.target.value || null })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                >
                  <option value="">No section</option>
                  {selectedProject.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedProject && selectedProject.members.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Assigned To
                </label>
                <select
                  value={task.assigneeId || ''}
                  onChange={(e) => patch({ assigneeId: e.target.value || null })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                >
                  <option value="">Unassigned</option>
                  {selectedProject.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => patch({ priority: e.target.value as Priority }, `Priority set to ${e.target.value}`)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Energy Required
              </label>
              <select
                value={task.energy}
                onChange={(e) => patch({ energy: e.target.value as EnergyLevel })}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              >
                <option value="low">Low effort</option>
                <option value="medium">Medium effort</option>
                <option value="high">High effort</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Estimated Duration
              </label>
              <select
                value={task.estimatedMinutes}
                onChange={(e) => patch({ estimatedMinutes: Number(e.target.value) })}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              >
                <option value={5}>5 min</option>
                <option value={15}>15 min</option>
                <option value={25}>25 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Parent Task
              </label>
              <select
                value={task.parentId || ''}
                onChange={(e) => patch({ parentId: e.target.value || null })}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              >
                <option value="">None (Top-level task)</option>
                {availableParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Snooze & Schedule */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Schedule & Snooze
              </h3>
              <div className="flex items-center gap-1.5 text-xs">
                <Moon className="w-3.5 h-3.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() =>
                    patch(
                      { snoozedUntil: new Date(Date.now() + 3 * 3600000).toISOString() },
                      'Snoozed +3 hours'
                    )
                  }
                  className="px-2 py-1 rounded border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
                >
                  +3h
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patch(
                      { dueDate: addDays(today, 1), snoozedUntil: `${addDays(today, 1)}T08:00:00` },
                      'Snoozed until tomorrow'
                    )
                  }
                  className="px-2 py-1 rounded border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
                >
                  Tomorrow
                </button>
                {task.snoozedUntil && (
                  <button
                    type="button"
                    onClick={() => patch({ snoozedUntil: null }, 'Cleared snooze')}
                    className="px-2 py-1 rounded text-amber-600 dark:text-amber-400"
                  >
                    Unsnooze
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={task.startDate || ''}
                  onChange={(e) => patch({ startDate: e.target.value || null })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(e) => patch({ dueDate: e.target.value || null }, `Due date set to ${e.target.value || 'none'}`)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Hard Deadline
                </label>
                <input
                  type="date"
                  value={task.deadline || ''}
                  onChange={(e) => patch({ deadline: e.target.value || null })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Time Block
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={task.timeSlot?.start || ''}
                    onChange={(e) =>
                      patch({
                        timeSlot: e.target.value
                          ? { start: e.target.value, end: task.timeSlot?.end || e.target.value }
                          : null,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                  />
                  <span className="text-xs text-slate-400">–</span>
                  <input
                    type="time"
                    value={task.timeSlot?.end || ''}
                    onChange={(e) =>
                      patch({
                        timeSlot: e.target.value
                          ? { start: task.timeSlot?.start || e.target.value, end: e.target.value }
                          : null,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Repeat Schedule
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={task.recurrence.type}
                    onChange={(e) =>
                      patch({
                        recurrence: {
                          ...task.recurrence,
                          type: e.target.value as RecurrenceType,
                        },
                      })
                    }
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom interval (days)</option>
                  </select>
                  {task.recurrence.type !== 'none' && (
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={task.recurrence.interval}
                      onChange={(e) =>
                        patch({
                          recurrence: {
                            ...task.recurrence,
                            interval: Math.max(1, Number(e.target.value) || 1),
                          },
                        })
                      }
                      className="w-16 px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
                    />
                  )}
                </div>
              </div>
            </div>

            {task.recurrence.type === 'weekly' && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((label, dayIdx) => {
                  const active = task.recurrence.daysOfWeek?.includes(dayIdx) || false;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const current = task.recurrence.daysOfWeek || [];
                        const next = active
                          ? current.filter((d) => d !== dayIdx)
                          : [...current, dayIdx];
                        patch({ recurrence: { ...task.recurrence, daysOfWeek: next } });
                      }}
                      className={`px-2 py-1 text-xs rounded border ${
                        active
                          ? 'accent-bg border-transparent'
                          : 'border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Multiple Reminders */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              <span>Reminders ({(task.reminders || []).length})</span>
            </h3>
            {(task.reminders || []).map((rem) => (
              <div key={rem.id} className="flex items-center justify-between text-xs py-1">
                <span className="font-mono text-slate-700 dark:text-slate-200">
                  {new Date(rem.triggerAt).toLocaleString()} {rem.fired ? '· Fired' : ''}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      reminders: (task.reminders || []).filter((r) => r.id !== rem.id),
                    })
                  }
                  className="text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
            <form onSubmit={handleAddReminder} className="flex gap-2">
              <input
                type="datetime-local"
                value={newReminderInput}
                onChange={(e) => setNewReminderInput(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              />
              <button
                type="submit"
                disabled={!newReminderInput}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 disabled:opacity-40"
              >
                Add Reminder
              </button>
            </form>
          </div>

          {/* Time Tracking */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Time Tracked vs Est. ({task.estimatedMinutes}m)
              </div>
              <div className="font-mono text-base font-medium text-slate-900 dark:text-white tabular-nums mt-0.5">
                {formatTimerSeconds(totalTrackedSeconds)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => patch({ actualSeconds: task.actualSeconds + 900 })}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => onToggleTimer(task.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${
                  isTimerRunning
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 dark:border-white/15'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                <span>{isTimerRunning ? 'Pause' : 'Start Timer'}</span>
              </button>
            </div>
          </div>

          {/* Subtasks with Progress Bar */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">
                Subtasks ({subtasksDone}/{task.subtasks.length})
              </h3>
              {task.subtasks.length > 0 && (
                <span className="font-mono tabular-nums text-slate-400">{subtaskPct}%</span>
              )}
            </div>
            {task.subtasks.length > 0 && (
              <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
                <div className="h-full accent-bg transition-all" style={{ width: `${subtaskPct}%` }} />
              </div>
            )}
            <div className="space-y-1.5">
              {task.subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between gap-2 py-1 group">
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        subtasks: task.subtasks.map((s) =>
                          s.id === sub.id ? { ...s, completed: !s.completed } : s
                        ),
                      })
                    }
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0"
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
                      className={`text-sm truncate ${
                        sub.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ subtasks: task.subtasks.filter((s) => s.id !== sub.id) })}
                    className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add checklist step..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15"
              >
                Add
              </button>
            </form>
          </div>

          {/* Tags */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 space-y-2">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Tags & Labels
            </h3>
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                {task.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1">
                    <span>@{tag}</span>
                    <button
                      type="button"
                      onClick={() => patch({ tags: task.tags.filter((t) => t !== tag) })}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form onSubmit={handleAddTag} className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              />
              <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15">
                Add
              </button>
            </form>
          </div>

          {/* Dependencies */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 space-y-2">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Dependencies (Blocked By)
            </h3>
            {task.dependsOn.map((depId) => {
              const depTask = allTasks.find((t) => t.id === depId);
              if (!depTask) return null;
              return (
                <div key={depId} className="flex items-center justify-between text-xs py-1">
                  <span className={depTask.status === 'done' ? 'line-through text-slate-400' : ''}>
                    {depTask.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => patch({ dependsOn: task.dependsOn.filter((id) => id !== depId) })}
                    className="text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <div className="flex gap-2">
              <select
                value={depToAdd}
                onChange={(e) => setDepToAdd(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              >
                <option value="">Select blocking task...</option>
                {availableDeps.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!depToAdd}
                onClick={() => {
                  if (!depToAdd) return;
                  patch({ dependsOn: [...task.dependsOn, depToAdd] });
                  setDepToAdd('');
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 disabled:opacity-40"
              >
                Link
              </button>
            </div>
          </div>

          {/* Links & Local Attachments */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              <span>Links & Local Attachments</span>
            </h3>
            {task.links.map((lnk) => (
              <div key={lnk.id} className="flex items-center justify-between text-xs gap-2">
                <a
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 accent-text hover:underline truncate"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lnk.label}</span>
                </a>
                <button
                  type="button"
                  onClick={() => patch({ links: task.links.filter((l) => l.id !== lnk.id) })}
                  className="text-slate-400 hover:text-red-600 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <form onSubmit={handleAddLink} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input
                type="text"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="Label"
                className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              />
              <input
                type="text"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://..."
                className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 inline-flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Link</span>
              </button>
            </form>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                <span>Files ({task.attachments.length})</span>
              </span>
              <label className="cursor-pointer px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-white/15">
                <span>Attach File</span>
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            {task.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg border border-slate-200/70 dark:border-white/10"
              >
                <span className="truncate">
                  {att.name} ({Math.max(1, Math.round(att.size / 1024))} KB)
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={att.dataUrl} download={att.name} className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => patch({ attachments: task.attachments.filter((a) => a.id !== att.id) })}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Comments & Activity Log */}
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments & Activity History</span>
            </h3>

            {(task.comments || []).map((cmt) => (
              <div key={cmt.id} className="p-2.5 rounded-lg glass-panel text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{cmt.author}</span>
                  <span className="font-mono">{new Date(cmt.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-200">{cmt.text}</p>
              </div>
            ))}

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment or update..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg accent-bg inline-flex items-center gap-1 disabled:opacity-40"
              >
                <Send className="w-3 h-3" />
                <span>Post</span>
              </button>
            </form>

            {(task.activityLog || []).length > 0 && (
              <div className="pt-2 space-y-1 text-[11px] text-slate-400">
                {(task.activityLog || []).slice(0, 6).map((act) => (
                  <div key={act.id} className="flex justify-between gap-2">
                    <span>
                      {act.actor}: {act.action}
                    </span>
                    <span className="font-mono shrink-0">
                      {new Date(act.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
