import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { DailyBriefingModal } from './components/DailyBriefingModal';
import { DashboardPanels, DashboardWelcome } from './components/DashboardPanels';
import { FocusModeOverlay } from './components/FocusModeOverlay';
import { LockScreen } from './components/LockScreen';
import { LoginPage } from './components/LoginPage';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OnboardingModal } from './components/OnboardingModal';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { RescheduleModal } from './components/RescheduleModal';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { TaskListView } from './components/TaskListView';
import { TodayView } from './components/TodayView';
import { TopBar } from './components/TopBar';
import { WeeklyResetModal } from './components/WeeklyResetModal';
import { DEFAULT_SETTINGS } from './data/seedData';
import { dbService } from './db/indexedDb';
import type {
  CountdownItem,
  EnergyLevel,
  ExamItem,
  FilterCriteria,
  FocusSession,
  Folder,
  GroceryItem,
  Habit,
  LifeCategory,
  Priority,
  Project,
  ReadingItem,
  RescheduleSuggestion,
  SavedFilter,
  Task,
  TaskTemplate,
  UserSettings,
  ViewType,
  Workspace,
} from './types/todo';
import { addDays, computeNextRecurrenceDate, getTodayStr } from './utils/date';
import type { ProjectSharePackage, WorkspaceBackup } from './utils/exportImport';
import { tLabel } from './utils/i18n';
import { computeTaskScore } from './utils/rulesEngine';
import { playGentleChime } from './utils/sound';
import {
  createLocalAccount,
  getLocalAccountProfile,
  hasLocalAccount,
  hasLocalSession,
  signInLocalAccount,
  signOutLocalAccount,
  updateLocalAccountEmail,
} from './utils/localAuth';

const CalendarView = lazy(() =>
  import('./components/CalendarView').then((module) => ({ default: module.CalendarView }))
);
const EisenhowerView = lazy(() =>
  import('./components/EisenhowerView').then((module) => ({ default: module.EisenhowerView }))
);
const InsightsView = lazy(() =>
  import('./components/InsightsView').then((module) => ({ default: module.InsightsView }))
);
const KanbanView = lazy(() =>
  import('./components/KanbanView').then((module) => ({ default: module.KanbanView }))
);
const SpecializedListsView = lazy(() =>
  import('./components/SpecializedListsView').then((module) => ({ default: module.SpecializedListsView }))
);
const TableView = lazy(() =>
  import('./components/TableView').then((module) => ({ default: module.TableView }))
);
const TaskRadarView = lazy(() =>
  import('./components/TaskRadarView').then((module) => ({ default: module.TaskRadarView }))
);
const TimelineView = lazy(() =>
  import('./components/TimelineView').then((module) => ({ default: module.TimelineView }))
);

interface ToastState {
  id: string;
  message: string;
  canUndo?: boolean;
}

function isWithinQuietHours(settings: UserSettings): boolean {
  if (!settings.quietHoursEnabled) return false;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const start = settings.quietHoursStart || '22:00';
  const end = settings.quietHoursEnd || '07:00';
  if (start <= end) {
    return hhmm >= start && hhmm < end;
  }
  return hhmm >= start || hhmm < end;
}

interface WorkspaceAppProps {
  onSignOut: () => void;
  initialProfile: { name: string; email: string } | null;
}

export default function App() {
  const [authState, setAuthState] = useState<'checking' | 'signed-out' | 'signed-in' | 'error'>('checking');
  const [accountExists, setAccountExists] = useState(false);
  const [initialProfile, setInitialProfile] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    try {
      const exists = hasLocalAccount();
      setAccountExists(exists);
      setInitialProfile(getLocalAccountProfile());
      setAuthState(exists && hasLocalSession() ? 'signed-in' : 'signed-out');
    } catch {
      setAuthState('error');
    }
  }, []);

  const handleLogin = async (email: string, password: string, remember: boolean) => {
    await signInLocalAccount(email, password, remember);
    setInitialProfile(getLocalAccountProfile());
    setAuthState('signed-in');
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    await createLocalAccount(name, email, password);
    setAccountExists(true);
    setInitialProfile(getLocalAccountProfile());
    setAuthState('signed-in');
  };

  const handleSignOut = () => {
    signOutLocalAccount();
    setAccountExists(true);
    setAuthState('signed-out');
  };

  if (authState === 'checking') {
    return <div className="min-h-screen workspace-shell flex items-center justify-center text-sm text-slate-600">Opening secure sign-in…</div>;
  }
  if (authState !== 'signed-in') {
    return <LoginPage hasAccount={accountExists} onLogin={handleLogin} onRegister={handleRegister} />;
  }
  return <WorkspaceApp key="authenticated-workspace" onSignOut={handleSignOut} initialProfile={initialProfile} />;
}

