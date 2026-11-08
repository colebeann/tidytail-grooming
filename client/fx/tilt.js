// 3D tilt with a soap-film glare on cards, and "magnetic" buttons that lean toward the cursor.
import { gsap } from './gsap.js';
import { $$ } from '../core.js';

export function initTilt() {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  $$('.card, .plan, .report, .promise, .review').forEach((el) => {
    el.classList.add('tilt');
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3' });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      ry((x - 0.5) * 10);
      rx((0.5 - y) * 10);
      el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  $$('.btn').forEach((btn) => {
    const x = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
    const y = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.28);
      y((e.clientY - (r.top + r.height / 2)) * 0.38);
    });
    btn.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}
