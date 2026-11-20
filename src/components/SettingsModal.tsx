import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  Download,
  Lock,
  Merge,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AccentColor,
  BackgroundPreset,
  LanguageCode,
  Project,
  Task,
  UserSettings,
  ViewDensity,
} from '../types/todo';
import { sha256Hex } from '../utils/crypto';
import {
  exportEncryptedWorkspaceJSON,
  exportTasksCSV,
  exportTasksICS,
  exportWorkspaceJSON,
  parseTasksFromCSV,
  parseTasksFromICS,
  parseWorkspaceBackupMaybeEncrypted,
  WorkspaceBackup,
} from '../utils/exportImport';
import { SUPPORTED_LANGUAGES } from '../utils/i18n';
import { detectDuplicateTasks } from '../utils/rulesEngine';
import { playGentleChime } from '../utils/sound';

interface SettingsModalProps {
  isOpen: boolean;
  settings: UserSettings;
  tasks: Task[];
  projects: Project[];
  defaultWorkspaceId: string;
  fullBackup: WorkspaceBackup;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onImportBackup: (backup: WorkspaceBackup) => Promise<void>;
  onImportTasks: (imported: Omit<Task, 'id' | 'order'>[], sourceLabel: string) => void;
  onMergeDuplicates: (keepId: string, trashIds: string[]) => void;
  onResetDemo: () => Promise<void>;
  onWipeAll: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const ACCENTS: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'indigo', label: 'Indigo', hex: '#4f46e5' },
  { id: 'emerald', label: 'Emerald', hex: '#059669' },
  { id: 'amber', label: 'Amber', hex: '#d97706' },
  { id: 'rose', label: 'Rose', hex: '#e11d48' },
  { id: 'slate', label: 'Graphite', hex: '#334155' },
];

