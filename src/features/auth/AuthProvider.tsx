import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { setGoogleToken } from '../import/googleToken';
import { AuthContext, type AuthState } from './authContext';

// Full contacts scope, not contacts.readonly: the import reads the People API,
// and edits saved here are written back to Google (see googlePush.ts).
const GOOGLE_SCOPES = 'email profile https://www.googleapis.com/auth/contacts';

// origin alone drops the subpath on GitHub Pages, sending auth redirects to
// https://marsierz-ui.github.io/ instead of .../World-network/. BASE_URL is
// '/World-network/' in production and '/' in dev.
const APP_URL = window.location.origin + import.meta.env.BASE_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Present only on the load that handles the OAuth redirect.
      if (data.session?.provider_token) setGoogleToken(data.session.provider_token);
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (s?.provider_token) setGoogleToken(s.provider_token);
      if (event === 'SIGNED_OUT') setGoogleToken(null);
      setSession(s);
    });
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
