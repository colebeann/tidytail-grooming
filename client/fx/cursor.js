// Custom cursor: a coral dot glued to the pointer and a soap-bubble ring that
// follows it closely and swells over anything clickable, plus fading paw prints.
//
// Performance notes (this runs every frame):
// - Only `transform` and `opacity` change, so the browser composites on the GPU
//   without layout or repaint. The ring grows with scale(), not width/height.
// - The dot moves on the pointer event itself; the ring is eased once per frame
//   with a frame-rate-independent factor, so it never trails by more than a frame or two.
// - Coalesced pointer events are ignored; we only need the latest position.
// - Paw prints use the Web Animations API, which runs on the compositor.

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
  const ringInner = document.createElement('div');
  dot.className = 'cursor-dot';
  ring.className = 'cursor-ring';
  ringInner.className = 'cursor-ring-inner';
  ring.appendChild(ringInner);
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring, dot);
  const root = document.documentElement;
  root.classList.add('has-cursor');

  const layer = document.createElement('div');
  layer.className = 'paw-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const pool = Array.from({ length: 12 }, () => layer.appendChild(svgPaw()));

  let tx = -100, ty = -100, rx = -100, ry = -100;
  let lastX = 0, lastY = 0, side = 1, i = 0;
  let raf = 0, last = performance.now();

  const loop = (now) => {
    const dt = Math.min((now - last) / 16.67, 4);
    last = now;
    // ~0.55 per 60fps frame: tight, but still soft.
    const k = 1 - Math.pow(0.45, dt);
    rx += (tx - rx) * k;
    ry += (ty - ry) * k;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = Math.abs(tx - rx) + Math.abs(ty - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    if (!root.classList.contains('cursor-on')) { rx = tx; ry = ty; root.classList.add('cursor-on'); }
    kick();

    const dx = tx - lastX, dy = ty - lastY;
    if (dx * dx + dy * dy < 4900 || e.target.closest('.form')) return;
    const angle = Math.atan2(dy, dx);
    lastX = tx; lastY = ty;
    side = -side;
    const px = tx + Math.cos(angle + Math.PI / 2) * 9 * side - 9;
    const py = ty + Math.sin(angle + Math.PI / 2) * 9 * side - 9;
    const deg = (angle * 180) / Math.PI + 90;
    const base = `translate3d(${px}px, ${py}px, 0) rotate(${deg}deg)`;
    pool[i++ % pool.length].animate(
      [
        { transform: `${base} scale(.4)`, opacity: 0.55 },
        { transform: `${base} scale(1)`, opacity: 0.5, offset: 0.12 },
        { transform: `${base} scale(1)`, opacity: 0 },
      ],
      { duration: 1700, easing: 'ease-out', fill: 'forwards' },
    );
  }, { passive: true });

  document.addEventListener('pointerleave', () => root.classList.remove('cursor-on'));

  const HOT = 'a, button, select, label, summary, input[type="checkbox"], input[type="range"], .chip';
  const TEXT = 'input:not([type="checkbox"]):not([type="range"]), textarea';
  let state = '';
  document.addEventListener('pointerover', (e) => {
    const next = e.target.closest(TEXT) ? 'text' : e.target.closest(HOT) ? 'hot' : '';
    if (next !== state) { ring.dataset.state = next; state = next; }
  }, { passive: true });
  document.addEventListener('pointerdown', () => {
    ringInner.animate([{ scale: 0.75 }, { scale: 1 }], { duration: 350, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }, { passive: true });
}
