import { useState } from 'react';
import { useProfile, useUpdateProfile } from '../profile/useProfile';
import { fetchGoogleContacts } from './googleContacts';
import { getGoogleAccessToken, googleTokenReason } from './googleToken';
import { describeGoogleError } from './googleError';
import { pushChangedContacts, type OutboundReport } from './googlePush';
import { findDeletedMatches, useBulkImport, type ImportSummary } from './useImport';
import type { ImportItem } from './parseCsv';

// Settings, the Import page and the background sync all mount this hook. One
// run at a time, across all of them: two concurrent syncs would import the same
// batch twice and push the same edits twice.
let globalRun = false;

function noConnection(): string {
  switch (googleTokenReason()) {
    case 'reconnect_required':
      return 'Google revoked the connection. Click "Connect Google" to link it again.';
    case 'not_configured':
      return 'The google-token function is missing its Google client id/secret. See the README.';
    default:
      return 'Google not connected. Click "Connect Google" and try again.';
  }
}

/**
 * The Google sync, shared by the Settings card, the Import page and the
 * background sync.
 *
 * Pull first, then push whatever changed here since the last sync, so the run
 * ends with both sides equal and can report what it wrote into Google. The
 * Import page passes `push: false` - that card is an import, not a sync.
 *
 * When the batch contains contacts that were deleted here, `pending` is set and
 * nothing is written until the caller answers with `confirm`. A background run
 * passes `skipDeleted` instead: it has no one to ask, so it leaves them out and
 * the next interactive sync asks.
 */
export function useGoogleSync() {
  const bulk = useBulkImport();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [status, setStatus] = useState<string | null>(null);
  /** Link that fixes whatever `status` is complaining about, when there is one. */
  const [help, setHelp] = useState<string | null>(null);
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

  function report(e: unknown) {
    const { text, url } = describeGoogleError(e);
    setStatus(text);
    setHelp(url);
  }

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

  async function run({
    push = true,
    skipDeleted = false,
  }: { push?: boolean; skipDeleted?: boolean } = {}) {
    if (running || globalRun) return;
    globalRun = true;
    setRunning(true);
    setSummary(null);
    setOutbound(null);
    setHelp(null);
    // Read before the import: the pull itself touches rows (label backfill),
    // and those edits are Google's own, not ours to send back.
    const since = push ? profile?.google_last_synced ?? null : null;
    try {
      setStatus('Checking Google connection...');
      const token = await getGoogleAccessToken();
      if (!token) {
        setStatus(noConnection());
        return;
      }
      setStatus('Syncing contacts from Google...');
      const all = await fetchGoogleContacts(token);
      const deleted = await findDeletedMatches(all);
      if (deleted.length && !skipDeleted) {
        // Nothing is written until the prompt is answered.
        setBatch({ all, deleted, since });
        setStatus(null);
        return;
      }
      const rejected = new Set(skipDeleted ? deleted : []);
      await importItems(
        rejected.size ? all.filter((i) => !rejected.has(i)) : all,
        since,
      );
    } catch (e) {
      report(e);
    } finally {
      globalRun = false;
      setRunning(false);
    }
  }

  async function confirm(approved: ImportItem[]) {
    if (!batch || running || globalRun) return;
    const approvedSet = new Set(approved);
    const rejected = new Set(batch.deleted.filter((d) => !approvedSet.has(d)));
    const items = batch.all.filter((i) => !rejected.has(i));
    const since = batch.since;
    setBatch(null);
    globalRun = true;
    setRunning(true);
    try {
      setStatus('Importing...');
      await importItems(items, since);
    } catch (e) {
      report(e);
    } finally {
      globalRun = false;
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
    help,
    summary,
    outbound,
    pending: batch?.deleted ?? null,
    busy: running || bulk.isPending,
  };
}
