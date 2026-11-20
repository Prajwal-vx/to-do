import {
  CountdownItem,
  EnergyLevel,
  ExamItem,
  FocusSession,
  Folder,
  GroceryItem,
  Habit,
  Priority,
  Project,
  ReadingItem,
  SavedFilter,
  Task,
  TaskTemplate,
  UserSettings,
  Workspace,
} from '../types/todo';
import { decryptBackupString, encryptBackupString } from './crypto';

export interface WorkspaceBackup {
  version: number;
  exportedAt: string;
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
  settings?: UserSettings;
}

export interface ProjectSharePackage {
  packageType: 'to-do-project-share';
  version: number;
  exportedAt: string;
  project: Project;
  tasks: Task[];
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Safari may start consuming the download after the click handler returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportWorkspaceJSON(backup: WorkspaceBackup) {
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    `todo-workspace-backup-${dateStamp}.json`,
    JSON.stringify(backup, null, 2),
    'application/json'
  );
}

export async function exportEncryptedWorkspaceJSON(
  backup: WorkspaceBackup,
  passphrase: string
) {
  const encrypted = await encryptBackupString(JSON.stringify(backup), passphrase);
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    `todo-encrypted-backup-${dateStamp}.todo-enc.json`,
    encrypted,
    'application/json'
  );
}

export function exportProjectSharePackage(project: Project, tasks: Task[]) {
  const pkg: ProjectSharePackage = {
    packageType: 'to-do-project-share',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    tasks: tasks.filter((t) => t.projectId === project.id && t.status !== 'trashed'),
  };
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  downloadBlob(
    `project-${slug}.todo-share.json`,
    JSON.stringify(pkg, null, 2),
    'application/json'
  );
}

export function parseProjectSharePackage(jsonText: string): ProjectSharePackage {
  const parsed = JSON.parse(jsonText);
  if (!parsed || parsed.packageType !== 'to-do-project-share' || !parsed.project || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid TO-DO project sharing package.');
  }
  return parsed as ProjectSharePackage;
}

export function exportTasksCSV(tasks: Task[], projects: Project[]) {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const escapeCsv = (val: string) => {
    const value = val || '';
    const safeValue = /^[\s\x00-\x1f\x7f-\x9f]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u.test(value)
      ? `'${value}`
      : value;
    return `"${safeValue.replace(/"/g, '""')}"`;
  };

  const headers = [
    'Title',
    'Description',
    'Status',
    'Priority',
    'Energy',
    'Category',
    'Project',
    'Due Date',
    'Deadline',
    'Estimated Minutes',
    'Tracked Minutes',
    'Tags',
    'Created At',
    'Completed At',
  ];

  const rows = tasks.map((t) =>
    [
      escapeCsv(t.title),
      escapeCsv(t.description),
      escapeCsv(t.status),
      escapeCsv(t.priority),
      escapeCsv(t.energy),
      escapeCsv(t.lifeCategory),
      escapeCsv(t.projectId ? projectMap.get(t.projectId) || 'Unknown' : 'Inbox'),
      escapeCsv(t.dueDate || ''),
      escapeCsv(t.deadline || ''),
      String(t.estimatedMinutes),
      String(Math.round(t.actualSeconds / 60)),
      escapeCsv(t.tags.join('; ')),
      escapeCsv(t.createdAt),
      escapeCsv(t.completedAt || ''),
    ].join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`todo-tasks-${dateStamp}.csv`, csv, 'text/csv;charset=utf-8;');
}

