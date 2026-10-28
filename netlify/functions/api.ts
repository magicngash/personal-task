import type { Handler } from '@netlify/functions';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

const admin = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseSecret) throw new Error('Supabase server credentials are not configured.');
  return createClient(supabaseUrl, supabaseSecret, { auth: { autoRefreshToken: false, persistSession: false } });
};

async function authenticate(event: Parameters<Handler>[0]): Promise<{ db: SupabaseClient; user: User } | { error: ReturnType<typeof json> }> {
  try {
    const db = admin();
    const header = event.headers.authorization || event.headers.Authorization;
    const token = header?.replace(/^Bearer\s+/i, '');
    if (!token) return { error: json(401, { success: false, error: 'Sign in is required.' }) };
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return { error: json(401, { success: false, error: 'Your session has expired. Sign in again.' }) };
    return { db, user: data.user };
  } catch (error) {
    return { error: json(500, { success: false, error: error instanceof Error ? error.message : 'Server configuration error.' }) };
  }
}

const statusToDb: Record<string, string> = { 'Not Started': 'not_started', 'In Progress': 'in_progress', Completed: 'completed' };
const statusToUi: Record<string, string> = { not_started: 'Not Started', in_progress: 'In Progress', blocked: 'In Progress', completed: 'Completed', cancelled: 'Completed' };
const priorityToDb: Record<string, string> = { Low: 'low', Normal: 'normal', High: 'high' };
const priorityToUi: Record<string, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'High' };

function taskView(row: any) {
  return { ...row, priority: priorityToUi[row.priority] || 'Normal', status: statusToUi[row.status] || 'Not Started', due_date: row.due_at ? row.due_at.slice(0, 10) : undefined };
}

async function taskDetails(db: SupabaseClient, userId: string, task: any) {
  const { data: children } = await db.from('tasks').select('*').eq('user_id', userId).eq('parent_task_id', task.id).order('created_at');
  const { data: rules } = await db.from('reminder_rules').select('*').eq('user_id', userId).eq('task_id', task.id).limit(1);
  const mini_tasks = (children || []).map((child, index) => ({ ...taskView(child), task_id: task.id, sort_order: index + 1 }));
  const reminder = rules?.[0] ? { ...rules[0], reminder_time: rules[0].reminder_time, nudge_tone: rules[0].urgency === 'strict' ? 'firm' : rules[0].urgency === 'gentle' ? 'gentle' : 'balanced', next_reminder_at: new Date().toISOString() } : null;
  return { ...taskView(task), mini_tasks, reminder, mini_tasks_total: mini_tasks.length, mini_tasks_completed: mini_tasks.filter((m: any) => m.status === 'Completed').length, has_reminder: Boolean(reminder), reminder_summary: reminder ? `${reminder.frequency.toUpperCase()} at ${reminder.reminder_time}` : undefined };
}

