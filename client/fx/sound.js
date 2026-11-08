// Tidytail "bath-time" sound. Off by default; the header button turns it on.
// Everything is synthesised live with the Web Audio API, so there are no audio
// files to license, download or allow in the CSP.
//
// When on:
//   Ambience  warm water bed + a slow lofi chord pad + the odd drifting bubble
//   Feedback  soft tick on hover, pop on click, splash when a 3D bubble pops,
//             till-tick on the price estimate, chime on language switch,
//             low "boop" on form errors, sparkle chime on booking
import { $, $$, store, t } from '../core.js';

let ctx = null;
let master = null;
let on = false;
let ambience = null;

// ---------- Engine ----------
function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function env(gain, at, attack, peak, decay) {
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function voice({ type = 'sine', freq, to, at = 0, attack = 0.005, peak = 0.1, decay = 0.15, pan = 0, dest }) {
  const a = audio();
  const now = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  const p = a.createStereoPanner();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, now + attack + decay * 0.6);
  env(g, now, attack, peak, decay);
  p.pan.value = pan;
  osc.connect(g).connect(p).connect(dest || master);
  osc.start(now);
  osc.stop(now + attack + decay + 0.05);
}

let noiseBuf = null;
function noise() {
  if (noiseBuf) return noiseBuf;
  const a = audio();
  noiseBuf = a.createBuffer(1, a.sampleRate * 4, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  // Brown noise: soft and watery rather than hissy.
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.2;
  }
  return noiseBuf;
}

function splash(at = 0, peak = 0.06) {
  const a = audio();
  const now = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noise();
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2600;
  bp.Q.value = 0.8;
  const g = a.createGain();
  env(g, now, 0.004, peak, 0.12);
  src.connect(bp).connect(g).connect(master);
  src.start(now, Math.random() * 3);
  src.stop(now + 0.2);
}

// ---------- Sound palette ----------
export const sfx = {
  bubble(pitch = 1, peak = 0.16, pan = 0) {
    if (!on) return;
    voice({ freq: 320 * pitch, to: 1250 * pitch, peak, decay: 0.11, pan });
    voice({ freq: 640 * pitch, to: 2100 * pitch, peak: peak * 0.3, decay: 0.07, pan, at: 0.01 });
  },
  pop(pitch = 1) {
    if (!on) return;
    sfx.bubble(pitch * 1.3, 0.2);
    splash(0.03, 0.05);
  },
  tick() {
    if (!on) return;
    voice({ freq: 2100, peak: 0.025, decay: 0.03, type: 'triangle' });
  },
  click() {
    if (!on) return;
    voice({ freq: 520, to: 900, peak: 0.09, decay: 0.08 });
  },
  till() {
    if (!on) return;
    voice({ type: 'triangle', freq: 1320, peak: 0.05, decay: 0.09 });
    voice({ type: 'triangle', freq: 1760, peak: 0.04, decay: 0.12, at: 0.06 });
  },
  chime() {
    if (!on) return;
    [[784, 0], [1046.5, 0.09]].forEach(([f, at]) => voice({ type: 'triangle', freq: f, at, peak: 0.07, attack: 0.01, decay: 0.6 }));
  },
  error() {
    if (!on) return;
    voice({ type: 'sine', freq: 330, to: 190, peak: 0.12, decay: 0.28 });
  },
  success() {
    if (!on) return;
    [[659.25, 0], [830.6, 0.1], [987.8, 0.2], [1318.5, 0.32]].forEach(([f, at]) =>
      voice({ type: 'triangle', freq: f, at, peak: 0.1, attack: 0.01, decay: 1.1 }));
    for (let i = 0; i < 6; i++) setTimeout(() => sfx.bubble(1 + Math.random(), 0.06, Math.random() * 1.6 - 0.8), 400 + i * 110);
  },
  hello() {
    // Played when sound is switched on, so the visitor knows it works.
    voice({ freq: 330, to: 990, peak: 0.16, decay: 0.12 });
    voice({ freq: 440, to: 1320, peak: 0.14, decay: 0.12, at: 0.12 });
    voice({ type: 'triangle', freq: 1318.5, peak: 0.05, attack: 0.01, decay: 0.8, at: 0.24 });
  },
};

