// Tidytail sound: cute and upbeat, like a friendly neighbourhood pet shop.
// Off by default; the header button turns it on. Everything is synthesised live
// with the Web Audio API (no audio files to license, download or allow in the CSP).
//
// Music     a bouncy marimba + glockenspiel loop on the major pentatonic scale
//           (the five-note scale familiar across Taiwanese and Filipino pop and
//           children's songs), with a soft shaker. ~108 BPM, no heavy bass.
// Feedback  hover plays pentatonic marimba notes (menus become a little tune),
//           cartoon pop/boing on clicks, squeaky pops for bubbles, marimba
//           "uh-oh" on errors, and a happy jingle plus a small-dog "arf! arf!" on booking.
import { $, $$, store, t } from '../core.js';

let ctx = null;
let master = null;
let on = false;
let music = null;

// Background music sits well under the effects:
// - MUSIC_LEVEL keeps it at roughly a quarter of an effect's loudness
// - a low-pass filter takes the sparkle off so it doesn't compete for attention
// - every effect "ducks" the music for a moment so pops and chimes always cut through
const MUSIC_LEVEL = 0.32;
const DUCK_TO = 0.3; // music drops to 30% of its level while an effect plays
let musicGain = null;

function duck(hold = 0.35) {
  if (!musicGain) return;
  const now = ctx.currentTime;
  const g = musicGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(MUSIC_LEVEL * DUCK_TO, now + 0.02);
  g.setValueAtTime(MUSIC_LEVEL * DUCK_TO, now + hold);
  g.linearRampToValueAtTime(MUSIC_LEVEL, now + hold + 0.4);
}

// ---------- Engine ----------
function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function tone({ type = 'sine', freq, to, at, attack = 0.003, peak = 0.1, decay = 0.2, pan = 0, dest }) {
  const a = audio();
  const osc = a.createOscillator();
  const g = a.createGain();
  const p = a.createStereoPanner();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + attack + decay * 0.7);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  p.pan.value = pan;
  osc.connect(g).connect(p).connect(dest || master);
  osc.start(at);
  osc.stop(at + attack + decay + 0.05);
  return osc;
}

// Marimba: warm fundamental + the bar's characteristic 4x overtone, quick wooden decay.
function marimba(note, at, peak = 0.12, dest, pan = 0) {
  const f = midi(note);
  tone({ freq: f * 1.01, to: f, at, attack: 0.002, peak, decay: 0.45, dest, pan });
  tone({ freq: f * 3.95, at, attack: 0.001, peak: peak * 0.22, decay: 0.08, dest, pan });
}

// Glockenspiel: bright, bell-like inharmonic partials with a longer ring.
function glock(note, at, peak = 0.05, dest, pan = 0) {
  const f = midi(note);
  tone({ freq: f, at, attack: 0.001, peak, decay: 1.1, dest, pan });
  tone({ freq: f * 2.76, at, attack: 0.001, peak: peak * 0.35, decay: 0.5, dest, pan });
  tone({ freq: f * 5.4, at, attack: 0.001, peak: peak * 0.15, decay: 0.25, dest, pan });
}

let noiseBuf = null;
function noise() {
  if (noiseBuf) return noiseBuf;
  const a = audio();
  noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function shaker(at, peak = 0.04, dest) {
  const a = audio();
  const src = a.createBufferSource();
  src.buffer = noise();
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6500;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  src.connect(hp).connect(g).connect(dest || master);
  src.start(at, Math.random() * 0.8);
  src.stop(at + 0.08);
}

// A small, happy dog: a pitched yip shaped by a vocal-like band-pass, plus a breathy edge.
function arf(at) {
  const a = audio();
  const osc = a.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(620, at);
  osc.frequency.exponentialRampToValueAtTime(880, at + 0.025);
  osc.frequency.exponentialRampToValueAtTime(430, at + 0.11);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 3;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.35, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
  osc.connect(bp).connect(g).connect(master);
  osc.start(at);
  osc.stop(at + 0.15);
  const n = a.createBufferSource();
  n.buffer = noise();
  const nb = a.createBiquadFilter();
  nb.type = 'bandpass';
  nb.frequency.value = 2200;
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.0001, at);
  ng.gain.exponentialRampToValueAtTime(0.05, at + 0.01);
  ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
  n.connect(nb).connect(ng).connect(master);
  n.start(at, Math.random() * 0.5);
  n.stop(at + 0.1);
}

// ---------- Sound palette ----------
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88]; // C major pentatonic, C5 → E6
let hoverStep = 0;

