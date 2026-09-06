import { supabase } from '../../lib/supabase';

// Google access tokens live about an hour and Supabase hands out
// session.provider_token exactly once, on the OAuth redirect. On its own that
// makes the connection last one tab, one hour.
//
// So the refresh token that comes back with the same redirect is posted to the
// google-token Edge Function, which keeps it out of reach of the browser and
// mints a fresh access token whenever this module asks for one. That is what
// makes the connection survive reloads, new tabs and days away.
//
// Everything degrades to the old behaviour when the function is not deployed:
// the redirect token still works for the rest of the session.

const KEY = 'wn.google_provider_token';
const FN = 'google-token';
// Refresh a minute early rather than discovering expiry mid-sync.
const EXPIRY_MARGIN_MS = 60_000;

export type LinkState =
  | 'linked' // refresh token stored: reconnects itself
  | 'session-only' // only the redirect token; dies with the tab
  | 'not-configured' // function deployed but missing the Google client secret
  | 'unavailable' // function not deployed / unreachable
  | 'none';

let cached: { token: string; expiresAt: number } | null = null;
// A sync fires several requests at once; without this they would each mint a
// separate access token.
let refreshing: Promise<string | null> | null = null;
let lastReason: string | null = null;

interface FunctionResult {
  ok: boolean;
  reason?: string;
  detail?: string;
  access_token?: string;
  expires_in?: number;
  connected?: boolean;
  configured?: boolean;
}

// On a deployment without the function, every push would otherwise pay for a
// failed request first. One failure stands in for the next few minutes.
const DOWN_FOR_MS = 5 * 60_000;
let downUntil = 0;

/** Returns null when the function is unreachable (not deployed, offline). */
async function callFunction(body: Record<string, unknown>): Promise<FunctionResult | null> {
  if (Date.now() < downUntil) return null;
  const { data, error } = await supabase.functions.invoke<FunctionResult>(FN, { body });
  if (error || !data) {
    downUntil = Date.now() + DOWN_FOR_MS;
    return null;
  }
  downUntil = 0;
  return data;
}

// ---------------------------------------------------------------------------
// the token handed over by the OAuth redirect
// ---------------------------------------------------------------------------

// sessionStorage, not localStorage: this is a bearer token, and it should die
// with the tab rather than sit on disk.
export function setGoogleToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private-mode Safari and friends; the stored refresh token covers it.
  }
}

export function getGoogleToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Hand the refresh token to the Edge Function. Called once per OAuth redirect.
 *
 * Google only issues one when the consent screen was shown, which is why the
 * sign-in asks for `access_type=offline` and `prompt=consent` every time - a
 * silent re-auth would return an access token and no refresh token, and the
 * connection would quietly go back to lasting one hour.
 */
export async function rememberGoogleRefreshToken(refreshToken: string): Promise<boolean> {
  const res = await callFunction({ action: 'store', refresh_token: refreshToken });
  return !!res?.ok;
}

// ---------------------------------------------------------------------------
// access tokens
// ---------------------------------------------------------------------------

async function mint(): Promise<string | null> {
  const res = await callFunction({ action: 'access' });
  if (!res) {
    lastReason = 'unavailable';
    return null;
  }
  if (!res.ok || !res.access_token) {
    lastReason = res.reason ?? 'unknown';
    // The stored grant is gone; a session token would only mask that.
    if (res.reason === 'reconnect_required') cached = null;
    return null;
  }
  lastReason = null;
  cached = {
    token: res.access_token,
    expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000 - EXPIRY_MARGIN_MS,
  };
  return cached.token;
}

/**
 * A usable Google access token, or null when the user has to reconnect.
 *
 * Order: the token minted from the stored refresh token, then whatever the
 * current OAuth redirect left behind. The fallback is what keeps sync working
 * on a deployment where the Edge Function was never deployed.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  refreshing ??= mint().finally(() => {
    refreshing = null;
  });
  const minted = await refreshing;
  if (minted) return minted;

  const { data } = await supabase.auth.getSession();
  return data.session?.provider_token ?? getGoogleToken();
}

/** Why the last mint failed: 'no_refresh_token', 'reconnect_required', ... */
export function googleTokenReason(): string | null {
  return lastReason;
}

export function clearGoogleToken() {
  cached = null;
  lastReason = null;
  setGoogleToken(null);
}

/** How durable the current connection is, for the settings card. */
export async function getGoogleLinkState(): Promise<LinkState> {
  const res = await callFunction({ action: 'status' });
  if (!res) return getGoogleToken() ? 'session-only' : 'unavailable';
  if (!res.configured) return 'not-configured';
  if (res.connected) return 'linked';
  return getGoogleToken() ? 'session-only' : 'none';
}

export async function disconnectGoogle(): Promise<void> {
  await callFunction({ action: 'disconnect' });
  clearGoogleToken();
}
