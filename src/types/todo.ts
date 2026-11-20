export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'done'
  | 'parking_lot'
  | 'archived'
  | 'trashed';

export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type LifeCategory = 'projects' | 'education' | 'personal' | 'health' | 'responsibilities';
export type MemberRole = 'owner' | 'editor' | 'viewer';
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'hi';

export interface RecurrenceRule {
  type: RecurrenceType;
  interval: number;
  daysOfWeek?: number[];
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskLink {
  id: string;
  label: string;
  url: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export interface TimeSlot {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface TaskReminder {
  id: string;
  triggerAt: string; // ISO datetime
  fired: boolean;
  snoozedUntil?: string | null;
  recurringDaily?: boolean;
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  important: boolean; // Eisenhower Important axis
  urgent: boolean; // Eisenhower Urgent axis
  energy: EnergyLevel;
  lifeCategory: LifeCategory;
  workspaceId: string;
  projectId: string | null;
  sectionId: string | null;
  parentId: string | null; // Parent-child task relationship
  assigneeId: string | null; // Local project member responsibility
  color: string | null;
  isFavorite: boolean;
  tags: string[];
  startDate: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  deadline: string | null; // YYYY-MM-DD
  timeSlot: TimeSlot | null;
  reminderAt: string | null; // Legacy/primary reminder ISO
  reminderFired?: boolean;
  reminders: TaskReminder[]; // Multiple reminders per task
  recurrence: RecurrenceRule;
  subtasks: Subtask[];
  estimatedMinutes: number;
  actualSeconds: number;
  dependsOn: string[];
  links: TaskLink[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  activityLog: TaskActivity[];
  top3Date: string | null;
  snoozedUntil?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  trashedAt: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
}

export interface Folder {
  id: string;
  name: string;
  workspaceId: string;
  order: number;
}

export interface ProjectSection {
  id: string;
  title: string;
  order: number;
}

export interface ProjectMember {
  id: string;
  name: string;
  role: MemberRole;
}

export interface Project {
  id: string;
  name: string;
  workspaceId: string;
  folderId: string | null;
  parentProjectId: string | null; // Nested projects
  color: string;
  isFavorite: boolean;
  sections: ProjectSection[];
  members: ProjectMember[];
  milestoneTitle?: string;
  milestoneTargetDate?: string | null;
  order: number;
  createdAt: string;
}

export interface Habit {
  id: string;
  title: string;
  targetPerWeek: number;
  color: string;
  completedDates: string[];
  createdAt: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  category: 'work' | 'study' | 'routine' | 'personal';
  description: string;
  priority: Priority;
  energy: EnergyLevel;
  lifeCategory: LifeCategory;
  estimatedMinutes: number;
  tags: string[];
  subtasks: string[];
  recurrence: RecurrenceRule;
}

export interface CountdownItem {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  category: LifeCategory;
  notes: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: 'Produce' | 'Dairy & Eggs' | 'Pantry' | 'Bakery' | 'Household' | 'Other';
  checked: boolean;
}

export interface ReadingItem {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  status: 'to_read' | 'reading' | 'finished';
  notes: string;
}

export interface ExamItem {
  id: string;
  course: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  weightPct: number;
  progressPct: number;
  completed: boolean;
  notes: string;
}

export interface FilterCriteria {
  query?: string;
  priorities?: Priority[];
  energies?: EnergyLevel[];
  lifeCategories?: LifeCategory[];
  tags?: string[];
  projectId?: string | 'ALL' | 'INBOX';
  maxMinutes?: number | null;
  overdueOnly?: boolean;
  hasDueDate?: boolean;
  statusFilter?: 'active' | 'todo' | 'in_progress' | 'done' | 'parking_lot';
}

export interface SavedFilter {
  id: string;
  name: string;
  criteria: FilterCriteria;
}

export interface FocusSession {
  id: string;
  taskId: string | null;
  taskTitle: string;
  durationSeconds: number;
  mode: 'pomodoro' | 'stopwatch' | 'custom';
  completedAt: string;
}

export type AccentColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
export type BackgroundPreset = 'default' | 'paper' | 'mist' | 'midnight';
export type ViewDensity = 'comfortable' | 'compact';
export type ThemePreference = 'light' | 'dark' | 'system';

export type ViewType =
  | 'home'
  | 'today'
  | 'upcoming'
  | 'inbox'
  | 'all'
  | 'completed'
  | 'overdue'
  | 'favorites'
  | 'parking_lot'
  | 'quick_wins'
  | 'table'
  | 'timeline'
  | 'matrix'
  | 'calendar'
  | 'kanban'
  | 'radar'
  | 'insights'
  | 'lists'
  | 'archive'
  | 'project'
  | 'saved_filter';

export type DashboardWidget =
  | 'top3'
  | 'timeAvailable'
  | 'shortlist'
  | 'habits'
  | 'streak'
  | 'score'
  | 'workload';

export interface UserSettings {
  id: 'user-settings';
  profileName?: string;
  profileEmail?: string;
  profileBio?: string;
  profileImage?: string | null;
  theme: ThemePreference;
  accentColor: AccentColor;
  backgroundPreset: BackgroundPreset;
  density: ViewDensity;
  language: LanguageCode;
  timezone: string;
  dailyGoal: number;
  weeklyGoal: number;
  monthlyGoal: number;
  pomodoroMinutes: number;
  shortBreakMinutes: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  morningSummaryHour: number; // 8
  eveningSummaryHour: number; // 19
  defaultView: ViewType;
  dashboardWidgets: DashboardWidget[];
  pinHash: string | null; // Optional SHA-256 local lock PIN
  onboardingDismissed: boolean;
}

export type SortOption =
  | 'smart'
  | 'manual'
  | 'dueDate'
  | 'priority'
  | 'effort'
  | 'quick_wins'
  | 'duration'
  | 'createdAt';

export interface ScoreReason {
  label: string;
  points: number;
}

export interface TaskScore {
  score: number;
  reasons: ScoreReason[];
  blocked: boolean;
  blockedByTitles: string[];
}

export interface RescheduleSuggestion {
  id: string;
  taskId: string;
  taskTitle: string;
  currentDueDate: string | null;
  suggestedDueDate: string;
  suggestedTimeSlot?: TimeSlot | null;
  reason: string;
  category: 'overdue' | 'overload' | 'neglected';
}

export type DeadlinePressureLevel = 'critical' | 'high' | 'steady' | 'calm' | 'none';