function WorkspaceApp({ onSignOut, initialProfile }: WorkspaceAppProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | 'ALL'>('ALL');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const [activeView, setActiveView] = useState<ViewType>('today');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [weeklyResetOpen, setWeeklyResetOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Live stopwatch state
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [activeTimerElapsed, setActiveTimerElapsed] = useState(0);

  // Undo stack of task snapshots
  const [undoStack, setUndoStack] = useState<Task[][]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((message: string, canUndo = false) => {
    const id = `toast-${Date.now()}`;
    setToast({ id, message, canUndo });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Initial load from IndexedDB
  useEffect(() => {
    let mounted = true;
    dbService
      .loadWorkspace()
      .then((ws) => {
        if (!mounted) return;
        setWorkspaces(ws.workspaces);
        setTasks(ws.tasks);
        setProjects(ws.projects);
        setFolders(ws.folders);
        setHabits(ws.habits);
        setTemplates(ws.templates);
        setCountdowns(ws.countdowns);
        setGroceries(ws.groceries);
        setReadings(ws.readings);
        setExams(ws.exams);
        setSavedFilters(ws.savedFilters);
        setFocusSessions(ws.focusSessions);
        const loadedSettings: UserSettings = {
          ...ws.settings,
          theme: 'light',
          profileName: ws.settings.profileName || initialProfile?.name,
          profileEmail: ws.settings.profileEmail || initialProfile?.email,
        };
        setSettings(loadedSettings);
        if (loadedSettings.profileName !== ws.settings.profileName || loadedSettings.profileEmail !== ws.settings.profileEmail) {
          void dbService.saveSettings(loadedSettings).catch((error) => console.error('Could not save profile details', error));
        }
        setActiveView(
          ws.settings.defaultView === 'today'
            ? 'home'
            : ws.settings.defaultView || 'home'
        );
        setLocked(Boolean(ws.settings.pinHash));
        setOnboardingOpen(!ws.settings.onboardingDismissed);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : 'Local workspace storage could not be opened.');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Keep the workspace in its light theme, with accent and background presets applied.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.setAttribute('data-accent', settings.accentColor);
    root.setAttribute('data-bg', settings.backgroundPreset || 'default');
  }, [settings.accentColor, settings.backgroundPreset]);

  // Live task stopwatch ticker
  useEffect(() => {
    if (!activeTimerTaskId) return;
    const interval = window.setInterval(() => {
      setActiveTimerElapsed((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimerTaskId]);

  // Multi-reminder & legacy reminder checker (runs every 15s, respects Quiet Hours)
  useEffect(() => {
    const checkReminders = () => {
      if (locked || isWithinQuietHours(settings)) return;
      const now = Date.now();

      tasks.forEach((t) => {
        if (t.status === 'done' || t.status === 'archived' || t.status === 'trashed') return;

        let changed = false;
        let firedMessage = '';
        let updatedReminders = t.reminders || [];

        if (updatedReminders.length > 0) {
          updatedReminders = updatedReminders.map((rem) => {
            if (rem.fired) return rem;
            const effectiveMs = rem.snoozedUntil
              ? new Date(rem.snoozedUntil).getTime()
              : new Date(rem.triggerAt).getTime();
            if (!Number.isNaN(effectiveMs) && effectiveMs <= now) {
              changed = true;
              firedMessage = `Reminder: ${t.title}`;
              if (rem.recurringDaily) {
                const nextDate = new Date(effectiveMs);
                nextDate.setDate(nextDate.getDate() + 1);
                const nextDay = nextDate.toISOString();
                return { ...rem, triggerAt: nextDay, snoozedUntil: null, fired: false };
              }
              return { ...rem, fired: true, snoozedUntil: null };
            }
            return rem;
          });
        }

        let updatedReminderFired = t.reminderFired;
        if (t.reminderAt && !t.reminderFired) {
          const targetMs = new Date(t.reminderAt).getTime();
          if (!Number.isNaN(targetMs) && targetMs <= now) {
            changed = true;
            firedMessage = `Reminder: ${t.title}`;
            updatedReminderFired = true;
          }
        }

        if (changed) {
          playGentleChime(settings.soundEnabled);
          showToast(firedMessage || `Reminder: ${t.title}`);
          if (
            settings.notificationsEnabled &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification('TO-DO Reminder', { body: t.title });
            } catch {
              // Some mobile browsers expose Notification but require an installed PWA.
            }
          }
          const updated: Task = {
            ...t,
            reminders: updatedReminders,
            reminderFired: updatedReminderFired,
          };
          setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
          dbService.saveTask(updated);
        }
      });
    };

    const timer = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(timer);
  }, [tasks, locked, settings, showToast]);

  const pushUndoSnapshot = useCallback((snapshot: Task[]) => {
    setUndoStack((prev) => [...prev.slice(-24), snapshot]);
  }, []);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const prevTasks = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setTasks(prevTasks);
    await dbService.replaceWorkspace({
      workspaces,
      tasks: prevTasks,
      projects,
      folders,
      habits,
      templates,
      countdowns,
      groceries,
      readings,
      exams,
      savedFilters,
      focusSessions,
      settings,
    });
    showToast('Action undone.');
  }, [
    undoStack,
    workspaces,
    projects,
    folders,
    habits,
    templates,
    countdowns,
    groceries,
    readings,
    exams,
    savedFilters,
    focusSessions,
    settings,
    showToast,
  ]);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    if (typeof patch.profileEmail === 'string') updateLocalAccountEmail(patch.profileEmail);
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      dbService.saveSettings(next);
      return next;
    });
  }, []);

  const defaultWorkspaceId = useMemo(
    () =>
      selectedWorkspaceId === 'ALL'
        ? workspaces[0]?.id || 'ws-personal'
        : selectedWorkspaceId,
    [selectedWorkspaceId, workspaces]
  );

  // Filtered by active workspace selector
  const wsTasks = useMemo(
    () =>
      selectedWorkspaceId === 'ALL'
        ? tasks
        : tasks.filter((t) => t.workspaceId === selectedWorkspaceId),
    [tasks, selectedWorkspaceId]
  );

  const wsProjects = useMemo(
    () =>
      selectedWorkspaceId === 'ALL'
        ? projects
        : projects.filter((p) => p.workspaceId === selectedWorkspaceId),
    [projects, selectedWorkspaceId]
  );

  // Focus Mode selection & logging
  const rankedActiveTasks = useMemo(() => {
    const today = getTodayStr();
    return wsTasks
      .filter((t) => t.status === 'todo' || t.status === 'in_progress')
      .map((t) => ({ task: t, score: computeTaskScore(t, tasks, today) }))
      .sort((a, b) => b.score.score - a.score.score)
      .map((x) => x.task);
  }, [wsTasks, tasks]);

  const handleStartFocus = useCallback(
    (taskId?: string) => {
      if (taskId) {
        setFocusTaskId(taskId);
      } else {
        setFocusTaskId(rankedActiveTasks[0]?.id || null);
      }
      setFocusOpen(true);
    },
    [rankedActiveTasks]
  );

  // Global keyboard shortcuts (N / Cmd+K = Quick Capture, F = Focus Mode, / = Search, Cmd+Z = Undo, Esc = Close)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (locked) return;
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickCaptureOpen(true);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !inInput) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (!inInput && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (!inInput && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setQuickCaptureOpen(true);
        return;
      }

      if (!inInput && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleStartFocus();
        return;
      }

      if (e.key === 'Escape') {
        if (quickCaptureOpen) setQuickCaptureOpen(false);
        else if (detailTaskId) setDetailTaskId(null);
        else if (rescheduleOpen) setRescheduleOpen(false);
        else if (weeklyResetOpen) setWeeklyResetOpen(false);
        else if (briefingOpen) setBriefingOpen(false);
        else if (onboardingOpen) {
          setOnboardingOpen(false);
          updateSettings({ onboardingDismissed: true });
        } else if (settingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    locked,
    handleUndo,
    handleStartFocus,
    quickCaptureOpen,
    detailTaskId,
    rescheduleOpen,
    weeklyResetOpen,
    briefingOpen,
    onboardingOpen,
    settingsOpen,
    updateSettings,
  ]);

  const handleToggleTimer = useCallback(
    async (taskId: string) => {
      if (activeTimerTaskId === taskId) {
        const elapsed = activeTimerElapsed;
        setActiveTimerTaskId(null);
        setActiveTimerElapsed(0);
        if (elapsed > 0) {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              const updated = {
                ...t,
                actualSeconds: t.actualSeconds + elapsed,
                updatedAt: new Date().toISOString(),
              };
              dbService.saveTask(updated);
              return updated;
            })
          );
        }
      } else {
        if (activeTimerTaskId && activeTimerElapsed > 0) {
          const prevId = activeTimerTaskId;
          const prevElapsed = activeTimerElapsed;
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== prevId) return t;
              const updated = {
                ...t,
                actualSeconds: t.actualSeconds + prevElapsed,
                updatedAt: new Date().toISOString(),
              };
              dbService.saveTask(updated);
              return updated;
            })
          );
        }
        setActiveTimerElapsed(0);
        setActiveTimerTaskId(taskId);
      }
    },
    [activeTimerTaskId, activeTimerElapsed]
  );

  const handleCreateTask = useCallback(
    async (input: {
      title: string;
      priority: Priority;
      energy: EnergyLevel;
      estimatedMinutes: number;
      dueDate: string | null;
      projectId: string | null;
      tags: string[];
      pinTop3: boolean;
      status?: Task['status'];
      timeStart?: string;
      important?: boolean;
      urgent?: boolean;
      lifeCategory?: LifeCategory;
      description?: string;
      subtasks?: Task['subtasks'];
      recurrence?: Task['recurrence'];
    }) => {
      const today = getTodayStr();
      const nowIso = new Date().toISOString();
      let top3Date: string | null = null;
      if (input.pinTop3) {
        const currentTop3 = tasks.filter(
          (t) => t.top3Date === today && t.status !== 'archived' && t.status !== 'trashed'
        );
        if (currentTop3.length < 3) {
          top3Date = today;
        } else {
          showToast('Daily Top 3 already has 3 tasks; task added without pinning.');
        }
      }

      const targetProj = input.projectId ? projects.find((p) => p.id === input.projectId) : null;

      const newTask: Task = {
        id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: input.title,
        description: input.description || '',
        status: input.status || 'todo',
        priority: input.priority,
        important:
          input.important ?? (input.priority === 'urgent' || input.priority === 'high'),
        urgent: input.urgent ?? input.priority === 'urgent',
        energy: input.energy,
        lifeCategory: input.lifeCategory || 'projects',
        workspaceId: targetProj?.workspaceId || defaultWorkspaceId,
        projectId: input.projectId,
        sectionId: null,
        parentId: null,
        assigneeId: null,
        color: null,
        isFavorite: false,
        tags: input.tags,
        startDate: input.dueDate ? today : null,
        dueDate: input.dueDate,
        deadline: null,
        timeSlot: input.timeStart ? { start: input.timeStart, end: input.timeStart } : null,
        reminderAt: null,
        reminders: [],
        recurrence: input.recurrence || { type: 'none', interval: 1 },
        subtasks: input.subtasks || [],
        estimatedMinutes: input.estimatedMinutes,
        actualSeconds: 0,
        dependsOn: [],
        links: [],
        attachments: [],
        comments: [],
        activityLog: [
          {
            id: `act-${Date.now()}`,
            actor: 'You',
            action: 'Created task',
            timestamp: nowIso,
          },
        ],
        top3Date,
        snoozedUntil: null,
        order: tasks.length,
        createdAt: nowIso,
        updatedAt: nowIso,
        completedAt: input.status === 'done' ? nowIso : null,
        trashedAt: null,
      };

      pushUndoSnapshot(tasks);
      setTasks((prev) => [newTask, ...prev]);
      await dbService.saveTask(newTask);
      showToast('Task added.', true);
    },
    [tasks, projects, defaultWorkspaceId, pushUndoSnapshot, showToast]
  );

  const handleUpdateTask = useCallback(async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await dbService.saveTask(updated);
  }, []);

  const handleToggleComplete = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      pushUndoSnapshot(tasks);
      const nowIso = new Date().toISOString();
      const willComplete = target.status !== 'done';

      let extraSeconds = 0;
      if (willComplete && activeTimerTaskId === taskId) {
        extraSeconds = activeTimerElapsed;
        setActiveTimerTaskId(null);
        setActiveTimerElapsed(0);
      }

      const updated: Task = {
        ...target,
        status: willComplete ? 'done' : 'todo',
        completedAt: willComplete ? nowIso : null,
        actualSeconds: target.actualSeconds + extraSeconds,
        snoozedUntil: null,
        activityLog: [
          ...(target.activityLog || []),
          {
            id: `act-${Date.now()}`,
            actor: 'You',
            action: willComplete ? 'Completed task' : 'Reopened task',
            timestamp: nowIso,
          },
        ],
        updatedAt: nowIso,
      };

      const nextList: Task[] = [updated];

      if (willComplete && target.recurrence.type !== 'none') {
        const nextDue = computeNextRecurrenceDate(target.dueDate, target.recurrence);
        const nextOccurrence: Task = {
          ...target,
          id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          status: 'todo',
          dueDate: nextDue,
          startDate: nextDue,
          completedAt: null,
          actualSeconds: 0,
          top3Date: null,
          snoozedUntil: null,
          reminderFired: false,
          reminders: (target.reminders || []).map((r) => ({ ...r, fired: false, snoozedUntil: null })),
          subtasks: target.subtasks.map((s) => ({ ...s, completed: false })),
          activityLog: [
            {
              id: `act-rec-${Date.now()}`,
              actor: 'Rule Engine',
              action: `Generated recurring instance for ${nextDue}`,
              timestamp: nowIso,
            },
          ],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextList.push(nextOccurrence);
      }

      setTasks((prev) => {
        const mapped = prev.map((t) => (t.id === taskId ? updated : t));
        return nextList.length > 1 ? [nextList[1], ...mapped] : mapped;
      });

      await dbService.saveTasks(nextList);

      if (willComplete) {
        playGentleChime(settings.soundEnabled);
        showToast(
          nextList.length > 1
            ? `Completed! Next recurrence scheduled for ${nextList[1].dueDate}.`
            : `Completed "${target.title}".`,
          true
        );
      }
    },
    [tasks, activeTimerTaskId, activeTimerElapsed, pushUndoSnapshot, settings.soundEnabled, showToast]
  );

  const handleToggleTop3 = useCallback(
    async (taskId: string) => {
      const today = getTodayStr();
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      if (target.top3Date === today) {
        const updated = { ...target, top3Date: null, updatedAt: new Date().toISOString() };
        await handleUpdateTask(updated);
        return;
      }

      const currentTop3 = tasks.filter(
        (t) => t.top3Date === today && t.status !== 'archived' && t.status !== 'trashed'
      );
      if (currentTop3.length >= 3) {
        showToast('Daily Top 3 is limited to 3 tasks. Unpin one to swap.');
        return;
      }

      const updated = { ...target, top3Date: today, updatedAt: new Date().toISOString() };
      await handleUpdateTask(updated);
      showToast('Pinned to Daily Top 3.');
    },
    [tasks, handleUpdateTask, showToast]
  );

  const handleToggleFavorite = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const updated = {
        ...target,
        isFavorite: !target.isFavorite,
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
    },
    [tasks, handleUpdateTask]
  );

  const handleSnoozeTomorrow = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      pushUndoSnapshot(tasks);
      const tomorrow = addDays(getTodayStr(), 1);
      const nowIso = new Date().toISOString();
      const updated: Task = {
        ...target,
        snoozedUntil: tomorrow,
        top3Date: null,
        activityLog: [
          ...(target.activityLog || []),
          { id: `act-${Date.now()}`, actor: 'You', action: `Snoozed until ${tomorrow}`, timestamp: nowIso },
        ],
        updatedAt: nowIso,
      };
      await handleUpdateTask(updated);
      showToast(`Snoozed "${target.title}" until tomorrow (${tomorrow}).`, true);
    },
    [tasks, pushUndoSnapshot, handleUpdateTask, showToast]
  );

  const handleDuplicate = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const nowIso = new Date().toISOString();
      const copy: Task = {
        ...target,
        id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `${target.title} (Copy)`,
        status: 'todo',
        completedAt: null,
        actualSeconds: 0,
        top3Date: null,
        snoozedUntil: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setTasks((prev) => [copy, ...prev]);
      await dbService.saveTask(copy);
      showToast('Task duplicated.');
    },
    [tasks, showToast]
  );

  const handleArchive = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      pushUndoSnapshot(tasks);
      const updated: Task = {
        ...target,
        status: 'archived',
        top3Date: null,
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
      showToast('Moved to Archive.', true);
    },
    [tasks, pushUndoSnapshot, handleUpdateTask, showToast]
  );

  const handleTrash = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      pushUndoSnapshot(tasks);
      const updated: Task = {
        ...target,
        status: 'trashed',
        top3Date: null,
        trashedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
      showToast('Moved to Trash.', true);
    },
    [tasks, pushUndoSnapshot, handleUpdateTask, showToast]
  );

  const handleRestore = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const updated: Task = {
        ...target,
        status: 'todo',
        trashedAt: null,
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
      showToast('Task restored.');
    },
    [tasks, handleUpdateTask, showToast]
  );

  const handleDeleteForever = useCallback(
    async (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await dbService.deleteTaskPermanently(taskId);
      showToast('Deleted permanently.');
    },
    [showToast]
  );

  const handleEmptyTrash = useCallback(async () => {
    const trashedIds = tasks.filter((t) => t.status === 'trashed').map((t) => t.id);
    setTasks((prev) => prev.filter((t) => t.status !== 'trashed'));
    await Promise.all(trashedIds.map((id) => dbService.deleteTaskPermanently(id)));
    showToast('Trash emptied.');
  }, [tasks, showToast]);

  const handleReorderTasks = useCallback(
    async (sourceId: string, targetId: string) => {
      const ordered = [...tasks].sort((a, b) => a.order - b.order);
      const srcIdx = ordered.findIndex((t) => t.id === sourceId);
      const tgtIdx = ordered.findIndex((t) => t.id === targetId);
      if (srcIdx === -1 || tgtIdx === -1) return;

      const [moved] = ordered.splice(srcIdx, 1);
      ordered.splice(tgtIdx, 0, moved);
      const reindexed = ordered.map((t, idx) => ({ ...t, order: idx }));
      setTasks(reindexed);
      await dbService.saveTasks(reindexed);
    },
    [tasks]
  );

  const handleBulkAction = useCallback(
    async (
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
    ) => {
      if (ids.length === 0) return;
      pushUndoSnapshot(tasks);
      const today = getTodayStr();
      const tomorrow = addDays(today, 1);
      const nowIso = new Date().toISOString();
      const idSet = new Set(ids);
      const changed: Task[] = [];

      const next = tasks.map((t) => {
        if (!idSet.has(t.id)) return t;
        let updated = { ...t, updatedAt: nowIso };
        if (action === 'complete') {
          updated = { ...updated, status: 'done', completedAt: nowIso, snoozedUntil: null };
        } else if (action === 'today') {
          updated = { ...updated, dueDate: today, snoozedUntil: null };
        } else if (action === 'tomorrow') {
          updated = { ...updated, dueDate: tomorrow, snoozedUntil: null };
        } else if (action === 'archive') {
          updated = { ...updated, status: 'archived', top3Date: null };
        } else if (action === 'trash') {
          updated = { ...updated, status: 'trashed', trashedAt: nowIso, top3Date: null };
        } else if (action === 'priority_high') {
          updated = { ...updated, priority: 'high', important: true };
        } else if (action === 'move_project') {
          updated = { ...updated, projectId: projectId ?? null };
        }
        changed.push(updated);
        return updated;
      });

      setTasks(next);
      await dbService.saveTasks(changed);
      showToast(`Updated ${changed.length} tasks.`, true);
    },
    [tasks, pushUndoSnapshot, showToast]
  );

  const handleLogFocusSession = useCallback(
    async (
      taskId: string | null,
      taskTitle: string,
      durationSeconds: number,
      mode: FocusSession['mode']
    ) => {
      if (durationSeconds < 5) return;
      const session: FocusSession = {
        id: `foc-${Date.now()}`,
        taskId,
        taskTitle,
        durationSeconds,
        mode,
        completedAt: new Date().toISOString(),
      };
      setFocusSessions((prev) => [session, ...prev]);
      await dbService.saveFocusSession(session);

      if (taskId) {
        const t = tasks.find((x) => x.id === taskId);
        if (t) {
          const updated = {
            ...t,
            actualSeconds: t.actualSeconds + durationSeconds,
            updatedAt: new Date().toISOString(),
          };
          await handleUpdateTask(updated);
        }
      }
    },
    [tasks, handleUpdateTask]
  );

  const handleFocusCompleteAndNext = useCallback(
    async (taskId: string, elapsedSeconds: number) => {
      const current = tasks.find((t) => t.id === taskId);
      if (current && elapsedSeconds >= 5) {
        await handleLogFocusSession(taskId, current.title, elapsedSeconds, 'pomodoro');
      }
      await handleToggleComplete(taskId);
      const nextTask = rankedActiveTasks.find((t) => t.id !== taskId);
      setFocusTaskId(nextTask?.id || null);
    },
    [tasks, rankedActiveTasks, handleLogFocusSession, handleToggleComplete]
  );

  const handleFocusSkipNext = useCallback(() => {
    if (rankedActiveTasks.length === 0) {
      setFocusTaskId(null);
      return;
    }
    const idx = rankedActiveTasks.findIndex((t) => t.id === focusTaskId);
    const next = rankedActiveTasks[(idx + 1) % rankedActiveTasks.length];
    setFocusTaskId(next?.id || null);
  }, [rankedActiveTasks, focusTaskId]);

  // Workspaces, Projects, Folders, Habits, Filters
  const handleCreateWorkspace = useCallback(
    async (name: string) => {
      const ws: Workspace = {
        id: `ws-${Date.now()}`,
        name,
        description: '',
        color: '#4f46e5',
        order: workspaces.length,
      };
      setWorkspaces((prev) => [...prev, ws]);
      await dbService.saveWorkspace(ws);
      setSelectedWorkspaceId(ws.id);
      showToast(`Workspace "${name}" created.`);
    },
    [workspaces.length, showToast]
  );

  const handleCreateProject = useCallback(
    async (
      name: string,
      color: string,
      folderId: string | null,
      parentProjectId: string | null
    ) => {
      const proj: Project = {
        id: `prj-${Date.now()}`,
        name,
        workspaceId: defaultWorkspaceId,
        folderId,
        parentProjectId,
        color,
        isFavorite: false,
        sections: [{ id: `sec-${Date.now()}`, title: 'General', order: 0 }],
        members: [{ id: 'mem-you', name: 'You', role: 'owner' }],
        order: projects.length,
        createdAt: new Date().toISOString(),
      };
      setProjects((prev) => [...prev, proj]);
      await dbService.saveProject(proj);
    },
    [defaultWorkspaceId, projects.length]
  );

  const handleUpdateProject = useCallback(async (updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    await dbService.saveProject(updated);
  }, []);

  const handleImportProjectShare = useCallback(
    async (pkg: ProjectSharePackage) => {
      const newProjId = `prj-imp-${Date.now()}`;
      const importedProj: Project = {
        ...pkg.project,
        id: newProjId,
        workspaceId: defaultWorkspaceId,
        folderId: null,
        parentProjectId: null,
        order: projects.length,
      };
      const importedTasks: Task[] = pkg.tasks.map((t, idx) => ({
        ...t,
        id: `tsk-imp-${Date.now()}-${idx}`,
        workspaceId: defaultWorkspaceId,
        projectId: newProjId,
        order: tasks.length + idx,
      }));
      setProjects((prev) => [...prev, importedProj]);
      setTasks((prev) => [...importedTasks, ...prev]);
      await dbService.saveProject(importedProj);
      await dbService.saveTasks(importedTasks);
      setActiveView('project');
      setSelectedProjectId(newProjId);
      showToast(`Imported project "${importedProj.name}" with ${importedTasks.length} tasks.`);
    },
    [defaultWorkspaceId, projects.length, tasks.length, showToast]
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id && p.parentProjectId !== id));
      const affected = tasks
        .filter((t) => t.projectId === id)
        .map((t) => ({ ...t, projectId: null }));
      if (affected.length > 0) {
        setTasks((prev) => prev.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)));
        await dbService.saveTasks(affected);
      }
      await dbService.deleteProject(id);
      if (selectedProjectId === id) {
        setActiveView('today');
        setSelectedProjectId(null);
      }
    },
    [tasks, selectedProjectId]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      const fld: Folder = {
        id: `fld-${Date.now()}`,
        name,
        workspaceId: defaultWorkspaceId,
        order: folders.length,
      };
      setFolders((prev) => [...prev, fld]);
      await dbService.saveFolder(fld);
    },
    [defaultWorkspaceId, folders.length]
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      const updatedProjects = projects
        .filter((p) => p.folderId === id)
        .map((p) => ({ ...p, folderId: null }));
      if (updatedProjects.length > 0) {
        setProjects((prev) => prev.map((p) => (p.folderId === id ? { ...p, folderId: null } : p)));
        await Promise.all(updatedProjects.map((p) => dbService.saveProject(p)));
      }
      await dbService.deleteFolder(id);
    },
    [projects]
  );

  const handleToggleHabitDate = useCallback(
    async (habitId: string, dateStr: string) => {
      const target = habits.find((h) => h.id === habitId);
      if (!target) return;
      const exists = target.completedDates.includes(dateStr);
      const updated: Habit = {
        ...target,
        completedDates: exists
          ? target.completedDates.filter((d) => d !== dateStr)
          : [...target.completedDates, dateStr],
      };
      setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));
      await dbService.saveHabit(updated);
    },
    [habits]
  );

  const handleCreateHabit = useCallback(async (title: string, targetPerWeek: number) => {
    const habit: Habit = {
      id: `hab-${Date.now()}`,
      title,
      targetPerWeek,
      color: '#059669',
      completedDates: [],
      createdAt: new Date().toISOString(),
    };
    setHabits((prev) => [...prev, habit]);
    await dbService.saveHabit(habit);
  }, []);

  const handleDeleteHabit = useCallback(async (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    await dbService.deleteHabit(id);
  }, []);

  const handleSaveFilter = useCallback(
    async (name: string, criteria: FilterCriteria) => {
      const flt: SavedFilter = {
        id: `flt-${Date.now()}`,
        name,
        criteria,
      };
      setSavedFilters((prev) => [...prev, flt]);
      await dbService.saveFilter(flt);
      showToast(`Saved filter "${name}".`);
    },
    [showToast]
  );

  const handleDeleteSavedFilter = useCallback(
    async (id: string) => {
      setSavedFilters((prev) => prev.filter((f) => f.id !== id));
      await dbService.deleteFilter(id);
      if (selectedSavedFilterId === id) {
        setActiveView('all');
        setSelectedSavedFilterId(null);
      }
    },
    [selectedSavedFilterId]
  );

  // Templates, Countdowns, Grocery, Reading, Exams
  const handleSaveAsTemplate = useCallback(
    async (task: Task) => {
      const tpl: TaskTemplate = {
        id: `tpl-${Date.now()}`,
        name: task.title,
        category: 'work',
        description: task.description,
        priority: task.priority,
        energy: task.energy,
        lifeCategory: task.lifeCategory,
        estimatedMinutes: task.estimatedMinutes,
        tags: task.tags,
        subtasks: task.subtasks.map((s) => s.title),
        recurrence: task.recurrence,
      };
      setTemplates((prev) => [tpl, ...prev]);
      await dbService.saveTemplate(tpl);
      showToast(`Saved "${task.title}" as template.`);
    },
    [showToast]
  );

  const handleUseTemplate = useCallback(
    async (tpl: TaskTemplate) => {
      await handleCreateTask({
        title: tpl.name,
        description: tpl.description,
        priority: tpl.priority,
        energy: tpl.energy,
        lifeCategory: tpl.lifeCategory,
        estimatedMinutes: tpl.estimatedMinutes,
        dueDate: getTodayStr(),
        projectId: null,
        tags: tpl.tags,
        pinTop3: false,
        recurrence: tpl.recurrence,
        subtasks: tpl.subtasks.map((st, idx) => ({
          id: `sub-${Date.now()}-${idx}`,
          title: st,
          completed: false,
        })),
      });
      setActiveView('today');
    },
    [handleCreateTask]
  );

  const handleDeleteTemplate = useCallback(async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await dbService.deleteTemplate(id);
  }, []);

  const handleAddCountdown = useCallback(
    async (title: string, targetDate: string, category: LifeCategory) => {
      const item: CountdownItem = {
        id: `cd-${Date.now()}`,
        title,
        targetDate,
        category,
        notes: '',
      };
      setCountdowns((prev) => [...prev, item]);
      await dbService.saveCountdown(item);
      showToast(`Countdown "${title}" added.`);
    },
    [showToast]
  );

  const handleDeleteCountdown = useCallback(async (id: string) => {
    setCountdowns((prev) => prev.filter((c) => c.id !== id));
    await dbService.deleteCountdown(id);
  }, []);

  const handleAddGrocery = useCallback(
    async (name: string, quantity: string, category: GroceryItem['category']) => {
      const item: GroceryItem = {
        id: `gr-${Date.now()}`,
        name,
        quantity,
        category,
        checked: false,
      };
      setGroceries((prev) => [...prev, item]);
      await dbService.saveGrocery(item);
    },
    []
  );

  const handleToggleGrocery = useCallback(
    async (id: string) => {
      const target = groceries.find((g) => g.id === id);
      if (!target) return;
      const updated = { ...target, checked: !target.checked };
      setGroceries((prev) => prev.map((g) => (g.id === id ? updated : g)));
      await dbService.saveGrocery(updated);
    },
    [groceries]
  );

  const handleDeleteGrocery = useCallback(async (id: string) => {
    setGroceries((prev) => prev.filter((g) => g.id !== id));
    await dbService.deleteGrocery(id);
  }, []);

  const handleAddReading = useCallback(
    async (title: string, author: string, totalPages: number) => {
      const item: ReadingItem = {
        id: `rd-${Date.now()}`,
        title,
        author,
        totalPages,
        currentPage: 0,
        status: 'to_read',
        notes: '',
      };
      setReadings((prev) => [item, ...prev]);
      await dbService.saveReading(item);
    },
    []
  );

  const handleUpdateReading = useCallback(async (updated: ReadingItem) => {
    setReadings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    await dbService.saveReading(updated);
  }, []);

  const handleDeleteReading = useCallback(async (id: string) => {
    setReadings((prev) => prev.filter((r) => r.id !== id));
    await dbService.deleteReading(id);
  }, []);

  const handleAddExam = useCallback(
    async (course: string, title: string, dueDate: string, weightPct: number) => {
      const item: ExamItem = {
        id: `ex-${Date.now()}`,
        course,
        title,
        dueDate,
        weightPct,
        progressPct: 0,
        completed: false,
        notes: '',
      };
      setExams((prev) => [...prev, item]);
      await dbService.saveExam(item);
    },
    []
  );

  const handleUpdateExam = useCallback(async (updated: ExamItem) => {
    setExams((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    await dbService.saveExam(updated);
  }, []);

  const handleDeleteExam = useCallback(async (id: string) => {
    setExams((prev) => prev.filter((e) => e.id !== id));
    await dbService.deleteExam(id);
  }, []);

  // Reschedule, Weekly Reset, Briefing, Import & Duplicate Merge
  const handleApplyReschedule = useCallback(
    async (sug: RescheduleSuggestion) => {
      const t = tasks.find((x) => x.id === sug.taskId);
      if (!t) return;
      pushUndoSnapshot(tasks);
      const updated: Task = {
        ...t,
        dueDate: sug.suggestedDueDate,
        snoozedUntil: null,
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
      showToast(`Moved "${t.title}" to ${sug.suggestedDueDate}.`, true);
    },
    [tasks, pushUndoSnapshot, handleUpdateTask, showToast]
  );

  const handleApplyAllReschedules = useCallback(
    async (sugs: RescheduleSuggestion[]) => {
      if (sugs.length === 0) return;
      pushUndoSnapshot(tasks);
      const map = new Map(sugs.map((s) => [s.taskId, s.suggestedDueDate]));
      const nowIso = new Date().toISOString();
      const changed: Task[] = [];
      const next = tasks.map((t) => {
        const newDate = map.get(t.id);
        if (!newDate) return t;
        const u = { ...t, dueDate: newDate, snoozedUntil: null, updatedAt: nowIso };
        changed.push(u);
        return u;
      });
      setTasks(next);
      await dbService.saveTasks(changed);
      showToast(`Rebalanced ${changed.length} tasks.`, true);
    },
    [tasks, pushUndoSnapshot, showToast]
  );

  const handleRescheduleTask = useCallback(
    async (taskId: string, dueDate: string | null) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const updated = {
        ...target,
        dueDate,
        snoozedUntil: null,
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
    },
    [tasks, handleUpdateTask]
  );

  const handlePromoteFromParkingLot = useCallback(
    async (taskId: string, dueDate: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const updated: Task = {
        ...target,
        status: 'todo',
        dueDate,
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
      showToast(`Promoted "${target.title}" to active schedule.`);
    },
    [tasks, handleUpdateTask, showToast]
  );

  const handleSnoozeTask = useCallback(
    async (taskId: string, newDueDate: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      await handleUpdateTask({
        ...target,
        dueDate: newDueDate,
        snoozedUntil: null,
        updatedAt: new Date().toISOString(),
      });
      showToast(`Rescheduled "${target.title}" to ${newDueDate}.`);
    },
    [tasks, handleUpdateTask, showToast]
  );

  const handleDismissReminder = useCallback(
    async (taskId: string, reminderId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const updated: Task = {
        ...target,
        reminders: target.reminders.map((r) =>
          r.id === reminderId ? { ...r, fired: true, snoozedUntil: null } : r
        ),
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
    },
    [tasks, handleUpdateTask]
  );

  const handleSnoozeReminder = useCallback(
    async (taskId: string, reminderId: string, minutes: number) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const targetTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const updated: Task = {
        ...target,
        reminders: target.reminders.map((r) =>
          r.id === reminderId ? { ...r, fired: false, snoozedUntil: targetTime } : r
        ),
        updatedAt: new Date().toISOString(),
      };
      await handleUpdateTask(updated);
      showToast(`Reminder snoozed for ${minutes}m.`);
    },
    [tasks, handleUpdateTask, showToast]
  );

  const handleImportTasks = useCallback(
    async (imported: Omit<Task, 'id' | 'order'>[], sourceLabel: string) => {
      if (imported.length === 0) return;
      pushUndoSnapshot(tasks);
      const baseOrder = tasks.length;
      const fullTasks: Task[] = imported.map((item, idx) => ({
        ...item,
        id: `tsk-imp-${Date.now()}-${idx}`,
        order: baseOrder + idx,
      }));
      setTasks((prev) => [...fullTasks, ...prev]);
      await dbService.saveTasks(fullTasks);
      showToast(`Imported ${fullTasks.length} tasks from ${sourceLabel}.`, true);
    },
    [tasks, pushUndoSnapshot, showToast]
  );

  const handleMergeDuplicates = useCallback(
    async (keepId: string, trashIds: string[]) => {
      if (trashIds.length === 0) return;
      pushUndoSnapshot(tasks);
      const keepTask = tasks.find((t) => t.id === keepId);
      const duplicates = tasks.filter((t) => trashIds.includes(t.id));
      if (!keepTask || duplicates.length === 0) return;

      const mergedTags = Array.from(
        new Set([...keepTask.tags, ...duplicates.flatMap((d) => d.tags)])
      );
      const mergedSubtasks = [
        ...keepTask.subtasks,
        ...duplicates.flatMap((d) => d.subtasks),
      ];
      const nowIso = new Date().toISOString();
      const trashSet = new Set(trashIds);
      const changed: Task[] = [];

      const next = tasks.map((t) => {
        if (t.id === keepId) {
          const u = {
            ...t,
            tags: mergedTags,
            subtasks: mergedSubtasks,
            updatedAt: nowIso,
          };
          changed.push(u);
          return u;
        }
        if (trashSet.has(t.id)) {
          const u: Task = {
            ...t,
            status: 'trashed',
            trashedAt: nowIso,
            updatedAt: nowIso,
          };
          changed.push(u);
          return u;
        }
        return t;
      });

      setTasks(next);
      await dbService.saveTasks(changed);
      showToast(`Merged ${duplicates.length} duplicate(s) into "${keepTask.title}".`, true);
    },
    [tasks, pushUndoSnapshot, showToast]
  );

  const handleImportBackup = useCallback(
    async (backup: WorkspaceBackup) => {
      const nextSettings = backup.settings || settings;
      const nextWorkspaces =
        backup.workspaces && backup.workspaces.length > 0 ? backup.workspaces : workspaces;
      await dbService.replaceWorkspace({
        workspaces: nextWorkspaces,
        tasks: backup.tasks,
        projects: backup.projects,
        folders: backup.folders,
        habits: backup.habits,
        templates: backup.templates || [],
        countdowns: backup.countdowns || [],
        groceries: backup.groceries || [],
        readings: backup.readings || [],
        exams: backup.exams || [],
        savedFilters: backup.savedFilters,
        focusSessions: backup.focusSessions,
        settings: nextSettings,
      });
      setWorkspaces(nextWorkspaces);
      setTasks(backup.tasks);
      setProjects(backup.projects);
      setFolders(backup.folders);
      setHabits(backup.habits);
      setTemplates(backup.templates || []);
      setCountdowns(backup.countdowns || []);
      setGroceries(backup.groceries || []);
      setReadings(backup.readings || []);
      setExams(backup.exams || []);
      setSavedFilters(backup.savedFilters);
      setFocusSessions(backup.focusSessions);
      setSettings(nextSettings);
    },
    [settings, workspaces]
  );

  const handleResetDemo = useCallback(async () => {
    const seed = await dbService.resetDemoWorkspace();
    setWorkspaces(seed.workspaces);
    setSelectedWorkspaceId('ALL');
    setTasks(seed.tasks);
    setProjects(seed.projects);
    setFolders(seed.folders);
    setHabits(seed.habits);
    setTemplates(seed.templates);
    setCountdowns(seed.countdowns);
    setGroceries(seed.groceries);
    setReadings(seed.readings);
    setExams(seed.exams);
    setSavedFilters(seed.savedFilters);
    setFocusSessions(seed.focusSessions);
    setSettings(seed.settings);
    showToast('Workspace reset to starter data.');
  }, [showToast]);

  const handleWipeAll = useCallback(async () => {
    const empty = await dbService.wipeAllData();
    setWorkspaces(empty.workspaces);
    setSelectedWorkspaceId('ALL');
    setTasks(empty.tasks);
    setProjects(empty.projects);
    setFolders(empty.folders);
    setHabits(empty.habits);
    setTemplates(empty.templates);
    setCountdowns(empty.countdowns);
    setGroceries(empty.groceries);
    setReadings(empty.readings);
    setExams(empty.exams);
    setSavedFilters(empty.savedFilters);
    setFocusSessions(empty.focusSessions);
    setSettings(empty.settings);
    setLocked(false);
    showToast('All local workspace data wiped.');
  }, [showToast]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedSavedFilter = savedFilters.find((f) => f.id === selectedSavedFilterId);
  const detailTask = tasks.find((t) => t.id === detailTaskId) || null;
  const focusTask = tasks.find((t) => t.id === focusTaskId) || null;

  const viewTitle = useMemo(() => {
    switch (activeView) {
      case 'home':
        return 'Home';
      case 'today':
        return tLabel(settings.language, 'today');
      case 'upcoming':
        return tLabel(settings.language, 'upcoming');
      case 'inbox':
        return tLabel(settings.language, 'inbox');
      case 'all':
        return tLabel(settings.language, 'allTasks');
      case 'completed':
        return tLabel(settings.language, 'completed');
      case 'overdue':
        return tLabel(settings.language, 'overdue');
      case 'favorites':
        return tLabel(settings.language, 'favorites');
      case 'parking_lot':
        return tLabel(settings.language, 'parkingLot');
      case 'quick_wins':
        return tLabel(settings.language, 'quickWins');
      case 'table':
        return tLabel(settings.language, 'table');
      case 'timeline':
        return tLabel(settings.language, 'timeline');
      case 'matrix':
        return tLabel(settings.language, 'matrix');
      case 'calendar':
        return tLabel(settings.language, 'calendar');
      case 'kanban':
        return tLabel(settings.language, 'kanban');
      case 'radar':
        return tLabel(settings.language, 'radar');
      case 'insights':
        return tLabel(settings.language, 'insights');
      case 'lists':
        return tLabel(settings.language, 'lists');
      case 'archive':
        return tLabel(settings.language, 'archive');
      case 'project':
        return selectedProject?.name || 'Project';
      case 'saved_filter':
        return selectedSavedFilter?.name || 'Saved Filter';
      default:
        return 'TO-DO';
    }
  }, [activeView, settings.language, selectedProject, selectedSavedFilter]);

  const fullBackup: WorkspaceBackup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    workspaces,
    tasks,
    projects,
    folders,
    habits,
    templates,
    countdowns,
    groceries,
    readings,
    exams,
    savedFilters,
    focusSessions,
    settings,
  };

  if (loading) {
    return (
      <div className="min-h-screen workspace-shell flex items-center justify-center p-6">
        <div className="w-full max-w-md glass-panel rounded-2xl p-6 space-y-3">
          <div className="h-5 w-32 bg-slate-300/60 dark:bg-white/10 rounded animate-pulse" />
          <div className="h-12 w-full bg-slate-300/50 dark:bg-white/10 rounded-xl animate-pulse" />
          <div className="h-12 w-full bg-slate-300/50 dark:bg-white/10 rounded-xl animate-pulse" />
          <div className="h-12 w-full bg-slate-300/50 dark:bg-white/10 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen workspace-shell flex items-center justify-center p-6">
        <section className="glass-panel w-full max-w-lg rounded-2xl p-6 text-center" role="alert">
          <h1 className="text-xl font-semibold">Your workspace could not be opened</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Check that site data is enabled in this browser, then reload the page.</p>
          <button className="accent-bg mt-5 rounded-xl px-5 py-3 font-medium text-white" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </section>
      </main>
    );
  }

  if (locked && settings.pinHash) {
    return <LockScreen pinHash={settings.pinHash} onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="min-h-screen workspace-shell text-slate-900 dark:text-slate-100 flex">
      <Sidebar
        activeView={activeView}
        selectedWorkspaceId={selectedWorkspaceId}
        selectedProjectId={selectedProjectId}
        selectedSavedFilterId={selectedSavedFilterId}
        workspaces={workspaces}
        tasks={tasks}
        projects={projects}
        folders={folders}
        savedFilters={savedFilters}
        language={settings.language}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onSelectWorkspace={(wsId) => {
          setSelectedWorkspaceId(wsId);
          setSelectedProjectId(null);
          if (activeView === 'project') setActiveView('today');
        }}
        onCreateWorkspace={handleCreateWorkspace}
        onSelectView={(view, projectId = null, filterId = null) => {
          setActiveView(view);
          setSelectedProjectId(projectId ?? null);
          setSelectedSavedFilterId(filterId ?? null);
        }}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onDeleteSavedFilter={handleDeleteSavedFilter}
        onOpenWeeklyReset={() => setWeeklyResetOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        profileName={settings.profileName}
        profileEmail={settings.profileEmail}
        profileImage={settings.profileImage}
        onSignOut={onSignOut}
      />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <TopBar
          title={viewTitle}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          mobileSearchOpen={mobileSearchOpen}
          onToggleMobileSearch={() => setMobileSearchOpen((open) => !open)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenQuickCapture={() => setQuickCaptureOpen(true)}
          onStartFocusMode={() => handleStartFocus()}
          onOpenBriefing={() => setBriefingOpen(true)}
          onOpenHelp={() => setOnboardingOpen(true)}
          canUndo={undoStack.length > 0}
          onUndo={handleUndo}
          hasPinLock={Boolean(settings.pinHash)}
          onLockApp={() => setLocked(true)}
          language={settings.language}
          searchInputRef={searchInputRef}
        />

        <main className={`flex-1 pb-16 ${activeView === 'home' ? 'dashboard-main' : ''}`}>
          <Suspense
            fallback={
              <div
                className="mx-auto mt-8 max-w-5xl px-6 text-sm text-slate-500 dark:text-slate-400"
                role="status"
              >
                Loading view…
              </div>
            }
          >
          {activeView === 'home' && (
            <div className="dashboard-layout">
              <div className="dashboard-primary">
                <DashboardWelcome tasks={wsTasks} profileName={settings.profileName} />
                <TodayView
                  tasks={wsTasks}
                  projects={wsProjects}
                  habits={habits}
                  focusSessions={focusSessions}
                  settings={settings}
                  searchQuery={searchQuery}
                  activeTimerTaskId={activeTimerTaskId}
                  activeTimerElapsed={activeTimerElapsed}
                  onUpdateSettings={updateSettings}
                  onQuickCreate={(input) => handleCreateTask(input)}
                  onToggleComplete={handleToggleComplete}
                  onToggleTop3={handleToggleTop3}
                  onToggleFavorite={handleToggleFavorite}
                  onSnoozeTomorrow={handleSnoozeTomorrow}
                  onOpenDetail={setDetailTaskId}
                  onStartFocus={handleStartFocus}
                  onToggleTimer={handleToggleTimer}
                  onDuplicate={handleDuplicate}
                  onArchive={handleArchive}
                  onTrash={handleTrash}
                  onReorderTasks={handleReorderTasks}
                  onToggleHabitDate={handleToggleHabitDate}
                  onOpenReschedule={() => setRescheduleOpen(true)}
                  onBulkAction={handleBulkAction}
                />
              </div>
              <DashboardPanels
                tasks={wsTasks}
                onOpenCalendar={() => setActiveView('calendar')}
                onOpenInsights={() => setActiveView('insights')}
              />
            </div>
          )}

          {(activeView === 'upcoming' ||
            activeView === 'today' ||
            activeView === 'inbox' ||
            activeView === 'all' ||
            activeView === 'completed' ||
            activeView === 'overdue' ||
            activeView === 'favorites' ||
            activeView === 'parking_lot' ||
            activeView === 'quick_wins' ||
            activeView === 'project' ||
            activeView === 'saved_filter' ||
            activeView === 'archive') && (
            <TaskListView
              mode={activeView}
              tasks={wsTasks}
              projects={wsProjects}
              settings={settings}
              selectedProject={selectedProject}
              selectedSavedFilter={selectedSavedFilter}
              searchQuery={searchQuery}
              activeTimerTaskId={activeTimerTaskId}
              activeTimerElapsed={activeTimerElapsed}
              onOpenQuickCapture={() => setQuickCaptureOpen(true)}
              onSaveFilter={handleSaveFilter}
              onUpdateProject={handleUpdateProject}
              onImportProjectShare={handleImportProjectShare}
              onToggleComplete={handleToggleComplete}
              onToggleTop3={handleToggleTop3}
              onToggleFavorite={handleToggleFavorite}
              onSnoozeTomorrow={handleSnoozeTomorrow}
              onOpenDetail={setDetailTaskId}
              onStartFocus={handleStartFocus}
              onToggleTimer={handleToggleTimer}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onTrash={handleTrash}
              onRestore={handleRestore}
              onDeleteForever={handleDeleteForever}
              onEmptyTrash={handleEmptyTrash}
              onReorderTasks={handleReorderTasks}
              onBulkAction={handleBulkAction}
              onNotify={(msg) => showToast(msg)}
            />
          )}

          {activeView === 'kanban' && (
            <KanbanView
              tasks={wsTasks}
              projects={wsProjects}
              searchQuery={searchQuery}
              onUpdateTask={handleUpdateTask}
              onToggleComplete={handleToggleComplete}
              onOpenDetail={setDetailTaskId}
              onStartFocus={handleStartFocus}
              onQuickCreateInColumn={(title, overrides) =>
                handleCreateTask({
                  title,
                  priority: overrides.priority || 'medium',
                  energy: overrides.energy || 'medium',
                  estimatedMinutes: 30,
                  dueDate: null,
                  projectId: null,
                  tags: [],
                  pinTop3: false,
                  status: overrides.status || 'todo',
                })
              }
            />
          )}

          {activeView === 'table' && (
            <TableView
              tasks={wsTasks}
              projects={wsProjects}
              searchQuery={searchQuery}
              onUpdateTask={handleUpdateTask}
              onToggleComplete={handleToggleComplete}
              onOpenDetail={setDetailTaskId}
              onStartFocus={handleStartFocus}
            />
          )}

          {activeView === 'timeline' && (
            <TimelineView
              tasks={wsTasks}
              projects={wsProjects}
              onOpenDetail={setDetailTaskId}
            />
          )}

          {activeView === 'matrix' && (
            <EisenhowerView
              tasks={wsTasks}
              projects={wsProjects}
              searchQuery={searchQuery}
              onUpdateTask={handleUpdateTask}
              onToggleComplete={handleToggleComplete}
              onOpenDetail={setDetailTaskId}
              onStartFocus={handleStartFocus}
              onCreateInQuadrant={(title, important, urgent) =>
                handleCreateTask({
                  title,
                  priority: important && urgent ? 'urgent' : important ? 'high' : urgent ? 'medium' : 'low',
                  energy: 'medium',
                  estimatedMinutes: 30,
                  dueDate: important && urgent ? getTodayStr() : null,
                  projectId: null,
                  tags: [],
                  pinTop3: false,
                  important,
                  urgent,
                })
              }
            />
          )}

          {activeView === 'calendar' && (
            <CalendarView
              tasks={wsTasks}
              projects={wsProjects}
              countdowns={countdowns}
              defaultWorkspaceId={defaultWorkspaceId}
              onToggleComplete={handleToggleComplete}
              onOpenDetail={setDetailTaskId}
              onStartFocus={handleStartFocus}
              onCreateTaskOnDate={(title, dateStr, timeStart) =>
                handleCreateTask({
                  title,
                  priority: 'medium',
                  energy: 'medium',
                  estimatedMinutes: 30,
                  dueDate: dateStr,
                  projectId: null,
                  tags: [],
                  pinTop3: false,
                  timeStart,
                })
              }
              onImportTasks={handleImportTasks}
              onAddCountdown={handleAddCountdown}
              onDeleteCountdown={handleDeleteCountdown}
              onNotify={(msg) => showToast(msg)}
            />
          )}

          {activeView === 'radar' && (
            <TaskRadarView
              tasks={wsTasks}
              projects={wsProjects}
              dailyGoal={settings.dailyGoal}
              onOpenDetail={setDetailTaskId}
              onOpenReschedule={() => setRescheduleOpen(true)}
            />
          )}

          {activeView === 'insights' && (
            <InsightsView
              tasks={wsTasks}
              projects={wsProjects}
              habits={habits}
              focusSessions={focusSessions}
              settings={settings}
              onToggleHabitDate={handleToggleHabitDate}
              onCreateHabit={handleCreateHabit}
              onDeleteHabit={handleDeleteHabit}
              onOpenDetail={setDetailTaskId}
            />
          )}

          {activeView === 'lists' && (
            <SpecializedListsView
              templates={templates}
              groceries={groceries}
              readings={readings}
              exams={exams}
              onUseTemplate={handleUseTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onAddGrocery={handleAddGrocery}
              onToggleGrocery={handleToggleGrocery}
              onDeleteGrocery={handleDeleteGrocery}
              onAddReading={handleAddReading}
              onUpdateReading={handleUpdateReading}
              onDeleteReading={handleDeleteReading}
              onAddExam={handleAddExam}
              onUpdateExam={handleUpdateExam}
              onDeleteExam={handleDeleteExam}
            />
          )}
          </Suspense>
        </main>
      </div>

      <MobileBottomNav
        activeView={activeView}
        searchOpen={mobileSearchOpen}
        onSelectView={(view) => {
          setActiveView(view);
          setSelectedProjectId(null);
          setSelectedSavedFilterId(null);
          setMobileSearchOpen(false);
        }}
        onToggleSearch={() => {
          setMobileSearchOpen((open) => !open);
          setMobileSidebarOpen(false);
        }}
        onQuickCapture={() => {
          setMobileSearchOpen(false);
          setQuickCaptureOpen(true);
        }}
        onOpenMenu={() => {
          setMobileSearchOpen(false);
          setMobileSidebarOpen(true);
        }}
      />

      {/* Drawers & Modals */}
      <QuickCaptureModal
        isOpen={quickCaptureOpen}
        projects={wsProjects}
        defaultProjectId={activeView === 'project' ? selectedProjectId : null}
        defaultDueDate={activeView === 'today' ? getTodayStr() : null}
        onClose={() => setQuickCaptureOpen(false)}
        onCreateTask={(input) => handleCreateTask(input)}
      />

      <TaskDetailDrawer
        task={detailTask}
        allTasks={tasks}
        projects={projects}
        activeTimerTaskId={activeTimerTaskId}
        activeTimerElapsed={activeTimerElapsed}
        onClose={() => setDetailTaskId(null)}
        onUpdateTask={handleUpdateTask}
        onSaveAsTemplate={handleSaveAsTemplate}
        onToggleTimer={handleToggleTimer}
        onStartFocus={(id) => {
          setDetailTaskId(null);
          handleStartFocus(id);
        }}
        onDuplicate={handleDuplicate}
        onArchive={handleArchive}
        onTrash={handleTrash}
      />

      <FocusModeOverlay
        isOpen={focusOpen}
        task={focusTask}
        project={
          focusTask?.projectId
            ? projects.find((p) => p.id === focusTask.projectId)
            : undefined
        }
        settings={settings}
        onClose={() => setFocusOpen(false)}
        onUpdateTask={handleUpdateTask}
        onCompleteAndNext={handleFocusCompleteAndNext}
        onSkipNext={handleFocusSkipNext}
        onLogFocusSession={handleLogFocusSession}
      />

      <RescheduleModal
        isOpen={rescheduleOpen}
        tasks={wsTasks}
        dailyGoal={settings.dailyGoal}
        onClose={() => setRescheduleOpen(false)}
        onApplySuggestion={handleApplyReschedule}
        onApplyAll={handleApplyAllReschedules}
      />

      <WeeklyResetModal
        isOpen={weeklyResetOpen}
        tasks={wsTasks}
        settings={settings}
        onClose={() => setWeeklyResetOpen(false)}
        onRescheduleTask={handleRescheduleTask}
        onPromoteFromParkingLot={handlePromoteFromParkingLot}
        onUpdateSettings={updateSettings}
      />

      <DailyBriefingModal
        isOpen={briefingOpen}
        tasks={wsTasks}
        settings={settings}
        onClose={() => setBriefingOpen(false)}
        onOpenDetail={(id) => {
          setBriefingOpen(false);
          setDetailTaskId(id);
        }}
        onSnoozeTask={handleSnoozeTask}
        onDismissReminder={handleDismissReminder}
        onSnoozeReminder={handleSnoozeReminder}
      />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => {
          setOnboardingOpen(false);
          updateSettings({ onboardingDismissed: true });
        }}
      />

      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        tasks={tasks}
        projects={projects}
        defaultWorkspaceId={defaultWorkspaceId}
        fullBackup={fullBackup}
        onClose={() => setSettingsOpen(false)}
        onUpdateSettings={updateSettings}
        onImportBackup={handleImportBackup}
        onImportTasks={handleImportTasks}
        onMergeDuplicates={handleMergeDuplicates}
        onResetDemo={handleResetDemo}
        onWipeAll={handleWipeAll}
        onNotify={(msg) => showToast(msg)}
      />

      <OfflineIndicator />

      {/* Glass Action Toast with Undo */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl glass-modal text-slate-900 dark:text-white flex items-center gap-3 text-xs font-medium no-print">
          <span className="flex-1">{toast.message}</span>
          {toast.canUndo && undoStack.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg accent-soft-bg font-semibold shrink-0"
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-800 dark:hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
