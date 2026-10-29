import React from 'react';
import { Plus, Bell, Sparkles, CheckCircle2, LogOut } from 'lucide-react';

interface TaskNavbarProps {
  activeTab: 'all' | 'in_progress' | 'breakdowns' | 'reminders' | 'completed';
  setActiveTab: (tab: 'all' | 'in_progress' | 'breakdowns' | 'reminders' | 'completed') => void;
  onOpenCreate: () => void;
  activeReminderCount: number;
  totalTaskCount: number;
  onSignOut: () => void;
}

export const TaskNavbar: React.FC<TaskNavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreate,
  activeReminderCount,
  totalTaskCount,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
              TP
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('all');
              }}
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap"
            >
              TaskPartner
            </a>
          </div>

          {/* Zone 2: 4–5 clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'all'
                  ? 'text-slate-900 bg-slate-100 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Tasks ({totalTaskCount})
            </button>
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'in_progress'
                  ? 'text-slate-900 bg-slate-100 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setActiveTab('breakdowns')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'breakdowns'
                  ? 'text-slate-900 bg-slate-100 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              AI Breakdowns
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'reminders'
                  ? 'text-slate-900 bg-slate-100 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-blue-600" />
              Reminders & Nudges ({activeReminderCount})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'completed'
                  ? 'text-slate-900 bg-slate-100 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Completed
            </button>
          </nav>

          {/* Zone 3: 1 primary action + user profile */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={onOpenCreate}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>

            <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              <img
                src="/src/assets/images/user_avatar_1793187738176.jpg"
                alt="Personal profile"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
