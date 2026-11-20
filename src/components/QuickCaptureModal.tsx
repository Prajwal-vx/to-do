import React, { useMemo, useState } from 'react';
import { Calendar, Clock, Flag, Folder, Plus, X, Zap } from 'lucide-react';
import { EnergyLevel, Priority, Project } from '../types/todo';
import { formatDuration, formatShortDate, getTodayStr } from '../utils/date';
import { parseQuickCapture } from '../utils/rulesEngine';

interface QuickCaptureModalProps {
  isOpen: boolean;
  projects: Project[];
  defaultProjectId: string | null;
  defaultDueDate: string | null;
  onClose: () => void;
  onCreateTask: (input: {
    title: string;
    priority: Priority;
    energy: EnergyLevel;
    estimatedMinutes: number;
    dueDate: string | null;
    projectId: string | null;
    tags: string[];
    pinTop3: boolean;
  }) => void;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  projects,
  defaultProjectId,
  defaultDueDate,
  onClose,
  onCreateTask,
}) => {
  const [rawText, setRawText] = useState('');
  const [manualDueDate, setManualDueDate] = useState<string | null>(defaultDueDate);
  const [manualPriority, setManualPriority] = useState<Priority | null>(null);
  const [manualEnergy, setManualEnergy] = useState<EnergyLevel | null>(null);
  const [manualProjectId, setManualProjectId] = useState<string | null>(defaultProjectId);
  const [manualDuration, setManualDuration] = useState<number | null>(null);
  const [pinTop3, setPinTop3] = useState(false);

  const parsed = useMemo(
    () => parseQuickCapture(rawText, projects, manualProjectId, manualDueDate),
    [rawText, projects, manualProjectId, manualDueDate]
  );

  if (!isOpen) return null;

  const finalPriority = manualPriority || parsed.priority;
  const finalEnergy = manualEnergy || parsed.energy;
  const finalDuration = manualDuration || parsed.estimatedMinutes;
  const finalProjectId = parsed.projectId;
  const finalDueDate = parsed.dueDate;

  const projectObj = projects.find((p) => p.id === finalProjectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    onCreateTask({
      title: parsed.title,
      priority: finalPriority,
      energy: finalEnergy,
      estimatedMinutes: finalDuration,
      dueDate: finalDueDate,
      projectId: finalProjectId,
      tags: parsed.tags,
      pinTop3,
    });
    setRawText('');
    setManualPriority(null);
    setManualEnergy(null);
    setManualDuration(null);
    setPinTop3(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-xl rounded-2xl glass-modal overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick Capture
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Capture"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <input
            type="text"
            autoFocus
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="e.g. Draft release notes @tomorrow !high ~30m ^high #Q4 @writing"
            className="w-full text-base font-medium bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />

          {/* Live Rule-Based Syntax Helper & Preview */}
          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Shortcuts:</span>
            <span className="font-mono">!urgent !high !low</span>
            <span className="font-mono">~15m ~1h</span>
            <span className="font-mono">^low ^high</span>
            <span className="font-mono">#project</span>
            <span className="font-mono">@today @tomorrow @nextweek @tag</span>
          </div>

          {/* Interactive Controls */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-white/15 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={finalDueDate || ''}
                onChange={(e) => setManualDueDate(e.target.value || null)}
                className="bg-transparent focus:outline-none text-xs"
              />
            </label>

            <button
              type="button"
              onClick={() => setManualDueDate(getTodayStr())}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10"
            >
              Today
            </button>

            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-white/15 bg-white/60 dark:bg-white/5">
              <Flag className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={finalPriority}
                onChange={(e) => setManualPriority(e.target.value as Priority)}
                className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-white/15 bg-white/60 dark:bg-white/5">
              <Zap className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={finalEnergy}
                onChange={(e) => setManualEnergy(e.target.value as EnergyLevel)}
                className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="low">Low energy</option>
                <option value="medium">Med energy</option>
                <option value="high">High energy</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-white/15 bg-white/60 dark:bg-white/5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={finalDuration}
                onChange={(e) => setManualDuration(Number(e.target.value))}
                className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none font-mono"
              >
                <option value={5}>5m</option>
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={45}>45m</option>
                <option value={60}>1h</option>
                <option value={120}>2h</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-white/15 bg-white/60 dark:bg-white/5">
              <Folder className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={finalProjectId || ''}
                onChange={(e) => setManualProjectId(e.target.value || null)}
                className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="">Inbox</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rawText.trim() && (
            <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              Will save: <span className="text-slate-900 dark:text-slate-100 font-medium">{parsed.title}</span>
              {' · '}
              <span>{projectObj ? projectObj.name : 'Inbox'}</span>
              {' · '}
              <span>{formatShortDate(finalDueDate)}</span>
              {' · '}
              <span>{formatDuration(finalDuration)}</span>
              {parsed.tags.length > 0 && ` · ${parsed.tags.map((t) => `@${t}`).join(' ')}`}
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-white/40 dark:bg-white/5 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={pinTop3}
              onChange={(e) => setPinTop3(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            <span>Pin to Focus 3</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!rawText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg accent-bg disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
