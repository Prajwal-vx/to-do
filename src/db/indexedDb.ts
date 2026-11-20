import { createSeedWorkspace, DEFAULT_SETTINGS } from '../data/seedData';
import {
  CountdownItem,
  ExamItem,
  FocusSession,
  Folder,
  GroceryItem,
  Habit,
  Project,
  ReadingItem,
  SavedFilter,
  Task,
  TaskTemplate,
  UserSettings,
  Workspace,
} from '../types/todo';
import { WorkspaceBackup } from '../utils/exportImport';

const DB_NAME = 'todo_workspace_db';
const DB_VERSION = 2;

const STORES = {
  workspaces: 'workspaces',
  tasks: 'tasks',
  projects: 'projects',
  folders: 'folders',
  habits: 'habits',
  templates: 'templates',
  countdowns: 'countdowns',
  groceries: 'groceries',
  readings: 'readings',
  exams: 'exams',
  savedFilters: 'savedFilters',
  focusSessions: 'focusSessions',
  settings: 'settings',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support local workspace storage.'));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let wasBlocked = false;

    request.onupgradeneeded = () => {
      const db = request.result;
      (Object.values(STORES) as StoreName[]).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = () => {
      const db = request.result;
      if (wasBlocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Could not open local workspace storage'));
    };
    request.onblocked = () => {
      wasBlocked = true;
      dbPromise = null;
      reject(new Error('Local storage is busy in another tab. Close older app tabs and reload.'));
    };
  });
  return dbPromise;
}

async function getAllFromStore<T>(db: IDBDatabase, storeName: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
    tx.onabort = () => reject(tx.error || new Error(`Could not read ${storeName}`));
  });
}

async function putInStore<T>(db: IDBDatabase, storeName: StoreName, item: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error(`Could not save ${storeName}`));
  });
}

async function putManyInStore<T>(db: IDBDatabase, storeName: StoreName, items: T[]): Promise<void> {
  if (items.length === 0) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error(`Could not save ${storeName}`));
  });
}

async function deleteFromStore(db: IDBDatabase, storeName: StoreName, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error(`Could not delete from ${storeName}`));
  });
}

async function replaceAllStores(
  db: IDBDatabase,
  data: Omit<WorkspaceBackup, 'version' | 'exportedAt'>
): Promise<void> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(Object.values(STORES), 'readwrite');
      const collections: Partial<Record<StoreName, { id: string }[]>> = {
        [STORES.workspaces]: data.workspaces || [],
        [STORES.tasks]: data.tasks || [],
        [STORES.projects]: data.projects || [],
        [STORES.folders]: data.folders || [],
        [STORES.habits]: data.habits || [],
        [STORES.templates]: data.templates || [],
        [STORES.countdowns]: data.countdowns || [],
        [STORES.groceries]: data.groceries || [],
        [STORES.readings]: data.readings || [],
        [STORES.exams]: data.exams || [],
        [STORES.savedFilters]: data.savedFilters || [],
        [STORES.focusSessions]: data.focusSessions || [],
        [STORES.settings]: [data.settings || DEFAULT_SETTINGS],
      };

      (Object.values(STORES) as StoreName[]).forEach((storeName) => {
        const store = tx.objectStore(storeName);
        store.clear();
        (collections[storeName] || []).forEach((item) => store.put(item));
      });
    } catch (error) {
      reject(error);
      return;
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not replace local workspace'));
    tx.onabort = () => reject(tx.error || new Error('Workspace replacement was cancelled'));
  });
}

export interface LoadedWorkspace {
  workspaces: Workspace[];
  tasks: Task[];
  projects: Project[];
  folders: Folder[];
  habits: Habit[];
  templates: TaskTemplate[];
  countdowns: CountdownItem[];
  groceries: GroceryItem[];
  readings: ReadingItem[];
  exams: ExamItem[];
  savedFilters: SavedFilter[];
  focusSessions: FocusSession[];
  settings: UserSettings;
}

const SEEDED_FLAG_KEY = 'todo_workspace_seeded_v2';

