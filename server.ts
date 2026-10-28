import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// JSON File Database
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

interface SchemaDB {
  tasks: Array<{
    id: string;
    user_id: string;
    title: string;
    description?: string;
    priority: 'Low' | 'Normal' | 'High';
    status: 'Not Started' | 'In Progress' | 'Completed';
    due_date?: string;
    created_at: string;
    updated_at: string;
  }>;
  mini_tasks: Array<{
    id: string;
    task_id: string;
    user_id: string;
    title: string;
    status: 'Not Started' | 'In Progress' | 'Completed';
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>;
  reminders: Array<{
    id: string;
    task_id: string;
    user_id: string;
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    reminder_time: string;
    next_reminder_at: string;
    nudge_tone?: 'gentle' | 'balanced' | 'firm';
    notes?: string;
    created_at: string;
    updated_at: string;
  }>;
}

const DEFAULT_USER = 'user_me';

const seedData: SchemaDB = {
  tasks: [
    {
      id: 'task-1',
      user_id: DEFAULT_USER,
      title: 'Install bathroom tiles',
      description: 'Replace worn ceramic tiles with non-slip porcelain tiles in the master bathroom.',
      priority: 'High',
      status: 'In Progress',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'task-2',
      user_id: DEFAULT_USER,
      title: 'Pay electricity bill via tokens',
      description: 'Buy prepaid KPLC tokens before balance runs critical.',
      priority: 'High',
      status: 'Not Started',
      due_date: new Date().toISOString().slice(0, 10),
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'task-3',
      user_id: DEFAULT_USER,
      title: 'Meet business partner at café',
      description: 'Discuss Q4 supplies inventory, pricing contracts, and vehicle maintenance.',
      priority: 'Normal',
      status: 'Not Started',
      due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'task-4',
      user_id: DEFAULT_USER,
      title: 'Buy construction materials',
      description: 'Pick up 5 bags of cement, sand, waterproofing additive, and spacers.',
      priority: 'Normal',
      status: 'Not Started',
      due_date: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-5',
      user_id: DEFAULT_USER,
      title: 'Go to town to pick up supplies',
      description: 'Collect parcel from courier office and renew parking pass.',
      priority: 'Low',
      status: 'Completed',
      due_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ],
  mini_tasks: [
    {
      id: 'mini-1',
      task_id: 'task-1',
      user_id: DEFAULT_USER,
      title: 'Measure floor square meters & calculate tiles needed (+10% waste)',
      status: 'Completed',
      sort_order: 1,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'mini-2',
      task_id: 'task-1',
      user_id: DEFAULT_USER,
      title: 'Strip old baseboards and clean & level concrete subfloor',
      status: 'Completed',
      sort_order: 2,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
    {
      id: 'mini-3',
      task_id: 'task-1',
      user_id: DEFAULT_USER,
      title: 'Dry lay tiles with 3mm spacers to plan center lines and corner cuts',
      status: 'In Progress',
      sort_order: 3,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mini-4',
      task_id: 'task-1',
      user_id: DEFAULT_USER,
      title: 'Mix waterproof tile adhesive and install full tiles',
      status: 'Not Started',
      sort_order: 4,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mini-5',
      task_id: 'task-1',
      user_id: DEFAULT_USER,
      title: 'Cut edge tiles, grout joints, and seal silicone perimeter',
      status: 'Not Started',
      sort_order: 5,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  reminders: [
    {
      id: 'rem-1',
      task_id: 'task-2',
      user_id: DEFAULT_USER,
      enabled: true,
      frequency: 'daily',
      reminder_time: '08:30',
      next_reminder_at: calculateNextReminder('daily', '08:30'),
      nudge_tone: 'firm',
      notes: 'High priority nudge: Pay before meters drop below minimum emergency threshold.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'rem-2',
      task_id: 'task-3',
      user_id: DEFAULT_USER,
      enabled: true,
      frequency: 'weekly',
      reminder_time: '09:00',
      next_reminder_at: calculateNextReminder('weekly', '09:00'),
      nudge_tone: 'balanced',
      notes: 'Check partner agenda 30 mins prior.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

function calculateNextReminder(frequency: 'daily' | 'weekly', timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  const now = new Date();
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    if (frequency === 'daily') {
      next.setDate(next.getDate() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
  }
  return next.toISOString();
}

function initDb(): SchemaDB {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), 'utf8');
    return seedData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading database, resetting to seed:', e);
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), 'utf8');
    return seedData;
  }
}

let db = initDb();

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

// REST API ROUTES

// 1. Get all tasks with summaries
app.get('/api/tasks', (req, res) => {
  const tasksWithDetails = db.tasks.map((task) => {
    const taskMiniTasks = db.mini_tasks.filter((m) => m.task_id === task.id);
    const completedMiniTasks = taskMiniTasks.filter((m) => m.status === 'Completed').length;
    const reminder = db.reminders.find((r) => r.task_id === task.id && r.enabled);

    return {
      ...task,
      mini_tasks_total: taskMiniTasks.length,
      mini_tasks_completed: completedMiniTasks,
      has_reminder: !!reminder,
      reminder_summary: reminder ? `${reminder.frequency.toUpperCase()} at ${reminder.reminder_time}` : undefined,
    };
  });

  // Sort: In Progress & Not Started first, then by priority (High -> Normal -> Low)
  const priorityWeight = { High: 3, Normal: 2, Low: 1 };
  tasksWithDetails.sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1;
    if (a.status !== 'Completed' && b.status === 'Completed') return -1;
    return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
  });

  res.json({ success: true, tasks: tasksWithDetails });
});

// 2. Create a new task
app.post('/api/tasks', (req, res) => {
  const { title, description, priority, due_date } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Task title is required.' });
  }

  const validPriorities = ['Low', 'Normal', 'High'];
  const taskPriority = validPriorities.includes(priority) ? priority : 'Normal';

  const newTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: DEFAULT_USER,
    title: title.trim(),
    description: description ? description.trim() : '',
    priority: taskPriority,
    status: 'Not Started' as const,
    due_date: due_date || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.tasks.unshift(newTask);
  saveDb();

  res.status(201).json({ success: true, task: newTask });
});

// 3. Get single task detail (with mini_tasks & reminder)
app.get('/api/tasks/:id', (req, res) => {
  const task = db.tasks.find((t) => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found.' });
  }

  const mini_tasks = db.mini_tasks
    .filter((m) => m.task_id === task.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const reminder = db.reminders.find((r) => r.task_id === task.id) || null;

  res.json({
    success: true,
    task: {
      ...task,
      mini_tasks,
      reminder,
    },
  });
});

// 4. Update task
app.put('/api/tasks/:id', (req, res) => {
  const taskIndex = db.tasks.findIndex((t) => t.id === req.params.id);
  if (taskIndex === -1) {
    return res.status(404).json({ success: false, error: 'Task not found.' });
  }

  const current = db.tasks[taskIndex];
  const { title, description, priority, status, due_date } = req.body;

  const updated = {
    ...current,
    title: title !== undefined ? title.trim() : current.title,
    description: description !== undefined ? description.trim() : current.description,
    priority: priority !== undefined ? priority : current.priority,
    status: status !== undefined ? status : current.status,
    due_date: due_date !== undefined ? due_date : current.due_date,
    updated_at: new Date().toISOString(),
  };

  db.tasks[taskIndex] = updated;
  saveDb();

  res.json({ success: true, task: updated });
});

// 5. Delete task (cascades to mini-tasks & reminder)
app.delete('/api/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const initialLength = db.tasks.length;
  db.tasks = db.tasks.filter((t) => t.id !== taskId);

  if (db.tasks.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Task not found.' });
  }

  db.mini_tasks = db.mini_tasks.filter((m) => m.task_id !== taskId);
  db.reminders = db.reminders.filter((r) => r.task_id !== taskId);
  saveDb();

  res.json({ success: true, message: 'Task deleted successfully.' });
});

// 6. Mini-tasks: Add a single mini-task
app.post('/api/tasks/:id/mini-tasks', (req, res) => {
  const taskId = req.params.id;
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found.' });
  }

  const { title, sort_order } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Mini-task title is required.' });
  }

