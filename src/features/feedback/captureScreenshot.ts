// Captures the whole page for a feedback note: everything a user can scroll to,
// not only the part on screen.
//
// modern-screenshot rather than html2canvas: it renders through an SVG
// foreignObject, so the browser itself lays out the CSS. html2canvas
// reimplements CSS and throws on color-mix(), which index.css uses throughout.
// Map canvases are copied pixel for pixel, which is why every MapLibre map is
// created with preserveDrawingBuffer (MAP_CANVAS_CONTEXT in lib/basemap.ts).
//
// The app shell is 100% high and scrolls inside <main class="content">, so a
// plain capture of <body> stops at the bottom of the window. In the copy that
// is rendered (never on the live page) the shell is let out to its full height
// and the scroll box shows all of its content.

/** Elements carrying this attribute (the feedback UI itself) are left out. */
export const FEEDBACK_UI_ATTR = 'data-feedback-ui';

// Past this the picture is so tall that the text is no longer readable once
// it is scaled to fit, so the bottom is cut instead.
const MAX_PAGE_HEIGHT = 20000;
// Output limits, in device pixels. Browsers refuse canvases much past 16k on a
// side, and the Storage bucket takes 5 MB.
const MAX_OUT_WIDTH = 2400;
const MAX_OUT_HEIGHT = 14000;
const MAX_BYTES = 4.5 * 1024 * 1024;

export interface Shot {
  blob: Blob;
  /** True when the page was taller than MAX_PAGE_HEIGHT and the bottom was cut. */
  cropped: boolean;
}

function important(el: Element | null, props: Record<string, string>) {
  if (!(el instanceof HTMLElement)) return;
  for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v, 'important');
}

/** Height of the page with every scroll box opened up, in CSS pixels. */
function fullPageHeight(): number {
  const vh = window.innerHeight;
  const doc = document.documentElement;
  let h = Math.max(vh, doc.scrollHeight);
  const content = document.querySelector<HTMLElement>('main.content');
  const sidebar = document.querySelector<HTMLElement>('.sidebar');
  if (content) {
    // The content box grows by what is hidden below its fold; whatever sits
    // after it (the sidebar on phones) moves down by the same amount.
    const hidden = Math.max(0, content.scrollHeight - content.clientHeight);
    h = Math.max(h, doc.scrollHeight + hidden);
  }
  if (sidebar) h = Math.max(h, sidebar.getBoundingClientRect().top + sidebar.scrollHeight);
  return Math.ceil(h);
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the screenshot'))),
      'image/jpeg',
      quality,
    ),
  );
}

export async function captureFullPage(): Promise<Shot> {
  const { domToCanvas } = await import('modern-screenshot');

  const width = document.documentElement.clientWidth;
  const pageHeight = fullPageHeight();
  const height = Math.min(pageHeight, MAX_PAGE_HEIGHT);
  const contentTop = document.querySelector('main.content')?.getBoundingClientRect().top ?? 0;
  const minContent = Math.max(0, window.innerHeight - contentTop);
  const shell = document.querySelector('.app-shell');
  const shellRows = shell ? getComputedStyle(shell).gridTemplateRows.split(' ').length : 1;

  const scale = Math.min(window.devicePixelRatio || 1, 2, MAX_OUT_WIDTH / width, MAX_OUT_HEIGHT / height);
  const bg = getComputedStyle(document.body).backgroundColor;

  const canvas = await domToCanvas(document.body, {
    width,
    height,
    scale,
    backgroundColor: bg,
    filter: (node) => !(node instanceof Element && node.hasAttribute(FEEDBACK_UI_ATTR)),
    onCloneNode: (clone) => {
      if (!(clone instanceof HTMLElement)) return;
      important(clone, { height: `${height}px`, overflow: 'hidden' });
      // Inside the picture there is nothing behind an element to blur, so a
      // backdrop-filter (the glass map panels and dialogs) paints black.
      const noGlass = document.createElement('style');
      noGlass.textContent = '* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
      clone.appendChild(noGlass);
      // The copied styles also freeze the grid rows at their on-screen pixel
      // sizes; make every row size to its content again (one row on desktop,
      // page plus bottom bar on phones).
      clone.querySelectorAll('.app-shell').forEach((el) =>
        important(el, { 'grid-template-rows': Array(shellRows).fill('auto').join(' ') }),
      );
      clone.querySelectorAll('#root, .app-shell').forEach((el) =>
        important(el, { height: 'auto', 'block-size': 'auto', 'min-height': `${height}px`, overflow: 'visible' }),
      );
      // The copied styles pin the sidebar to the window height; let the grid
      // stretch it down the whole picture.
      clone.querySelectorAll('.sidebar').forEach((el) => important(el, { height: 'auto', 'block-size': 'auto' }));
      // Map pages fill the content box with an absolutely placed map, so the
      // box keeps at least its on-screen height.
      clone.querySelectorAll('main.content').forEach((el) =>
        important(el, { height: 'auto', 'block-size': 'auto', 'min-height': `${minContent}px`, overflow: 'visible' }),
      );
    },
  });

  let blob = await toBlob(canvas, 0.82);
  if (blob.size > MAX_BYTES) blob = await toBlob(canvas, 0.6);
  if (blob.size > MAX_BYTES) throw new Error('The page is too large to capture');
  return { blob, cropped: pageHeight > MAX_PAGE_HEIGHT };
}
