import { useEffect, useState } from 'react';
import { useAuth } from './authContext';
import { pendingInvite } from '../card/invite';
import { TrailMark, Wordmark } from '../../components/TrailMark';
import { CountUp } from '../../components/CountUp';
import { FootstepTrail } from '../../components/FootstepTrail';
import { CountryBall } from '../countryball/CountryBall';
import type { BallLook } from '../countryball/look';

// Tilts the hero map toward a mouse pointer; touch input leaves it flat.
function tilt(e: React.PointerEvent<HTMLDivElement>) {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
  el.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
  el.style.setProperty('--lift', '-3px');
}

function untilt(e: React.PointerEvent<HTMLDivElement>) {
  for (const p of ['--rx', '--ry', '--lift']) e.currentTarget.style.removeProperty(p);
}

function spotlight(e: React.PointerEvent<HTMLDivElement>) {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.lp-card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
}

// Illustrative cities for the signed-out demo; nothing here is real user data.
const HOME = { name: 'Berlin', x: 330, y: 84 };
const CITIES = [
  { name: 'Lisbon', n: 7, x: 236, y: 150, flags: ['PT', 'BR', 'ES'] },
  { name: 'New York', n: 31, x: 112, y: 122, flags: ['US', 'IE', 'IN'] },
  { name: 'Singapore', n: 18, x: 462, y: 204, flags: ['SG', 'MY', 'CN'] },
  { name: 'Sydney', n: 6, x: 516, y: 262, flags: ['AU', 'NZ', 'GB'] },
];

// Example looks for the demo only.
const ME_LOOK: BallLook = { hair: 'spiky', hairColor: '#2a1b12', eyes: 'happy', glasses: 'round', hat: 'none', country: null };
const CROWD: { country: string; look: BallLook }[] = [
  { country: 'PL', look: { hair: 'bob', hairColor: '#e0b04a', eyes: 'classic', glasses: 'none', hat: 'flower', country: null } },
  { country: 'JP', look: { hair: 'none', hairColor: '#2a1b12', eyes: 'stern', glasses: 'shades', hat: 'cap', country: null } },
  { country: 'BR', look: { hair: 'curly', hairColor: '#6b3f1f', eyes: 'happy', glasses: 'none', hat: 'headphones', country: null } },
  { country: 'FR', look: { hair: 'mohawk', hairColor: '#ff48b0', eyes: 'wink', glasses: 'none', hat: 'none', country: null } },
  { country: 'GB', look: { hair: 'none', hairColor: '#9aa0a6', eyes: 'sleepy', glasses: 'monocle', hat: 'tophat', country: null } },
];

// A group of up to three countryballs (two behind, one in front) with a count badge.
function DemoGroup({ x, y, flags, n }: { x: number; y: number; flags: string[]; n: number }) {
  return (
    <g className="lp-group">
      <CountryBall country={flags[1]} size={28} x={x - 25} y={y - 25} />
      <CountryBall country={flags[2]} size={28} x={x - 3} y={y - 25} />
      <CountryBall country={flags[0]} size={34} x={x - 17} y={y - 20} />
      <g className="lp-badge">
        <circle className="s" cx={x + 19} cy={y - 15} r={10} />
        <circle className="b" cx={x + 17.5} cy={y - 16.5} r={10} />
        <text x={x + 17.5} y={y - 12} textAnchor="middle">{n}</text>
      </g>
    </g>
  );
}

