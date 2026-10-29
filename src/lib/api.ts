import { supabase } from './supabase';

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

async function tokenForRetry(sentToken: string | null): Promise<string | null> {
  const latest = await currentAccessToken();
  if (refreshInFlight) return refreshInFlight;
  if (latest && latest !== sentToken) return latest;
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

  // Supabase access tokens are short-lived. Refresh once when the API rejects
  // a stale token, then retry the original request with the new token.
  if (response.status === 401 && supabase) {
    const retryToken = await tokenForRetry(sentToken);
    if (retryToken) {
      headers.set('Authorization', `Bearer ${retryToken}`);
      response = await fetch(input, { ...init, headers });
    }
  }

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('taskpartner:session-expired'));
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`API returned ${response.status} ${response.statusText}, not JSON. Check the Netlify Function deployment.`);
  }
  return response;
}
