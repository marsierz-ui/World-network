import { useId, useState, type ReactNode } from 'react';
import { flagImageUrl } from '../map/mapIcons';
import { FLAG_COLORS } from '../../lib/flagColors';
import type { BallLook } from './look';

// A countryball: a round ball printed with its national flag (a regional or
// city flag, when known, floats beside it in a FlagCloud), a dark outline and the
// classic white eyes. Members can dress their own one up (hair, eyes, glasses,
// hat); everyone else is drawn plain.
//
// Drawn in a 100x100 box: the ball sits low (centre 50,60, radius 34) so hair
// and hats have room above it.

const INK = '#1b1b1f';
const CX = 50, CY = 60, R = 34;
const EYE_L = { x: 39, y: 57 }, EYE_R = { x: 61, y: 57 };

interface Props {
  /** ISO alpha-2, any case. Null draws a neutral ball. */
  country: string | null;
  look?: BallLook | null;
  size?: number;
  title?: string;
  className?: string;
  /** Position when nested inside another SVG. */
  x?: number;
  y?: number;
}

export function CountryBall({ country, look, size = 40, title, className, x, y }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const code = (look?.country ?? country ?? '').toUpperCase();
  const [failed, setFailed] = useState<string | null>(null);
  const useImage = code.length === 2 && failed !== code;
  const clip = `cb-${uid}`;
  return (
    <svg
      className={className ? `countryball ${className}` : 'countryball'}
      width={size}
      height={size}
      x={x}
      y={y}
      viewBox="0 0 100 100"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
      </defs>
      <ellipse cx={CX} cy={97} rx={22} ry={2.6} fill={INK} opacity={0.18} />
      <g clipPath={`url(#${clip})`}>
        {useImage ? (
          <>
            <Stripes code={code} />
            <image
              href={flagImageUrl(code.toLowerCase())}
              x={CX - R}
              y={CY - R}
              width={R * 2}
              height={R * 2}
              preserveAspectRatio="xMidYMid slice"
              onError={() => setFailed(code)}
            />
          </>
        ) : (
          <Stripes code={code} />
        )}
        {/* soft print shading: a highlight top left, a shade bottom right */}
        <ellipse cx={38} cy={42} rx={14} ry={9} fill="#fff" opacity={0.18} />
        <circle cx={CX + 10} cy={CY + 12} r={R} fill={INK} opacity={0.08} />
      </g>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={INK} strokeWidth={3} />
      {look && <Hair look={look} />}
      <Eyes kind={look?.eyes ?? 'classic'} uid={uid} />
      {look && <Glasses kind={look.glasses} />}
      {look && <Hat kind={look.hat} />}
    </svg>
  );
}

/** Before (or instead of) the real flag image: the flag's dominant colours as bands, or neutral grey. */
function Stripes({ code }: { code: string }) {
  const colors = FLAG_COLORS[code];
  if (!colors?.length) return <rect x={0} y={0} width={100} height={100} fill="#d9dcd8" />;
  const h = (R * 2) / colors.length;
  return (
    <>
      {colors.map((c, i) => (
        <rect key={i} x={0} y={CY - R + i * h} width={100} height={h + 0.5} fill={c} />
      ))}
    </>
  );
}

