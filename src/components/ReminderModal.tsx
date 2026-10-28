import React, { useState, useEffect } from 'react';
import { X, Bell, Clock, Calendar, Volume2, Trash2, Check, AlertCircle } from 'lucide-react';
import { Task, ReminderConfig, ReminderFrequency, NudgeTone } from '../types';

interface ReminderModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onSaveReminder: (taskId: string, config: {
    enabled: boolean;
    frequency: ReminderFrequency;
    reminder_time: string;
    nudge_tone: NudgeTone;
    notes?: string;
  }) => Promise<void>;
  onDeleteReminder: (taskId: string) => Promise<void>;
  onSimulateNudge: (task: Task, tone: NudgeTone, frequency: ReminderFrequency, timeStr: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  task,
  onClose,
  onSaveReminder,
  onDeleteReminder,
  onSimulateNudge,
}) => {
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<ReminderFrequency>('daily');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [nudgeTone, setNudgeTone] = useState<NudgeTone>('balanced');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && task) {
      setError('');
      setIsLoading(true);
      fetch(`/api/tasks/${task.id}/reminder`)
        .then((res) => res.json())
        .then((data) => {
          if (data.reminder) {
            setHasExisting(true);
            setEnabled(data.reminder.enabled);
            setFrequency(data.reminder.frequency || 'daily');
            setReminderTime(data.reminder.reminder_time || '09:00');
            setNudgeTone(data.reminder.nudge_tone || (task.priority === 'High' ? 'firm' : task.priority === 'Normal' ? 'balanced' : 'gentle'));
            setNotes(data.reminder.notes || '');
          } else {
            setHasExisting(false);
            setEnabled(true);
            setFrequency('daily');
            setReminderTime('09:00');
            // Auto default based on task priority
            setNudgeTone(task.priority === 'High' ? 'firm' : task.priority === 'Normal' ? 'balanced' : 'gentle');
            setNotes('');
          }
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');
      await onSaveReminder(task.id, {
        enabled,
        frequency,
        reminder_time: reminderTime,
        nudge_tone: nudgeTone,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save reminder.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError('');
      await onDeleteReminder(task.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to remove reminder.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
              <Bell className="w-3.5 h-3.5" />
              <span>Reminders & Nudges Configuration</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Enable / Disable switch */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
            <div>
              <p className="text-sm font-semibold text-slate-900">Enable Reminders</p>
              <p className="text-xs text-slate-500">
                Receive nudges without having to check the app manually.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className={`space-y-4 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            {/* Frequency Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Reminder Cadence
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFrequency('daily')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    frequency === 'daily'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <p className="text-sm">Daily Nudge</p>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Every day at scheduled time
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setFrequency('weekly')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    frequency === 'weekly'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <p className="text-sm">Weekly Check-in</p>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Once a week on this day
                  </p>
                </button>
              </div>
            </div>

            {/* Time of Day */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Reminder Time
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-900 font-mono tabular-nums"
              />
            </div>

            {/* Priority Nudge Tone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                Nudge Tone (Priority-Aware)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNudgeTone('gentle')}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    nudgeTone === 'gentle'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-semibold">Gentle</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Soft ping</p>
                </button>
                <button
                  type="button"
                  onClick={() => setNudgeTone('balanced')}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    nudgeTone === 'balanced'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-semibold">Balanced</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Standard</p>
                </button>
                <button
                  type="button"
                  onClick={() => setNudgeTone('firm')}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    nudgeTone === 'firm'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-semibold">Firm</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Urgent nudge</p>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {nudgeTone === 'firm'
                  ? 'Recommended for High Priority tasks: Sends prominent, direct reminders so critical responsibilities are not missed.'
                  : nudgeTone === 'balanced'
                  ? 'Standard daily or weekly reminder to keep momentum without irritation.'
                  : 'Gentle, low-pressure nudge for low priority or casual tasks.'}
              </p>
            </div>

            {/* Custom Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nudge Note (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Pay before meter cutoff / Grab invoices on the way"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-900"
              />
            </div>

            {/* Test Simulation Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onSimulateNudge(task, nudgeTone, frequency, reminderTime)}
                className="w-full py-2 px-3 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Simulate & Test Nudge Alert Now
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            {hasExisting ? (
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Reminder</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Save Reminder</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