export function parseTasksFromCSV(
  csvText: string,
  defaultWorkspaceId: string
): Omit<Task, 'id' | 'order'>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(field); field = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csvText[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (inQuotes) throw new Error('Invalid CSV: unterminated quoted field.');
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell.trim()));
  if (nonEmptyRows.length < 2) return [];

  const headers = nonEmptyRows[0].map((h) => h.trim().toLowerCase());
  const idxOf = (name: string) => headers.findIndex((h) => h.includes(name));
  const titleIdx = Math.max(0, idxOf('title'));
  const descIdx = idxOf('description');
  const prioIdx = idxOf('priority');
  const energyIdx = idxOf('energy');
  const dueIdx = idxOf('due');
  const estIdx = idxOf('estimated');
  const tagsIdx = idxOf('tag');

  const nowIso = new Date().toISOString();
  const imported: Omit<Task, 'id' | 'order'>[] = [];

  for (let r = 1; r < nonEmptyRows.length; r++) {
    const cols = nonEmptyRows[r];
    const title = cols[titleIdx]?.trim();
    if (!title) continue;
    const rawPrio = (cols[prioIdx] || 'medium').toLowerCase();
    const priority: Priority = ['urgent', 'high', 'medium', 'low'].includes(rawPrio)
      ? (rawPrio as Priority)
      : 'medium';
    const rawEnergy = (cols[energyIdx] || 'medium').toLowerCase();
    const energy: EnergyLevel = ['low', 'medium', 'high'].includes(rawEnergy)
      ? (rawEnergy as EnergyLevel)
      : 'medium';
    const dueRaw = dueIdx >= 0 ? cols[dueIdx] : '';
    const dateMatch = dueRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const candidateDate = dateMatch?.[0];
    const parsedDate = candidateDate ? new Date(`${candidateDate}T00:00:00Z`) : null;
    const dueDate = parsedDate && !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === candidateDate ? candidateDate : null;
    const est = estIdx >= 0 ? parseInt(cols[estIdx] || '30', 10) || 30 : 30;
    const tags =
      tagsIdx >= 0 && cols[tagsIdx]
        ? cols[tagsIdx]
            .split(/[;,]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : [];

    imported.push({
      title,
      description: descIdx >= 0 ? cols[descIdx] || '' : '',
      status: 'todo',
      priority,
      important: priority === 'urgent' || priority === 'high',
      urgent: priority === 'urgent',
      energy,
      lifeCategory: 'projects',
      workspaceId: defaultWorkspaceId,
      projectId: null,
      sectionId: null,
      parentId: null,
      assigneeId: null,
      color: null,
      isFavorite: false,
      tags,
      startDate: null,
      dueDate,
      deadline: null,
      timeSlot: null,
      reminderAt: null,
      reminders: [],
      recurrence: { type: 'none', interval: 1 },
      subtasks: [],
      estimatedMinutes: Math.max(5, est),
      actualSeconds: 0,
      dependsOn: [],
      links: [],
      attachments: [],
      comments: [],
      activityLog: [{ id: `act-${Date.now()}-${r}`, actor: 'You', action: 'Imported via CSV', timestamp: nowIso }],
      top3Date: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: null,
      trashedAt: null,
    });
  }
  return imported;
}

