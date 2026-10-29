import { supabase } from './supabase';

// Supabase access tokens are short-lived, so a 401 can mean "stale token".
// But a 401 can also mean the API itself rejects every token (wrong Supabase
// project on the server, a proxy answering /api, ...). Refreshing on every 401
// turns that into an endless refresh loop, so refreshes are:
//   - single-flight (parallel requests share one refresh),
//   - rate limited (at most one real refresh per cooldown window),
//   - followed by at most one retry of the original request.
const REFRESH_COOLDOWN_MS = 30_000;
let refreshInFlight: Promise<string | null> | null = null;
let lastRefreshAt = 0;

async function currentAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function refreshAccessToken(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null);
  if (!refreshInFlight) {
    lastRefreshAt = Date.now();
    refreshInFlight = supabase.auth
      .refreshSession()
      .then(({ data, error }) => (!error && data.session?.access_token ? data.session.access_token : null))
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Returns a token worth retrying with, or null when a retry cannot help.
async function tokenForRetry(sentToken: string | null): Promise<string | null> {
  const latest = await currentAccessToken();
  // A refresh is already running (e.g. the tasks and reminders requests fired
  // together): join it rather than failing or starting a second one. This check
  // must come after the await above, and nothing may await between it and
  // refreshAccessToken() below, or two callers can both decide to refresh.
  if (refreshInFlight) return refreshInFlight;
  // Another request already refreshed the session while this one was in flight.
  if (latest && latest !== sentToken) return latest;
  // Refreshed very recently and still rejected: the token is not the problem.
  if (Date.now() - lastRefreshAt < REFRESH_COOLDOWN_MS) return null;
  return refreshAccessToken();
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const sentToken = await currentAccessToken();
  if (sentToken) headers.set('Authorization', `Bearer ${sentToken}`);

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401 && supabase) {
    const retryToken = await tokenForRetry(sentToken);
    if (retryToken) {
      headers.set('Authorization', `Bearer ${retryToken}`);
      response = await fetch(input, { ...init, headers });
    }
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`API returned ${response.status} ${response.statusText}, not JSON. Check the Netlify Function deployment.`);
  }
  return response;
}

// Like apiFetch, but parses the body and throws a readable Error when the
// request failed, so callers can show the reason instead of failing silently.
export async function apiJson<T = any>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, init);
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // fall through to the generic message below
  }
  if (!response.ok || !data?.success) {
    let message = data?.error || `Request failed (HTTP ${response.status}).`;
    if (response.status === 401) {
      message += ' The API rejected your sign-in. If signing out and back in does not help, check that SUPABASE_URL and SUPABASE_SECRET_KEY in Netlify belong to the same Supabase project as VITE_SUPABASE_URL.';
    }
    throw new Error(message);
  }
  return data as T;
}

