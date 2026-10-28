import React, { useState } from 'react';
import { Plus, CheckCircle2, Circle, Clock, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { MiniTask, TaskStatus } from '../types';

interface MiniTaskListProps {
  taskId: string;
  miniTasks: MiniTask[];
  onToggleStatus: (miniTask: MiniTask) => Promise<void>;
  onAddMiniTask: (taskId: string, title: string) => Promise<void>;
  onDeleteMiniTask: (miniId: string) => Promise<void>;
  onReorderMiniTasks: (taskId: string, orderIds: string[]) => Promise<void>;
}

export const MiniTaskList: React.FC<MiniTaskListProps> = ({
  taskId,
  miniTasks,
  onToggleStatus,
  onAddMiniTask,
  onDeleteMiniTask,
  onReorderMiniTasks,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setIsAdding(true);
      await onAddMiniTask(taskId, newTitle.trim());
      setNewTitle('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= miniTasks.length) return;

    const copy = [...miniTasks];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    await onReorderMiniTasks(taskId, copy.map((m) => m.id));
  };

  const completedCount = miniTasks.filter((m) => m.status === 'Completed').length;
  const progressPercent = miniTasks.length > 0 ? Math.round((completedCount / miniTasks.length) * 100) : 0;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {/* Progress header */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Sub-Tasks & Steps</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {completedCount} of {miniTasks.length} completed ({progressPercent}%)
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-slate-800 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step items */}
      <div className="space-y-1.5">
        {miniTasks.map((mini, idx) => {
          const isDone = mini.status === 'Completed';
          return (
            <div
              key={mini.id}
              className={`group flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors ${
                isDone
                  ? 'bg-slate-50/70 border-slate-150 text-slate-400'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onToggleStatus(mini)}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-800 transition-colors shrink-0"
                  title={isDone ? 'Mark In Progress' : 'Mark Completed'}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : mini.status === 'In Progress' ? (
                    <Clock className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                  )}
                </button>
                <span
                  className={`text-xs font-medium leading-relaxed truncate ${
                    isDone ? 'line-through text-slate-400' : 'text-slate-800'
                  }`}
                >
                  {mini.title}
                </span>
              </div>

              {/* Step actions: Reorder & Delete */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, 'up')}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors"
                  title="Move step up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={idx === miniTasks.length - 1}
                  onClick={() => handleMove(idx, 'down')}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors"
                  title="Move step down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMiniTask(mini.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                  title="Remove step"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add more mini-tasks later as work develops */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="+ Add another step as work develops..."
          className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={isAdding || !newTitle.trim()}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Step
        </button>
      </form>
    </div>
  );
};