export function exportTasksICS(tasks: Task[]) {
  const scheduled = tasks.filter(
    (t) => t.dueDate && t.status !== 'trashed' && t.status !== 'archived'
  );

  const formatICSDate = (dateStr: string, timeStr?: string) => {
    const cleanDate = dateStr.replace(/-/g, '');
    if (!timeStr) return cleanDate;
    const cleanTime = timeStr.replace(/:/g, '') + '00';
    return `${cleanDate}T${cleanTime}`;
  };

  const escapeICS = (str: string) =>
    (str || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TO-DO Workspace//Local Productivity//EN',
    'CALSCALE:GREGORIAN',
  ];

  scheduled.forEach((task) => {
    if (!task.dueDate) return;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id}@todo-workspace.local`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);

    if (task.timeSlot) {
      lines.push(`DTSTART:${formatICSDate(task.dueDate, task.timeSlot.start)}`);
      lines.push(`DTEND:${formatICSDate(task.dueDate, task.timeSlot.end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${formatICSDate(task.dueDate)}`);
    }

    lines.push(`SUMMARY:${escapeICS(task.title)}`);
    if (task.description) {
      lines.push(`DESCRIPTION:${escapeICS(task.description)}`);
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`todo-schedule-${dateStamp}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8;');
}

export function parseTasksFromICS(
  icsText: string,
  defaultWorkspaceId: string
): Omit<Task, 'id' | 'order'>[] {
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1);
  const nowIso = new Date().toISOString();
  const tasks: Omit<Task, 'id' | 'order'>[] = [];

  const parseIcsDateTime = (raw: string): { date: string | null; time: string | null } => {
    const val = raw.split(':').pop()?.trim() || '';
    const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
    if (!m) return { date: null, time: null };
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    const time = m[4] && m[5] ? `${m[4]}:${m[5]}` : null;
    return { date, time };
  };

  blocks.forEach((blk, idx) => {
    const endIdx = blk.indexOf('END:VEVENT');
    const content = endIdx >= 0 ? blk.slice(0, endIdx) : blk;
    const lines = content.split(/\r?\n/);

    let summary = '';
    let description = '';
    let dtStartRaw = '';
    let dtEndRaw = '';

    lines.forEach((line) => {
      if (line.startsWith('SUMMARY')) summary = line.split(':').slice(1).join(':').trim();
      else if (line.startsWith('DESCRIPTION'))
        description = line.split(':').slice(1).join(':').replace(/\\n/g, '\n').trim();
      else if (line.startsWith('DTSTART')) dtStartRaw = line;
      else if (line.startsWith('DTEND')) dtEndRaw = line;
    });

    if (!summary) return;
    const start = parseIcsDateTime(dtStartRaw);
    const end = parseIcsDateTime(dtEndRaw);

    tasks.push({
      title: summary,
      description,
      status: 'todo',
      priority: 'medium',
      important: false,
      urgent: false,
      energy: 'medium',
      lifeCategory: 'personal',
      workspaceId: defaultWorkspaceId,
      projectId: null,
      sectionId: null,
      parentId: null,
      assigneeId: null,
      color: null,
      isFavorite: false,
      tags: ['calendar'],
      startDate: start.date,
      dueDate: start.date,
      deadline: null,
      timeSlot:
        start.time && end.time
          ? { start: start.time, end: end.time }
          : start.time
          ? { start: start.time, end: start.time }
          : null,
      reminderAt: null,
      reminders: [],
      recurrence: { type: 'none', interval: 1 },
      subtasks: [],
      estimatedMinutes: 30,
      actualSeconds: 0,
      dependsOn: [],
      links: [],
      attachments: [],
      comments: [],
      activityLog: [{ id: `act-ics-${idx}`, actor: 'You', action: 'Imported from .ics calendar', timestamp: nowIso }],
      top3Date: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: null,
      trashedAt: null,
    });
  });

  return tasks;
}

export async function parseWorkspaceBackupMaybeEncrypted(
  rawText: string,
  passphrase?: string
): Promise<WorkspaceBackup> {
  const parsed = JSON.parse(rawText);
  let payload = parsed;
  if (parsed && parsed.encrypted === true) {
    if (!passphrase) {
      throw new Error('ENCRYPTED_BACKUP_NEEDS_PASSWORD');
    }
    const decryptedText = await decryptBackupString(rawText, passphrase);
    payload = JSON.parse(decryptedText);
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.tasks)) {
    throw new Error('Invalid TO-DO backup file: missing tasks array.');
  }
  return {
    version: Number(payload.version) || 2,
    exportedAt: String(payload.exportedAt || new Date().toISOString()),
    workspaces: Array.isArray(payload.workspaces) ? payload.workspaces : [],
    tasks: payload.tasks,
    projects: Array.isArray(payload.projects) ? payload.projects : [],
    folders: Array.isArray(payload.folders) ? payload.folders : [],
    habits: Array.isArray(payload.habits) ? payload.habits : [],
    templates: Array.isArray(payload.templates) ? payload.templates : [],
    countdowns: Array.isArray(payload.countdowns) ? payload.countdowns : [],
    groceries: Array.isArray(payload.groceries) ? payload.groceries : [],
    readings: Array.isArray(payload.readings) ? payload.readings : [],
    exams: Array.isArray(payload.exams) ? payload.exams : [],
    savedFilters: Array.isArray(payload.savedFilters) ? payload.savedFilters : [],
    focusSessions: Array.isArray(payload.focusSessions) ? payload.focusSessions : [],
    settings: payload.settings,
  };
}