// ---------- Ambience ----------
// Chords: Cmaj9 → Am7 → Fmaj7 → G6 (warm, unresolved, loops without fatigue).
const CHORDS = [
  [130.81, 196.0, 246.94, 329.63, 293.66],
  [110.0, 164.81, 196.0, 261.63, 329.63],
  [87.31, 174.61, 220.0, 261.63, 329.63],
  [98.0, 146.83, 196.0, 246.94, 329.63],
];
const CHORD_SECONDS = 7;

function startAmbience() {
  const a = audio();
  const bus = a.createGain();
  bus.gain.value = 0.0001;
  bus.gain.setTargetAtTime(1, a.currentTime, 1.2);
  bus.connect(master);

  // Water bed: brown noise through a low-pass whose cutoff sways like lapping water.
  const water = a.createBufferSource();
  water.buffer = noise();
  water.loop = true;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  const lfo = a.createOscillator();
  const lfoAmt = a.createGain();
  lfo.frequency.value = 0.09;
  lfoAmt.gain.value = 220;
  lfo.connect(lfoAmt).connect(lp.frequency);
  const wg = a.createGain();
  wg.gain.value = 0.11;
  water.connect(lp).connect(wg).connect(bus);
  water.start();
  lfo.start();

  // Pad
  const padBus = a.createGain();
  padBus.gain.value = 0.9;
  const padLp = a.createBiquadFilter();
  padLp.type = 'lowpass';
  padLp.frequency.value = 1100;
  padBus.connect(padLp).connect(bus);
  let chord = 0;
  const playChord = () => {
    const now = a.currentTime;
    CHORDS[chord % CHORDS.length].forEach((f, i) => {
      [-4, 4].forEach((cents) => {
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = cents;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.035 : 0.016, now + 2.2);
        g.gain.setTargetAtTime(0.0001, now + CHORD_SECONDS - 1.2, 1.1);
        o.connect(g).connect(padBus);
        o.start(now);
        o.stop(now + CHORD_SECONDS + 4);
      });
    });
    chord++;
  };
  playChord();
  const chordTimer = setInterval(playChord, CHORD_SECONDS * 1000);

  // Drifting bubbles and the odd soft chime note from the chord's scale.
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  let bubbleTimer = 0;
  const sprinkle = () => {
    if (Math.random() < 0.7) sfx.bubble(0.8 + Math.random() * 0.9, 0.025 + Math.random() * 0.03, Math.random() * 1.6 - 0.8);
    else voice({ type: 'sine', freq: NOTES[(Math.random() * NOTES.length) | 0], peak: 0.03, attack: 0.02, decay: 1.6, pan: Math.random() - 0.5, dest: bus });
    bubbleTimer = setTimeout(sprinkle, 500 + Math.random() * 1800);
  };
  sprinkle();

  return {
    stop() {
      clearInterval(chordTimer);
      clearTimeout(bubbleTimer);
      bus.gain.setTargetAtTime(0.0001, a.currentTime, 0.25);
      setTimeout(() => { try { water.stop(); lfo.stop(); } catch { /* already stopped */ } bus.disconnect(); }, 1500);
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
    master.gain.setTargetAtTime(0.9, a.currentTime, 0.15);
    if (!ambience) ambience = startAmbience();
    if (greet) sfx.hello();
  } else {
    master.gain.setTargetAtTime(0.0001, a.currentTime, 0.12);
    ambience?.stop();
    ambience = null;
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
  // previous visit, start it quietly on their first click or key press.
  if (store.get('tt-sound') === 'on') {
    const resume = (e) => {
      if (e.target.closest?.('#sound-toggle')) return;
      setOn(true, { greet: false });
    };
    window.addEventListener('pointerdown', resume, { once: true, capture: true });
    window.addEventListener('keydown', resume, { once: true, capture: true });
  }

  // Pause everything in a background tab.
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  // Interaction feedback
  const HOVER = '.btn, .site-nav a, .lang button, .chip, .card, .plan, summary';
  let lastTick = 0;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest(HOVER);
    if (!el || el.contains(e.relatedTarget)) return;
    const now = performance.now();
    if (now - lastTick > 70) { lastTick = now; sfx.tick(); }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#sound-toggle')) return;
    if (e.target.closest('.btn, .site-nav a, summary, .chip')) sfx.click();
  });
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => sfx.chime()));
  document.addEventListener('tt:lang', sync);
  document.addEventListener('tt:pop', (e) => sfx.pop(e.detail?.pitch || 1));
  document.addEventListener('tt:estimate', () => sfx.till());
  document.addEventListener('tt:form-error', () => sfx.error());
  document.addEventListener('tt:lead-success', () => sfx.success());
}
