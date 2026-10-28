import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowUp, ArrowDown, Trash2, Plus, Check, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { Task } from '../types';

interface ProposedItem {
  id: string;
  title: string;
  estimatedMinutes?: number;
  tips?: string;
}

interface AIBreakdownModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onApprove: (taskId: string, approvedItems: Array<{ title: string; estimatedMinutes?: number }>) => Promise<void>;
}

export const AIBreakdownModal: React.FC<AIBreakdownModalProps> = ({
  isOpen,
  task,
  onClose,
  onApprove,
}) => {
  const [items, setItems] = useState<ProposedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState('');
  const [newStepText, setNewStepText] = useState('');

  const fetchBreakdown = async () => {
    if (!task) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate breakdown suggestions.');
      }
      setItems(data.items || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to connect to AI assistant.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && task) {
      fetchBreakdown();
    } else {
      setItems([]);
      setError('');
      setNewStepText('');
    }
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const handleUpdateTitle = (id: string, newTitle: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleAddManualStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepText.trim()) return;
    const newItem: ProposedItem = {
      id: `manual-${Date.now()}`,
      title: newStepText.trim(),
      estimatedMinutes: 20,
    };
    setItems((prev) => [...prev, newItem]);
    setNewStepText('');
  };

  const handleApproveProposal = async () => {
    if (items.length === 0) {
      setError('Please keep or add at least one mini-task before saving.');
      return;
    }
    const emptyItem = items.find((i) => !i.title.trim());
    if (emptyItem) {
      setError('Please provide a title for all mini-tasks or delete empty ones.');
      return;
    }

    try {
      setIsApproving(true);
      setError('');
      await onApprove(
        task.id,
        items.map((i) => ({ title: i.title.trim(), estimatedMinutes: i.estimatedMinutes }))
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve and save mini-tasks.');
    } finally {
      setIsApproving(false);
    }
  };

  const totalMinutes = items.reduce((acc, curr) => acc + (curr.estimatedMinutes || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Task Breakdown Review</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 font-normal">Pending Approval</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {task.title}
            </h2>
            {task.description && (
              <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{task.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="px-6 py-2.5 bg-amber-50/70 border-b border-amber-100/80 text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              This is a proposed plan. Edit, reorder, or delete steps below before approving.
            </span>
          </div>
          {totalMinutes > 0 && (
            <div className="flex items-center gap-1 font-mono tabular-nums text-amber-800 font-medium shrink-0">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>~{totalMinutes} mins total</span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="py-14 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-800 animate-spin">
                <RefreshCw className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                Analyzing task and generating practical steps...
              </p>
              <p className="text-xs text-slate-400">
                Breaking down into actionable, sequential mini-tasks.
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-slate-600">No suggestions generated yet.</p>
              <button
                onClick={fetchBreakdown}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Generating Again
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>Proposed Steps ({items.length})</span>
                <button
                  onClick={fetchBreakdown}
                  className="hover:text-slate-900 transition-colors inline-flex items-center gap-1"
                  title="Generate alternative suggestions"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
              </div>

              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="group flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs"
                >
                  {/* Step Number */}
                  <span className="font-mono text-xs font-semibold text-slate-400 mt-2 shrink-0 w-5 text-right">
                    {index + 1}.
                  </span>

                  {/* Editable Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleUpdateTitle(item.id, e.target.value)}
                      placeholder="Step description..."
                      className="w-full text-sm font-medium text-slate-900 bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none py-1"
                    />
                    {item.tips && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">
                        Tip: {item.tips}
                      </p>
                    )}
                  </div>

                  {/* Estimated Time */}
                  {item.estimatedMinutes ? (
                    <span className="font-mono text-xs text-slate-500 mt-1.5 shrink-0 tabular-nums">
                      {item.estimatedMinutes}m
                    </span>
                  ) : null}

                  {/* Reordering & Action Controls */}
                  <div className="flex items-center gap-0.5 mt-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => handleMoveDown(index)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                      title="Remove step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Add Custom Step to Proposal */}
          {!isLoading && (
            <form onSubmit={handleAddManualStep} className="pt-2 flex items-center gap-2">
              <input
                type="text"
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                placeholder="+ Add an extra step to this plan..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!newStepText.trim()}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Step
              </button>
            </form>
          )}
        </div>

        {/* Footer with Approve Action */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Discard Proposal
          </button>

          <button
            type="button"
            disabled={isLoading || isApproving || items.length === 0}
            onClick={handleApproveProposal}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{isApproving ? 'Saving...' : 'Approve & Save Mini-Tasks'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
