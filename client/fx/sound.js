// Optional sound, off by default. Everything is synthesised with the Web Audio API
// (no audio files): a soft "bloop" when a bubble pops, a two-note chime on booking.
import { $, store, t } from '../core.js';

let ctx = null;
let on = false;

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function bloop(pitch = 1) {
  if (!on) return;
  const a = audio();
  const now = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(380 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(1300 * pitch, now + 0.07);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(gain).connect(a.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

function chime() {
  if (!on) return;
  const a = audio();
  [[659.25, 0], [987.77, 0.12], [1318.5, 0.24]].forEach(([f, d]) => {
    const now = a.currentTime + d;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.connect(gain).connect(a.destination);
    osc.start(now);
    osc.stop(now + 1);
  });
}

export function initSound() {
  const btn = $('#sound-toggle');
  if (!btn) return;
  const sync = () => {
    btn.setAttribute('aria-pressed', String(on));
    btn.title = t('sound');
  };
  // Browsers only allow audio after a user gesture, so we never auto-start it.
  on = store.get('tt-sound') === 'on';
  sync();
  btn.addEventListener('click', () => {
    on = !on;
    store.set('tt-sound', on ? 'on' : 'off');
    sync();
    if (on) bloop(1.2);
  });
  document.addEventListener('tt:pop', (e) => bloop(e.detail?.pitch || 1));
  document.addEventListener('tt:lead-success', chime);
}
