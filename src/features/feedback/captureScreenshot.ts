// Captures what the user is looking at, cropped to the area they selected.
//
// modern-screenshot rather than html2canvas (which attention-tracker uses): it
// renders through an SVG foreignObject, so the browser itself lays out the CSS -
// html2canvas reimplements CSS and throws on color-mix(), which index.css uses
// throughout. Map canvases are copied pixel for pixel, which is why every
// MapLibre map is created with preserveDrawingBuffer (MAP_CANVAS_CONTEXT in
// lib/basemap.ts); without it WebGL clears the buffer after each frame and the
// map would come out blank.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Elements carrying this attribute (the feedback UI itself) are left out. */
export const FEEDBACK_UI_ATTR = 'data-feedback-ui';

// Enough to read any label on screen; bigger only costs upload time.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export async function captureArea(rect: Rect | null): Promise<Blob> {
  const { domToCanvas } = await import('modern-screenshot');

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // A tap or a sliver of a drag means "the whole screen".
  const area = rect && rect.w > 12 && rect.h > 12 ? rect : { x: 0, y: 0, w: vw, h: vh };

  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const bg = getComputedStyle(document.body).backgroundColor;
  const full = await domToCanvas(document.body, {
    width: vw,
    height: vh,
    scale,
    backgroundColor: bg,
    filter: (node) => !(node instanceof Element && node.hasAttribute(FEEDBACK_UI_ATTR)),
  });

  const fit = Math.min(1, MAX_EDGE / Math.max(area.w * scale, area.h * scale));
  const out = document.createElement('canvas');
  out.width = Math.round(area.w * scale * fit);
  out.height = Math.round(area.h * scale * fit);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(
    full,
    area.x * scale,
    area.y * scale,
    area.w * scale,
    area.h * scale,
    0,
    0,
    out.width,
    out.height,
  );

  return new Promise((resolve, reject) =>
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the screenshot'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );
}
