// Custom cursor: a teal dot with a soap-bubble ring that swells over anything
// clickable, plus a trail of fading paw prints that trot along behind the pointer.
import { gsap } from './gsap.js';

const PAW = 'M12 21c-3.3 0-6-1.9-6-4.3 0-2.1 2.2-4.7 6-4.7s6 2.6 6 4.7c0 2.4-2.7 4.3-6 4.3z'
  + 'M2.3 11.6a2.3 2.9 0 1 0 4.6 0a2.3 2.9 0 1 0 -4.6 0z'
  + 'M6.9 7.4a2.3 2.9 0 1 0 4.6 0a2.3 2.9 0 1 0 -4.6 0z'
  + 'M12.5 7.4a2.3 2.9 0 1 0 4.6 0a2.3 2.9 0 1 0 -4.6 0z'
  + 'M17.1 11.6a2.3 2.9 0 1 0 4.6 0a2.3 2.9 0 1 0 -4.6 0z';

function svgPaw() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'paw-print');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', PAW);
  svg.appendChild(p);
  return svg;
}

export function initCursor() {
  const dot = document.createElement('div');
  const ring = document.createElement('div');
  dot.className = 'cursor-dot';
  ring.className = 'cursor-ring';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring, dot);
  document.documentElement.classList.add('has-cursor');

  const dx = gsap.quickSetter(dot, 'x', 'px');
  const dy = gsap.quickSetter(dot, 'y', 'px');
  const rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });

  // Paw print pool
  const layer = document.createElement('div');
  layer.className = 'paw-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const pool = Array.from({ length: 16 }, () => layer.appendChild(svgPaw()));
  let i = 0, lastX = 0, lastY = 0, side = 1;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    document.documentElement.classList.add('cursor-on');

    const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    if (dist < 70 || e.target.closest('.form, input, select, textarea')) return;
    const angle = Math.atan2(e.clientY - lastY, e.clientX - lastX);
    lastX = e.clientX; lastY = e.clientY;
    side *= -1;
    const off = 9 * side;
    const px = e.clientX + Math.cos(angle + Math.PI / 2) * off;
    const py = e.clientY + Math.sin(angle + Math.PI / 2) * off;
    const paw = pool[i++ % pool.length];
    gsap.killTweensOf(paw);
    gsap.fromTo(paw,
      { x: px - 9, y: py - 9, rotation: (angle * 180) / Math.PI + 90, scale: 0.4, autoAlpha: 0.55 },
      { scale: 1, duration: 0.25, ease: 'back.out(3)', onComplete: () => gsap.to(paw, { autoAlpha: 0, duration: 1.4, delay: 0.3 }) });
  }, { passive: true });

  document.addEventListener('pointerleave', () => document.documentElement.classList.remove('cursor-on'));

  const HOT = 'a, button, select, label, summary, input[type="checkbox"], input[type="range"], .chip';
  document.addEventListener('pointerover', (e) => {
    ring.classList.toggle('hot', Boolean(e.target.closest(HOT)));
    ring.classList.toggle('text', Boolean(e.target.closest('input:not([type="checkbox"]):not([type="range"]), textarea')));
  });
  document.addEventListener('pointerdown', () => gsap.fromTo(ring, { scale: 0.75 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }));
}
