// Supabase hands back the Google access token as session.provider_token exactly
// once, on the OAuth redirect, and does not retain it. Anything that needs the
// People API later has to keep its own copy, so AuthProvider stashes it here.
//
// sessionStorage, not localStorage: this is a bearer token, and it should die
// with the tab rather than sit on disk. Google expires it after ~1 hour anyway.

const KEY = 'wn.google_provider_token';

export function setGoogleToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private-mode Safari and friends; sync just falls back to reconnecting.
  }
}

export function getGoogleToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
