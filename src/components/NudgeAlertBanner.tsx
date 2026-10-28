import React, { useEffect } from 'react';
import { Bell, ShieldAlert, Check, X, Clock } from 'lucide-react';
import { Task, NudgeTone } from '../types';

interface NudgeAlertBannerProps {
  nudge: {
    task: Task;
    tone: NudgeTone;
    notes?: string;
  } | null;
  onDismiss: () => void;
  onMarkInProgress: (taskId: string) => void;
}

export const playNudgeSound = (tone: NudgeTone) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tone === 'firm') {
      // Stronger two-tone alert
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Gentle sine chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch (err) {
    // AudioContext might be blocked until user gesture, graceful silent fallback
  }
};

export const NudgeAlertBanner: React.FC<NudgeAlertBannerProps> = ({
  nudge,
  onDismiss,
  onMarkInProgress,
}) => {
  useEffect(() => {
    if (nudge) {
      playNudgeSound(nudge.tone);
    }
  }, [nudge]);

  if (!nudge) return null;

  const isFirm = nudge.tone === 'firm';

  return (
    <aside aria-label="Task Nudge Alert" className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in slide-in-from-top-4 duration-200">
      <div
        className={`p-4 rounded-xl shadow-xl border ${
          isFirm
            ? 'bg-rose-950 text-white border-rose-800'
            : 'bg-slate-900 text-white border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {isFirm ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Bell className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span
              className={`text-xs font-bold tracking-wide uppercase ${
                isFirm ? 'text-rose-300' : 'text-blue-300'
              }`}
            >
              {isFirm ? 'High Priority Nudge' : 'Task Reminder'}
            </span>
          </div>

          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2">
          <h4 className="text-sm font-semibold leading-tight text-white">
            {nudge.task.title}
          </h4>
          {nudge.notes ? (
            <p className="text-xs text-slate-300 mt-1 italic">
              "{nudge.notes}"
            </p>
          ) : (
            <p className="text-xs text-slate-300 mt-1">
              Time to take action on this task.
            </p>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
          <button
            onClick={onDismiss}
            className="px-2.5 py-1 text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1"
          >
            <Clock className="w-3 h-3" />
            Snooze 10m
          </button>

          <button
            onClick={() => {
              onMarkInProgress(nudge.task.id);
              onDismiss();
            }}
            className="px-3 py-1 text-xs font-semibold rounded bg-white text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Mark In Progress
          </button>
        </div>
      </div>
    </aside>
  );
};
