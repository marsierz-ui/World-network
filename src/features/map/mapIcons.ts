import type { ContactCategory } from '../../lib/database.types';

export const CATEGORY_RGB: Record<ContactCategory, [number, number, number]> = {
  work: [245, 158, 11],
  private: [34, 197, 94],
  other: [100, 116, 139],
};

export const CATEGORY_HEX: Record<ContactCategory, string> = {
  work: '#f59e0b',
  private: '#22c55e',
  other: '#64748b',
};

// White teardrop pin with a transparent hole (evenodd). Used as a tint mask in deck IconLayer.
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
  '<path fill="#fff" fill-rule="evenodd" d="M12 1c-4.4 0-8 3.6-8 8 0 5.4 8 14 8 14s8-8.6 8-14c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/>' +
  '</svg>';

export const PIN_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PIN_SVG)}`;

// Rasterize a category-colored pin for MapLibre's image registry (globe symbol layer).
export function makePinImage(hex: string, size = 48): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const s = size / 24;
  ctx.scale(s, s);
  const path = new Path2D(
    'M12 1c-4.4 0-8 3.6-8 8 0 5.4 8 14 8 14s8-8.6 8-14c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z',
  );
  ctx.fillStyle = hex;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.fill(path, 'evenodd');
  ctx.stroke(path);
  return canvas;
}