function Eyes({ kind, uid }: { kind: BallLook['eyes']; uid: string }) {
  const white = { fill: '#fff', stroke: INK, strokeWidth: 2.2 } as const;
  const oval = (p: { x: number; y: number }) => <ellipse cx={p.x} cy={p.y} rx={7.5} ry={9} {...white} />;
  const happy = (p: { x: number; y: number }) => (
    <path d={`M${p.x - 7.5} ${p.y + 3} Q${p.x} ${p.y - 11} ${p.x + 7.5} ${p.y + 3} Q${p.x} ${p.y - 3} ${p.x - 7.5} ${p.y + 3}Z`} {...white} />
  );
  switch (kind) {
    case 'happy':
      return <>{happy(EYE_L)}{happy(EYE_R)}</>;
    case 'sleepy':
      return (
        <>
          {[EYE_L, EYE_R].map((p, i) => (
            <path key={i} d={`M${p.x - 7.5} ${p.y} A7.5 8.5 0 0 0 ${p.x + 7.5} ${p.y} Z`} {...white} />
          ))}
        </>
      );
    case 'stern': {
      // inner corners cut lower, like a frown
      const cut = (p: { x: number; y: number }, inner: number) => {
        const id = `cbs-${uid}-${inner}`;
        // top edge of the visible eye: low at the inner corner (towards the nose)
        const yl = inner > 0 ? p.y - 8 : p.y - 1, yr = inner > 0 ? p.y - 1 : p.y - 8;
        return (
          <g key={id}>
            <clipPath id={id}>
              <polygon points={`${p.x - 12},${p.y + 12} ${p.x + 12},${p.y + 12} ${p.x + 12},${yr} ${p.x - 12},${yl}`} />
            </clipPath>
            <ellipse cx={p.x} cy={p.y} rx={7.5} ry={9} fill="#fff" stroke={INK} strokeWidth={2.2} clipPath={`url(#${id})`} />
            <line x1={p.x - 8} x2={p.x + 8} y1={yl} y2={yr} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          </g>
        );
      };
      return <>{cut(EYE_L, 1)}{cut(EYE_R, -1)}</>;
    }
    case 'wink':
      return (
        <>
          {oval(EYE_L)}
          <path d={`M${EYE_R.x - 7} ${EYE_R.y + 1} Q${EYE_R.x} ${EYE_R.y - 7} ${EYE_R.x + 7} ${EYE_R.y + 1}`} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
        </>
      );
    case 'dots':
      return (
        <>
          {oval(EYE_L)}{oval(EYE_R)}
          <circle cx={EYE_L.x + 1.5} cy={EYE_L.y + 2} r={2.8} fill={INK} />
          <circle cx={EYE_R.x + 1.5} cy={EYE_R.y + 2} r={2.8} fill={INK} />
        </>
      );
    default:
      return <>{oval(EYE_L)}{oval(EYE_R)}</>;
  }
}

function Glasses({ kind }: { kind: BallLook['glasses'] }) {
  const s = { fill: 'none', stroke: INK, strokeWidth: 2.4 } as const;
  const temples = <path d={`M${EYE_L.x - 10} ${EYE_L.y - 2} L18 52 M${EYE_R.x + 10} ${EYE_R.y - 2} L82 52`} {...s} />;
  switch (kind) {
    case 'round':
      return (
        <g>
          <circle cx={EYE_L.x} cy={EYE_L.y} r={10} {...s} fill="#fff" fillOpacity={0.12} />
          <circle cx={EYE_R.x} cy={EYE_R.y} r={10} {...s} fill="#fff" fillOpacity={0.12} />
          <path d={`M${EYE_L.x + 10} ${EYE_L.y - 1} Q50 ${EYE_L.y - 5} ${EYE_R.x - 10} ${EYE_R.y - 1}`} {...s} />
          {temples}
        </g>
      );
    case 'square':
      return (
        <g>
          <rect x={EYE_L.x - 10} y={EYE_L.y - 9} width={20} height={17} rx={3} {...s} fill="#fff" fillOpacity={0.12} />
          <rect x={EYE_R.x - 10} y={EYE_R.y - 9} width={20} height={17} rx={3} {...s} fill="#fff" fillOpacity={0.12} />
          <line x1={EYE_L.x + 10} x2={EYE_R.x - 10} y1={EYE_L.y - 3} y2={EYE_R.y - 3} {...s} />
          {temples}
        </g>
      );
    case 'shades':
      return (
        <g>
          <path d={`M${EYE_L.x - 11} ${EYE_L.y - 8} H${EYE_R.x + 11} V${EYE_R.y - 2} Q${EYE_R.x + 10} ${EYE_R.y + 9} ${EYE_R.x} ${EYE_R.y + 8} Q${EYE_R.x - 9} ${EYE_R.y + 7} ${EYE_R.x - 10} ${EYE_R.y - 2} H${EYE_L.x + 10} Q${EYE_L.x + 9} ${EYE_L.y + 7} ${EYE_L.x} ${EYE_L.y + 8} Q${EYE_L.x - 10} ${EYE_L.y + 9} ${EYE_L.x - 11} ${EYE_L.y - 2} Z`} fill={INK} />
          <path d={`M${EYE_L.x - 6} ${EYE_L.y - 4} L${EYE_L.x - 2} ${EYE_L.y - 4} M${EYE_R.x - 6} ${EYE_R.y - 4} L${EYE_R.x - 2} ${EYE_R.y - 4}`} stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
          {temples}
        </g>
      );
    case 'monocle':
      return (
        <g>
          <circle cx={EYE_R.x} cy={EYE_R.y} r={10.5} fill="#fff" fillOpacity={0.12} stroke="#b8901c" strokeWidth={2.6} />
          <path d={`M${EYE_R.x + 7} ${EYE_R.y + 8} Q${EYE_R.x + 14} ${EYE_R.y + 22} ${EYE_R.x + 4} 92`} fill="none" stroke="#b8901c" strokeWidth={1.4} />
        </g>
      );
    default:
      return null;
  }
}

