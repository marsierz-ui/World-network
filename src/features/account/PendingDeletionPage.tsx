import { useAuth } from '../auth/authContext';
import { useRestoreAccount, type PendingDeletion } from './useAccountDeletion';

// Shown instead of the app while an account waits out its deletion grace period.
// Nothing has been removed yet; restoring is one click.
export function PendingDeletionPage({ pending }: { pending: PendingDeletion }) {
  const { signOut } = useAuth();
  const restore = useRestoreAccount();
  const date = new Date(pending.purge_after).toLocaleDateString(undefined, { dateStyle: 'long' });

  return (
    <div className="login">
      <h1>Account scheduled for deletion</h1>
      <p className="muted">
        Your data will be permanently deleted on {date}. Until then nothing has been removed, and
        you can restore your account.
      </p>
      <p className="muted small">
        Google sync was switched off when you asked for deletion. After restoring, turn it back on
        in Settings.
      </p>
      <button onClick={() => restore.mutate()} disabled={restore.isPending}>
        {restore.isPending ? 'Restoring...' : 'Restore my account'}
      </button>
      {restore.isError && <div className="error">{restore.error.message}</div>}
      <button className="link" onClick={signOut}>Sign out</button>
    </div>
  );
}
