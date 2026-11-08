// Booking success: a burst of paw prints and soap bubbles in the brand colours.
// Uses its own canvas and no Web Worker, so it works under the strict CSP.
import confetti from 'canvas-confetti';

// One path: a paw pad plus four toes.
const PAW = 'M12 21c-3.3 0-6-1.9-6-4.3 0-2.1 2.2-4.7 6-4.7s6 2.6 6 4.7c0 2.4-2.7 4.3-6 4.3z'
  + 'M2.3 11.6a2.3 2.9 0 1 0 4.6 0a2.3 2.9 0 1 0 -4.6 0z'
  + 'M6.9 7.4a2.3 2.9 0 1 0 4.6 0a2.3 2.9 0 1 0 -4.6 0z'
  + 'M12.5 7.4a2.3 2.9 0 1 0 4.6 0a2.3 2.9 0 1 0 -4.6 0z'
  + 'M17.1 11.6a2.3 2.9 0 1 0 4.6 0a2.3 2.9 0 1 0 -4.6 0z';

const COLORS = ['#1f6f64', '#5cc2b2', '#e76f51', '#ffb59e', '#b9a6f2', '#f2c38b'];

export function initConfetti() {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
  const paw = confetti.shapeFromPath({ path: PAW });

  document.addEventListener('tt:lead-success', ({ detail }) => {
    const r = detail?.rect;
    const origin = r
      ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
      : { x: 0.5, y: 0.6 };
    fire({ particleCount: 70, spread: 80, startVelocity: 42, origin, shapes: [paw], scalar: 1.6, colors: COLORS, ticks: 260 });
    fire({ particleCount: 50, spread: 120, startVelocity: 30, origin, shapes: ['circle'], scalar: 0.9, colors: ['#ffffff', '#d5ebe5', '#9fd8ff'], gravity: -0.25, drift: 0.4, ticks: 320 });
    setTimeout(() => {
      fire({ particleCount: 40, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, shapes: [paw], scalar: 1.4, colors: COLORS });
      fire({ particleCount: 40, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, shapes: [paw], scalar: 1.4, colors: COLORS });
    }, 250);
  });

  // A gentle "no" shake on validation errors.
  document.addEventListener('tt:form-error', () => {
    const form = document.getElementById('lead-form');
    form?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
      { duration: 420, easing: 'ease-out' },
    );
  });
}