function parseBody(event: Parameters<Handler>[0]) {
  try { return event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : {}; } catch { return null; }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type, Authorization' }, body: '' };
  const auth = await authenticate(event);
  if ('error' in auth) return auth.error;
  const { db, user } = auth;
  const body = parseBody(event);
  if (body === null) return json(400, { success: false, error: 'Request body must be valid JSON.' });
  const route = (event.path || '').replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '') || '/';
  try {
    if (event.httpMethod === 'GET' && route === '/tasks') {
      const { data, error } = await db.from('tasks').select('*').eq('user_id', user.id).is('parent_task_id', null).order('created_at', { ascending: false });
      if (error) throw error;
      const tasks = await Promise.all((data || []).map((row) => taskDetails(db, user.id, row)));
      return json(200, { success: true, tasks });
    }
    const taskMatch = route.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch && event.httpMethod === 'GET') {
      const { data, error } = await db.from('tasks').select('*').eq('id', taskMatch[1]).eq('user_id', user.id).single();
      if (error || !data) return json(404, { success: false, error: 'Task not found.' });
      return json(200, { success: true, task: await taskDetails(db, user.id, data) });
    }
    if (route === '/tasks' && event.httpMethod === 'POST') {
      if (!body.title?.trim()) return json(400, { success: false, error: 'Task title is required.' });
      const { data, error } = await db.from('tasks').insert({ user_id: user.id, title: body.title.trim(), description: body.description?.trim() || null, priority: priorityToDb[body.priority] || 'normal', status: 'not_started', due_at: body.due_date ? `${body.due_date}T00:00:00Z` : null }).select().single();
      if (error) throw error;
      return json(201, { success: true, task: taskView(data) });
    }
    if (taskMatch && event.httpMethod === 'PUT') {
      const update: any = {};
      if (body.title !== undefined) update.title = body.title.trim();
      if (body.description !== undefined) update.description = body.description.trim() || null;
      if (body.priority !== undefined) update.priority = priorityToDb[body.priority] || 'normal';
      if (body.status !== undefined) update.status = statusToDb[body.status] || body.status;
      if (body.due_date !== undefined) update.due_at = body.due_date ? `${body.due_date}T00:00:00Z` : null;
      if (update.status === 'completed') update.completed_at = new Date().toISOString();
      const { data, error } = await db.from('tasks').update(update).eq('id', taskMatch[1]).eq('user_id', user.id).select().single();
      if (error || !data) return json(404, { success: false, error: 'Task not found.' });
      return json(200, { success: true, task: taskView(data) });
    }
    if (taskMatch && event.httpMethod === 'DELETE') {
      const { error } = await db.from('tasks').delete().eq('id', taskMatch[1]).eq('user_id', user.id);
      if (error) throw error;
      return json(200, { success: true });
    }
    const miniMatch = route.match(/^\/mini-tasks\/([^/]+)$/);
    if (miniMatch && event.httpMethod === 'PUT') {
      const update: any = {};
      if (body.title !== undefined) update.title = body.title.trim();
      if (body.status !== undefined) update.status = statusToDb[body.status] || body.status;
      const { data, error } = await db.from('tasks').update(update).eq('id', miniMatch[1]).eq('user_id', user.id).not('parent_task_id', 'is', null).select().single();
      if (error || !data) return json(404, { success: false, error: 'Mini-task not found.' });
      return json(200, { success: true, mini_task: { ...taskView(data), task_id: data.parent_task_id } });
    }
    if (miniMatch && event.httpMethod === 'DELETE') {
      const { error } = await db.from('tasks').delete().eq('id', miniMatch[1]).eq('user_id', user.id);
      if (error) throw error;
      return json(200, { success: true });
    }
    const childMatch = route.match(/^\/tasks\/([^/]+)\/mini-tasks(?:\/batch)?$/);
    if (childMatch && event.httpMethod === 'POST') {
      const parentId = childMatch[1];
      const items = body.items || [{ title: body.title }];
      if (!Array.isArray(items) || !items.length) return json(400, { success: false, error: 'Items must be a non-empty array.' });
      const rows = items.map((item: any) => ({ user_id: user.id, parent_task_id: parentId, title: String(item.title || '').trim(), status: 'not_started', priority: 'normal' }));
      const { data, error } = await db.from('tasks').insert(rows).select();
      if (error) throw error;
      return json(201, { success: true, mini_tasks: (data || []).map(taskView), count: data?.length || 0 });
    }
    const reminderMatch = route.match(/^\/tasks\/([^/]+)\/reminder$/);
    if (reminderMatch && event.httpMethod === 'GET') {
      const { data } = await db.from('reminder_rules').select('*').eq('user_id', user.id).eq('task_id', reminderMatch[1]).limit(1);
      return json(200, { success: true, reminder: data?.[0] || null });
    }
    if (reminderMatch && event.httpMethod === 'POST') {
      const values = { user_id: user.id, task_id: reminderMatch[1], reminder_type: 'task_progress', enabled: body.enabled !== false, frequency: body.frequency || 'daily', reminder_time: body.reminder_time || '09:00', timezone: 'Africa/Nairobi', urgency: body.nudge_tone === 'firm' ? 'strict' : body.nudge_tone === 'gentle' ? 'gentle' : 'firm', custom_instruction: body.notes || null };
      const { data: existing } = await db.from('reminder_rules').select('id').eq('user_id', user.id).eq('task_id', reminderMatch[1]).limit(1).maybeSingle();
      const query = existing?.id
        ? db.from('reminder_rules').update(values).eq('id', existing.id).eq('user_id', user.id)
        : db.from('reminder_rules').insert(values);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return json(200, { success: true, reminder: data });
    }
    if (reminderMatch && event.httpMethod === 'DELETE') {
      const { error } = await db.from('reminder_rules').delete().eq('user_id', user.id).eq('task_id', reminderMatch[1]);
      if (error) throw error;
      return json(200, { success: true });
    }
    if (route === '/reminders/active' && event.httpMethod === 'GET') {
      const { data, error } = await db.from('reminder_rules').select('*').eq('user_id', user.id).eq('enabled', true);
      if (error) throw error;
      const reminders = await Promise.all((data || []).map(async (rule: any) => { const { data: task } = await db.from('tasks').select('*').eq('id', rule.task_id).eq('user_id', user.id).single(); return { ...rule, task_title: task?.title || 'Unknown task', task_priority: priorityToUi[task?.priority] || 'Normal', task_status: statusToUi[task?.status] || 'Not Started', next_reminder_at: new Date().toISOString() }; }));
      return json(200, { success: true, reminders });
    }
    if (route === '/ai/breakdown' && event.httpMethod === 'POST') {
      const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
      const fallback = [{ title: `Clarify requirements and supplies for "${body.title}"`, estimatedMinutes: 15 }, { title: 'Prepare workspace, tools, and materials', estimatedMinutes: 20 }, { title: 'Complete the main work step', estimatedMinutes: 45 }, { title: 'Review quality and finalize', estimatedMinutes: 25 }];
      if (!ai) return json(200, { success: true, taskId: body.taskId, taskTitle: body.title, priority: body.priority || 'Normal', items: fallback, isFallback: true });
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Return JSON array of 4-7 actionable mini tasks for: ${body.title}. Context: ${body.description || 'none'}. Each item needs title and estimatedMinutes.` });
      let items: any[] = [];
      try { items = JSON.parse(response.text?.trim() || '[]'); } catch { items = fallback; }
      return json(200, { success: true, taskId: body.taskId, taskTitle: body.title, priority: body.priority || 'Normal', items: items.map((item, index) => ({ id: `proposal-${index}`, ...item })) });
    }
    return json(404, { success: false, error: 'API route not found.' });
  } catch (error) {
    console.error('API error', error);
    return json(500, { success: false, error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
};
