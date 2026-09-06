import { useEffect, useRef } from 'react';
import { useProfile } from '../profile/useProfile';
import { useGoogleSync } from './useGoogleSync';

/** How stale the last sync has to be before a background run starts. */
const SYNC_INTERVAL_MS = 15 * 60 * 1000;
/** How often staleness is re-checked. Cheap: it usually decides to do nothing. */
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Keeps Google in step on its own, mounted once in the app shell.
 *
 * Runs on load and every 15 minutes the app is open and visible, so opening the
 * app is enough to be up to date - "Sync now" stays for when you do not want to
 * wait. It only ever runs while the tab is visible: a background tab syncing an
 * address book on a phone is a poor trade for freshness nobody is looking at.
 *
 * Deletions are skipped rather than prompted for. A background run has no one to
 * ask, and re-adding a contact somebody deliberately deleted is the one outcome
 * worth avoiding; the next manual sync raises the prompt.
 */
export function useGoogleAutoSync() {
  const { data: profile } = useProfile();
  const sync = useGoogleSync();
  const enabled = profile?.google_sync_enabled ?? false;
  const lastSynced = profile?.google_last_synced ?? null;

  // Failures do not move google_last_synced, so without this a disconnected
  // Google would be retried every single check.
  const lastAttempt = useRef(0);
  // Keeping run in a ref means the timer is not torn down and rebuilt on every
  // render of the shell.
  const runRef = useRef(sync.run);
  useEffect(() => {
    runRef.current = sync.run;
  });

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastAttempt.current < SYNC_INTERVAL_MS) return;
      const since = lastSynced ? new Date(lastSynced).getTime() : 0;
      if (now - since < SYNC_INTERVAL_MS) return;
      lastAttempt.current = now;
      void runRef.current({ skipDeleted: true });
    };

    tick();
    const timer = setInterval(tick, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, lastSynced]);

  return {
    busy: sync.busy,
    // Progress text while a run is in flight; whatever went wrong once it is not.
    problem: !sync.busy && sync.status ? sync.status : null,
  };
}
