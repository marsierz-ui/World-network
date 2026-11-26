import { useEffect, useRef } from 'react';
import './footsteps.js';

// Footprints that walk along the mouse track and fade out behind it, with rare random
// variants (bare feet, sneakers, heels, mud, paws, bird tracks, hooves). Shared xTrails
// background motion; the drawing lives in footsteps.js next to this file.
// The parent needs `isolation: isolate` (or any stacking context) if it has its own background.

export type FootstepVariant = 'shoe' | 'bare' | 'sneaker' | 'heel' | 'mud' | 'paw' | 'bird' | 'hoof';
declare global {
  interface Window {
    xtFootsteps?: { start(canvas: HTMLCanvasElement, opts?: { special?: FootstepVariant; variant?: FootstepVariant }): () => void };
  }
}

export function FootstepTrail({ special }: { special?: FootstepVariant }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || !window.xtFootsteps) return;
    return window.xtFootsteps.start(ref.current, { special });
  }, [special]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: -1, pointerEvents: 'none' }}
    />
  );
}
