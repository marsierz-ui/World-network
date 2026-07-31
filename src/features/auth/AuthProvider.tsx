import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { AuthContext, type AuthState } from './authContext';

// contacts.readonly lets the Google import read the People API later.
const GOOGLE_SCOPES = 'email profile https://www.googleapis.com/auth/contacts.readonly';

// origin alone drops the subpath on GitHub Pages, sending auth redirects to
// https://marsierz-ui.github.io/ instead of .../World-network/. BASE_URL is
// '/World-network/' in production and '/' in dev.
const APP_URL = window.location.origin + import.meta.env.BASE_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    loading,
    signInWithGoogle: async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: GOOGLE_SCOPES,
          redirectTo: APP_URL,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
    },
    signInWithEmail: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUpWithEmail: async (email, password) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: APP_URL },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