  const existingCount = db.mini_tasks.filter((m) => m.task_id === taskId).length;

  const newMini = {
    id: `mini-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    task_id: taskId,
    user_id: DEFAULT_USER,
    title: title.trim(),
    status: 'Not Started' as const,
    sort_order: sort_order !== undefined ? sort_order : existingCount + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.mini_tasks.push(newMini);
  saveDb();

  res.status(201).json({ success: true, mini_task: newMini });
});

// 7. Mini-tasks: Batch approve / save mini-tasks (e.g. from approved AI breakdown)
app.post('/api/tasks/:id/mini-tasks/batch', (req, res) => {
  const taskId = req.params.id;
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found.' });
  }

  const { items, replaceExisting } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Items must be a non-empty array.' });
  }

  if (replaceExisting) {
    db.mini_tasks = db.mini_tasks.filter((m) => m.task_id !== taskId);
  }

  const currentCount = db.mini_tasks.filter((m) => m.task_id === taskId).length;
  const createdList = items.map((item, idx) => ({
    id: `mini-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    task_id: taskId,
    user_id: DEFAULT_USER,
    title: item.title.trim(),
    status: (item.status || 'Not Started') as 'Not Started' | 'In Progress' | 'Completed',
    sort_order: currentCount + idx + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  db.mini_tasks.push(...createdList);

  // If task status was 'Not Started', mark 'In Progress' as breakdown has commenced
  if (task.status === 'Not Started') {
    task.status = 'In Progress';
    task.updated_at = new Date().toISOString();
  }

  saveDb();

  res.status(201).json({ success: true, count: createdList.length, mini_tasks: createdList });
});

