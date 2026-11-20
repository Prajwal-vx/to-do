import React, { useMemo, useState } from 'react';
import { Check, Clock, Flag, Play, Plus, Star, Zap } from 'lucide-react';
import { EnergyLevel, Priority, Project, Task, TaskStatus } from '../types/todo';
import { formatDuration, formatShortDate, getTodayStr } from '../utils/date';

interface KanbanViewProps {
  tasks: Task[];
  projects: Project[];
  searchQuery: string;
  onUpdateTask: (updated: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onQuickCreateInColumn: (
    title: string,
    overrides: Partial<Pick<Task, 'status' | 'priority' | 'energy'>>
  ) => void;
}

type GroupMode = 'status' | 'priority' | 'energy';

export const KanbanView: React.FC<KanbanViewProps> = ({
  tasks,
  projects,
  searchQuery,
  onUpdateTask,
  onToggleComplete,
  onOpenDetail,
  onStartFocus,
  onQuickCreateInColumn,
}) => {
  const [groupMode, setGroupMode] = useState<GroupMode>('status');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [newColTitle, setNewColTitle] = useState('');

  const today = getTodayStr();
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const activeOrDone = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (t.status === 'archived' || t.status === 'trashed') return false;
      if (groupMode !== 'status' && t.status === 'done') return false;
      if (q) {
        return (
          t.title.toLowerCase().includes(q) ||
          t.tags.some((tg) => tg.includes(q))
        );
      }
      return true;
    });
  }, [tasks, groupMode, searchQuery]);

  const columns: {
    key: string;
    label: string;
    patch: Partial<Pick<Task, 'status' | 'priority' | 'energy'>>;
  }[] = useMemo(() => {
    if (groupMode === 'status') {
      return [
        { key: 'todo', label: 'To Do', patch: { status: 'todo' as TaskStatus } },
        { key: 'in_progress', label: 'In Progress', patch: { status: 'in_progress' as TaskStatus } },
        { key: 'done', label: 'Completed', patch: { status: 'done' as TaskStatus } },
      ];
    }
    if (groupMode === 'priority') {
      return [
        { key: 'urgent', label: 'Urgent', patch: { priority: 'urgent' as Priority } },
        { key: 'high', label: 'High', patch: { priority: 'high' as Priority } },
        { key: 'medium', label: 'Medium', patch: { priority: 'medium' as Priority } },
        { key: 'low', label: 'Low', patch: { priority: 'low' as Priority } },
      ];
    }
    return [
      { key: 'high', label: 'High Energy', patch: { energy: 'high' as EnergyLevel } },
      { key: 'medium', label: 'Medium Energy', patch: { energy: 'medium' as EnergyLevel } },
      { key: 'low', label: 'Low Energy', patch: { energy: 'low' as EnergyLevel } },
    ];
  }, [groupMode]);

  const getTasksForColumn = (colKey: string) => {
    return activeOrDone.filter((t) => {
      if (groupMode === 'status') return t.status === colKey;
      if (groupMode === 'priority') return t.priority === colKey;
      return t.energy === colKey;
    });
  };

  const handleDropOnColumn = (patch: Partial<Pick<Task, 'status' | 'priority' | 'energy'>>) => {
    if (!draggedId) return;
    const task = tasks.find((t) => t.id === draggedId);
    if (!task) return;

    const nextStatus = patch.status ?? task.status;
    onUpdateTask({
      ...task,
      ...patch,
      completedAt:
        patch.status === 'done'
          ? new Date().toISOString()
          : patch.status
          ? null
          : task.completedAt,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
    setDraggedId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Drag tasks between columns to update status, priority, or effort level.
        </p>

        <div className="inline-flex items-center p-0.5 rounded-lg glass-panel self-start">
          {(
            [
              ['status', 'By Status'],
              ['priority', 'By Priority'],
              ['energy', 'By Energy'],
            ] as [GroupMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGroupMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                groupMode === mode
                  ? 'accent-bg'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 items-start ${
          columns.length === 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'
        }`}
      >
        {columns.map((col) => {
          const colTasks = getTasksForColumn(col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnColumn(col.patch)}
              className="rounded-xl glass-panel flex flex-col min-h-[420px]"
            >
              <div className="px-3.5 py-3 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    {col.label}
                  </h3>
                  <span className="text-xs text-slate-400 tabular-nums">{colTasks.length}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCol(col.key);
                    setNewColTitle('');
                  }}
                  aria-label={`Add task to ${col.label}`}
                  className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2.5 space-y-2 flex-1">
                {addingCol === col.key && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newColTitle.trim()) return;
                      onQuickCreateInColumn(newColTitle.trim(), col.patch);
                      setNewColTitle('');
                      setAddingCol(null);
                    }}
                    className="p-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white/75 dark:bg-slate-900/70 space-y-2"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={newColTitle}
                      onChange={(e) => setNewColTitle(e.target.value)}
                      placeholder="Task title..."
                      className="w-full text-xs bg-transparent text-slate-900 dark:text-white focus:outline-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddingCol(null)}
                        className="px-2 py-1 text-xs text-slate-500"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="px-2.5 py-1 text-xs rounded accent-bg font-medium">
                        Add
                      </button>
                    </div>
                  </form>
                )}

                {colTasks.map((task) => {
                  const proj = task.projectId ? projectMap.get(task.projectId) : undefined;
                  const done = task.status === 'done';
                  const overdue = !done && task.dueDate && task.dueDate < today;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedId(task.id)}
                      onDragEnd={() => setDraggedId(null)}
                      className="group p-3 rounded-lg border border-slate-200/70 dark:border-white/10 bg-white/55 dark:bg-white/5 hover:bg-white/85 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleComplete(task.id)}
                          aria-label={`Toggle ${task.title}`}
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            done
                              ? 'accent-bg border-transparent'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {done && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDetail(task.id)}
                          className={`text-left text-sm font-medium leading-snug flex-1 ${
                            done
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {task.title}
                        </button>
                        {task.top3Date === today && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pl-6">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                          <span>{proj ? proj.name : 'Inbox'}</span>
                          {task.dueDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                                {formatShortDate(task.dueDate)}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatDuration(task.estimatedMinutes)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Flag className="w-3 h-3" />
                          <Zap className="w-3 h-3" />
                          {!done && (
                            <button
                              type="button"
                              onClick={() => onStartFocus(task.id)}
                              title="Focus Mode"
                              className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {task.subtasks.length > 0 && (
                        <div className="pl-6 text-xs text-slate-400 tabular-nums flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} steps
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {colTasks.length === 0 && addingCol !== col.key && (
                  <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
