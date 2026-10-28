import React, { useState } from 'react';
import {
  Sparkles,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Circle,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Task, MiniTask, TaskPriority, TaskStatus } from '../types';
import { MiniTaskList } from './MiniTaskList';

interface TaskItemProps {
  task: Task;
  onOpenBreakdown: (task: Task) => void;
  onOpenReminder: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  onToggleMiniTaskStatus: (miniTask: MiniTask) => Promise<void>;
  onAddMiniTask: (taskId: string, title: string) => Promise<void>;
  onDeleteMiniTask: (miniId: string) => Promise<void>;
  onReorderMiniTasks: (taskId: string, orderIds: string[]) => Promise<void>;
  // For tasks where detailed mini-tasks are loaded
  miniTasks?: MiniTask[];
  onLoadMiniTasks?: (taskId: string) => Promise<void>;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onOpenBreakdown,
  onOpenReminder,
  onEditTask,
  onDeleteTask,
  onUpdateStatus,
  onToggleMiniTaskStatus,
  onAddMiniTask,
  onDeleteMiniTask,
  onReorderMiniTasks,
  miniTasks = [],
  onLoadMiniTasks,
}) => {
  const [isExpanded, setIsExpanded] = useState(
    (task.mini_tasks_total || 0) > 0 || task.status === 'In Progress'
  );
  const [showMenu, setShowMenu] = useState(false);

  const handleToggleExpand = async () => {
    if (!isExpanded && onLoadMiniTasks && miniTasks.length === 0 && (task.mini_tasks_total || 0) > 0) {
      await onLoadMiniTasks(task.id);
    }
    setIsExpanded(!isExpanded);
  };

  const handleCycleStatus = () => {
    const nextStatusMap: Record<TaskStatus, TaskStatus> = {
      'Not Started': 'In Progress',
      'In Progress': 'Completed',
      'Completed': 'Not Started',
    };
    onUpdateStatus(task.id, nextStatusMap[task.status]);
  };

  const priorityColor = {
    High: 'text-rose-700 font-semibold',
    Normal: 'text-slate-700',
    Low: 'text-slate-500',
  }[task.priority];

  const statusIcon = {
    'Completed': <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    'In Progress': <Clock className="w-5 h-5 text-amber-600" />,
    'Not Started': <Circle className="w-5 h-5 text-slate-300 hover:text-slate-400" />,
  }[task.status];

  return (
    <div
      className={`rounded-xl border transition-all ${
        task.status === 'Completed'
          ? 'bg-slate-50/70 border-slate-200/80 text-slate-600'
          : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Status Checkbox & Title */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleCycleStatus}
              className="mt-0.5 p-0.5 rounded transition-transform active:scale-90 shrink-0"
              title={`Status: ${task.status}. Click to cycle.`}
            >
              {statusIcon}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={`text-sm sm:text-base font-semibold text-slate-900 leading-snug cursor-pointer ${
                    task.status === 'Completed' ? 'line-through text-slate-400' : ''
                  }`}
                  onClick={handleToggleExpand}
                >
                  {task.title}
                </h3>
              </div>

              {task.description && (
                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Zero-Pill Unboxed Metadata with · separator */}
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 flex-wrap">
                <span className={priorityColor}>{task.priority} Priority</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{task.status}</span>

                {task.due_date && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 font-mono tabular-nums">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Due {task.due_date}
                    </span>
                  </>
                )}

                {(task.mini_tasks_total || 0) > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={handleToggleExpand}
                      className="hover:text-slate-900 font-mono tabular-nums underline decoration-slate-300 underline-offset-2"
                    >
                      {task.mini_tasks_completed || 0}/{task.mini_tasks_total} Steps
                    </button>
                  </>
                )}

                {task.has_reminder && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => onOpenReminder(task)}
                      className="hover:text-blue-700 font-mono tabular-nums text-blue-600 flex items-center gap-1"
                    >
                      <Bell className="w-3 h-3" />
                      {task.reminder_summary || 'Reminder set'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Optional AI Breakdown Trigger */}
            <button
              type="button"
              onClick={() => onOpenBreakdown(task)}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap active:scale-95"
              title="Break down this specific task with AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Break Down</span>
            </button>

            {/* Separate Reminder Config Trigger */}
            <button
              type="button"
              onClick={() => onOpenReminder(task)}
              className={`p-1.5 rounded-md transition-colors ${
                task.has_reminder
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={task.has_reminder ? 'Configure active reminder' : 'Set reminder or nudges'}
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Expand / Collapse sub-tasks if any exist */}
            {(task.mini_tasks_total || 0) > 0 && (
              <button
                type="button"
                onClick={handleToggleExpand}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title={isExpanded ? 'Collapse steps' : 'Expand steps'}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            {/* More Menu (Edit / Delete) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onEditTask(task);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit Task
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDeleteTask(task.id);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Task
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Embedded Mini-tasks list when expanded */}
        {isExpanded && miniTasks && miniTasks.length > 0 && (
          <MiniTaskList
            taskId={task.id}
            miniTasks={miniTasks}
            onToggleStatus={onToggleMiniTaskStatus}
            onAddMiniTask={onAddMiniTask}
            onDeleteMiniTask={onDeleteMiniTask}
            onReorderMiniTasks={onReorderMiniTasks}
          />
        )}
      </div>
    </div>
  );
};