// 8. Update mini-task
app.put('/api/mini-tasks/:id', (req, res) => {
  const miniId = req.params.id;
  const index = db.mini_tasks.findIndex((m) => m.id === miniId);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Mini-task not found.' });
  }

  const current = db.mini_tasks[index];
  const { title, status, sort_order } = req.body;

  const updated = {
    ...current,
    title: title !== undefined ? title.trim() : current.title,
    status: status !== undefined ? status : current.status,
    sort_order: sort_order !== undefined ? sort_order : current.sort_order,
    updated_at: new Date().toISOString(),
  };

  db.mini_tasks[index] = updated;

  // Auto-sync parent task status if all mini-tasks are completed
  const parentTaskId = current.task_id;
  const parentTask = db.tasks.find((t) => t.id === parentTaskId);
  if (parentTask) {
    const parentMiniTasks = db.mini_tasks.filter((m) => m.task_id === parentTaskId);
    const allDone = parentMiniTasks.length > 0 && parentMiniTasks.every((m) => m.status === 'Completed');
    if (allDone && parentTask.status !== 'Completed') {
      parentTask.status = 'Completed';
      parentTask.updated_at = new Date().toISOString();
    } else if (!allDone && parentTask.status === 'Completed' && status !== 'Completed') {
      parentTask.status = 'In Progress';
      parentTask.updated_at = new Date().toISOString();
    }
  }

  saveDb();

  res.json({ success: true, mini_task: updated });
});

// 9. Delete mini-task
app.delete('/api/mini-tasks/:id', (req, res) => {
  const miniId = req.params.id;
  const initialLength = db.mini_tasks.length;
  db.mini_tasks = db.mini_tasks.filter((m) => m.id !== miniId);

  if (db.mini_tasks.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Mini-task not found.' });
  }

  saveDb();
  res.json({ success: true, message: 'Mini-task removed.' });
});

// 10. Reorder mini-tasks
app.post('/api/tasks/:id/mini-tasks/reorder', (req, res) => {
  const taskId = req.params.id;
  const { orderIds } = req.body; // array of mini task IDs in desired order

  if (!Array.isArray(orderIds)) {
    return res.status(400).json({ success: false, error: 'orderIds must be an array.' });
  }

  orderIds.forEach((id, index) => {
    const mini = db.mini_tasks.find((m) => m.id === id && m.task_id === taskId);
    if (mini) {
      mini.sort_order = index + 1;
      mini.updated_at = new Date().toISOString();
    }
  });

  saveDb();
  res.json({ success: true, message: 'Order updated.' });
});

