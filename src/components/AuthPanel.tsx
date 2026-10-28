import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const AuthPanel: React.FC = () => {
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setMessage('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify.');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = mode === 'sign_in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            // Keep email verification inside the deployed application rather
            // than using a dashboard/default redirect from another project.
            emailRedirectTo: window.location.origin,
          },
        });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === 'sign_up' && !result.data.session) setMessage('Check your email to confirm your account.');
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-5">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">TaskPartner</p><h1 className="text-2xl font-bold mt-2">{mode === 'sign_in' ? 'Welcome back' : 'Create your account'}</h1><p className="text-sm text-slate-500 mt-1">Your tasks, reminders, and progress in one secure place.</p></div>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full px-3 py-2.5 border rounded-lg" />
        <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2.5 border rounded-lg" />
        {message && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{message}</p>}
        <button disabled={busy} className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{mode === 'sign_in' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}{busy ? 'Working...' : mode === 'sign_in' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" onClick={() => setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')} className="w-full text-sm text-blue-700">{mode === 'sign_in' ? 'Create an account' : 'I already have an account'}</button>
      </form>
    </main>
  );
};
