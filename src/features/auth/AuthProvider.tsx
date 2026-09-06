import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  clearGoogleToken,
  rememberGoogleRefreshToken,
  setGoogleToken,
} from '../import/googleToken';
import { AuthContext, type AuthState } from './authContext';

// Full contacts scope, not contacts.readonly: the import reads the People API,
// and edits saved here are written back to Google (see googlePush.ts).
const GOOGLE_SCOPES = 'email profile https://www.googleapis.com/auth/contacts';

// origin alone drops the subpath on GitHub Pages, sending auth redirects to
// https://marsierz-ui.github.io/ instead of .../World-network/. BASE_URL is
// '/World-network/' in production and '/' in dev.
const APP_URL = window.location.origin + import.meta.env.BASE_URL;

/**
 * Both Google tokens exist on exactly one page load: the one that handles the
 * OAuth redirect. The access token covers this tab; the refresh token is handed
 * to the Edge Function, which is what keeps the connection alive afterwards.
 */
function captureGoogleTokens(session: Session | null) {
  if (session?.provider_token) setGoogleToken(session.provider_token);
  if (session?.provider_refresh_token) {
    void rememberGoogleRefreshToken(session.provider_refresh_token);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      captureGoogleTokens(data.session);
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Deferred: supabase-js warns against calling back into the client from
      // inside this callback, and captureGoogleTokens invokes an Edge Function.
      setTimeout(() => {
        if (event === 'SIGNED_OUT') clearGoogleToken();
        else captureGoogleTokens(s);
      }, 0);
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
