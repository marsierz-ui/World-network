import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useProfile, useUpdateProfile } from '../profile/useProfile';
import { fetchGoogleContacts } from './googleContacts';
import { getGoogleToken } from './googleToken';
import { pushChangedContacts, type OutboundReport } from './googlePush';
import { findDeletedMatches, useBulkImport, type ImportSummary } from './useImport';
import type { ImportItem } from './parseCsv';

// Google access tokens last about an hour; 403 usually means the People API is
// off in the Cloud project or the contacts scope was declined.
function explain(message: string): string {
  if (message.includes('People API 401')) {
    return 'Google session expired. Click "Connect Google" and sync again.';
  }
  if (message.includes('People API 403')) {
    return (
      'Google refused the request. Enable the People API in your Google Cloud project and ' +
      'make sure you granted the contacts permission when connecting.'
    );
  }
  return `Sync failed: ${message}`;
}

/**
 * The Google sync, shared by the Settings card and the Import page.
 *
 * Pull first, then push whatever changed here since the last sync, so the run
 * ends with both sides equal and can report what it wrote into Google. The
 * Import page passes `push: false` - that card is an import, not a sync.
 *
 * When the batch contains contacts that were deleted here, `pending` is set and
 * nothing is written until the caller answers with `confirm`.
 */
export function useGoogleSync() {
  const bulk = useBulkImport();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [outbound, setOutbound] = useState<OutboundReport | null>(null);
  const [batch, setBatch] = useState<{
    all: ImportItem[];
    deleted: ImportItem[];
    since: string | null;
  } | null>(null);
  // bulk.isPending only covers the write; the fetch before it can take a while
  // and a second click there would import the same batch twice.
  const [running, setRunning] = useState(false);

  async function importItems(items: ImportItem[], since: string | null) {
    const result = await bulk.mutateAsync({ items, source: 'google' });
    setSummary(result);

    // No previous sync means no window to push: every contact would look new,
    // and the first run would dump the whole address book into Google.
    if (since) {
      setStatus('Sending your changes to Google...');
      setOutbound(
        await pushChangedContacts(since, (done, total) =>
          setStatus(`Sending your changes to Google... ${done}/${total}`),
        ),
      );
    }

    // Stamped last, so the links written by the push above fall inside this
    // run's window and are not re-examined by the next one.
    updateProfile.mutate({ google_last_synced: new Date().toISOString() });
    setStatus(null);
  }

  async function run({ push = true }: { push?: boolean } = {}) {
    if (running) return;
    setRunning(true);
    setSummary(null);
    setOutbound(null);
    // Read before the import: the pull itself touches rows (label backfill),
    // and those edits are Google's own, not ours to send back.
    const since = push ? profile?.google_last_synced ?? null : null;
    try {
      setStatus('Checking Google connection...');
      const { data } = await supabase.auth.getSession();
      // provider_token only survives the OAuth redirect itself; the stored copy
      // covers every load after that.
      const token = data.session?.provider_token ?? getGoogleToken();
      if (!token) {
        setStatus('Google not connected in this session. Click "Connect Google" and try again.');
        return;
      }
      setStatus('Syncing contacts from Google...');
      const all = await fetchGoogleContacts(token);
      const deleted = await findDeletedMatches(all);
      if (deleted.length) {
        // Nothing is written until the prompt is answered.
        setBatch({ all, deleted, since });
        setStatus(null);
        return;
      }
      await importItems(all, since);
    } catch (e) {
      setStatus(explain((e as Error).message));
    } finally {
      setRunning(false);
    }
  }

  async function confirm(approved: ImportItem[]) {
    if (!batch || running) return;
    const approvedSet = new Set(approved);
    const rejected = new Set(batch.deleted.filter((d) => !approvedSet.has(d)));
    const items = batch.all.filter((i) => !rejected.has(i));
    const since = batch.since;
    setBatch(null);
    setRunning(true);
    try {
      setStatus('Importing...');
      await importItems(items, since);
    } catch (e) {
      setStatus(explain((e as Error).message));
    } finally {
      setRunning(false);
    }
  }

  function cancel() {
    setBatch(null);
    setStatus('Sync cancelled. Nothing was imported.');
  }

  return {
    run,
    confirm,
    cancel,
    status,
    summary,
    outbound,
    pending: batch?.deleted ?? null,
    busy: running || bulk.isPending,
  };
}