// 11. Reminder configuration: Get or set for task
app.get('/api/tasks/:id/reminder', (req, res) => {
  const reminder = db.reminders.find((r) => r.task_id === req.params.id) || null;
  res.json({ success: true, reminder });
});

app.post('/api/tasks/:id/reminder', (req, res) => {
  const taskId = req.params.id;
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found.' });
  }

  const { enabled = true, frequency = 'daily', reminder_time = '09:00', nudge_tone, notes } = req.body;

  let existing = db.reminders.find((r) => r.task_id === taskId);
  const nextReminder = calculateNextReminder(frequency, reminder_time);

  // Derive nudge tone if not provided based on task priority
  const defaultTone = task.priority === 'High' ? 'firm' : task.priority === 'Normal' ? 'balanced' : 'gentle';

  if (existing) {
    existing.enabled = enabled;
    existing.frequency = frequency;
    existing.reminder_time = reminder_time;
    existing.next_reminder_at = nextReminder;
    existing.nudge_tone = nudge_tone || existing.nudge_tone || defaultTone;
    existing.notes = notes !== undefined ? notes : existing.notes;
    existing.updated_at = new Date().toISOString();
  } else {
    existing = {
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      task_id: taskId,
      user_id: DEFAULT_USER,
      enabled,
      frequency,
      reminder_time,
      next_reminder_at: nextReminder,
      nudge_tone: nudge_tone || defaultTone,
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.reminders.push(existing);
  }

  saveDb();
  res.json({ success: true, reminder: existing });
});

app.delete('/api/tasks/:id/reminder', (req, res) => {
  const taskId = req.params.id;
  db.reminders = db.reminders.filter((r) => r.task_id !== taskId);
  saveDb();
  res.json({ success: true, message: 'Reminder deleted.' });
});

// 12. Active Reminders overview
app.get('/api/reminders/active', (req, res) => {
  const activeList = db.reminders
    .filter((r) => r.enabled)
    .map((rem) => {
      const task = db.tasks.find((t) => t.id === rem.task_id);
      return {
        ...rem,
        task_title: task ? task.title : 'Unknown Task',
        task_priority: task ? task.priority : 'Normal',
        task_status: task ? task.status : 'Not Started',
        due_date: task?.due_date,
      };
    })
    .sort((a, b) => new Date(a.next_reminder_at).getTime() - new Date(b.next_reminder_at).getTime());

  res.json({ success: true, reminders: activeList });
});

