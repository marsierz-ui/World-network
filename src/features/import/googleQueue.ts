import { create } from 'zustand';
import { supabase } from '../../lib/supabase';
import {
  createContactInGoogle,
  googleResourceName,
  pushContactToGoogle,
  type PushResult,
} from './googlePush';
import type { Contact } from '../../lib/database.types';

export interface SyncOutcome {
  name: string;
  result: PushResult | 'failed';
  error: string | null;
}

interface QueueState {
  /** Writes still in flight. */
  pending: number;
  last: SyncOutcome | null;
  clear: () => void;
}

export const useGoogleQueue = create<QueueState>((set) => ({
  pending: 0,
  last: null,
  clear: () => set({ last: null }),
}));

const setState = useGoogleQueue.setState;

/**
 * Google writes run here rather than inside the save mutation.
 *
 * A push is two or three round-trips to Google (profile check, read-back for the
 * etag, then the write). Awaiting that before the form closed made every save
 * feel broken. The local write is what the user is waiting for; Google catches
 * up behind it and reports through this store.
 *
 * One chain, not parallel calls: the People API asks for mutations on a single
 * user to be sent sequentially, and it also keeps a burst of edits from racing
 * each other onto the same contact.
 */
let chain: Promise<unknown> = Promise.resolve();

export function enqueueGoogleSync(
  contact: Contact,
  mode: 'create' | 'update',
  onLinked?: (resourceName: string) => void,
) {
  setState((s) => ({ pending: s.pending + 1 }));
  chain = chain
    .then(() => run(contact, mode, onLinked))
    .catch(() => {}) // a failed push must not stall everything queued behind it
    .finally(() => setState((s) => ({ pending: s.pending - 1 })));
}

async function run(
  contact: Contact,
  mode: 'create' | 'update',
  onLinked?: (resourceName: string) => void,
) {
  const report = (result: PushResult | 'failed', error: string | null = null) =>
    setState({ last: { name: contact.full_name, result, error } });

  try {
    // Editing a contact that never came from Google leaves it local: silently
    // creating one per edit would flood Google after a CSV import.
    if (mode === 'update' || googleResourceName(contact)) {
      report(await pushContactToGoogle(contact));
      return;
    }
    const { result, resourceName } = await createContactInGoogle(contact);
    if (resourceName) {
      await supabase
        .from('contacts')
        .update({ external_ids: { ...contact.external_ids, google: resourceName } })
        .eq('id', contact.id);
      onLinked?.(resourceName);
    }
    report(result);
  } catch (e) {
    report('failed', (e as Error).message);
  }
}
