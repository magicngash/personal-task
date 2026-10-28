export type TaskPriority = 'Low' | 'Normal' | 'High';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed';
export type ReminderFrequency = 'daily' | 'weekly';
export type NudgeTone = 'gentle' | 'balanced' | 'firm';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
  // Computed aggregations for list view
  mini_tasks_total?: number;
  mini_tasks_completed?: number;
  has_reminder?: boolean;
  reminder_summary?: string;
}

export interface MiniTask {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  status: TaskStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ReminderConfig {
  id: string;
  task_id: string;
  user_id: string;
  enabled: boolean;
  frequency: ReminderFrequency;
  reminder_time: string; // HH:mm
  next_reminder_at: string; // ISO string
  nudge_tone?: NudgeTone;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskDetail extends Task {
  mini_tasks: MiniTask[];
  reminder?: ReminderConfig | null;
}

export interface SuggestedMiniTask {
  title: string;
  estimatedMinutes?: number;
  tips?: string;
}

export interface BreakdownProposal {
  taskId: string;
  taskTitle: string;
  priority: TaskPriority;
  items: Array<{
    id: string;
    title: string;
    estimatedMinutes?: number;
  }>;
}