function Hair({ look }: { look: BallLook }) {
  const s = { fill: look.hairColor, stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const };
  let shape: ReactNode = null;
  switch (look.hair) {
    case 'spiky':
      shape = <path d="M21 46 L24 26 L32 36 L37 17 L45 31 L50 12 L55 31 L63 17 L68 36 L76 26 L79 46 Q50 30 21 46 Z" {...s} />;
      break;
    case 'bob':
      shape = <path d="M16 64 C12 22 88 22 84 64 L78 64 C78 46 66 37 50 37 C34 37 22 46 22 64 Z" {...s} />;
      break;
    case 'curly': {
      const dots = [200, 222, 244, 266, 288, 310, 332, 354, 186].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return [CX + Math.cos(a) * (R - 2), CY + Math.sin(a) * (R - 2)];
      });
      shape = <g>{dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={8.5} {...s} />)}</g>;
      break;
    }
    case 'bun':
      shape = (
        <g>
          <circle cx={50} cy={19} r={9} {...s} />
          <path d="M18 54 C16 24 84 24 82 54 C78 40 64 34 50 34 C36 34 22 40 18 54 Z" {...s} />
        </g>
      );
      break;
    case 'mohawk':
      shape = <path d="M43 30 L40 18 L46 22 L46 8 L51 18 L54 6 L56 20 L61 14 L58 30 Q50 26 43 30 Z" {...s} />;
      break;
    case 'long':
      shape = <path d="M15 64 C10 20 90 20 85 64 L87 90 L77 90 L77 54 C72 42 62 36 50 36 C38 36 28 42 23 54 L23 90 L13 90 Z" {...s} />;
      break;
  }
  return shape;
}

function Hat({ kind }: { kind: BallLook['hat'] }) {
  const s = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'cap':
      return (
        <g>
          <path d="M20 40 C22 12 78 12 80 40 Z" fill="#0078bf" {...s} />
          <path d="M66 38 L97 41 Q97 46 92 46 L64 44 Z" fill="#0078bf" {...s} />
          <circle cx={50} cy={16} r={2.5} fill="#ff48b0" />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d="M19 42 C19 10 81 10 81 42 Z" fill="#ff48b0" {...s} />
          <rect x={17} y={36} width={66} height={10} rx={4} fill="#d93a95" {...s} />
          <circle cx={50} cy={10} r={6.5} fill="#ffe800" {...s} />
        </g>
      );
    case 'tophat':
      return (
        <g>
          <rect x={33} y={2} width={34} height={30} rx={2} fill={INK} />
          <rect x={33} y={23} width={34} height={6} fill="#ff48b0" />
          <ellipse cx={50} cy={32} rx={31} ry={5} fill={INK} />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path d="M27 36 L29 12 L39 24 L50 6 L61 24 L71 12 L73 36 Z" fill="#ffd23f" {...s} />
          <circle cx={50} cy={28} r={3} fill="#ff48b0" />
          <circle cx={38} cy={30} r={2.2} fill="#0078bf" />
          <circle cx={62} cy={30} r={2.2} fill="#0078bf" />
        </g>
      );
    case 'headphones':
      return (
        <g>
          <path d="M17 58 C13 14 87 14 83 58" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <rect x={9} y={50} width={12} height={20} rx={5} fill="#ff48b0" {...s} />
          <rect x={79} y={50} width={12} height={20} rx={5} fill="#ff48b0" {...s} />
        </g>
      );
    case 'flower':
      return (
        <g transform="translate(73 30)">
          {[0, 72, 144, 216, 288].map((d) => (
            <circle key={d} cx={Math.cos((d * Math.PI) / 180) * 6} cy={Math.sin((d * Math.PI) / 180) * 6} r={5} fill="#ff48b0" {...s} strokeWidth={1.4} />
          ))}
          <circle r={4} fill="#ffe800" {...s} strokeWidth={1.4} />
        </g>
      );
    default:
      return null;
  }
}