export const sfx = {
  hover() {
    if (!on) return;
    // Walk up and down the scale so moving across the menu plays a little tune.
    const seq = [0, 1, 2, 3, 4, 3, 2, 1];
    marimba(PENTA[seq[hoverStep++ % seq.length]], audio().currentTime, 0.05);
  },
  pop() {
    if (!on) return;
    const now = audio().currentTime;
    tone({ freq: 700, to: 1500, at: now, peak: 0.13, decay: 0.06 });
  },
  boing() {
    if (!on) return;
    const a = audio();
    const now = a.currentTime;
    const osc = tone({ freq: 520, to: 260, at: now, peak: 0.12, decay: 0.32 });
    const lfo = a.createOscillator();
    const amt = a.createGain();
    lfo.frequency.value = 22;
    amt.gain.setValueAtTime(60, now);
    amt.gain.exponentialRampToValueAtTime(1, now + 0.3);
    lfo.connect(amt).connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.35);
  },
  bubble(size = 1) {
    if (!on) return;
    // Squeaky pop: smaller bubbles squeak higher.
    const now = audio().currentTime;
    const p = 1.5 - Math.min(size, 1) * 0.6;
    tone({ freq: 900 * p, to: 2600 * p, at: now, peak: 0.16, decay: 0.05 });
    tone({ type: 'triangle', freq: 1800 * p, to: 3400 * p, at: now + 0.03, peak: 0.05, decay: 0.04 });
    shaker(now + 0.01, 0.05);
  },
  till() {
    if (!on) return;
    const now = audio().currentTime;
    marimba(84, now, 0.08);
    marimba(88, now + 0.07, 0.07);
  },
  chime() {
    if (!on) return;
    const now = audio().currentTime;
    glock(84, now, 0.07);
    glock(91, now + 0.1, 0.06);
  },
  error() {
    if (!on) return;
    // Marimba "uh-oh".
    const now = audio().currentTime;
    marimba(67, now, 0.13);
    marimba(64, now + 0.16, 0.13);
  },
  success() {
    if (!on) return;
    const now = audio().currentTime;
    [72, 76, 79, 84].forEach((n, i) => marimba(n, now + i * 0.11, 0.14));
    glock(96, now + 0.44, 0.06);
    glock(91, now + 0.55, 0.05);
    arf(now + 0.75);
    arf(now + 0.95);
  },
  hello() {
    const now = audio().currentTime;
    [72, 76, 79].forEach((n, i) => marimba(n, now + i * 0.08, 0.12));
    glock(88, now + 0.26, 0.05);
  },
};

// Every effect ducks the music; longer effects hold the duck longer.
const HOLD = { hover: 0.15, pop: 0.25, boing: 0.4, bubble: 0.25, till: 0.3, chime: 0.5, error: 0.5, success: 1.6, hello: 0.6 };
for (const [name, fn] of Object.entries(sfx)) {
  sfx[name] = (...args) => {
    if (on || name === 'hello') duck(HOLD[name] ?? 0.3);
    return fn(...args);
  };
}

// ---------- Music ----------
// 8 bars of 8 eighth-notes. Numbers are MIDI notes; 0 is a rest.
const BPM = 108;
const STEP = 60 / BPM / 2;
const MELODY = [
  76, 0, 79, 0, 81, 79, 76, 0, //  C   bright opening hook
  74, 0, 76, 0, 72, 0, 0, 0, //    Am  answer
  69, 0, 72, 0, 74, 72, 69, 0, //  F   hook, lower
  67, 0, 69, 0, 74, 0, 0, 0, //    G   lift
  76, 79, 81, 84, 81, 79, 76, 0, // C   run up
  81, 0, 79, 0, 76, 0, 74, 0, //   Am  step down
  74, 76, 79, 76, 74, 0, 72, 0, // F   playful turn
  72, 0, 0, 0, 79, 0, 84, 0, //    G→C home, with a hop
];
const BASS = [48, 45, 41, 43, 48, 45, 41, 43];
const COMP = [[64, 67], [64, 69], [65, 69], [62, 67], [64, 67], [64, 69], [65, 69], [62, 67]];

