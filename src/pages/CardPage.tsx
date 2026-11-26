import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../features/auth/authContext';
import { useContacts } from '../features/contacts/useContacts';
import { CARD_FIELDS } from '../features/card/cardFields';
import { inviteUrl } from '../features/card/invite';
import { useContactLinks, useUnlink } from '../features/card/useCard';
import { useProfile, useUpdateProfile } from '../features/profile/useProfile';
import { COUNTRY_BY_CODE } from '../lib/countries';
import { PLATFORMS } from '../lib/socials';
import type { CardField, Profile } from '../lib/database.types';
import { BallCustomizer } from '../features/countryball/BallCustomizer';

export function CardPage() {
  const { data: profile } = useProfile();
  if (!profile) return <div className="page-pad muted">Loading...</div>;
  return (
    <div className="page-pad import-page">
      <h2>My card</h2>
      <section className="import-card" id="countryball">
        <h3>Your countryball</h3>
        <p className="muted">
          How you appear on the maps of people you connect with. Everyone who has not made one is a
          plain flag ball.
        </p>
        <BallCustomizer />
      </section>
      <ShareCard profile={profile} />
      <CardContents profile={profile} />
      <LinkedMembers />
    </div>
  );
}

function ShareCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const url = inviteUrl(profile.share_token);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    // Dark on white whatever the theme: phone cameras read that most reliably.
    void QRCode.toDataURL(url, { margin: 2, width: 480 }).then((d) => live && setQr(d));
    return () => {
      live = false;
    };
  }, [url]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function share() {
    void navigator
      .share({ title: 'CrowdTrails', text: 'Connect with me on CrowdTrails', url })
      .catch(() => {}); // dismissed share sheet
  }

  function replace() {
    const ok = window.confirm(
      'Replace your invite link? The current link and QR code stop working. People already connected stay connected.',
    );
    if (ok) update.mutate({ share_token: crypto.randomUUID() });
  }

  return (
    <section className="import-card">
      <h3>Invite someone</h3>
      <p className="muted">
        Let them scan the code or send them the link. Once they accept, you are in each other's
        contacts with the details each of you chose to share.
      </p>
      <div className="card-share">
        {qr ? <img className="card-qr" src={qr} alt="QR code of your invite link" /> : <div className="card-qr" />}
        <div className="card-link">
          <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Invite link" />
          <div className="actions-row">
            <button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
            {'share' in navigator && <button onClick={share}>Share...</button>}
            <button className="link" onClick={replace} disabled={update.isPending}>
              Replace link
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CardContents({ profile }: { profile: Profile }) {
  const { session } = useAuth();
  const update = useUpdateProfile();
  const on = (f: CardField) => profile.share_fields.includes(f);

  function toggle(f: CardField) {
    update.mutate({
      share_fields: on(f) ? profile.share_fields.filter((x) => x !== f) : [...profile.share_fields, f],
    });
  }

  const emails = [...new Set([session?.user.email, ...profile.emails].filter(Boolean))];
  const home = [profile.home_city, COUNTRY_BY_CODE.get(profile.home_country ?? '')?.name]
    .filter(Boolean)
    .join(', ');
  const socials = PLATFORMS.filter((p) => profile.socials[p.key]).map((p) => p.label);
  const value: Record<CardField, string> = {
    phone: profile.phone ?? '',
    emails: emails.join(', '),
    socials: socials.join(', '),
    home,
  };

  return (
    <section className="import-card">
      <h3>What your card carries</h3>
      <p className="muted">
        Only people you connect with get it. Your name is always included:{' '}
        <strong>{profile.display_name || 'not set'}</strong>. Edit the details in{' '}
        <Link to="/settings">Settings</Link>.
      </p>
      <div className="card-fields">
        {CARD_FIELDS.map((f) => (
          <label key={f.key} className="check">
            <input
              type="checkbox"
              checked={on(f.key)}
              onChange={() => toggle(f.key)}
              disabled={update.isPending}
            />
            <span>
              {f.label}
              <span className="muted"> - {value[f.key] || 'nothing entered yet'}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="muted small">
        Changes apply to people who connect from now on. Cards already handed over stay as they
        were.
      </p>
    </section>
  );
}

function LinkedMembers() {
  const { data: links } = useContactLinks();
  const { data: contacts = [] } = useContacts();
  const unlink = useUnlink();
  const linked = contacts.filter((c) => links?.has(c.id));

  return (
    <section className="import-card">
      <h3>Connected members</h3>
      {linked.length === 0 ? (
        <p className="muted">Nobody yet. People who accept your invite appear here.</p>
      ) : (
        <div className="people-list">
          {linked.map((c) => (
            <div key={c.id} className="person-row">
              <span className="person-name">{c.full_name}</span>
              <span className="muted person-place">{c.current_city ?? ''}</span>
              <button
                className="link"
                disabled={unlink.isPending}
                onClick={() => {
                  const ok = window.confirm(
                    `Disconnect from ${c.full_name}? You both keep the contact, but can no longer send each other visit notices or see each other's city.`,
                  );
                  if (ok) unlink.mutate(c.id);
                }}
              >
                Disconnect
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