// 13. AI TASK BREAKDOWN ENDPOINT (Gemini Server-Side)
app.post('/api/ai/breakdown', async (req, res) => {
  const { taskId, title, description, priority } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Task title is required for AI breakdown.' });
  }

  const prompt = `You are a practical, grounded Personal AI Task Partner.
The user needs help breaking down a specific task into manageable, sequential, and realistic mini-tasks (between 4 and 7 concrete steps).

Task details:
- Main Task: "${title.trim()}"
- Details/Context: "${description ? description.trim() : 'No additional details provided'}"
- Priority: ${priority || 'Normal'}

Rules for breakdown:
1. Provide concrete, actionable steps that can be checked off in order.
2. Keep each step title concise (under 12 words), active verb first (e.g., "Measure...", "Buy...", "Draft...", "Confirm...").
3. Estimate realistic minutes for each step (e.g., 15, 30, 45, 60).
4. Do NOT overwhelm the user; keep steps simple, natural, and directly related to the user's specific task.
5. Return ONLY structured data matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'A list of concrete mini-task suggestions to accomplish the parent task',
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Concise, action-oriented step title',
              },
              estimatedMinutes: {
                type: Type.NUMBER,
                description: 'Estimated minutes to complete',
              },
              tips: {
                type: Type.STRING,
                description: 'Practical tip or watchout for this step',
              },
            },
            required: ['title'],
          },
        },
      },
    });

    const rawText = response.text?.trim() || '[]';
    let parsedItems = [];
    try {
      parsedItems = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn('Could not parse Gemini JSON directly, attempting fallback extraction:', parseErr);
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedItems = JSON.parse(jsonMatch[0]);
      }
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      parsedItems = getFallbackBreakdown(title);
    }

    // Attach temporary proposal IDs for client UI editing & reordering
    const proposal = parsedItems.map((item, index) => ({
      id: `prop-${Date.now()}-${index}`,
      title: item.title,
      estimatedMinutes: item.estimatedMinutes || 20,
      tips: item.tips || '',
    }));

    return res.json({
      success: true,
      taskId: taskId || null,
      taskTitle: title,
      priority: priority || 'Normal',
      items: proposal,
    });
  } catch (err: any) {
    console.error('Error in Gemini AI breakdown:', err?.message || err);
    // Graceful fallback breakdown if API is unreachable or rate limited
    const fallbackItems = getFallbackBreakdown(title).map((item, index) => ({
      id: `prop-${Date.now()}-${index}`,
      title: item.title,
      estimatedMinutes: item.estimatedMinutes || 25,
      tips: item.tips || '',
    }));

    return res.json({
      success: true,
      taskId: taskId || null,
      taskTitle: title,
      priority: priority || 'Normal',
      items: fallbackItems,
      isFallback: true,
    });
  }
});

function getFallbackBreakdown(title: string): Array<{ title: string; estimatedMinutes: number; tips?: string }> {
  const lower = title.toLowerCase();
  if (lower.includes('tile') || lower.includes('bath') || lower.includes('floor')) {
    return [
      { title: 'Measure surface area and calculate tile boxes + adhesive needed', estimatedMinutes: 20 },
      { title: 'Remove old fixtures and inspect subfloor for leveling', estimatedMinutes: 45 },
      { title: 'Dry layout tiles with spacers to align grout symmetry', estimatedMinutes: 30 },
      { title: 'Mix thin-set adhesive and set full tiles along grid', estimatedMinutes: 60 },
      { title: 'Cut border tiles and fit corner trim pieces', estimatedMinutes: 40 },
      { title: 'Apply waterproof grout and clean sponge wash', estimatedMinutes: 35 },
    ];
  }
  if (lower.includes('bill') || lower.includes('pay') || lower.includes('token')) {
    return [
      { title: 'Check current meter / account balance and outstanding charges', estimatedMinutes: 5 },
      { title: 'Confirm payment details (account number / meter ID)', estimatedMinutes: 5 },
      { title: 'Initiate mobile payment / bank transfer for desired amount', estimatedMinutes: 5 },
      { title: 'Input token code or verify payment receipt confirmation', estimatedMinutes: 5 },
    ];
  }
  if (lower.includes('meet') || lower.includes('partner') || lower.includes('discuss')) {
    return [
      { title: 'Confirm meeting time, location, and quiet seating', estimatedMinutes: 10 },
      { title: 'List 3 priority agenda discussion items and expected outcomes', estimatedMinutes: 15 },
      { title: 'Gather relevant invoices, metrics, or sample agreements', estimatedMinutes: 20 },
      { title: 'Conduct meeting and record agreed action items', estimatedMinutes: 60 },
      { title: 'Send short follow-up summary message with agreed next steps', estimatedMinutes: 15 },
    ];
  }
  // Generic high quality breakdown
  return [
    { title: `Clarify specific requirements and supplies for "${title}"`, estimatedMinutes: 15 },
    { title: 'Prepare workspace, tools, and needed materials', estimatedMinutes: 20 },
    { title: 'Execute the core foundational step of the work', estimatedMinutes: 45 },
    { title: 'Review progress, test, or inspect details for quality', estimatedMinutes: 25 },
    { title: 'Finalize, clean up, and confirm completion', estimatedMinutes: 15 },
  ];
}

// Full-Stack Server Integration with Vite
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal AI Task Partner server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