// Storage can be disabled in private browsing or under strict privacy settings.
// IndexedDB remains the source of truth; this flag only avoids reseeding after a wipe.
function hasBeenSeeded(): boolean {
  try {
    return localStorage.getItem(SEEDED_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

function markSeeded(): void {
  try {
    localStorage.setItem(SEEDED_FLAG_KEY, 'true');
  } catch {
    // The workspace itself is stored in IndexedDB, so a missing hint is non-fatal.
  }
}

function normalizeTask(t: Partial<Task>, defaultWsId: string): Task {
  return {
    ...(t as Task),
    important: t.important ?? (t.priority === 'urgent' || t.priority === 'high'),
    urgent: t.urgent ?? t.priority === 'urgent',
    lifeCategory: t.lifeCategory || 'projects',
    workspaceId: t.workspaceId || defaultWsId,
    sectionId: t.sectionId ?? null,
    parentId: t.parentId ?? null,
    assigneeId: t.assigneeId ?? null,
    color: t.color ?? null,
    isFavorite: Boolean(t.isFavorite),
    reminders: Array.isArray(t.reminders)
      ? t.reminders
      : t.reminderAt
      ? [{ id: `rem-${t.id}`, triggerAt: t.reminderAt, fired: Boolean(t.reminderFired) }]
      : [],
    comments: Array.isArray(t.comments) ? t.comments : [],
    activityLog: Array.isArray(t.activityLog) ? t.activityLog : [],
  };
}

function normalizeProject(p: Partial<Project>, defaultWsId: string): Project {
  return {
    ...(p as Project),
    workspaceId: p.workspaceId || defaultWsId,
    parentProjectId: p.parentProjectId ?? null,
    isFavorite: Boolean(p.isFavorite),
    sections: Array.isArray(p.sections) ? p.sections : [],
    members: Array.isArray(p.members)
      ? p.members
      : [{ id: 'mem-you', name: 'You', role: 'owner' }],
  };
}

export const dbService = {
  async loadWorkspace(): Promise<LoadedWorkspace> {
    const db = await openDb();
    const [
      workspaces,
      rawTasks,
      rawProjects,
      rawFolders,
      habits,
      templates,
      countdowns,
      groceries,
      readings,
      exams,
      savedFilters,
      focusSessions,
      settingsList,
    ] = await Promise.all([
      getAllFromStore<Workspace>(db, STORES.workspaces),
      getAllFromStore<Task>(db, STORES.tasks),
      getAllFromStore<Project>(db, STORES.projects),
      getAllFromStore<Folder>(db, STORES.folders),
      getAllFromStore<Habit>(db, STORES.habits),
      getAllFromStore<TaskTemplate>(db, STORES.templates),
      getAllFromStore<CountdownItem>(db, STORES.countdowns),
      getAllFromStore<GroceryItem>(db, STORES.groceries),
      getAllFromStore<ReadingItem>(db, STORES.readings),
      getAllFromStore<ExamItem>(db, STORES.exams),
      getAllFromStore<SavedFilter>(db, STORES.savedFilters),
      getAllFromStore<FocusSession>(db, STORES.focusSessions),
      getAllFromStore<UserSettings>(db, STORES.settings),
    ]);

    const alreadySeeded = hasBeenSeeded();
    if (
      !alreadySeeded &&
      rawTasks.length === 0 &&
      rawProjects.length === 0 &&
      settingsList.length === 0
    ) {
      const seed = createSeedWorkspace();
      await replaceAllStores(db, seed);
      markSeeded();
      return seed;
    }

    const seedFallback = createSeedWorkspace();
    const finalWorkspaces =
      workspaces.length > 0
        ? workspaces.sort((a, b) => a.order - b.order)
        : seedFallback.workspaces;
    if (workspaces.length === 0) {
      await putManyInStore(db, STORES.workspaces, finalWorkspaces);
    }

    const defaultWsId = finalWorkspaces[0].id;
    const tasks = rawTasks.map((t) => normalizeTask(t, defaultWsId)).sort((a, b) => a.order - b.order);
    const projects = rawProjects
      .map((p) => normalizeProject(p, defaultWsId))
      .sort((a, b) => a.order - b.order);
    const folders = rawFolders
      .map((f) => ({ ...f, workspaceId: f.workspaceId || defaultWsId }))
      .sort((a, b) => a.order - b.order);

    const finalTemplates = templates.length > 0 ? templates : seedFallback.templates;
    if (templates.length === 0 && !alreadySeeded) {
      await putManyInStore(db, STORES.templates, finalTemplates);
    }

    const settings: UserSettings = { ...DEFAULT_SETTINGS, ...(settingsList[0] || {}) };
    if (settingsList.length === 0) {
      await putInStore(db, STORES.settings, settings);
    }
    markSeeded();

    return {
      workspaces: finalWorkspaces,
      tasks,
      projects,
      folders,
      habits,
      templates: finalTemplates,
      countdowns,
      groceries,
      readings,
      exams,
      savedFilters,
      focusSessions: focusSessions.sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
      settings,
    };
  },

  async saveWorkspace(ws: Workspace) {
    const db = await openDb();
    await putInStore(db, STORES.workspaces, ws);
  },
  async deleteWorkspace(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.workspaces, id);
  },
  async saveTask(task: Task) {
    const db = await openDb();
    await putInStore(db, STORES.tasks, task);
  },
  async saveTasks(tasks: Task[]) {
    const db = await openDb();
    await putManyInStore(db, STORES.tasks, tasks);
  },
  async deleteTaskPermanently(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.tasks, id);
  },
  async saveProject(project: Project) {
    const db = await openDb();
    await putInStore(db, STORES.projects, project);
  },
  async deleteProject(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.projects, id);
  },
  async saveFolder(folder: Folder) {
    const db = await openDb();
    await putInStore(db, STORES.folders, folder);
  },
  async deleteFolder(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.folders, id);
  },
  async saveHabit(habit: Habit) {
    const db = await openDb();
    await putInStore(db, STORES.habits, habit);
  },
  async deleteHabit(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.habits, id);
  },
  async saveTemplate(tpl: TaskTemplate) {
    const db = await openDb();
    await putInStore(db, STORES.templates, tpl);
  },
  async deleteTemplate(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.templates, id);
  },
  async saveCountdown(item: CountdownItem) {
    const db = await openDb();
    await putInStore(db, STORES.countdowns, item);
  },
  async deleteCountdown(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.countdowns, id);
  },
  async saveGrocery(item: GroceryItem) {
    const db = await openDb();
    await putInStore(db, STORES.groceries, item);
  },
  async deleteGrocery(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.groceries, id);
  },
  async saveReading(item: ReadingItem) {
    const db = await openDb();
    await putInStore(db, STORES.readings, item);
  },
  async deleteReading(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.readings, id);
  },
  async saveExam(item: ExamItem) {
    const db = await openDb();
    await putInStore(db, STORES.exams, item);
  },
  async deleteExam(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.exams, id);
  },
  async saveFilter(filter: SavedFilter) {
    const db = await openDb();
    await putInStore(db, STORES.savedFilters, filter);
  },
  async deleteFilter(id: string) {
    const db = await openDb();
    await deleteFromStore(db, STORES.savedFilters, id);
  },
  async saveFocusSession(session: FocusSession) {
    const db = await openDb();
    await putInStore(db, STORES.focusSessions, session);
  },
  async saveSettings(settings: UserSettings) {
    const db = await openDb();
    await putInStore(db, STORES.settings, settings);
  },

  async replaceWorkspace(data: Omit<WorkspaceBackup, 'version' | 'exportedAt'>) {
    const db = await openDb();
    await replaceAllStores(db, data);
    markSeeded();
  },

  async resetDemoWorkspace(): Promise<LoadedWorkspace> {
    const seed = createSeedWorkspace();
    await this.replaceWorkspace(seed);
    return seed;
  },

  async wipeAllData(): Promise<LoadedWorkspace> {
    const empty: LoadedWorkspace = {
      workspaces: [{ id: 'ws-default', name: 'My Workspace', description: '', color: '#4f46e5', order: 0 }],
      tasks: [],
      projects: [],
      folders: [],
      habits: [],
      templates: [],
      countdowns: [],
      groceries: [],
      readings: [],
      exams: [],
      savedFilters: [],
      focusSessions: [],
      settings: { ...DEFAULT_SETTINGS, pinHash: null, onboardingDismissed: true },
    };
    await this.replaceWorkspace(empty);
    return empty;
  },
};
