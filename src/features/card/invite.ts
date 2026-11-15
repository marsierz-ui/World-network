import { APP_URL } from '../../lib/app';

const KEY = 'wn.invite';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function inviteUrl(token: string): string {
  return `${APP_URL}?invite=${token}`;
}

// An invite usually arrives signed out, and signing in (the OAuth round trip,
// or the email confirmation link) comes back without the query string. Park the
// token and take it off the address bar before anything else runs.
export function captureInvite() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('invite');
  if (!token) return;
  if (UUID.test(token)) localStorage.setItem(KEY, token);
  url.searchParams.delete('invite');
  window.history.replaceState(null, '', url);
}

export function pendingInvite(): string | null {
  return localStorage.getItem(KEY);
}

export function clearInvite() {
  localStorage.removeItem(KEY);
}
