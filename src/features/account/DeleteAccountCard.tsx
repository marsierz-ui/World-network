import { useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useIsAdmin } from '../auth/useIsAdmin';
import { useRequestDeletion } from './useAccountDeletion';

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountCard() {
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const request = useRequestDeletion();
  const [typed, setTyped] = useState('');

  if (isAdmin) return null;

  async function submit() {
    try {
      await request.mutateAsync();
    } catch {
      return; // the error shows below; stay signed in
    }
    await signOut();
  }

  return (
    <div className="connection-card">
      <div className="conn-head">
        <div>
          <strong>Delete my account</strong>
          <div className="muted">
            Removes your contacts, labels, history and settings, and disconnects Google. Nothing
            is deleted straight away: your data is kept for 30 days, and signing back in during
            that time lets you restore it. After that it is gone for good.
          </div>
        </div>
      </div>
      <label>
        Type {CONFIRM_WORD} to confirm
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      <button onClick={submit} disabled={typed !== CONFIRM_WORD || request.isPending}>
        {request.isPending ? 'Working...' : 'Delete my account'}
      </button>
      {request.isError && <div className="error">{request.error.message}</div>}
    </div>
  );
}
