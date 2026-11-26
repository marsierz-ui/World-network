import { useEffect, useRef, useState } from 'react';
import { BallCustomizer } from './BallCustomizer';
import { markSetupSeen, setupSeen, useMyBallLook } from './useBallLook';

/**
 * First-run setup step: a member who has not made a countryball yet is asked
 * once. Skipping keeps a plain flag ball; it can be changed later on My card.
 */
export function BallSetup() {
  const { look, profile } = useMyBallLook();
  const [seen, setSeen] = useState(setupSeen);
  const open = !!profile && !look && !seen;
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function close() {
    markSetupSeen();
    setSeen(true);
  }

  if (!open) return null;
  return (
    <dialog ref={ref} className="cb-setup" onCancel={close} aria-labelledby="cb-setup-title">
      <div className="cb-setup-head">
        <div>
          <span className="cb-step">Setup · your countryball</span>
          <h2 id="cb-setup-title">This is you on the map.</h2>
          <p className="muted">
            People you connect with see this ball where you are. Everyone else in CrowdTrails is a
            plain flag ball.
          </p>
        </div>
        <button type="button" className="link" onClick={close}>
          Skip for now
        </button>
      </div>
      <BallCustomizer compact onSaved={() => setTimeout(close, 700)} />
    </dialog>
  );
}
