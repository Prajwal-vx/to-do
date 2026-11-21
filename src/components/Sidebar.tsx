import React, { useState } from 'react';
import {
  BarChart3,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Columns3,
  Filter,
  Folder as FolderIcon,
  FolderPlus,
  GanttChartSquare,
  Grid2x2,
  House,
  Inbox,
  Layers,
  ListChecks,
  LogOut,
  ParkingCircle,
  Plus,
  Radar,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Table2,
  Trash2,
  AlertCircle,
  X,
  Zap,
} from 'lucide-react';
import { Folder, LanguageCode, Project, SavedFilter, Task, ViewType, Workspace } from '../types/todo';
import { getTodayStr } from '../utils/date';
import { tLabel } from '../utils/i18n';

interface SidebarProps {
  activeView: ViewType;
  selectedWorkspaceId: string | 'ALL';
  selectedProjectId: string | null;
  selectedSavedFilterId: string | null;
  workspaces: Workspace[];
  tasks: Task[];
  projects: Project[];
  folders: Folder[];
  savedFilters: SavedFilter[];
  language: LanguageCode;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectWorkspace: (wsId: string | 'ALL') => void;
  onCreateWorkspace: (name: string) => void;
  onSelectView: (view: ViewType, projectId?: string | null, filterId?: string | null) => void;
  onCreateProject: (name: string, color: string, folderId: string | null, parentProjectId: string | null) => void;
  onDeleteProject: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteSavedFilter: (id: string) => void;
  onOpenWeeklyReset: () => void;
  onOpenSettings: () => void;
  profileName?: string;
  profileEmail?: string;
  profileImage?: string | null;
  onSignOut: () => void;
}

