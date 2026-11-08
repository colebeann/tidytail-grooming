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

  // Magnetic buttons. The offset is measured from the button's resting position
  // (measuring its moved position fed back on itself), clamped to a few pixels,
  // and reset on every way the pointer can leave: pointerleave, pointercancel,
  // scrolling, the window losing focus, or the pointer drifting off the resting area.
  const MAX = 8;
  let active = null;
  const magnets = new Map();

  function release(btn) {
    const m = magnets.get(btn);
    if (!m) return;
    m.x(0);
    m.y(0);
    m.rest = null;
    if (active === btn) active = null;
  }

  $$('.btn').forEach((btn) => {
    magnets.set(btn, {
      x: gsap.quickTo(btn, 'x', { duration: 0.35, ease: 'power3' }),
      y: gsap.quickTo(btn, 'y', { duration: 0.35, ease: 'power3' }),
      rest: null,
    });
    btn.addEventListener('pointerenter', () => {
      const m = magnets.get(btn);
      const r = btn.getBoundingClientRect();
      const ox = Number(gsap.getProperty(btn, 'x')) || 0;
      const oy = Number(gsap.getProperty(btn, 'y')) || 0;
      m.rest = { left: r.left - ox, top: r.top - oy, width: r.width, height: r.height };
      active = btn;
    });
    btn.addEventListener('pointermove', (e) => {
      const m = magnets.get(btn);
      if (!m.rest) return;
      const cx = m.rest.left + m.rest.width / 2;
      const cy = m.rest.top + m.rest.height / 2;
      m.x(gsap.utils.clamp(-MAX, MAX, (e.clientX - cx) * 0.2));
      m.y(gsap.utils.clamp(-MAX, MAX, (e.clientY - cy) * 0.3));
    });
    btn.addEventListener('pointerleave', () => release(btn));
    btn.addEventListener('pointercancel', () => release(btn));
  });

  const releaseAll = () => magnets.forEach((_, btn) => release(btn));
  window.addEventListener('scroll', releaseAll, { passive: true });
  window.addEventListener('blur', releaseAll);
  // Watchdog: if the pointer is well outside the button's resting area, send it home.
  window.addEventListener('pointermove', (e) => {
    if (!active) return;
    const r = magnets.get(active).rest;
    if (!r) return;
    const pad = 16;
    const out = e.clientX < r.left - pad || e.clientX > r.left + r.width + pad
      || e.clientY < r.top - pad || e.clientY > r.top + r.height + pad;
    if (out) release(active);
  }, { passive: true });
}
