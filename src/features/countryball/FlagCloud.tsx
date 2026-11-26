import type { CSSProperties } from 'react';
import { LOCAL_FLAGS } from '../../lib/localFlags';
import { LocalFlagArt } from './LocalFlagArt';

// A regional or city flag in a small thought cloud beside a countryball. The
// ball keeps the person's national flag; the cloud says where in a country
// they are (Bavaria, Munich, Kraków ...). Shown once the map is zoomed in to
// city level, where regions mean something.
//
// It appears in two beats, bubbles then cloud, after `delay` ms, so a map
// full of clouds fills in one by one instead of all at once; then it drifts.

const INK = '#1b1b1f';
// In a 60 x 40 box; the cloud's left edge trails two bubbles down to the ball.
const PUFFS: [number, number, number][] = [
  [21, 15, 10], [33, 11, 11], [45, 15, 10], [27, 24, 9.5], [40, 24, 9.5], [15, 22, 6.5], [51, 22, 6.5],
];
const FLAG = { x: 19, y: 9, w: 28, h: 18.5 };

export function FlagCloud({
  flag,
  side = 'right',
  delay = 0,
  size = 1,
}: {
  /** Local flag id from lib/localFlags. */
  flag: string;
  side?: 'left' | 'right';
  delay?: number;
  /** Scale factor, 1 = for a 40px ball. */
  size?: number;
}) {
  const f = LOCAL_FLAGS.get(flag);
  if (!f) return null;
  const style = { '--cloud-delay': `${delay}ms`, '--cloud-scale': size } as CSSProperties;
  return (
    <span className={`cb-cloud ${side}`} style={style} title={f.name} aria-label={f.name} role="img">
      <svg width={60} height={40} viewBox="0 0 60 40" overflow="visible" aria-hidden="true">
        <g className="cb-cloud-bubbles">
          <circle cx={side === 'right' ? 5 : 55} cy={36} r={2.2} fill="#fff" stroke={INK} strokeWidth={1.3} />
          <circle cx={side === 'right' ? 9.5 : 50.5} cy={31} r={3.1} fill="#fff" stroke={INK} strokeWidth={1.3} />
        </g>
        <g className="cb-cloud-body">
          {/* every puff stroked, then every puff filled on top: only the outer edge shows */}
          {PUFFS.map(([cx, cy, r], i) => <circle key={`o${i}`} cx={cx} cy={cy} r={r} fill={INK} stroke={INK} strokeWidth={2.6} />)}
          {PUFFS.map(([cx, cy, r], i) => <circle key={`f${i}`} cx={cx} cy={cy} r={r} fill="#fff" />)}
          {/* the local flag, drawn from its ball artwork stretched to a 3:2 rectangle */}
          <svg x={FLAG.x} y={FLAG.y} width={FLAG.w} height={FLAG.h} viewBox="16 26 68 68" preserveAspectRatio="none">
            <LocalFlagArt art={f.art} />
          </svg>
          <rect x={FLAG.x} y={FLAG.y} width={FLAG.w} height={FLAG.h} rx={1.5} fill="none" stroke={INK} strokeWidth={0.8} opacity={0.45} />
        </g>
      </svg>
    </span>
  );
}
