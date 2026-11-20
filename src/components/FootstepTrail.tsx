import { useEffect, useRef } from 'react';

// Footprints that walk along the mouse track and fade out behind it.
const STRIDE = 36; // px of pointer travel per step
const SPREAD = 7; // px each foot sits off the walking line
const LIFE = 1600; // ms until a print is gone
const MAX = 14; // prints on screen at once

type Print = { x: number; y: number; a: number; t: number };

function drawFoot(ctx: CanvasRenderingContext2D, p: Print, alpha: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a + Math.PI / 2);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(0, -4, 4.4, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 8.5, 3.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function FootstepTrail() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const prints: Print[] = [];
    let last: { x: number; y: number } | null = null;
    let travelled = 0;
    let left = false;
    let raf = 0;
    let color = '';

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      while (prints.length && now - prints[0].t > LIFE) prints.shift();
      ctx.fillStyle = color;
      for (const p of prints) drawFoot(ctx, p, 0.55 * (1 - (now - p.t) / LIFE));
      raf = prints.length ? requestAnimationFrame(frame) : 0;
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const { clientX: x, clientY: y } = e;
      if (!last) { last = { x, y }; return; }
      const dx = x - last.x;
      const dy = y - last.y;
      const d = Math.hypot(dx, dy);
      if (d > 200) { last = { x, y }; travelled = 0; return; } // jumped, do not draw a stride across
      travelled += d;
      if (travelled >= STRIDE && d > 0) {
        travelled = 0;
        const a = Math.atan2(dy, dx);
        const side = left ? -SPREAD : SPREAD;
        left = !left;
        prints.push({ x: x - Math.sin(a) * side, y: y + Math.cos(a) * side, a, t: performance.now() });
        if (prints.length > MAX) prints.shift();
        if (!raf) {
          color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
          raf = requestAnimationFrame(frame);
        }
      }
      last = { x, y };
    };

    const leave = () => { last = null; };

    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
    };
  }, []);

  return <canvas ref={ref} className="footsteps" aria-hidden="true" />;
}
