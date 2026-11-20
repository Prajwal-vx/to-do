import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  BookmarkPlus,
  Download,
  Filter,
  ListFilter,
  Milestone,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  EnergyLevel,
  FilterCriteria,
  MemberRole,
  Priority,
  Project,
  SavedFilter,
  SortOption,
  Task,
  UserSettings,
  ViewType,
} from '../types/todo';
import { addDays, getTodayStr } from '../utils/date';
import {
  exportProjectSharePackage,
  parseProjectSharePackage,
  ProjectSharePackage,
} from '../utils/exportImport';
import { computeTaskScore } from '../utils/rulesEngine';
import { TaskRow } from './TaskRow';

interface TaskListViewProps {
  mode: Extract<
    ViewType,
    | 'today'
    | 'upcoming'
    | 'inbox'
    | 'all'
    | 'completed'
    | 'overdue'
    | 'favorites'
    | 'parking_lot'
    | 'quick_wins'
    | 'project'
    | 'saved_filter'
    | 'archive'
  >;
  tasks: Task[];
  projects: Project[];
  settings: UserSettings;
  selectedProject?: Project;
  selectedSavedFilter?: SavedFilter;
  searchQuery: string;
  activeTimerTaskId: string | null;
  activeTimerElapsed: number;
  onOpenQuickCapture: () => void;
  onSaveFilter: (name: string, criteria: FilterCriteria) => void;
  onUpdateProject: (project: Project) => void;
  onImportProjectShare: (pkg: ProjectSharePackage) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleTop3: (taskId: string) => void;
  onToggleFavorite: (taskId: string) => void;
  onSnoozeTomorrow: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onToggleTimer: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onTrash: (taskId: string) => void;
  onRestore: (taskId: string) => void;
  onDeleteForever: (taskId: string) => void;
  onEmptyTrash: () => void;
  onReorderTasks: (sourceId: string, targetId: string) => void;
  onBulkAction: (
    ids: string[],
    action:
      | 'complete'
      | 'today'
      | 'tomorrow'
      | 'archive'
      | 'trash'
      | 'priority_high'
      | 'move_project',
    projectId?: string | null
  ) => void;
  onNotify: (msg: string) => void;
}

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const ENERGY_RANK: Record<EnergyLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export const TaskListView: React.FC<TaskListViewProps> = ({
  mode,
  tasks,
  projects,
  settings,
  selectedProject,
  selectedSavedFilter,
  searchQuery,
  activeTimerTaskId,
  activeTimerElapsed,
  onOpenQuickCapture,
  onSaveFilter,
  onUpdateProject,
  onImportProjectShare,
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
  onEmptyTrash,
  onReorderTasks,
  onBulkAction,
  onNotify,
}) => {
  const today = getTodayStr();
  const nowIso = new Date().toISOString();
  const shareInputRef = useRef<HTMLInputElement | null>(null);

  const [sortBy, setSortBy] = useState<SortOption>(
    mode === 'quick_wins' ? 'quick_wins' : 'smart'
  );
  const [showFilters, setShowFilters] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'done' | 'all'>('active');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [savingFilterName, setSavingFilterName] = useState('');
  const [showSaveFilterInput, setShowSaveFilterInput] = useState(false);

  // Project section & member controls
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showCollabPanel, setShowCollabPanel] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('editor');

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [archiveTab, setArchiveTab] = useState<'archived' | 'trashed'>('archived');

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => t.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [tasks]);

  const scoredMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeTaskScore>>();
    tasks.forEach((t) => {
      map.set(t.id, computeTaskScore(t, tasks, today));
    });
    return map;
  }, [tasks, today]);

  const projectStats = useMemo(() => {
    if (!selectedProject) return null;
    const pTasks = tasks.filter(
      (t) => t.projectId === selectedProject.id && t.status !== 'trashed' && t.status !== 'archived'
    );
    const done = pTasks.filter((t) => t.status === 'done').length;
    const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
    return { total: pTasks.length, done, pct };
  }, [selectedProject, tasks]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = tasks.filter((t) => {
      if (mode === 'archive') {
        return t.status === archiveTab;
      }
      if (t.status === 'archived' || t.status === 'trashed') return false;

      if (mode === 'today') {
        return t.status !== 'done' && t.status !== 'parking_lot' && Boolean(t.dueDate && t.dueDate <= today);
      }

      if (mode === 'completed') {
        if (t.status !== 'done') return false;
      } else if (mode === 'parking_lot') {
        if (t.status !== 'parking_lot') return false;
      } else {
        if (t.status === 'parking_lot') return false;
        const isSnoozed = Boolean(t.snoozedUntil && t.snoozedUntil > nowIso);
        if (isSnoozed && t.status !== 'done') return false;
      }

      if (mode === 'inbox') {
        if (t.projectId !== null) return false;
      } else if (mode === 'project' && selectedProject) {
        if (t.projectId !== selectedProject.id) return false;
        if (sectionFilter !== 'all' && t.sectionId !== (sectionFilter === 'none' ? null : sectionFilter)) {
          return false;
        }
      } else if (mode === 'upcoming') {
        if (!t.dueDate || t.dueDate <= today) return false;
      } else if (mode === 'overdue') {
        if (!t.dueDate || t.dueDate >= today || t.status === 'done') return false;
      } else if (mode === 'favorites') {
        if (!t.isFavorite) return false;
      } else if (mode === 'quick_wins') {
        if (t.estimatedMinutes > 15 || t.status === 'done') return false;
      } else if (mode === 'saved_filter' && selectedSavedFilter) {
        const c = selectedSavedFilter.criteria;
        if (c.statusFilter === 'active' && t.status === 'done') return false;
        if (c.priorities?.length && !c.priorities.includes(t.priority)) return false;
        if (c.energies?.length && !c.energies.includes(t.energy)) return false;
        if (c.maxMinutes && t.estimatedMinutes > c.maxMinutes) return false;
        if (c.tags?.length && !c.tags.some((tg) => t.tags.includes(tg))) return false;
        if (c.overdueOnly && (!t.dueDate || t.dueDate >= today)) return false;
      }

      if (
        mode !== 'saved_filter' &&
        mode !== 'completed' &&
        mode !== 'parking_lot' &&
        mode !== 'overdue' &&
        mode !== 'quick_wins'
      ) {
        if (statusFilter === 'active' && t.status === 'done') return false;
        if (statusFilter === 'done' && t.status !== 'done') return false;
      }

      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (energyFilter !== 'all' && t.energy !== energyFilter) return false;
      if (tagFilter !== 'all' && !t.tags.includes(tagFilter)) return false;
      if (maxMinutes !== null && t.estimatedMinutes > maxMinutes) return false;

      if (q) {
        const match =
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tg) => tg.includes(q));
        if (!match) return false;
      }

      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'smart') {
        return (scoredMap.get(b.id)?.score || 0) - (scoredMap.get(a.id)?.score || 0);
      }
      if (sortBy === 'manual') return a.order - b.order;
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sortBy === 'priority') return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (sortBy === 'effort') return ENERGY_RANK[a.energy] - ENERGY_RANK[b.energy];
      if (sortBy === 'quick_wins') {
        const aQuick = a.estimatedMinutes <= 15 ? 0 : 1;
        const bQuick = b.estimatedMinutes <= 15 ? 0 : 1;
        if (aQuick !== bQuick) return aQuick - bQuick;
        if (a.estimatedMinutes !== b.estimatedMinutes) {
          return a.estimatedMinutes - b.estimatedMinutes;
        }
        return (scoredMap.get(b.id)?.score || 0) - (scoredMap.get(a.id)?.score || 0);
      }
      if (sortBy === 'duration') return a.estimatedMinutes - b.estimatedMinutes;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return list;
  }, [
    tasks,
    mode,
    archiveTab,
    nowIso,
    selectedProject,
    sectionFilter,
    selectedSavedFilter,
    today,
    statusFilter,
    priorityFilter,
    energyFilter,
    tagFilter,
    maxMinutes,
    searchQuery,
    sortBy,
    scoredMap,
  ]);

  const upcomingGroups = useMemo(() => {
    if (mode !== 'upcoming') return null;
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(today, 7);
    return [
      { label: 'Tomorrow', items: filteredTasks.filter((t) => t.dueDate === tomorrow) },
      {
        label: 'Next 7 Days',
        items: filteredTasks.filter((t) => t.dueDate! > tomorrow && t.dueDate! <= nextWeek),
      },
      { label: 'Later', items: filteredTasks.filter((t) => t.dueDate! > nextWeek) },
    ].filter((g) => g.items.length > 0);
  }, [mode, filteredTasks, today]);

  const handleSaveCurrentFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savingFilterName.trim()) return;
    onSaveFilter(savingFilterName.trim(), {
      priorities: priorityFilter !== 'all' ? [priorityFilter] : undefined,
      energies: energyFilter !== 'all' ? [energyFilter] : undefined,
      tags: tagFilter !== 'all' ? [tagFilter] : undefined,
      maxMinutes,
      statusFilter: statusFilter === 'done' ? 'done' : 'active',
    });
    setSavingFilterName('');
    setShowSaveFilterInput(false);
  };

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newSectionTitle.trim()) return;
    onUpdateProject({
      ...selectedProject,
      sections: [
        ...selectedProject.sections,
        {
          id: `sec-${Date.now()}`,
          title: newSectionTitle.trim(),
          order: selectedProject.sections.length,
        },
      ],
    });
    setNewSectionTitle('');
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newMemberName.trim()) return;
    onUpdateProject({
      ...selectedProject,
      members: [
        ...selectedProject.members,
        { id: `mem-${Date.now()}`, name: newMemberName.trim(), role: newMemberRole },
      ],
    });
    setNewMemberName('');
  };

  const handleShareFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const pkg = parseProjectSharePackage(txt);
      onImportProjectShare(pkg);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not import project package.');
    } finally {
      e.target.value = '';
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const viewSubtitle =
    mode === 'inbox'
      ? 'Uncategorized tasks waiting to be organized into projects or dates.'
      : mode === 'upcoming'
      ? 'Scheduled tasks across Tomorrow, Next 7 Days, and beyond.'
      : mode === 'overdue'
      ? 'Past-due active commitments needing immediate attention or rescheduling.'
      : mode === 'quick_wins'
      ? 'Short, actionable tasks (≤ 15 minutes) ready for quick momentum.'
      : mode === 'favorites'
      ? 'Bookmarked high-leverage tasks pinned across projects.'
      : mode === 'parking_lot'
      ? 'Ideas and backlog commitments parked safely outside active lists.'
      : mode === 'completed'
      ? 'Chronological record of completed tasks.'
      : mode === 'project' && selectedProject
      ? `Organize sections, milestone targets, and offline project share packages for ${selectedProject.name}.`
      : mode === 'saved_filter' && selectedSavedFilter
      ? `Saved filter: ${selectedSavedFilter.name}.`
      : mode === 'archive'
      ? 'Completed archive and trashed items ready for recovery or cleanup.'
      : 'Complete workspace task inventory with filtering, sorting, and bulk tools.';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{viewSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {mode === 'archive' ? (
            <div className="flex items-center gap-2">
              <div className="inline-flex p-0.5 rounded-lg glass-panel">
                <button
                  type="button"
                  onClick={() => setArchiveTab('archived')}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    archiveTab === 'archived'
                      ? 'accent-bg'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Archived
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveTab('trashed')}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    archiveTab === 'trashed'
                      ? 'accent-bg'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Trash
                </button>
              </div>
              {archiveTab === 'trashed' && filteredTasks.length > 0 && (
                <button
                  type="button"
                  onClick={onEmptyTrash}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300/60 dark:border-red-900/60 rounded-lg hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Trash</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {mode === 'project' && selectedProject && (
                <button
                  type="button"
                  onClick={() => setShowCollabPanel((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    showCollabPanel
                      ? 'accent-soft-bg border-transparent'
                      : 'glass-panel text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Sections & Share ({selectedProject.members.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  showFilters
                    ? 'accent-soft-bg border-transparent'
                    : 'glass-panel text-slate-600 dark:text-slate-300'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="smart">Sort: Smart Score</option>
                  <option value="quick_wins">Sort: Quick Wins (≤15m)</option>
                  <option value="dueDate">Sort: Due Date</option>
                  <option value="priority">Sort: Priority</option>
                  <option value="effort">Sort: Lowest Effort</option>
                  <option value="duration">Sort: Shortest Duration</option>
                  <option value="manual">Sort: Manual Order</option>
                  <option value="createdAt">Sort: Newest</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBulkMode((v) => !v);
                  setSelectedIds([]);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                  bulkMode
                    ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                    : 'glass-panel text-slate-600 dark:text-slate-300'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Select</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Project Milestone & Section Header */}
      {mode === 'project' && selectedProject && projectStats && (
        <div className="rounded-xl glass-panel p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: selectedProject.color }}
              />
              <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                {selectedProject.milestoneTitle || `${selectedProject.name} Progress`}
              </span>
              {selectedProject.milestoneTargetDate && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                  <Milestone className="w-3.5 h-3.5" />
                  Target {selectedProject.milestoneTargetDate}
                </span>
              )}
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {projectStats.done}/{projectStats.total} tasks ({projectStats.pct}%)
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full accent-bg transition-all"
              style={{ width: `${projectStats.pct}%` }}
            />
          </div>

          {selectedProject.sections.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <button
                type="button"
                onClick={() => setSectionFilter('all')}
                className={`px-2.5 py-1 rounded-md ${
                  sectionFilter === 'all'
                    ? 'accent-soft-bg font-medium'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Sections
              </button>
              {selectedProject.sections.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSectionFilter(sec.id)}
                  className={`px-2.5 py-1 rounded-md ${
                    sectionFilter === sec.id
                      ? 'accent-soft-bg font-medium'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sec.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSectionFilter('none')}
                className={`px-2.5 py-1 rounded-md ${
                  sectionFilter === 'none'
                    ? 'accent-soft-bg font-medium'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Unsectioned
              </button>
            </div>
          )}

          {showCollabPanel && (
            <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  Sections
                </div>
                <form onSubmit={handleAddSection} className="flex gap-1.5">
                  <input
                    type="text"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="New section title..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/60"
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-lg accent-bg font-medium">
                    Add
                  </button>
                </form>
                <div className="font-semibold text-slate-700 dark:text-slate-200 pt-2">
                  Offline Project Share Package
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Export or import a portable `.todo-share.json` package with collaborators without cloud accounts.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportProjectSharePackage(selectedProject, tasks)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Share Package</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shareInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Share Package</span>
                  </button>
                  <input
                    ref={shareInputRef}
                    type="file"
                    accept=".json,.todo-share.json"
                    onChange={handleShareFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  Local Members & Roles
                </div>
                <div className="space-y-1">
                  {selectedProject.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-white/10 last:border-0"
                    >
                      <span className="text-slate-800 dark:text-slate-100">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          onChange={(e) =>
                            onUpdateProject({
                              ...selectedProject,
                              members: selectedProject.members.map((mem) =>
                                mem.id === m.id
                                  ? { ...mem, role: e.target.value as MemberRole }
                                  : mem
                              ),
                            })
                          }
                          className="bg-transparent text-slate-500 dark:text-slate-400 capitalize"
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {selectedProject.members.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateProject({
                                ...selectedProject,
                                members: selectedProject.members.filter((x) => x.id !== m.id),
                              })
                            }
                            className="text-slate-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddMember} className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Add member name..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/60"
                  />
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/60"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                    <option value="owner">Owner</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg accent-bg font-medium"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Filter Builder */}
      {showFilters && mode !== 'archive' && (
        <div className="p-4 rounded-xl glass-panel space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'done' | 'all')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100"
            >
              <option value="active">Status: Active</option>
              <option value="done">Status: Completed</option>
              <option value="all">Status: All</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100"
            >
              <option value="all">Priority: All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={energyFilter}
              onChange={(e) => setEnergyFilter(e.target.value as EnergyLevel | 'all')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100"
            >
              <option value="all">Energy: All</option>
              <option value="low">Low effort</option>
              <option value="medium">Medium effort</option>
              <option value="high">High effort</option>
            </select>

            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100"
            >
              <option value="all">Tags: All</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  @{t}
                </option>
              ))}
            </select>

            <select
              value={maxMinutes ?? ''}
              onChange={(e) => setMaxMinutes(e.target.value ? Number(e.target.value) : null)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100"
            >
              <option value="">Duration: Any</option>
              <option value="5">≤ 5 min</option>
              <option value="15">≤ 15 min</option>
              <option value="30">≤ 30 min</option>
              <option value="60">≤ 60 min</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setPriorityFilter('all');
                setEnergyFilter('all');
                setTagFilter('all');
                setMaxMinutes(null);
                setStatusFilter('active');
              }}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Reset filters
            </button>

            {showSaveFilterInput ? (
              <form onSubmit={handleSaveCurrentFilter} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={savingFilterName}
                  onChange={(e) => setSavingFilterName(e.target.value)}
                  placeholder="Filter name..."
                  autoFocus
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
                />
                <button type="submit" className="px-2.5 py-1 rounded accent-bg font-medium">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveFilterInput(false)}
                  className="px-2 py-1 text-slate-500"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveFilterInput(true)}
                className="inline-flex items-center gap-1.5 accent-text font-medium hover:underline"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save as Filter</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Toolbar */}
      {bulkMode && selectedIds.length > 0 && mode !== 'archive' && (
        <div className="px-4 py-2.5 rounded-xl glass-panel flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-800 dark:text-slate-100 tabular-nums">
            {selectedIds.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'complete');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md accent-bg font-medium"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'today');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/15"
            >
              Schedule Today
            </button>
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'tomorrow');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/15"
            >
              Snooze Tomorrow
            </button>
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'priority_high');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/15"
            >
              Set High Priority
            </button>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === '__none__') {
                  onBulkAction(selectedIds, 'move_project', null);
                } else if (e.target.value) {
                  onBulkAction(selectedIds, 'move_project', e.target.value);
                }
                setSelectedIds([]);
              }}
              className="px-2 py-1 rounded-md border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-slate-900/70"
            >
              <option value="" disabled>
                Move to project...
              </option>
              <option value="__none__">Inbox</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                onBulkAction(selectedIds, 'trash');
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 rounded-md bg-red-600 text-white"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* List Body */}
      {mode === 'upcoming' && upcomingGroups && upcomingGroups.length > 0 ? (
        <div className="space-y-5">
          {upcomingGroups.map((grp) => (
            <section key={grp.label} className="rounded-xl glass-panel overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span>{grp.label}</span>
                <span className="text-slate-400 font-normal tabular-nums">{grp.items.length}</span>
              </div>
              {grp.items.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  project={task.projectId ? projectMap.get(task.projectId) : undefined}
                  scoreInfo={scoredMap.get(task.id)}
                  density={settings.density}
                  isSelected={selectedIds.includes(task.id)}
                  bulkMode={bulkMode}
                  activeTimerTaskId={activeTimerTaskId}
                  activeTimerElapsed={activeTimerElapsed}
                  onToggleSelect={toggleSelect}
                  onToggleComplete={onToggleComplete}
                  onToggleTop3={onToggleTop3}
                  onToggleFavorite={onToggleFavorite}
                  onSnoozeTomorrow={onSnoozeTomorrow}
                  onOpenDetail={onOpenDetail}
                  onStartFocus={onStartFocus}
                  onToggleTimer={onToggleTimer}
                  onDuplicate={onDuplicate}
                  onArchive={onArchive}
                  onTrash={onTrash}
                />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <section className="rounded-xl glass-panel overflow-hidden">
          {filteredTasks.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No tasks match this view.
              </p>
              {mode !== 'archive' && (
                <button
                  type="button"
                  onClick={onOpenQuickCapture}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg accent-bg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Task</span>
                </button>
              )}
            </div>
          ) : (
            filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                project={task.projectId ? projectMap.get(task.projectId) : undefined}
                scoreInfo={scoredMap.get(task.id)}
                showScoreReason={sortBy === 'smart'}
                density={settings.density}
                isSelected={selectedIds.includes(task.id)}
                bulkMode={bulkMode}
                activeTimerTaskId={activeTimerTaskId}
                activeTimerElapsed={activeTimerElapsed}
                draggable={sortBy === 'manual' && mode !== 'archive'}
                onDragStart={(_, id) => setDraggedTaskId(id)}
                onDrop={(_, targetId) => {
                  if (draggedTaskId && draggedTaskId !== targetId) {
                    onReorderTasks(draggedTaskId, targetId);
                  }
                  setDraggedTaskId(null);
                }}
                onToggleSelect={toggleSelect}
                onToggleComplete={onToggleComplete}
                onToggleTop3={onToggleTop3}
                onToggleFavorite={onToggleFavorite}
                onSnoozeTomorrow={onSnoozeTomorrow}
                onOpenDetail={onOpenDetail}
                onStartFocus={onStartFocus}
                onToggleTimer={onToggleTimer}
                onDuplicate={onDuplicate}
                onArchive={onArchive}
                onTrash={onTrash}
                onRestore={mode === 'archive' ? onRestore : undefined}
                onDeleteForever={mode === 'archive' ? onDeleteForever : undefined}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
};
