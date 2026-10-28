import { supabase } from './supabase';

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }

  let response = await fetch(input, { ...init, headers });

  // Supabase access tokens are short-lived. Refresh once when the API rejects
  // a stale token, then retry the original request with the new token.
  if (response.status === 401 && supabase) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      headers.set('Authorization', `Bearer ${data.session.access_token}`);
      response = await fetch(input, { ...init, headers });
    }
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`API returned ${response.status} ${response.statusText}, not JSON. Check the Netlify Function deployment.`);
  }
  return response;
}
