import type { Emblem, FlagArt } from '../../lib/localFlags';

// Draws a regional or city flag into the countryball's box (the ball is a
// circle of radius 34 at 50,60, so the flag fills x 16..84, y 26..94). Emblems
// sit low, under the eyes, so they stay visible.

const X0 = 16, Y0 = 26, S = 68, CX = 50, CY = 60;
const EY = 77; // emblem centre, below the eyes
const INK = '#1b1b1f';

export function LocalFlagArt({ art }: { art: FlagArt }) {
  return (
    <>
      <Field art={art} />
      {art.e?.map((e, i) => <EmblemShape key={i} e={e} />)}
    </>
  );
}

function Field({ art }: { art: FlagArt }) {
  const { s, d = 'h' } = art;
  if (s.length === 1) return <rect x={0} y={0} width={100} height={100} fill={s[0]} />;
  if (d === 'd' || d === 'd2') {
    // d: line from upper hoist to lower fly, s[0] above it. d2: lower hoist to upper fly, s[0] above it.
    const upper = d === 'd' ? `${X0},${Y0} ${X0 + S},${Y0} ${X0 + S},${Y0 + S}` : `${X0},${Y0} ${X0 + S},${Y0} ${X0},${Y0 + S}`;
    return (
      <>
        <rect x={0} y={0} width={100} height={100} fill={s[1]} />
        <polygon points={upper} fill={s[0]} />
      </>
    );
  }
  const w = art.w ?? s.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const starts = w.map((_, i) => w.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <>
      {s.map((c, i) => {
        const start = (starts[i] / total) * S;
        const size = (w[i] / total) * S + 0.5;
        return d === 'v' ? (
          <rect key={i} x={X0 + start} y={0} width={size} height={100} fill={c} />
        ) : (
          <rect key={i} x={0} y={Y0 + start} width={100} height={size} fill={c} />
        );
      })}
    </>
  );
}

function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
}

function EmblemShape({ e }: { e: Emblem }) {
  const ex = e.hoist ? X0 + 12 : CX;
  const ey = e.hoist ? CY - 14 : EY;
  switch (e.k) {
    case 'disc':
      return <circle cx={ex} cy={ey} r={8} fill={e.c} stroke={e.c2} strokeWidth={e.c2 ? 2.5 : 0} />;
    case 'shield':
      return (
        <path
          d={`M${ex - 8} ${ey - 9} H${ex + 8} V${ey} Q${ex + 8} ${ey + 7} ${ex} ${ey + 10} Q${ex - 8} ${ey + 7} ${ex - 8} ${ey} Z`}
          fill={e.c}
          stroke={e.c2 ?? INK}
          strokeWidth={1.6}
        />
      );
    case 'star':
      return <polygon points={star(ex, ey, e.hoist ? 7 : 9)} fill={e.c} />;
    case 'cross':
      return (
        <>
          <rect x={0} y={CY - 6} width={100} height={12} fill={e.c} />
          <rect x={CX - 6} y={0} width={12} height={100} fill={e.c} />
        </>
      );
    case 'saltire':
      return (
        <g stroke={e.c} strokeWidth={11}>
          <line x1={X0} y1={Y0} x2={X0 + S} y2={Y0 + S} />
          <line x1={X0 + S} y1={Y0} x2={X0} y2={Y0 + S} />
        </g>
      );
    case 'canton':
      return (
        <>
          <rect x={0} y={0} width={CX} height={CY - 4} fill={e.c} />
          {e.c2 && (
            <>
              <rect x={X0 + 12} y={Y0 + 12} width={14} height={4} fill={e.c2} />
              <rect x={X0 + 17} y={Y0 + 7} width={4} height={14} fill={e.c2} />
            </>
          )}
        </>
      );
    case 'hoist':
      return <rect x={0} y={0} width={X0 + S * 0.3} height={100} fill={e.c} />;
    case 'triangle':
      return <polygon points={`${X0 - 4},${Y0 - 4} ${X0 - 4},${Y0 + S + 4} ${X0 + S * 0.6},${CY}`} fill={e.c} />;
    case 'bend':
      return <line x1={X0} y1={Y0} x2={X0 + S} y2={Y0 + S} stroke={e.c} strokeWidth={12} />;
    case 'diamond':
      return (
        <polygon
          points={`${CX},${CY - 22} ${CX + 24},${CY + 4} ${CX},${CY + 30} ${CX - 24},${CY + 4}`}
          fill={e.c}
          stroke={e.c2}
          strokeWidth={e.c2 ? 3 : 0}
        />
      );
    case 'bar':
      return <rect x={CX - 4} y={CY + 2} width={8} height={30} rx={2} fill={e.c} />;
    case 'quarter':
      return (
        <>
          <rect x={0} y={0} width={CX} height={CY} fill={e.c} />
          <rect x={CX} y={CY} width={CX} height={40} fill={e.c} />
          <rect x={CX} y={0} width={CX} height={CY} fill={e.c2} />
          <rect x={0} y={CY} width={CX} height={40} fill={e.c2} />
        </>
      );
    case 'lozenge': {
      const cells = [];
      for (let y = Y0 - 6, row = 0; y < Y0 + S + 6; y += 9, row++) {
        for (let x = X0 - 6 + (row % 2) * 9; x < X0 + S + 6; x += 18) {
          cells.push(`M${x} ${y - 4.5} L${x + 6.5} ${y} L${x} ${y + 4.5} L${x - 6.5} ${y} Z`);
        }
      }
      return <path d={cells.join(' ')} fill={e.c} />;
    }
  }
}
