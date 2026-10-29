import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Sparkles,
  Bell,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { Task, MiniTask, TaskPriority, TaskStatus, ReminderFrequency, NudgeTone } from './types';
import { TaskNavbar } from './components/TaskNavbar';
import { TaskItem } from './components/TaskItem';
import { TaskModal } from './components/TaskModal';
import { AIBreakdownModal } from './components/AIBreakdownModal';
import { ReminderModal } from './components/ReminderModal';
import { RemindersHub } from './components/RemindersHub';
import { NudgeAlertBanner } from './components/NudgeAlertBanner';
import { AuthPanel } from './components/AuthPanel';
import { apiJson } from './lib/api';
import { supabase } from './lib/supabase';

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [miniTasksMap, setMiniTasksMap] = useState<Record<string, MiniTask[]>>({});
  const [activeReminders, setActiveReminders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'All' | TaskPriority>('All');
  const [activeTab, setActiveTab] = useState<'all' | 'in_progress' | 'breakdowns' | 'reminders' | 'completed'>('all');

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  const [reminderTask, setReminderTask] = useState<Task | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  // Active Nudge Toast
  const [activeNudge, setActiveNudge] = useState<{
    task: Task;
    tone: NudgeTone;
    notes?: string;
  } | null>(null);

  // Identity of the signed-in user. Data loading is keyed on this id rather than on
  // the session object: Supabase hands out a new session object on every token
  // refresh and tab refocus, and reacting to that wiped the list and refetched.
  const userId: string | null = session?.user?.id ?? null;

  // Banner messages. Keyed so one successful request cannot clear another's error.
  type ErrorKey = 'tasks' | 'reminders' | 'action';
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const errorMessage = errors.tasks || errors.reminders || errors.action || null;

  const setError = (key: ErrorKey, message: string | null) =>
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });

  const reportError = (key: ErrorKey, err: unknown, fallback: string) => {
    console.error(fallback, err);
    setError(key, err instanceof Error && err.message ? err.message : fallback);
  };

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Fetch all tasks. The list endpoint already embeds each task's mini-tasks.
  const fetchTasks = async () => {
    try {
      const data = await apiJson('/api/tasks');
      const list: Task[] = data.tasks || [];
      setTasks(list);
      setMiniTasksMap(Object.fromEntries(list.map((t: any) => [t.id, (t.mini_tasks || []) as MiniTask[]])));
      setError('tasks', null);
    } catch (err) {
      reportError('tasks', err, 'Could not load your tasks.');
    }
  };

  // Fetch active reminders list
  const fetchReminders = async () => {
    try {
      const data = await apiJson('/api/reminders/active');
      setActiveReminders(data.reminders || []);
      setError('reminders', null);
    } catch (err) {
      reportError('reminders', err, 'Could not load your reminders.');
    }
  };

  // Re-fetch the mini-tasks of one task (used after reordering)
  const loadMiniTasks = async (taskId: string) => {
    try {
      const data = await apiJson(`/api/tasks/${taskId}`);
      if (data.task?.mini_tasks) {
        setMiniTasksMap((prev) => ({
          ...prev,
          [taskId]: data.task.mini_tasks,
        }));
      }
    } catch (err) {
      reportError('action', err, 'Could not load the steps for this task.');
    }
  };

  const retryLoad = async () => {
    setError('action', null);
    setIsLoading(true);
    await Promise.all([fetchTasks(), fetchReminders()]);
    setIsLoading(false);
  };

  // Initial load, and again only when a different user signs in.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!userId) {
        setTasks([]);
        setMiniTasksMap({});
        setActiveReminders([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      await Promise.all([fetchTasks(), fetchReminders()]);
      if (!cancelled) setIsLoading(false);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Runs a user action, then refreshes data. Failures show in the banner
  // instead of disappearing into the console.
  const runAction = async (
    action: () => Promise<unknown>,
    refresh: () => Promise<unknown>,
    fallback: string
  ) => {
    try {
      await action();
      setError('action', null);
    } catch (err) {
      reportError('action', err, fallback);
      return;
    }
    await refresh();
  };

  // Task creation or update handler (errors are shown by the modal)
  const handleSaveTask = async (taskData: {
    title: string;
    description?: string;
    priority: TaskPriority;
    status?: TaskStatus;
    due_date?: string;
  }) => {
    if (editingTask) {
      await apiJson(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        body: JSON.stringify(taskData),
      });
    } else {
      await apiJson('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
    }
    await Promise.all([fetchTasks(), fetchReminders()]);
    setEditingTask(null);
  };

  // Task deletion handler
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    await runAction(
      () => apiJson(`/api/tasks/${taskId}`, { method: 'DELETE' }),
      () => Promise.all([fetchTasks(), fetchReminders()]),
      'Could not delete the task.'
    );
  };

  // Update task status
  const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
    await runAction(
      () =>
        apiJson(`/api/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        }),
      fetchTasks,
      'Could not update the task status.'
    );
  };

  // Mini-task toggle status
  const handleToggleMiniTaskStatus = async (miniTask: MiniTask) => {
    const nextStatus: TaskStatus =
      miniTask.status === 'Completed' ? 'In Progress' : 'Completed';
    await runAction(
      () =>
        apiJson(`/api/mini-tasks/${miniTask.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: nextStatus }),
        }),
      fetchTasks,
      'Could not update the step.'
    );
  };

  // Mini-task add
  const handleAddMiniTask = async (taskId: string, title: string) => {
    await runAction(
      () =>
        apiJson(`/api/tasks/${taskId}/mini-tasks`, {
          method: 'POST',
          body: JSON.stringify({ title }),
        }),
      fetchTasks,
      'Could not add the step.'
    );
  };

  // Mini-task delete
  const handleDeleteMiniTask = async (miniId: string) => {
    await runAction(
      () => apiJson(`/api/mini-tasks/${miniId}`, { method: 'DELETE' }),
      fetchTasks,
      'Could not delete the step.'
    );
  };

  // Mini-tasks reorder
  const handleReorderMiniTasks = async (taskId: string, orderIds: string[]) => {
    await runAction(
      () =>
        apiJson(`/api/tasks/${taskId}/mini-tasks/reorder`, {
          method: 'POST',
          body: JSON.stringify({ orderIds }),
        }),
      () => loadMiniTasks(taskId),
      'Could not save the new step order.'
    );
  };

  // Approve AI breakdown proposal (errors are shown by the modal)
  const handleApproveBreakdown = async (
    taskId: string,
    approvedItems: Array<{ title: string; estimatedMinutes?: number }>
  ) => {
    await apiJson(`/api/tasks/${taskId}/mini-tasks/batch`, {
      method: 'POST',
      body: JSON.stringify({
        items: approvedItems,
        replaceExisting: false,
      }),
    });
    await fetchTasks();
  };

  // Reminder save (errors are shown by the modal)
  const handleSaveReminder = async (
    taskId: string,
    config: {
      enabled: boolean;
      frequency: ReminderFrequency;
      reminder_time: string;
      nudge_tone: NudgeTone;
      notes?: string;
    }
  ) => {
    await apiJson(`/api/tasks/${taskId}/reminder`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
    await Promise.all([fetchTasks(), fetchReminders()]);
  };

  // Reminder delete
  const handleDeleteReminder = async (taskId: string) => {
    await apiJson(`/api/tasks/${taskId}/reminder`, { method: 'DELETE' });
    await Promise.all([fetchTasks(), fetchReminders()]);
  };

  // Simulate Nudge Trigger
  const handleSimulateNudge = (
    task: Task,
    tone: NudgeTone,
    frequency: ReminderFrequency,
    timeStr: string
  ) => {
    setActiveNudge({
      task,
      tone,
      notes: `${frequency.toUpperCase()} alert scheduled for ${timeStr}. Time to act on this item.`,
    });
  };

  // Filter tasks based on search, tab, and priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Priority Filter
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) {
        return false;
      }

      // Tab Filter
      if (activeTab === 'in_progress') return t.status === 'In Progress';
      if (activeTab === 'breakdowns') return (t.mini_tasks_total || 0) > 0;
      if (activeTab === 'completed') return t.status === 'Completed';
      // 'all' tab shows all
      return true;
    });
  }, [tasks, searchQuery, priorityFilter, activeTab]);

  const outstandingTasksCount = tasks.filter((t) => t.status !== 'Completed').length;
  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length;
  const completedCount = tasks.filter((t) => t.status === 'Completed').length;

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading your secure workspace...</div>;
  if (!session) return <AuthPanel />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Contract (3 zones) */}
      <TaskNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCreate={() => {
          setEditingTask(null);
          setIsTaskModalOpen(true);
        }}
        activeReminderCount={activeReminders.length}
        totalTaskCount={tasks.length}
        onSignOut={() => {
          void supabase?.auth.signOut();
        }}
      />

      {/* Live Nudge Alert Toast */}
      <NudgeAlertBanner
        nudge={activeNudge}
        onDismiss={() => setActiveNudge(null)}
        onMarkInProgress={(id) => handleUpdateTaskStatus(id, 'In Progress')}
      />

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Core Philosophy Header */}
        <div className="mb-6 pb-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Personal Task Partner
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
              Record any task. Remind me when I need it. Break it down only when I ask.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
            <span>{outstandingTasksCount} Outstanding</span>
            <span aria-hidden="true">Â·</span>
            <span>{inProgressCount} In Progress</span>
            <span aria-hidden="true">Â·</span>
            <span>{completedCount} Completed</span>
          </div>
        </div>

        {/* Load / action errors */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row sm:items-start justify-between gap-3"
          >
            <span className="break-words">{errorMessage}</span>
            <div className="flex items-center gap-4 shrink-0">
              <button type="button" onClick={retryLoad} className="font-semibold underline">
                Retry
              </button>
              <button
                type="button"
                onClick={() => supabase?.auth.signOut()}
                className="font-semibold underline"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Tab View Switcher */}
        {activeTab === 'reminders' ? (
          <RemindersHub
            reminders={activeReminders}
            tasks={tasks}
            onOpenReminderConfig={(task) => {
              setReminderTask(task);
              setIsReminderModalOpen(true);
            }}
            onSimulateNudge={handleSimulateNudge}
            onToggleReminderActive={async (remId, current) => {
              const rem = activeReminders.find((r) => r.id === remId);
              if (rem) {
                try {
                  await handleSaveReminder(rem.task_id, {
                    enabled: !current,
                    frequency: rem.frequency,
                    reminder_time: rem.reminder_time,
                    nudge_tone: rem.nudge_tone || 'balanced',
                    notes: rem.notes,
                  });
                  setError('action', null);
                } catch (err) {
                  reportError('action', err, 'Could not update the reminder.');
                }
              }
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* Search & Filter Strip */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks, notes, or descriptions..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Priority Filter segmented control */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
                {(['All', 'High', 'Normal', 'Low'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setPriorityFilter(lvl)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      priorityFilter === lvl
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl === 'All' ? 'All Priorities' : `${lvl} Priority`}
                  </button>
                ))}
              </div>
            </div>

            {/* Task List */}
            {isLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-800 animate-spin">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">Loading your tasks...</p>
              </div>
            ) : filteredTasks.length === 0 && errors.tasks && tasks.length === 0 ? (
              // The list failed to load: the banner above explains why, so don't
              // claim the user has no tasks.
              null
            ) : filteredTasks.length === 0 ? (
              <div className="py-16 text-center rounded-xl border border-dashed border-slate-200 bg-white space-y-3">
                <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">
                  {searchQuery || priorityFilter !== 'All'
                    ? 'No matching tasks found'
                    : 'No tasks in this view'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery || priorityFilter !== 'All'
                    ? 'Try adjusting your search query or priority filters.'
                    : 'Record a new task to get started.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setIsTaskModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Task</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    miniTasks={miniTasksMap[task.id] || []}
                    onOpenBreakdown={(t) => {
                      setBreakdownTask(t);
                      setIsBreakdownModalOpen(true);
                    }}
                    onOpenReminder={(t) => {
                      setReminderTask(t);
                      setIsReminderModalOpen(true);
                    }}
                    onEditTask={(t) => {
                      setEditingTask(t);
                      setIsTaskModalOpen(true);
                    }}
                    onDeleteTask={handleDeleteTask}
                    onUpdateStatus={handleUpdateTaskStatus}
                    onToggleMiniTaskStatus={handleToggleMiniTaskStatus}
                    onAddMiniTask={handleAddMiniTask}
                    onDeleteMiniTask={handleDeleteMiniTask}
                    onReorderMiniTasks={handleReorderMiniTasks}
                    onLoadMiniTasks={loadMiniTasks}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Task Creation & Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
      />

      {/* AI Breakdown Proposal Review Modal */}
      <AIBreakdownModal
        isOpen={isBreakdownModalOpen}
        task={breakdownTask}
        onClose={() => {
          setIsBreakdownModalOpen(false);
          setBreakdownTask(null);
        }}
        onApprove={handleApproveBreakdown}
      />

      {/* Reminder & Nudging Configuration Modal */}
      <ReminderModal
        isOpen={isReminderModalOpen}
        task={reminderTask}
        onClose={() => {
          setIsReminderModalOpen(false);
          setReminderTask(null);
        }}
        onSaveReminder={handleSaveReminder}
        onDeleteReminder={handleDeleteReminder}
        onSimulateNudge={handleSimulateNudge}
      />

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-slate-200 py-6 bg-white text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>Â© {new Date().getFullYear()} Personal AI Task Partner. Uncluttered, user-controlled productivity.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Tasks</span>
            <span>Â·</span>
            <span>Priority Nudges</span>
            <span>Â·</span>
            <span>On-Demand AI Breakdown</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