const BACKGROUNDS: { id: BackgroundPreset; label: string }[] = [
  { id: 'default', label: 'Aurora Glass' },
  { id: 'paper', label: 'Warm Paper' },
  { id: 'mist', label: 'Cool Mist' },
  { id: 'midnight', label: 'Midnight Glass' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  tasks,
  projects,
  defaultWorkspaceId,
  fullBackup,
  onClose,
  onUpdateSettings,
  onImportBackup,
  onImportTasks,
  onMergeDuplicates,
  onResetDemo,
  onWipeAll,
  onNotify,
}) => {
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const icsInputRef = useRef<HTMLInputElement | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [pendingEncryptedRaw, setPendingEncryptedRaw] = useState<string | null>(null);
  const [decryptPass, setDecryptPass] = useState('');
  const [exportPass, setExportPass] = useState('');
  const [showEncExport, setShowEncExport] = useState(false);
  const [profileImageError, setProfileImageError] = useState('');

  const [newPin, setNewPin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const duplicates = useMemo(
    () => (isOpen ? detectDuplicateTasks(tasks) : []),
    [isOpen, tasks]
  );

  if (!isOpen) return null;

  const handleProfileImage = async (file?: File) => {
    setProfileImageError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileImageError('Choose an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setProfileImageError('Choose an image smaller than 8 MB.');
      return;
    }
    try {
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image editor is unavailable in this browser.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not process this image.')), 'image/webp', 0.82)
        );
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the processed image.'));
          reader.onerror = () => reject(new Error('Could not read the processed image.'));
          reader.readAsDataURL(blob);
        });
        onUpdateSettings({ profileImage: dataUrl });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      setProfileImageError(error instanceof Error ? error.message : 'Could not update the profile photo.');
    }
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      onNotify('Browser notifications are unavailable here; in-app alerts remain active.');
      onUpdateSettings({ notificationsEnabled: true });
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        onUpdateSettings({ notificationsEnabled: true });
        new Notification('TO-DO Reminders Enabled', {
          body: 'Scheduled task reminders will appear right on time.',
        });
      } else {
        onUpdateSettings({ notificationsEnabled: true });
        onNotify('System permission denied; in-app reminder banners will be shown.');
      }
    } catch {
      onUpdateSettings({ notificationsEnabled: true });
      onNotify('System notifications are unavailable here; in-app reminder banners will be shown.');
    }
  };

  const handleJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setPendingEncryptedRaw(null);
    try {
      const text = await file.text();
      const backup = await parseWorkspaceBackupMaybeEncrypted(text);
      await onImportBackup(backup);
      onNotify(`Restored ${backup.tasks.length} tasks from backup.`);
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message === 'ENCRYPTED_BACKUP_NEEDS_PASSWORD') {
        setPendingEncryptedRaw(await file.text());
      } else {
        setImportError(err instanceof Error ? err.message : 'Failed to parse backup file.');
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleDecryptRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEncryptedRaw || !decryptPass) return;
    setImportError(null);
    try {
      const backup = await parseWorkspaceBackupMaybeEncrypted(pendingEncryptedRaw, decryptPass);
      await onImportBackup(backup);
      setPendingEncryptedRaw(null);
      setDecryptPass('');
      onNotify(`Decrypted and restored ${backup.tasks.length} tasks.`);
      onClose();
    } catch {
      setImportError('Incorrect passphrase or corrupted encrypted backup.');
    }
  };

  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const imported = parseTasksFromCSV(text, defaultWorkspaceId);
      if (imported.length === 0) {
        setImportError('No valid rows found in CSV.');
      } else {
        onImportTasks(imported, 'CSV');
      }
    } catch {
      setImportError('Failed to parse CSV file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleIcsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const imported = parseTasksFromICS(text, defaultWorkspaceId);
      if (imported.length === 0) {
        setImportError('No calendar events found in .ics file.');
      } else {
        onImportTasks(imported, 'ICS Calendar');
      }
    } catch {
      setImportError('Failed to parse .ics file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length < 4) {
      onNotify('Choose a PIN with at least 4 characters.');
      return;
    }
    const hash = await sha256Hex(newPin.trim());
    onUpdateSettings({ pinHash: hash });
    setNewPin('');
    onNotify('Local PIN lock enabled.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl glass-modal overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Personalization, Privacy & Data Management
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Your profile</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex items-center gap-3 sm:w-52 shrink-0">
                <img src={settings.profileImage || '/avatar.svg'} alt="Profile preview" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" />
                <div className="space-y-1.5">
                  <button type="button" onClick={() => profileImageInputRef.current?.click()} className="px-3 py-1.5 rounded-lg accent-bg text-xs font-medium">Choose photo</button>
                  {settings.profileImage && <button type="button" onClick={() => onUpdateSettings({ profileImage: null })} className="block text-xs text-slate-500 hover:text-red-600">Remove photo</button>}
                  <input ref={profileImageInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { void handleProfileImage(event.target.files?.[0]); event.target.value = ''; }} />
                </div>
              </div>
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <label className="text-xs text-slate-500 dark:text-slate-400">Full name
                  <input value={settings.profileName || ''} onChange={(event) => onUpdateSettings({ profileName: event.target.value })} maxLength={80} placeholder="Your name" className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75 text-sm text-slate-900 dark:text-white" />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">Email
                  <input type="email" value={settings.profileEmail || ''} onChange={(event) => onUpdateSettings({ profileEmail: event.target.value })} maxLength={254} placeholder="you@example.com" className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75 text-sm text-slate-900 dark:text-white" />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">About me
                  <textarea value={settings.profileBio || ''} onChange={(event) => onUpdateSettings({ profileBio: event.target.value })} maxLength={240} rows={2} placeholder="A short introduction (optional)" className="mt-1.5 w-full resize-y px-3 py-2 rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75 text-sm text-slate-900 dark:text-white" />
                </label>
              </div>
            </div>
            {profileImageError && <p className="text-xs text-red-600" role="alert">{profileImageError}</p>}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Your profile details and photo are saved locally on this device.</p>
          </section>

          {/* Appearance */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Appearance, Glass Surface & Locale
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  List Density
                </label>
                <div className="inline-flex p-0.5 rounded-lg glass-panel">
                  {(['comfortable', 'compact'] as ViewDensity[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onUpdateSettings({ density: d })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize ${
                        settings.density === d
                          ? 'accent-bg'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  Glass Backdrop Preset
                </label>
                <select
                  value={settings.backgroundPreset}
                  onChange={(e) =>
                    onUpdateSettings({ backgroundPreset: e.target.value as BackgroundPreset })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                >
                  {BACKGROUNDS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  Interface Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) =>
                    onUpdateSettings({ language: e.target.value as LanguageCode })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                Accent Color
              </label>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onUpdateSettings({ accentColor: acc.id })}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      settings.accentColor === acc.id
                        ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: acc.hex }} />
                    <span>{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Goals & Timer */}
          <section className="pt-5 border-t border-slate-200/70 dark:border-white/10 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Goals, Timezone & Focus Timer
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Daily Goal
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.dailyGoal}
                  onChange={(e) =>
                    onUpdateSettings({ dailyGoal: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Weekly Goal
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={settings.weeklyGoal}
                  onChange={(e) =>
                    onUpdateSettings({ weeklyGoal: Math.max(1, Number(e.target.value) || 15) })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Monthly Goal
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={settings.monthlyGoal}
                  onChange={(e) =>
                    onUpdateSettings({ monthlyGoal: Math.max(1, Number(e.target.value) || 60) })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Pomodoro (m)
                </label>
                <input
                  type="number"
                  min={5}
                  max={90}
                  value={settings.pomodoroMinutes}
                  onChange={(e) =>
                    onUpdateSettings({
                      pomodoroMinutes: Math.max(5, Number(e.target.value) || 25),
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Short Break (m)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.shortBreakMinutes}
                  onChange={(e) =>
                    onUpdateSettings({
                      shortBreakMinutes: Math.max(1, Number(e.target.value) || 5),
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={settings.timezone}
                  onChange={(e) => onUpdateSettings({ timezone: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
              </div>
            </div>
          </section>

          {/* Notifications & Quiet Hours */}
          <section className="pt-5 border-t border-slate-200/70 dark:border-white/10 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Reminders, Audio & Quiet Hours
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRequestNotificationPermission}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>
                  {settings.notificationsEnabled
                    ? 'Reminders Active (Test)'
                    : 'Enable Browser Reminders'}
                </span>
              </button>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => {
                    onUpdateSettings({ soundEnabled: e.target.checked });
                    if (e.target.checked) playGentleChime(true);
                  }}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span>Play gentle chime</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.quietHoursEnabled}
                  onChange={(e) => onUpdateSettings({ quietHoursEnabled: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span>Quiet hours</span>
              </label>
            </div>

            {settings.quietHoursEnabled && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Silence reminders between</span>
                <input
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={(e) => onUpdateSettings({ quietHoursStart: e.target.value })}
                  className="px-2 py-1 font-mono rounded border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
                <span>and</span>
                <input
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => onUpdateSettings({ quietHoursEnd: e.target.value })}
                  className="px-2 py-1 font-mono rounded border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
              </div>
            )}
          </section>

          {/* Local App Lock PIN */}
          <section className="pt-5 border-t border-slate-200/70 dark:border-white/10 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Local Privacy PIN Lock</span>
            </h3>
            {settings.pinHash ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  PIN Lock is enabled (SHA-256 local verification).
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ pinHash: null });
                    onNotify('PIN lock removed.');
                  }}
                  className="px-3 py-1 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
                >
                  Remove PIN
                </button>
              </div>
            ) : (
              <form onSubmit={handleSetPin} className="flex gap-2">
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Set 4+ character local PIN..."
                  className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-white/15 bg-white/75 dark:bg-slate-900/75"
                />
                <button
                  type="submit"
                  disabled={newPin.trim().length < 4}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg accent-bg disabled:opacity-40"
                >
                  Enable PIN Lock
                </button>
              </form>
            )}
          </section>

          {/* Duplicate Detector */}
          {duplicates.length > 0 && (
            <section className="pt-5 border-t border-slate-200/70 dark:border-white/10 space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Merge className="w-3.5 h-3.5 text-amber-500" />
                <span>Duplicate Tasks Detected ({duplicates.length})</span>
              </h3>
              <div className="space-y-2">
                {duplicates.map((grp) => (
                  <div
                    key={grp.normalizedTitle}
                    className="p-3 rounded-xl glass-panel flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {grp.items[0].title}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {grp.items.length} matching tasks
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const [keep, ...rest] = grp.items;
                        onMergeDuplicates(
                          keep.id,
                          rest.map((r) => r.id)
                        );
                      }}
                      className="px-2.5 py-1 rounded-md accent-bg font-medium shrink-0"
                    >
                      Keep First & Trash Duplicates
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Local Backup, Encrypted Export & Multi-Format Import */}
          <section className="pt-5 border-t border-slate-200/70 dark:border-white/10 space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Local-First Storage, Encrypted Backups & Import/Export
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                All data lives offline in IndexedDB. Export plain or AES-GCM encrypted backups, CSV spreadsheets, or `.ics` calendars.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportWorkspaceJSON(fullBackup)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Backup JSON</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEncExport((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Encrypted Backup</span>
              </button>

              <button
                type="button"
                onClick={() => exportTasksCSV(tasks, projects)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => exportTasksICS(tasks)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .ics</span>
              </button>

              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg accent-bg"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore JSON</span>
              </button>

              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV</span>
              </button>

              <button
                type="button"
                onClick={() => icsInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import .ics</span>
              </button>

              <input
                ref={jsonInputRef}
                type="file"
                accept="application/json,.json,.todo-enc.json"
                onChange={handleJsonFileChange}
                className="hidden"
              />
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvChange}
                className="hidden"
              />
              <input
                ref={icsInputRef}
                type="file"
                accept=".ics,text/calendar"
                onChange={handleIcsChange}
                className="hidden"
              />
            </div>

            {showEncExport && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (exportPass.length < 4) return;
                  await exportEncryptedWorkspaceJSON(fullBackup, exportPass);
                  setExportPass('');
                  setShowEncExport(false);
                  onNotify('Encrypted backup downloaded.');
                }}
                className="flex gap-2 p-3 rounded-xl glass-panel text-xs"
              >
                <input
                  type="password"
                  value={exportPass}
                  onChange={(e) => setExportPass(e.target.value)}
                  placeholder="Encryption passphrase (min 4 chars)..."
                  className="flex-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
                />
                <button
                  type="submit"
                  disabled={exportPass.length < 4}
                  className="px-3 py-1.5 rounded accent-bg font-medium disabled:opacity-40"
                >
                  Download Encrypted
                </button>
              </form>
            )}

            {pendingEncryptedRaw && (
              <form
                onSubmit={handleDecryptRestore}
                className="flex gap-2 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-500/10 text-xs"
              >
                <input
                  type="password"
                  autoFocus
                  value={decryptPass}
                  onChange={(e) => setDecryptPass(e.target.value)}
                  placeholder="Enter passphrase to decrypt backup..."
                  className="flex-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-slate-900/70"
                />
                <button type="submit" className="px-3 py-1.5 rounded accent-bg font-medium">
                  Decrypt & Restore
                </button>
              </form>
            )}

            {importError && (
              <p className="text-xs text-red-600 dark:text-red-400">{importError}</p>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-5">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-600"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to sample data</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-amber-600 dark:text-amber-400">
                    Load starter sample workspace?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await onResetDemo();
                      setConfirmReset(false);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded bg-amber-600 text-white font-medium"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2 py-1 text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {!confirmWipe ? (
                <button
                  type="button"
                  onClick={() => setConfirmWipe(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe all local data</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-red-600 dark:text-red-400">
                    Erase everything permanently?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await onWipeAll();
                      setConfirmWipe(false);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded bg-red-600 text-white font-medium"
                  >
                    Wipe All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(false)}
                    className="px-2 py-1 text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-slate-200/70 dark:border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg accent-bg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