function DemoMap({ city, onPick }: { city: number; onPick: (i: number) => void }) {
  const c = CITIES[city];
  const trail = `M${HOME.x} ${HOME.y} Q ${(HOME.x + c.x) / 2} ${Math.min(HOME.y, c.y) - 46} ${c.x} ${c.y}`;
  return (
    <div className="lp-demo" onPointerMove={tilt} onPointerLeave={untilt}>
      <svg viewBox="0 0 580 300" role="img" aria-label={`Example map: a trail from ${HOME.name} to ${c.name}`}>
        <g className="lp-grid">
          {[60, 120, 180, 240].map((y) => <line key={y} x1="0" x2="580" y1={y} y2={y} />)}
          {[58, 116, 174, 232, 290, 348, 406, 464, 522].map((x) => <line key={x} y1="0" y2="300" x1={x} x2={x} />)}
        </g>
        {/* key restarts the draw animation each time another city is picked */}
        <g key={c.name}>
          <mask id="lp-trail-mask" maskUnits="userSpaceOnUse">
            <path className="lp-trail-mask" d={trail} pathLength={1} />
          </mask>
          <path className="lp-trail" d={trail} mask="url(#lp-trail-mask)" />
          <circle className="lp-pulse" cx={c.x} cy={c.y} r="12" />
        </g>
        <g className="lp-home">
          <CountryBall country="DE" look={ME_LOOK} size={40} x={HOME.x - 20} y={HOME.y - 28} />
          <text x={HOME.x} y={HOME.y + 26} textAnchor="middle">You, {HOME.name}</text>
        </g>
        {CITIES.map((p, i) => (
          <g key={p.name} className={i === city ? 'lp-city active' : 'lp-city'} onClick={() => onPick(i)}>
            <circle className="lp-hit" cx={p.x} cy={p.y - 6} r={24} />
            <DemoGroup x={p.x} y={p.y} flags={p.flags} n={p.n} />
            <text x={p.x} y={p.y + 28} textAnchor="middle">{p.name}</text>
          </g>
        ))}
      </svg>
      <div className="lp-demo-foot">
        <span className="lp-demo-count">
          <CountUp value={c.n} /> people you know live in <span key={c.name} className="lp-demo-city">{c.name}</span>
        </span>
        <span className="lp-demo-tag">Example</span>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [city, setCity] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fn = mode === 'in' ? signInWithEmail : signUpWithEmail;
    const { error } = await fn(email, password);
    setError(error);
    setBusy(false);
  }

  return (
    <div className="landing">
      <FootstepTrail special="sneaker" />
      <div className="lp-wrap">
        <header className={scrolled ? 'lp-nav scrolled lg' : 'lp-nav'}>
          <span className="lp-brand"><TrailMark size={32} /><Wordmark /></span>
          <a className="lp-link" href="#does">What it does</a>
          <a className="lp-link" href="#data">Your data</a>
          <a className="lp-btn" href="#signin">Sign in</a>
        </header>

        <section className="lp-hero">
          <div className="lp-copy">
            <h1>Know who you know, wherever you land.</h1>
            <p>
              CrowdTrails puts your contacts on a world map. Open it in a new city and it shows
              who lives there, so you can say hello before you fly home.
            </p>
            <div className="lp-crowd" aria-hidden="true">
              {CROWD.map((b) => (
                <CountryBall key={b.country} country={b.country} look={b.look} size={52} />
              ))}
            </div>
            <div className="lp-pick">
              <span className="lp-pick-label">Where are you landing?</span>
              <div className="lp-chips">
                {CITIES.map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    className={i === city ? 'lp-chip active' : 'lp-chip'}
                    aria-pressed={i === city}
                    onClick={() => setCity(i)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <DemoMap city={city} onPick={setCity} />
          </div>

          <aside className="lp-sign" id="signin">
            <h2>{mode === 'in' ? 'Open your map' : 'Create your account'}</h2>
            {pendingInvite() && (
              <p className="invite-note">
                You have been invited to connect. Sign in or create an account to see the invite.
              </p>
            )}
            <button className="btn-google" onClick={signInWithGoogle}>
              Continue with Google
            </button>
            <p className="muted small">
              With Google, the app asks to read and update your contacts, to place them on the
              map and keep them in sync. Nothing else.
            </p>
            <div className="divider">or</div>
            <form onSubmit={submit}>
              <input
                type="email"
                placeholder="Email"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <div className="error">{error}</div>}
              <button type="submit" disabled={busy}>
                {mode === 'in' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </aside>
        </section>

        <section className="lp-section" id="does">
          <span className="lp-eyebrow">What it does</span>
          <h2>Three moments it is built for</h2>
          <div className="lp-cards" onPointerMove={spotlight}>
            <div className="lp-card lp-reveal">
              <span className="lp-card-kicker">On arrival</span>
              <h3>You arrive. It tells you who is there.</h3>
              <p>
                Tick who should hear from you and send one notice. People on CrowdTrails see it
                in the app. For everyone else it opens your own mail or messaging app.
              </p>
            </div>
            <div className="lp-card lp-reveal">
              <span className="lp-card-kicker">Google, LinkedIn, CSV</span>
              <h3>Import once. Stay in sync.</h3>
              <p>
                No typing people in. Bring your address book, and edits flow both ways with
                Google. Duplicates are found and merged with your approval.
              </p>
            </div>
            <div className="lp-card lp-reveal">
              <span className="lp-card-kicker">In person</span>
              <h3>Meet someone. Swap cards by QR.</h3>
              <p>
                They scan your code and each of you gets the other as a contact. You choose
                which details your card carries, and you can retire the code at any time.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-section" id="data">
          <div className="lp-trust lp-reveal">
            <span className="lp-eyebrow">Your data</span>
            <h2>An address book is private. We treat it that way.</h2>
            <div className="lp-facts">
              <div className="lp-fact">
                <strong>A city, never a position</strong>
                <span>
                  Your position is matched to a city on your device. Only the city is stored,
                  with no history, and location is off until you turn it on.
                </span>
              </div>
              <div className="lp-fact">
                <strong>Your rows only</strong>
                <span>
                  Every table sits behind row-level security. A signed-in person reaches their
                  own contacts and nothing else.
                </span>
              </div>
              <div className="lp-fact">
                <strong>Nothing is sent for you</strong>
                <span>
                  CrowdTrails sends no email or SMS itself. Messages to people outside the app
                  leave from your own mail or messaging app.
                </span>
              </div>
              <div className="lp-fact">
                <strong>30 days to change your mind</strong>
                <span>
                  Deleting your account starts a 30-day grace period. After it, everything is
                  removed.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-end lp-reveal">
          <h2>Your address book is already a map. Open it.</h2>
          <a className="lp-btn big" href="#signin">Put my contacts on the map</a>
          <span className="muted">Works in the browser and installs on iPhone and Android.</span>
        </section>

        <footer className="lp-foot">
          <span>CrowdTrails, an xTrails app</span>
          <a href={`${import.meta.env.BASE_URL}privacy.html`}>Privacy Policy</a>
          <a href={`${import.meta.env.BASE_URL}terms.html`}>Terms of Service</a>
        </footer>
      </div>
    </div>
  );
}
