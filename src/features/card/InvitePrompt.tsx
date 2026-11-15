import { useEffect, useState } from 'react';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import { useProfile } from '../profile/useProfile';
import { CARD_FIELDS } from './cardFields';
import { clearInvite, pendingInvite } from './invite';
import { useAcceptInvite, useInvitePreview } from './useCard';

// Shown once after sign-in when the session started from someone's invite link
// or QR code. Nothing is exchanged until "Connect" is pressed.
export function InvitePrompt() {
  const [token, setToken] = useState(pendingInvite);
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();
  const { data: profile } = useProfile();

  function close() {
    clearInvite();
    setToken(null);
  }

  const p = preview.data;
  // Your own QR code, scanned to try it out.
  const own = p?.is_self === true;
  useEffect(() => {
    if (own) clearInvite();
  }, [own]);

  if (!token || preview.isLoading || own) return null;

  const place = p && [p.home_city, COUNTRY_BY_CODE.get(p.home_country ?? '')?.name].filter(Boolean).join(', ');
  const mine = CARD_FIELDS.filter((f) => profile?.share_fields.includes(f.key)).map((f) => f.short);

  return (
    <div className="picker-backdrop">
      <div className="merge-modal invite-modal">
        {preview.isError || !p ? (
          <>
            <strong>This invite no longer works</strong>
            <p className="muted">The link was replaced by its owner. Ask them for a new one.</p>
            <div className="actions-row">
              <button onClick={close}>Close</button>
            </div>
          </>
        ) : p.linked || accept.isSuccess ? (
          <>
            <strong>You are connected with {p.display_name}</strong>
            <p className="muted">
              They are in your contacts, and you are in theirs. When one of you visits the
              other's city, you can let each other know from the Visits page.
            </p>
            <div className="actions-row">
              <button onClick={close}>Done</button>
            </div>
          </>
        ) : (
          <>
            <strong>Connect with {p.display_name}?</strong>
            {place && <div className="muted">{place}</div>}
            <p className="muted">
              You swap cards: {p.display_name} is added to your contacts, and you are added to
              theirs with your name{mine.length ? `, ${mine.join(', ')}` : ''}. Change what your
              card carries under My card.
            </p>
            <div className="actions-row">
              <button onClick={() => accept.mutate(token)} disabled={accept.isPending}>
                {accept.isPending ? 'Connecting...' : 'Connect'}
              </button>
              <button className="link" onClick={close}>Not now</button>
            </div>
            {accept.isError && <div className="error">That did not go through. Try again.</div>}
          </>
        )}
      </div>
    </div>
  );
}
