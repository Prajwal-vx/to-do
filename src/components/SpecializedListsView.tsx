import React, { useState } from 'react';
import { BookOpen, Check, GraduationCap, Layers, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import {
  ExamItem,
  GroceryItem,
  ReadingItem,
  TaskTemplate,
} from '../types/todo';
import { diffDays, formatDuration, getTodayStr } from '../utils/date';

interface SpecializedListsViewProps {
  templates: TaskTemplate[];
  groceries: GroceryItem[];
  readings: ReadingItem[];
  exams: ExamItem[];
  onUseTemplate: (tpl: TaskTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onAddGrocery: (name: string, quantity: string, category: GroceryItem['category']) => void;
  onToggleGrocery: (id: string) => void;
  onDeleteGrocery: (id: string) => void;
  onAddReading: (title: string, author: string, totalPages: number) => void;
  onUpdateReading: (item: ReadingItem) => void;
  onDeleteReading: (id: string) => void;
  onAddExam: (course: string, title: string, dueDate: string, weightPct: number) => void;
  onUpdateExam: (item: ExamItem) => void;
  onDeleteExam: (id: string) => void;
}

type TabKey = 'templates' | 'grocery' | 'reading' | 'exams';

const GROCERY_CATEGORIES: GroceryItem['category'][] = [
  'Produce',
  'Dairy & Eggs',
  'Pantry',
  'Bakery',
  'Household',
  'Other',
];

export const SpecializedListsView: React.FC<SpecializedListsViewProps> = ({
  templates,
  groceries,
  readings,
  exams,
  onUseTemplate,
  onDeleteTemplate,
  onAddGrocery,
  onToggleGrocery,
  onDeleteGrocery,
  onAddReading,
  onUpdateReading,
  onDeleteReading,
  onAddExam,
  onUpdateExam,
  onDeleteExam,
}) => {
  const today = getTodayStr();
  const [tab, setTab] = useState<TabKey>('templates');

  // Grocery form
  const [gName, setGName] = useState('');
  const [gQty, setGQty] = useState('1');
  const [gCat, setGCat] = useState<GroceryItem['category']>('Produce');

  // Reading form
  const [rTitle, setRTitle] = useState('');
  const [rAuthor, setRAuthor] = useState('');
  const [rPages, setRPages] = useState(250);

  // Exam form
  const [eCourse, setECourse] = useState('');
  const [eTitle, setETitle] = useState('');
  const [eDue, setEDue] = useState(today);
  const [eWeight, setEWeight] = useState(20);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-0.5 rounded-lg glass-panel">
          {(
            [
              ['templates', 'Templates & Routines', Layers],
              ['grocery', 'Grocery & Shopping', ShoppingCart],
              ['reading', 'Reading List', BookOpen],
              ['exams', 'Assignments & Exams', GraduationCap],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === key
                  ? 'bg-white/90 dark:bg-white/15 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Templates */}
      {tab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl glass-panel p-4 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-400 capitalize">
                      {tpl.category} · {formatDuration(tpl.estimatedMinutes)} · {tpl.priority}
                    </div>
                    <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                      {tpl.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(tpl.id)}
                    aria-label={`Delete template ${tpl.name}`}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tpl.description}</p>
                {tpl.subtasks.length > 0 && (
                  <ul className="space-y-1 pt-1 text-xs text-slate-600 dark:text-slate-300">
                    {tpl.subtasks.map((s, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="text-slate-400">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={() => onUseTemplate(tpl)}
                className="w-full py-2 text-xs font-medium rounded-lg accent-bg"
              >
                Create Task from Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Grocery List */}
      {tab === 'grocery' && (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!gName.trim()) return;
              onAddGrocery(gName.trim(), gQty.trim() || '1', gCat);
              setGName('');
            }}
            className="p-4 rounded-xl glass-panel grid grid-cols-1 sm:grid-cols-6 gap-2.5"
          >
            <input
              type="text"
              value={gName}
              onChange={(e) => setGName(e.target.value)}
              placeholder="Item name (e.g. Oats, Avocados)..."
              className="sm:col-span-3 px-3 py-1.5 text-xs rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={gQty}
              onChange={(e) => setGQty(e.target.value)}
              placeholder="Qty"
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <select
              value={gCat}
              onChange={(e) => setGCat(e.target.value as GroceryItem['category'])}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-800 dark:text-slate-100"
            >
              {GROCERY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-lg accent-bg inline-flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GROCERY_CATEGORIES.map((cat) => {
              const items = groceries.filter((g) => g.category === cat);
              if (items.length === 0) return null;
              return (
                <div
                  key={cat}
                  className="rounded-xl glass-panel p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h3 className="font-display text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {cat}
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      {items.filter((i) => i.checked).length}/{items.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => onToggleGrocery(item.id)}
                          className="flex items-center gap-2 text-left flex-1 min-w-0"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              item.checked
                                ? 'accent-bg border-transparent'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {item.checked && <Check className="w-3 h-3" />}
                          </span>
                          <span
                            className={`truncate ${
                              item.checked
                                ? 'line-through text-slate-400'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {item.name}
                          </span>
                        </button>
                        <span className="text-slate-400 font-mono shrink-0">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteGrocery(item.id)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reading List */}
      {tab === 'reading' && (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!rTitle.trim()) return;
              onAddReading(rTitle.trim(), rAuthor.trim() || 'Unknown', Math.max(1, rPages));
              setRTitle('');
              setRAuthor('');
            }}
            className="p-4 rounded-xl glass-panel grid grid-cols-1 sm:grid-cols-6 gap-2.5"
          >
            <input
              type="text"
              value={rTitle}
              onChange={(e) => setRTitle(e.target.value)}
              placeholder="Book or article title..."
              className="sm:col-span-2 px-3 py-1.5 text-xs rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={rAuthor}
              onChange={(e) => setRAuthor(e.target.value)}
              placeholder="Author"
              className="sm:col-span-2 px-3 py-1.5 text-xs rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <input
              type="number"
              min={1}
              value={rPages}
              onChange={(e) => setRPages(Number(e.target.value) || 100)}
              placeholder="Pages"
              className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-lg accent-bg">
              Add Book
            </button>
          </form>

          <div className="space-y-3">
            {readings.map((book) => {
              const pct = Math.min(100, Math.round((book.currentPage / Math.max(1, book.totalPages)) * 100));
              return (
                <div
                  key={book.id}
                  className="p-4 rounded-xl glass-panel space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                        {book.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {book.author} · {book.currentPage}/{book.totalPages} pages ({pct}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={book.status}
                        onChange={(e) =>
                          onUpdateReading({
                            ...book,
                            status: e.target.value as ReadingItem['status'],
                          })
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      >
                        <option value="to_read">To Read</option>
                        <option value="reading">Reading</option>
                        <option value="finished">Finished</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => onDeleteReading(book.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={book.totalPages}
                    value={book.currentPage}
                    onChange={(e) => {
                      const pages = Number(e.target.value);
                      onUpdateReading({
                        ...book,
                        currentPage: pages,
                        status: pages >= book.totalPages ? 'finished' : pages > 0 ? 'reading' : 'to_read',
                      });
                    }}
                    className="w-full accent-indigo-600"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assignments & Exam Tracker */}
      {tab === 'exams' && (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!eTitle.trim()) return;
              onAddExam(eCourse.trim() || 'General', eTitle.trim(), eDue, eWeight);
              setETitle('');
            }}
            className="p-4 rounded-xl glass-panel grid grid-cols-1 sm:grid-cols-6 gap-2.5"
          >
            <input
              type="text"
              value={eCourse}
              onChange={(e) => setECourse(e.target.value)}
              placeholder="Course (e.g. CS 402)"
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
              placeholder="Assignment or Exam title..."
              className="sm:col-span-2 px-3 py-1.5 text-xs rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <input
              type="date"
              value={eDue}
              onChange={(e) => setEDue(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={eWeight}
              onChange={(e) => setEWeight(Number(e.target.value) || 10)}
              placeholder="Weight %"
              className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-900 dark:text-white"
            />
            <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-lg accent-bg">
              Track
            </button>
          </form>

          <div className="space-y-3">
            {exams.map((ex) => {
              const daysLeft = diffDays(today, ex.dueDate);
              return (
                <div
                  key={ex.id}
                  className="p-4 rounded-xl glass-panel space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => onUpdateExam({ ...ex, completed: !ex.completed, progressPct: !ex.completed ? 100 : ex.progressPct })}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          ex.completed ? 'accent-bg border-transparent' : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {ex.completed && <Check className="w-3 h-3" />}
                      </button>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {ex.course} · Weight {ex.weightPct}% · Due {ex.dueDate}
                        </div>
                        <h3 className={`font-display text-sm font-semibold ${ex.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {ex.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          daysLeft < 0
                            ? 'text-red-600 dark:text-red-400'
                            : daysLeft <= 3
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d past` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteExam(ex.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pl-6">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={ex.progressPct}
                      onChange={(e) => onUpdateExam({ ...ex, progressPct: Number(e.target.value) })}
                      className="flex-1 accent-indigo-600"
                    />
                    <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 w-10 text-right">
                      {ex.progressPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
