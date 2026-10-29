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

// Supabase errors are plain objects (not Error instances), so read .message from either.
const messageOf = (error: unknown, fallback = 'Unexpected server error.') =>
  error instanceof Error
    ? error.message
    : typeof (error as any)?.message === 'string' && (error as any).message
      ? (error as any).message
      : fallback;

const authFailure = (error: unknown, requestId: string) => {
  const detail = messageOf(error, 'Supabase Auth returned no user.');
  const normalized = detail.toLowerCase();
  const unreachable = normalized.includes('fetch failed') || normalized.includes('econn') || normalized.includes('enotfound') || normalized.includes('timeout');
  const invalidToken = normalized.includes('jwt') || normalized.includes('token') || normalized.includes('unauthorized') || normalized.includes('invalid');
  const code = unreachable ? 'AUTH_PROVIDER_UNREACHABLE' : invalidToken ? 'AUTH_TOKEN_REJECTED' : 'AUTH_VERIFICATION_FAILED';
  const statusCode = unreachable ? 503 : 401;
  const userMessage = unreachable
    ? 'The task API could not reach Supabase Auth. Check the Supabase URL, Netlify function environment, DNS, and provider availability.'
    : invalidToken
      ? 'Supabase Auth rejected this session token. This usually means the session is stale or the browser and Netlify functions use different Supabase projects.'
      : 'Supabase Auth could not verify this session.';

  console.error('Authentication verification failed', {
    requestId,
    code,
    detail,
    supabaseHost: supabaseUrl?.replace(/^https?:\/\//i, '').split('/')[0] || 'missing',
  });
  return json(statusCode, {
    success: false,
    error: `${userMessage} Reference: ${requestId}`,
    diagnostic_code: code,
    request_id: requestId,
  });
};

const admin = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseSecret) throw new Error('Supabase server credentials are not configured.');
  return createClient(supabaseUrl, supabaseSecret, { auth: { autoRefreshToken: false, persistSession: false } });
};

async function authenticate(event: Parameters<Handler>[0]): Promise<{ db: SupabaseClient; user: User } | { error: ReturnType<typeof json> }> {
  const requestId = event.headers['x-nf-request-id'] || event.headers['x-request-id'] || crypto.randomUUID();
  try {
    const db = admin();
    const header = event.headers.authorization || event.headers.Authorization;
    const token = header?.replace(/^Bearer\s+/i, '');
    if (!token) return { error: json(401, { success: false, error: 'Sign in is required.' }) };
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) {
      return { error: authFailure(error || new Error('No user returned.'), requestId) };
    }
    return { db, user: data.user };
  } catch (error) {
    return { error: authFailure(error, requestId) };
  }
}

const statusToDb: Record<string, string> = { 'Not Started': 'not_started', 'In Progress': 'in_progress', Completed: 'completed' };
const statusToUi: Record<string, string> = { not_started: 'Not Started', in_progress: 'In Progress', blocked: 'In Progress', completed: 'Completed', cancelled: 'Completed' };
const priorityToDb: Record<string, string> = { Low: 'low', Normal: 'normal', High: 'high' };
const priorityToUi: Record<string, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'High' };

// Postgres `time` columns come back as HH:MM:SS; the UI works in HH:MM.
const hhmm = (time: unknown) => String(time ?? '').slice(0, 5);

function taskView(row: any) {
  return { ...row, priority: priorityToUi[row.priority] || 'Normal', status: statusToUi[row.status] || 'Not Started', due_date: row.due_at ? row.due_at.slice(0, 10) : undefined };
}

function buildTaskDetails(task: any, children: any[], rule: any) {
  const mini_tasks = children.map((child, index) => ({ ...taskView(child), task_id: task.id, sort_order: index + 1 }));
  const reminder = rule
    ? {
        ...rule,
        reminder_time: hhmm(rule.reminder_time),
        nudge_tone: rule.urgency === 'strict' ? 'firm' : rule.urgency === 'gentle' ? 'gentle' : 'balanced',
        next_reminder_at: new Date().toISOString(),
      }
    : null;
  return {
    ...taskView(task),
    mini_tasks,
    reminder,
    mini_tasks_total: mini_tasks.length,
    mini_tasks_completed: mini_tasks.filter((m: any) => m.status === 'Completed').length,
    has_reminder: Boolean(reminder),
    reminder_summary: reminder ? `${reminder.frequency.toUpperCase()} at ${reminder.reminder_time}` : undefined,
  };
}

