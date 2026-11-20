import React, { useMemo, useState } from 'react';
import { Check, Flame, Play, Plus } from 'lucide-react';
import { Project, Task } from '../types/todo';
import { formatDuration, formatShortDate } from '../utils/date';

interface EisenhowerViewProps {
  tasks: Task[];
  projects: Project[];
  searchQuery: string;
  onUpdateTask: (updated: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onCreateInQuadrant: (title: string, important: boolean, urgent: boolean) => void;
}

const QUADRANTS = [
  {
    key: 'do',
    title: 'Do Now',
    subtitle: 'Important & Urgent',
    important: true,
    urgent: true,
    accent: 'text-red-600 dark:text-red-400',
  },
  {
    key: 'schedule',
    title: 'Schedule',
    subtitle: 'Important & Not Urgent',
    important: true,
    urgent: false,
    accent: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    key: 'delegate',
    title: 'Delegate / Batch',
    subtitle: 'Not Important & Urgent',
    important: false,
    urgent: true,
    accent: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'defer',
    title: 'Defer / Eliminate',
    subtitle: 'Not Important & Not Urgent',
    important: false,
    urgent: false,
    accent: 'text-slate-500 dark:text-slate-400',
  },
];

export const EisenhowerView: React.FC<EisenhowerViewProps> = ({
  tasks,
  projects,
  searchQuery,
  onUpdateTask,
  onToggleComplete,
  onOpenDetail,
  onStartFocus,
  onCreateInQuadrant,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [doNowOnly, setDoNowOnly] = useState(false);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const activeTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (t.status !== 'todo' && t.status !== 'in_progress') return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.tags.some((tg) => tg.includes(q))) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery]);

  const handleDrop = (important: boolean, urgent: boolean) => {
    if (!draggedId) return;
    const t = tasks.find((x) => x.id === draggedId);
    if (!t) return;
    onUpdateTask({
      ...t,
      important,
      urgent,
      priority: important && urgent ? 'urgent' : important ? 'high' : urgent ? 'medium' : 'low',
      updatedAt: new Date().toISOString(),
    });
    setDraggedId(null);
  };

  const visibleQuadrants = doNowOnly ? QUADRANTS.slice(0, 1) : QUADRANTS;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Drag tasks across quadrants to reclassify importance and urgency using the Eisenhower Priority Matrix.
        </p>

        <button
          type="button"
          onClick={() => setDoNowOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors self-start whitespace-nowrap ${
            doNowOnly
              ? 'bg-red-600 text-white border-transparent'
              : 'glass-panel text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{doNowOnly ? 'Showing Do Now Only (Reset)' : 'Filter: Do Now'}</span>
        </button>
      </div>

      <div className={`grid grid-cols-1 ${doNowOnly ? '' : 'md:grid-cols-2'} gap-4`}>
        {visibleQuadrants.map((q) => {
          const qTasks = activeTasks.filter(
            (t) => Boolean(t.important) === q.important && Boolean(t.urgent) === q.urgent
          );
          return (
            <section
              key={q.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(q.important, q.urgent)}
              className="rounded-xl glass-panel flex flex-col min-h-[280px]"
            >
              <div className="px-4 py-3 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between">
                <div>
                  <h3 className={`font-display text-sm font-semibold ${q.accent}`}>{q.title}</h3>
                  <p className="text-xs text-slate-400">{q.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {qTasks.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingKey(q.key);
                      setNewTitle('');
                    }}
                    aria-label={`Add task to ${q.title}`}
                    className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-2 flex-1 max-h-[380px] overflow-y-auto">
                {addingKey === q.key && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newTitle.trim()) return;
                      onCreateInQuadrant(newTitle.trim(), q.important, q.urgent);
                      setNewTitle('');
                      setAddingKey(null);
                    }}
                    className="p-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white/70 dark:bg-slate-900/60 space-y-2"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Task title..."
                      className="w-full text-xs bg-transparent text-slate-900 dark:text-white focus:outline-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddingKey(null)}
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

                {qTasks.length === 0 && addingKey !== q.key ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No tasks in {q.title}
                  </div>
                ) : (
                  qTasks.map((task) => {
                    const proj = task.projectId ? projectMap.get(task.projectId) : undefined;
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDraggedId(task.id)}
                        onDragEnd={() => setDraggedId(null)}
                        className="group p-2.5 rounded-lg border border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 cursor-grab flex items-start justify-between gap-2 transition-colors"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => onToggleComplete(task.id)}
                            className="mt-0.5 w-4 h-4 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0 hover:border-slate-500"
                            aria-label={`Complete ${task.title}`}
                          >
                            {task.status === 'done' && <Check className="w-3 h-3" />}
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpenDetail(task.id)}
                              className="text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline truncate block"
                            >
                              {task.title}
                            </button>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {proj ? proj.name : 'Inbox'} · {formatDuration(task.estimatedMinutes)}
                              {task.dueDate ? ` · ${formatShortDate(task.dueDate)}` : ''}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onStartFocus(task.id)}
                          title="Focus One"
                          className="p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-900 dark:hover:text-white shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
