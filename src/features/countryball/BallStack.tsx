import type { CSSProperties } from 'react';
import { CountryBall } from './CountryBall';
import { FlagCloud } from './FlagCloud';
import { pickFaces, type Ball } from './faces';

/**
 * A map marker of countryballs.
 *  - one person: one ball
 *  - a group: two balls behind, one in front, and a yellow count badge; they
 *    roll together when the group forms
 *  - spread (zoomed far in): everyone in a ring around the place
 */
export function BallStack({
  balls,
  count,
  spread,
  selected,
  label,
}: {
  balls: Ball[];
  count: number;
  spread: boolean;
  selected?: boolean;
  label?: string;
}) {
  const cls = `cb-marker${selected ? ' selected' : ''}`;

  if (count <= 1 || balls.length <= 1) {
    const b = balls[0];
    return (
      <div className={`${cls} one`}>
        <CountryBall country={b?.country ?? null} look={b?.look} size={b?.look ? 40 : 34} />
        {b?.local && <FlagCloud flag={b.local} side={count > 1 ? 'left' : 'right'} delay={b.cloudDelay} />}
        {label && <span className="cb-you">{label}</span>}
        {count > 1 && <span className="cb-badge">{count}</span>}
      </div>
    );
  }

  if (spread) {
    const shown = balls.slice(0, 12);
    const r = 20 + shown.length * 3;
    // Everyone in a ring stands in one place, so one cloud per distinct flag is enough.
    const clouded = new Set<string>();
    const cloudFor = (b: Ball) => (b.local && !clouded.has(b.local) ? (clouded.add(b.local), b.local) : null);
    return (
      <div className={`${cls} spread`} style={{ width: r * 2 + 34, height: r * 2 + 34 }}>
        {shown.map((b, i) => {
          const a = (i / shown.length) * Math.PI * 2 - Math.PI / 2;
          const style = {
            '--dx': `${Math.cos(a) * r}px`,
            '--dy': `${Math.sin(a) * r}px`,
            animationDelay: `${i * 25}ms`,
          } as CSSProperties;
          return (
            <span key={b.key} className="cb-fan" style={style} title={b.name}>
              <CountryBall country={b.country} look={b.look} size={30} />
              {cloudFor(b) && <FlagCloud flag={b.local!} delay={(b.cloudDelay ?? 0) + i * 60} size={0.8} />}
            </span>
          );
        })}
        {count > shown.length && <span className="cb-badge center">+{count - shown.length}</span>}
      </div>
    );
  }

  const [front, back1, back2] = pickFaces(balls, 3);
  return (
    <div className={`${cls} stack`}>
      {back1 && <span className="cb-slot back-l"><CountryBall country={back1.country} look={back1.look} size={32} /></span>}
      {back2 && <span className="cb-slot back-r"><CountryBall country={back2.country} look={back2.look} size={32} /></span>}
      <span className="cb-slot front">
        <CountryBall country={front.country} look={front.look} size={40} />
        {front.local && <FlagCloud flag={front.local} side="left" delay={front.cloudDelay} />}
      </span>
      <span className="cb-badge">{count}</span>
    </div>
  );
}