// One task: its steps and reminder rule.
async function taskDetails(db: SupabaseClient, userId: string, task: any) {
  const [children, rules] = await Promise.all([
    db.from('tasks').select('*').eq('user_id', userId).eq('parent_task_id', task.id).order('created_at'),
    db.from('reminder_rules').select('*').eq('user_id', userId).eq('task_id', task.id).limit(1),
  ]);
  if (children.error) throw children.error;
  if (rules.error) throw rules.error;
  return buildTaskDetails(task, children.data || [], rules.data?.[0]);
}

// Many tasks at once: two queries in total instead of two per task.
async function taskListDetails(db: SupabaseClient, userId: string, tasks: any[]) {
  if (!tasks.length) return [];
  const [children, rules] = await Promise.all([
    db.from('tasks').select('*').eq('user_id', userId).not('parent_task_id', 'is', null).order('created_at'),
    db.from('reminder_rules').select('*').eq('user_id', userId).not('task_id', 'is', null),
  ]);
  if (children.error) throw children.error;
  if (rules.error) throw rules.error;
  const childrenByParent = new Map<string, any[]>();
  for (const child of children.data || []) {
    const list = childrenByParent.get(child.parent_task_id) || [];
    list.push(child);
    childrenByParent.set(child.parent_task_id, list);
  }
  const ruleByTask = new Map<string, any>();
  for (const rule of rules.data || []) if (!ruleByTask.has(rule.task_id)) ruleByTask.set(rule.task_id, rule);
  return tasks.map((task) => buildTaskDetails(task, childrenByParent.get(task.id) || [], ruleByTask.get(task.id)));
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
      const tasks = await taskListDetails(db, user.id, data || []);
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
      if (!Object.keys(update).length) return json(400, { success: false, error: 'Nothing to update.' });
      // completed_at is kept in sync with status by a database trigger.
      const { data, error } = await db.from('tasks').update(update).eq('id', taskMatch[1]).eq('user_id', user.id).select().maybeSingle();
      if (error) throw error; // a real database error, not "not found"
      if (!data) return json(404, { success: false, error: 'Task not found.' });
      return json(200, { success: true, task: taskView(data) });
    }
    if (taskMatch && event.httpMethod === 'DELETE') {
      // tasks.parent_task_id is ON DELETE RESTRICT, so a task with steps cannot be
      // deleted until its steps are gone.
      const { error: stepsError } = await db.from('tasks').delete().eq('user_id', user.id).eq('parent_task_id', taskMatch[1]);
      if (stepsError) throw stepsError;
      const { error } = await db.from('tasks').delete().eq('id', taskMatch[1]).eq('user_id', user.id);
      if (error) throw error;
      return json(200, { success: true });
    }
    const miniMatch = route.match(/^\/mini-tasks\/([^/]+)$/);
    if (miniMatch && event.httpMethod === 'PUT') {
      const update: any = {};
      if (body.title !== undefined) update.title = body.title.trim();
      if (body.status !== undefined) update.status = statusToDb[body.status] || body.status;
      if (!Object.keys(update).length) return json(400, { success: false, error: 'Nothing to update.' });
      const { data, error } = await db.from('tasks').update(update).eq('id', miniMatch[1]).eq('user_id', user.id).not('parent_task_id', 'is', null).select().maybeSingle();
      if (error) throw error;
      if (!data) return json(404, { success: false, error: 'Mini-task not found.' });
      return json(200, { success: true, mini_task: { ...taskView(data), task_id: data.parent_task_id } });
    }
    if (miniMatch && event.httpMethod === 'DELETE') {
      const { error } = await db.from('tasks').delete().eq('id', miniMatch[1]).eq('user_id', user.id);
      if (error) throw error;
      return json(200, { success: true });
    }
    const reorderMatch = route.match(/^\/tasks\/([^/]+)\/mini-tasks\/reorder$/);
    if (reorderMatch && event.httpMethod === 'POST') {
      const orderIds = body.orderIds;
      if (!Array.isArray(orderIds) || !orderIds.length || orderIds.some((id: unknown) => typeof id !== 'string')) {
        return json(400, { success: false, error: 'orderIds must be a non-empty array of step ids.' });
      }
      const parentId = reorderMatch[1];
      const { data: existing, error } = await db.from('tasks').select('id, created_at').eq('user_id', user.id).eq('parent_task_id', parentId).in('id', orderIds);
      if (error) throw error;
      if (new Set(orderIds).size !== orderIds.length || (existing || []).length !== orderIds.length) {
        return json(400, { success: false, error: 'orderIds must list each step of this task exactly once.' });
      }
      // The tasks table has no sort column and steps are listed by created_at, so
      // persist the order by spacing created_at 1ms apart from the earliest step.
      const base = Math.min(...(existing || []).map((row: any) => new Date(row.created_at).getTime()));
      const results = await Promise.all(
        orderIds.map((id: string, index: number) =>
          db.from('tasks').update({ created_at: new Date(base + index).toISOString() }).eq('id', id).eq('user_id', user.id).eq('parent_task_id', parentId)
        )
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      return json(200, { success: true });
    }
    const childMatch = route.match(/^\/tasks\/([^/]+)\/mini-tasks(?:\/batch)?$/);
    if (childMatch && event.httpMethod === 'POST') {
      const parentId = childMatch[1];
      const items = body.items || [{ title: body.title }];
      if (!Array.isArray(items) || !items.length) return json(400, { success: false, error: 'Items must be a non-empty array.' });
      const titles = items.map((item: any) => String(item?.title || '').trim()).filter(Boolean);
      if (!titles.length) return json(400, { success: false, error: 'Each step needs a title.' });
      const { data: parent, error: parentError } = await db.from('tasks').select('id').eq('id', parentId).eq('user_id', user.id).maybeSingle();
      if (parentError) throw parentError;
      if (!parent) return json(404, { success: false, error: 'Task not found.' });
      if (body.replaceExisting === true) {
        const { error: clearError } = await db.from('tasks').delete().eq('user_id', user.id).eq('parent_task_id', parentId);
        if (clearError) throw clearError;
      }
      // Rows inserted together share one now(), which would make their order
      // arbitrary; give each its own timestamp so steps list in the order given.
      const baseTime = Date.now();
      const rows = titles.map((title: string, index: number) => ({ user_id: user.id, parent_task_id: parentId, title, status: 'not_started', priority: 'normal', created_at: new Date(baseTime + index).toISOString() }));
      const { data, error } = await db.from('tasks').insert(rows).select().order('created_at');
      if (error) throw error;
      return json(201, { success: true, mini_tasks: (data || []).map(taskView), count: data?.length || 0 });
    }
    const reminderMatch = route.match(/^\/tasks\/([^/]+)\/reminder$/);
    if (reminderMatch && event.httpMethod === 'GET') {
      const { data, error } = await db.from('reminder_rules').select('*').eq('user_id', user.id).eq('task_id', reminderMatch[1]).limit(1);
      if (error) throw error;
      return json(200, { success: true, reminder: data?.[0] ? { ...data[0], reminder_time: hhmm(data[0].reminder_time) } : null });
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
      const rules = data || [];
      // One query for all the tasks the rules belong to, instead of one per rule.
      const { data: taskRows, error: taskError } = rules.length
        ? await db.from('tasks').select('*').eq('user_id', user.id).in('id', [...new Set(rules.map((rule: any) => rule.task_id).filter(Boolean))])
        : { data: [] as any[], error: null };
      if (taskError) throw taskError;
      const tasksById = new Map((taskRows || []).map((task: any) => [task.id, task]));
      const reminders = rules.map((rule: any) => {
        const task: any = tasksById.get(rule.task_id);
        return { ...rule, reminder_time: hhmm(rule.reminder_time), task_title: task?.title || 'Unknown task', task_priority: priorityToUi[task?.priority] || 'Normal', task_status: statusToUi[task?.status] || 'Not Started', next_reminder_at: new Date().toISOString() };
      });
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
    return json(500, { success: false, error: messageOf(error) });
  }
};

