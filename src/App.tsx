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
import { apiFetch } from './lib/api';
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

  // Token refreshes create a new session object without changing the signed-in
  // user. Key data loading on the user id so refreshes do not wipe the screen
  // and refetch everything.
  const userId: string | null = session?.user?.id ?? null;

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

  // Fetch all tasks
  const fetchTasks = async () => {
    try {
      const res = await apiFetch('/api/tasks');
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  // Fetch active reminders list
  const fetchReminders = async () => {
    try {
      const res = await apiFetch('/api/reminders/active');
      const data = await res.json();
      if (data.success) {
        setActiveReminders(data.reminders);
      }
    } catch (err) {
      console.error('Error fetching reminders:', err);
    }
  };

  // Fetch mini-tasks for a specific task
  const loadMiniTasks = async (taskId: string) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      if (data.success && data.task?.mini_tasks) {
        setMiniTasksMap((prev) => ({
          ...prev,
          [taskId]: data.task.mini_tasks,
        }));
      }
    } catch (err) {
      console.error(`Error loading mini tasks for ${taskId}:`, err);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      await Promise.all([fetchTasks(), fetchReminders()]);
      setIsLoading(false);
    };
    init();
  }, [userId]);

  // Preload mini-tasks for tasks that have mini_tasks_total > 0
  useEffect(() => {
    tasks.forEach((t) => {
      if ((t.mini_tasks_total || 0) > 0 && !miniTasksMap[t.id]) {
        loadMiniTasks(t.id);
      }
    });
  }, [tasks]);

  // Task creation or update handler
  const handleSaveTask = async (taskData: {
    title: string;
    description?: string;
    priority: TaskPriority;
    status?: TaskStatus;
    due_date?: string;
  }) => {
    if (editingTask) {
      const res = await apiFetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update task');
    } else {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create task');
    }
    await Promise.all([fetchTasks(), fetchReminders()]);
    setEditingTask(null);
  };

  // Task deletion handler
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      await Promise.all([fetchTasks(), fetchReminders()]);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Update task status
  const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchTasks();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Mini-task toggle status
  const handleToggleMiniTaskStatus = async (miniTask: MiniTask) => {
    const nextStatus: TaskStatus =
      miniTask.status === 'Completed' ? 'In Progress' : 'Completed';
    try {
      const res = await apiFetch(`/api/mini-tasks/${miniTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        await loadMiniTasks(miniTask.task_id);
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error toggling mini-task:', err);
    }
  };

  // Mini-task add
  const handleAddMiniTask = async (taskId: string, title: string) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/mini-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (data.success) {
        await loadMiniTasks(taskId);
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error adding mini task:', err);
    }
  };

  // Mini-task delete
  const handleDeleteMiniTask = async (miniId: string) => {
    try {
      // Find parent taskId first
      let parentTaskId = '';
      for (const [taskId, list] of Object.entries(miniTasksMap)) {
        if (list.some((m) => m.id === miniId)) {
          parentTaskId = taskId;
          break;
        }
      }

      await apiFetch(`/api/mini-tasks/${miniId}`, { method: 'DELETE' });
      if (parentTaskId) {
        await loadMiniTasks(parentTaskId);
      }
      await fetchTasks();
    } catch (err) {
      console.error('Error deleting mini-task:', err);
    }
  };

  // Mini-tasks reorder
  const handleReorderMiniTasks = async (taskId: string, orderIds: string[]) => {
    try {
      await apiFetch(`/api/tasks/${taskId}/mini-tasks/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds }),
      });
      await loadMiniTasks(taskId);
    } catch (err) {
      console.error('Error reordering mini tasks:', err);
    }
  };

  // Approve AI breakdown proposal
  const handleApproveBreakdown = async (
    taskId: string,
    approvedItems: Array<{ title: string; estimatedMinutes?: number }>
  ) => {
    const res = await apiFetch(`/api/tasks/${taskId}/mini-tasks/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: approvedItems,
        replaceExisting: false,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save approved breakdown');
    }
    await loadMiniTasks(taskId);
    await fetchTasks();
  };

  // Reminder save
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
    const res = await apiFetch(`/api/tasks/${taskId}/reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save reminder');
    await Promise.all([fetchTasks(), fetchReminders()]);
  };

  // Reminder delete
  const handleDeleteReminder = async (taskId: string) => {
    await apiFetch(`/api/tasks/${taskId}/reminder`, { method: 'DELETE' });
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
            <span aria-hidden="true">·</span>
            <span>{inProgressCount} In Progress</span>
            <span aria-hidden="true">·</span>
            <span>{completedCount} Completed</span>
          </div>
        </div>

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
                await handleSaveReminder(rem.task_id, {
                  enabled: !current,
                  frequency: rem.frequency,
                  reminder_time: rem.reminder_time,
                  nudge_tone: rem.nudge_tone || 'balanced',
                  notes: rem.notes,
                });
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
          <p>© {new Date().getFullYear()} Personal AI Task Partner. Uncluttered, user-controlled productivity.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Tasks</span>
            <span>·</span>
            <span>Priority Nudges</span>
            <span>·</span>
            <span>On-Demand AI Breakdown</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