const PROJECT_COLORS = ['#4f46e5', '#0284c7', '#059669', '#d97706', '#e11d48', '#64748b'];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  selectedWorkspaceId,
  selectedProjectId,
  selectedSavedFilterId,
  workspaces,
  tasks,
  projects,
  folders,
  savedFilters,
  language,
  mobileOpen,
  onCloseMobile,
  onSelectWorkspace,
  onCreateWorkspace,
  onSelectView,
  onCreateProject,
  onDeleteProject,
  onCreateFolder,
  onDeleteFolder,
  onDeleteSavedFilter,
  onOpenWeeklyReset,
  onOpenSettings,
  profileName,
  profileEmail,
  profileImage,
  onSignOut,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [addingWs, setAddingWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [newProjectFolderId, setNewProjectFolderId] = useState<string | null>(null);
  const [newProjectParentId, setNewProjectParentId] = useState<string | null>(null);

  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const today = getTodayStr();
  const wsTasks =
    selectedWorkspaceId === 'ALL'
      ? tasks
      : tasks.filter((t) => t.workspaceId === selectedWorkspaceId);

  const activeTasks = wsTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const todayCount = activeTasks.filter((t) => t.dueDate && t.dueDate <= today).length;
  const upcomingCount = activeTasks.filter((t) => t.dueDate && t.dueDate > today).length;
  const overdueCount = activeTasks.filter((t) => t.dueDate && t.dueDate < today).length;
  const inboxCount = activeTasks.filter((t) => !t.projectId).length;
  const quickWinCount = activeTasks.filter((t) => t.estimatedMinutes <= 15).length;
  const parkingCount = wsTasks.filter((t) => t.status === 'parking_lot').length;
  const favCount = activeTasks.filter((t) => t.isFavorite).length;
  const completedCount = wsTasks.filter((t) => t.status === 'done').length;
  const archiveTrashCount = wsTasks.filter(
    (t) => t.status === 'archived' || t.status === 'trashed'
  ).length;

  const visibleProjects =
    selectedWorkspaceId === 'ALL'
      ? projects
      : projects.filter((p) => p.workspaceId === selectedWorkspaceId);

  const visibleFolders =
    selectedWorkspaceId === 'ALL'
      ? folders
      : folders.filter((f) => f.workspaceId === selectedWorkspaceId);

  const navItemClass = (isActive: boolean) =>
    `sidebar-nav-link w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-xl transition-colors whitespace-nowrap ${
      isActive
        ? 'sidebar-nav-active font-semibold'
        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
    }`;

  const renderProjectTree = (project: Project, depth = 0) => {
    const count = activeTasks.filter((t) => t.projectId === project.id).length;
    const isActive = activeView === 'project' && selectedProjectId === project.id;
    const children = visibleProjects.filter((p) => p.parentProjectId === project.id);

    return (
      <div key={project.id}>
        <div
          className="group flex items-center gap-1"
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          <button
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              onSelectView('project', project.id, null);
              onCloseMobile();
            }}
            className={navItemClass(isActive)}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate">{project.name}</span>
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums ml-2">{count}</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteProject(project.id)}
            aria-label={`Delete project ${project.name}`}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {children.map((c) => renderProjectTree(c, depth + 1))}
      </div>
    );
  };

  const rootProjects = visibleProjects.filter((p) => !p.folderId && !p.parentProjectId);

  const sidebarContent = (
    <div className="flex flex-col h-full glass-chrome border-r">
      {/* Brand + Workspace Selector */}
      <div className="sidebar-brand p-3 border-b border-slate-200/60 dark:border-white/10 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="sidebar-brand-logo w-10 h-10 rounded-xl accent-bg flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white">
                TaskFlow
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Plan · Focus · Achieve
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <select
            value={selectedWorkspaceId}
            onChange={(e) => {
              onSelectWorkspace(e.target.value);
              onCloseMobile();
            }}
            aria-label="Select workspace"
            className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-800 dark:text-slate-100 focus:outline-none"
          >
            <option value="ALL">All Workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAddingWs((v) => !v)}
            title="New Workspace"
            aria-label="New Workspace"
            className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {addingWs && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newWsName.trim()) return;
              onCreateWorkspace(newWsName.trim());
              setNewWsName('');
              setAddingWs(false);
            }}
            className="flex gap-1"
          >
            <input
              type="text"
              autoFocus
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Workspace name..."
              className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-slate-900/80"
            />
            <button type="submit" className="px-2 py-1 text-xs rounded accent-bg">
              Add
            </button>
          </form>
        )}
      </div>

      {/* Scrollable Navigation */}
      <nav aria-label="Main navigation" className="sidebar-navigation flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        <div className="sidebar-main-links space-y-1">
          {(
            [
              ['home', 'Home', House, null],
              ['today', 'Today', CalendarCheck2, todayCount],
              ['upcoming', 'Upcoming', Calendar, upcomingCount],
              ['favorites', tLabel(language, 'favorites'), Star, favCount],
              ['completed', 'Completed', CheckCircle2, completedCount],
              ['archive', tLabel(language, 'archive'), Trash2, archiveTrashCount],
            ] as const
          ).map(([viewKey, label, Icon, count]) => (
            <button
              key={viewKey}
              type="button"
              aria-current={activeView === viewKey ? 'page' : undefined}
              onClick={() => {
                onSelectView(viewKey);
                onCloseMobile();
              }}
              className={navItemClass(activeView === viewKey)}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </span>
              {count !== null && (
                <span className="text-[11px] text-slate-400 tabular-nums">{count}</span>
              )}
            </button>
          ))}
        </div>

        <details className="sidebar-more group">
          <summary className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-white">
            More views
          </summary>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              {(
                [
                  ['inbox', tLabel(language, 'inbox'), Inbox, inboxCount],
                  ['all', tLabel(language, 'allTasks'), Layers, activeTasks.length],
                  ['overdue', tLabel(language, 'overdue'), AlertCircle, overdueCount],
                  ['quick_wins', tLabel(language, 'quickWins'), Zap, quickWinCount],
                  ['parking_lot', tLabel(language, 'parkingLot'), ParkingCircle, parkingCount],
                ] as const
              ).map(([viewKey, label, Icon, count]) => (
                <button
                  key={viewKey}
                  type="button"
                  aria-current={activeView === viewKey ? 'page' : undefined}
                  onClick={() => {
                    onSelectView(viewKey);
                    onCloseMobile();
                  }}
                  className={navItemClass(activeView === viewKey)}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{count}</span>
                </button>
              ))}
            </div>

        {/* Workspace Views */}
        <div>
          <div className="px-3 mb-1 text-[11px] font-medium text-slate-400">
            Views & Planning
          </div>
          <div className="space-y-0.5">
            {[
              ['kanban', tLabel(language, 'kanban'), Columns3],
              ['table', tLabel(language, 'table'), Table2],
              ['timeline', tLabel(language, 'timeline'), GanttChartSquare],
              ['matrix', tLabel(language, 'matrix'), Grid2x2],
              ['calendar', tLabel(language, 'calendar'), Calendar],
              ['radar', tLabel(language, 'radar'), Radar],
              ['insights', tLabel(language, 'insights'), BarChart3],
              ['lists', tLabel(language, 'lists'), ListChecks],
            ].map(([viewKey, label, Icon]) => (
              <button
                key={viewKey as string}
                type="button"
                aria-current={activeView === viewKey ? 'page' : undefined}
                onClick={() => {
                  onSelectView(viewKey as ViewType);
                  onCloseMobile();
                }}
                className={navItemClass(activeView === viewKey)}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label as string}</span>
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                onOpenWeeklyReset();
                onCloseMobile();
              }}
              className={navItemClass(false)}
            >
              <span className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>{tLabel(language, 'weeklyReset')}</span>
              </span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </button>
          </div>
        </div>

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div>
            <div className="px-3 mb-1 text-[11px] font-medium text-slate-400">
              Saved Filters
            </div>
            <div className="space-y-0.5">
              {savedFilters.map((flt) => {
                const isActive =
                  activeView === 'saved_filter' && selectedSavedFilterId === flt.id;
                return (
                  <div key={flt.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        onSelectView('saved_filter', null, flt.id);
                        onCloseMobile();
                      }}
                      className={navItemClass(isActive)}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Filter className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{flt.name}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSavedFilter(flt.id)}
                      aria-label={`Delete saved filter ${flt.name}`}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </div>
        </details>

        {/* Folders & Nested Projects */}
        <div>
          <div className="px-3 mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">My Lists</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAddingFolder((v) => !v)}
                title="New Folder"
                aria-label="New Folder"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setAddingProject((v) => !v)}
                title="New Project"
                aria-label="New Project"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {addingFolder && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newFolderName.trim()) return;
                onCreateFolder(newFolderName.trim());
                setNewFolderName('');
                setAddingFolder(false);
              }}
              className="px-2 pb-2 space-y-1.5"
            >
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name..."
                autoFocus
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
              />
              <div className="flex gap-1.5 justify-end">
                <button type="button" onClick={() => setAddingFolder(false)} className="px-2 py-1 text-xs text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-2.5 py-1 text-xs font-medium rounded accent-bg">
                  Add
                </button>
              </div>
            </form>
          )}

          {addingProject && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProjectName.trim()) return;
                onCreateProject(
                  newProjectName.trim(),
                  newProjectColor,
                  newProjectFolderId,
                  newProjectParentId
                );
                setNewProjectName('');
                setNewProjectParentId(null);
                setAddingProject(false);
              }}
              className="px-2 pb-3 mb-2 border-b border-slate-200/60 dark:border-white/10 space-y-2"
            >
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                autoFocus
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
              />
              {visibleFolders.length > 0 && (
                <select
                  value={newProjectFolderId || ''}
                  onChange={(e) => setNewProjectFolderId(e.target.value || null)}
                  className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
                >
                  <option value="">No folder</option>
                  {visibleFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
              {visibleProjects.length > 0 && (
                <select
                  value={newProjectParentId || ''}
                  onChange={(e) => setNewProjectParentId(e.target.value || null)}
                  className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
                >
                  <option value="">Top-level project</option>
                  {visibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      Nest inside: {p.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewProjectColor(c)}
                      className={`w-4 h-4 rounded-sm ${
                        newProjectColor === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setAddingProject(false)} className="px-2 py-1 text-xs text-slate-500">
                    Cancel
                  </button>
                  <button type="submit" className="px-2.5 py-1 text-xs font-medium rounded accent-bg">
                    Save
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-1">
            {visibleFolders.map((folder) => {
              const folderProjects = visibleProjects.filter(
                (p) => p.folderId === folder.id && !p.parentProjectId
              );
              const isOpen = expandedFolders[folder.id] !== false;
              return (
                <div key={folder.id} className="space-y-0.5">
                  <div className="group flex items-center justify-between px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedFolders((prev) => ({ ...prev, [folder.id]: !isOpen }))
                      }
                      className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <FolderIcon className="w-3.5 h-3.5" />
                      <span>{folder.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFolder(folder.id)}
                      aria-label={`Delete folder ${folder.name}`}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="pl-2 space-y-0.5">
                      {folderProjects.map((p) => renderProjectTree(p, 0))}
                    </div>
                  )}
                </div>
              );
            })}

            {rootProjects.map((p) => renderProjectTree(p, 0))}
            {visibleFolders.length === 0 && rootProjects.length === 0 && (
              <button
                type="button"
                onClick={() => setAddingProject(true)}
                className="w-full px-2 py-2 text-left text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Create your first list
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-2.5 border-t border-slate-200/60 dark:border-white/10 space-y-0.5 shrink-0">
        <div className="sidebar-profile px-1.5 py-2 mb-1 flex items-center gap-2.5">
          <img
            src={profileImage || '/avatar.svg'}
            alt={profileName ? `${profileName} profile` : 'Profile'}
            className="w-9 h-9 rounded-full border border-white/80 shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate">{profileName || 'Your profile'}</p>
            <p className="text-[10px] text-slate-500 truncate">{profileEmail || 'Edit your profile'}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="p-1.5 rounded-md text-slate-500 hover:bg-white/70 hover:text-slate-800"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="p-1.5 rounded-md text-slate-500 hover:bg-white/70 hover:text-slate-800"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[230px] pl-2 py-2 shrink-0 h-screen sticky top-0 no-print">
        {sidebarContent}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
