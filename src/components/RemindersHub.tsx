import React from 'react';
import { Bell, Clock, Calendar, Volume2, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Task, ReminderFrequency, NudgeTone } from '../types';

interface ActiveReminderItem {
  id: string;
  task_id: string;
  user_id: string;
  enabled: boolean;
  frequency: ReminderFrequency;
  reminder_time: string;
  next_reminder_at: string;
  nudge_tone?: NudgeTone;
  notes?: string;
  task_title: string;
  task_priority: 'Low' | 'Normal' | 'High';
  task_status: string;
  due_date?: string;
}

interface RemindersHubProps {
  reminders: ActiveReminderItem[];
  tasks: Task[];
  onOpenReminderConfig: (task: Task) => void;
  onSimulateNudge: (task: Task, tone: NudgeTone, frequency: ReminderFrequency, timeStr: string) => void;
  onToggleReminderActive: (reminderId: string, currentEnabled: boolean) => Promise<void>;
}

export const RemindersHub: React.FC<RemindersHubProps> = ({
  reminders,
  tasks,
  onOpenReminderConfig,
  onSimulateNudge,
  onToggleReminderActive,
}) => {
  const tasksWithoutReminders = tasks.filter(
    (t) => t.status !== 'Completed' && !reminders.some((r) => r.task_id === t.id && r.enabled)
  );

  return (
    <div className="space-y-6">
      {/* Module Overview Banner */}
      <div className="p-5 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
            <Bell className="w-3.5 h-3.5" />
            <span>Reminders & Priority Nudging Engine</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            Gentle prompt, firm accountability when it matters
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Configure cadence and nudge firmness independently from task creation. High priority tasks trigger firmer alerts, keeping you accountable without flooding your day.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold font-mono tabular-nums text-blue-900">
              {reminders.filter((r) => r.enabled).length}
            </p>
            <p className="text-[11px] text-blue-700 font-medium">Active Nudges</p>
          </div>
        </div>
      </div>

      {/* Active Scheduled Reminders */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center justify-between">
          <span>Scheduled Nudges ({reminders.length})</span>
          <span className="text-xs font-normal text-slate-500">Sorted by next alert</span>
        </h3>

        {reminders.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 bg-white">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No active reminders configured yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You can record tasks freely without reminders. When you want a nudge, configure one below.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {reminders.map((rem) => {
              const matchedTask = tasks.find((t) => t.id === rem.task_id);
              const tone = rem.nudge_tone || (rem.task_priority === 'High' ? 'firm' : 'balanced');
              const nextTime = new Date(rem.next_reminder_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const nextDate = new Date(rem.next_reminder_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={rem.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {rem.task_title}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span
                        className={`text-xs ${
                          rem.task_priority === 'High'
                            ? 'text-rose-700 font-semibold'
                            : 'text-slate-600'
                        }`}
                      >
                        {rem.task_priority} Priority
                      </span>
                    </div>

                    {rem.notes && (
                      <p className="text-xs text-slate-600 mt-1 italic">
                        "{rem.notes}"
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Next: {nextDate} at {nextTime}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{rem.frequency}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1 capitalize">
                        {tone === 'firm' ? (
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                        ) : (
                          <Volume2 className="w-3 h-3 text-blue-600" />
                        )}
                        {tone} Tone
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {matchedTask && (
                      <button
                        type="button"
                        onClick={() =>
                          onSimulateNudge(matchedTask, tone, rem.frequency, rem.reminder_time)
                        }
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                        title="Simulate how this alert feels"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Test Nudge</span>
                      </button>
                    )}

                    {matchedTask && (
                      <button
                        type="button"
                        onClick={() => onOpenReminderConfig(matchedTask)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unconfigured Tasks Section */}
      {tasksWithoutReminders.length > 0 && (
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Tasks without Reminders ({tasksWithoutReminders.length})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Add a reminder only when you need proactive assistance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {tasksWithoutReminders.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{task.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {task.priority} Priority · {task.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenReminderConfig(task)}
                  className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1 shrink-0"
                >
                  <Bell className="w-3 h-3" />
                  <span>Set Nudge</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
