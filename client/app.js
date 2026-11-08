// Entry point. Core behaviour always runs; the motion layer only runs when the
// visitor has not asked for reduced motion. The 3D bubbles load lazily on idle.
import { initCore } from './core.js';
import { initSound } from './fx/sound.js';

initCore();
initSound();

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!reduce) {
  document.documentElement.classList.add('fx');
  const [{ initScroll }, { initReveal }, { initTilt }, { initConfetti }] = await Promise.all([
    import('./fx/scroll.js'),
    import('./fx/reveal.js'),
    import('./fx/tilt.js'),
    import('./fx/confetti.js'),
  ]);
  initScroll();
  initReveal();
  initTilt();
  initConfetti();
  if (finePointer) (await import('./fx/cursor.js')).initCursor();

  const hero = document.querySelector('.hero');
  if (hero && hasWebGL()) {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    idle(() => import('./fx/bubbles3d.js').then((m) => m.initBubbles(hero)).catch(() => {}));
  }
}