function startMusic() {
  const a = audio();
  // Notes go into `bus`, then a soft low-pass, then `musicGain` (faded in and ducked).
  const bus = a.createGain();
  const soften = a.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 2400;
  soften.Q.value = 0.5;
  musicGain = a.createGain();
  musicGain.gain.value = 0.0001;
  musicGain.gain.setTargetAtTime(MUSIC_LEVEL, a.currentTime, 0.6);
  bus.connect(soften).connect(musicGain).connect(master);

  let step = 0;
  let loop = 0;
  let next = a.currentTime + 0.12;
  // Look-ahead scheduler: steady timing even when the page is busy animating.
  const timer = setInterval(() => {
    while (next < a.currentTime + 0.15) {
      const i = step % MELODY.length;
      const bar = Math.floor(i / 8);
      const beat = i % 8;
      const note = MELODY[i];
      const swing = beat % 2 ? STEP * 0.12 : 0; // a little bounce
      const at = next + swing;
      if (note) marimba(note, at, 0.085, bus, 0.15);
      if (beat === 0 || beat === 4) marimba(BASS[bar] + (beat === 4 ? 7 : 0), at, 0.07, bus, -0.2);
      if (beat === 2 || beat === 6) COMP[bar].forEach((n) => marimba(n, at, 0.03, bus, -0.1));
      shaker(at, beat % 2 ? 0.018 : 0.03, bus);
      // Every second time round, a glockenspiel sparkle doubles the hook.
      if (loop % 2 === 1 && note && (bar === 0 || bar === 4) && beat < 6) glock(note + 12, at, 0.022, bus, 0.3);
      next += STEP;
      step++;
      if (step % MELODY.length === 0) loop++;
    }
  }, 25);

  return {
    stop() {
      clearInterval(timer);
      const g = musicGain;
      musicGain = null;
      g.gain.cancelScheduledValues(a.currentTime);
      g.gain.setTargetAtTime(0.0001, a.currentTime, 0.15);
      setTimeout(() => g.disconnect(), 1200);
    },
  };
}

// ---------- Switch ----------
function setOn(next, { greet = true } = {}) {
  on = next;
  store.set('tt-sound', on ? 'on' : 'off');
  const a = audio();
  if (on) {
    master.gain.cancelScheduledValues(a.currentTime);
    master.gain.setTargetAtTime(0.9, a.currentTime, 0.08);
    if (greet) sfx.hello();
    if (!music) setTimeout(() => { if (on && !music) music = startMusic(); }, greet ? 600 : 0);
  } else {
    master.gain.setTargetAtTime(0.0001, a.currentTime, 0.1);
    music?.stop();
    music = null;
  }
  sync();
}

function sync() {
  const btn = $('#sound-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(on));
  const label = on ? t('soundOff') : t('soundOn');
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

function hint() {
  const tip = $('#sound-hint');
  if (!tip || store.get('tt-sound')) return;
  setTimeout(() => { if (!on) tip.hidden = false; }, 3500);
  setTimeout(() => { tip.hidden = true; }, 11000);
}

export function initSound() {
  const btn = $('#sound-toggle');
  if (!btn) return;
  sync();
  hint();
  btn.addEventListener('click', () => {
    $('#sound-hint')?.setAttribute('hidden', '');
    setOn(!on);
  });

  // Browsers block audio until the visitor interacts. If they chose sound on a
  // previous visit, start it on their first click or key press.
  if (store.get('tt-sound') === 'on') {
    const resume = (e) => {
      if (e.target.closest?.('#sound-toggle')) return;
      setOn(true, { greet: false });
    };
    window.addEventListener('pointerdown', resume, { once: true, capture: true });
    window.addEventListener('keydown', resume, { once: true, capture: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  // Interaction feedback
  // Hover notes only on things you click. Not on cards (services, Care Club
  // plans) or FAQ questions: scanning across those made the page too noisy.
  const HOVER = '.btn, .site-nav a, .lang button, .chip';
  let lastHover = 0;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest(HOVER);
    if (!el || el.contains(e.relatedTarget)) return;
    const now = performance.now();
    if (now - lastHover > 90) { lastHover = now; sfx.hover(); }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#sound-toggle')) return;
    if (e.target.closest('.chip, summary')) sfx.boing();
    else if (e.target.closest('.btn, .site-nav a')) sfx.pop();
  });
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => sfx.chime()));
  // Light/dark: a glockenspiel step down into night, up into day.
  document.addEventListener('tt:theme', (e) => {
    if (!on) return;
    duck(0.5);
    const now = audio().currentTime;
    const [a, b] = e.detail?.theme === 'dark' ? [88, 81] : [81, 88];
    glock(a, now, 0.06);
    glock(b, now + 0.1, 0.05);
  });
  document.addEventListener('tt:lang', sync);
  document.addEventListener('tt:pop', (e) => sfx.bubble(e.detail?.size ?? 0.5));
  document.addEventListener('tt:estimate', () => sfx.till());
  document.addEventListener('tt:form-error', () => sfx.error());
  document.addEventListener('tt:lead-success', () => sfx.success());
}
