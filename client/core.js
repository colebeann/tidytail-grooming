// Core page behaviour: language, nav, estimator, before/after slider, booking form.
// Works on its own; the motion layer (fx/) listens to the events dispatched here.
// No innerHTML with user data anywhere.
import { ZH } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

const EN = {
  errRequired: 'Please fill this in.', errContact: 'Please give at least one way to reach you.', errEmail: 'Please enter a valid email.',
  errPhone: 'Please enter a valid mobile number.', errLine: 'LINE ID can only use letters, numbers and . _ - @',
  errConsent: 'We need your consent to handle the request.', errDate: 'Please pick a date within the next 120 days.',
  errServer: "We couldn't send this right now. Please try again, or message us on LINE.", errFields: 'Please check the highlighted fields.',
  sending: 'Sending…', submit: 'Send request', themeDark: 'Switch to dark mode', themeLight: 'Switch to light mode', sound: 'Sound', soundOn: 'Turn on bath-time sounds', soundOff: 'Turn sound off',
};
export let lang = 'en';

export function t(key) {
  return (lang === 'zh' && ZH[key]) || EN[key] || key;
}

// ---------- Language ----------
function textNode(el) {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return n;
  return null;
}

export function setLang(next) {
  emit('tt:before-lang');
  lang = next === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant-TW' : 'en';
  $$('[data-i18n]').forEach((el) => {
    const value = lang === 'zh' ? ZH[el.dataset.i18n] : el.dataset.en;
    if (!value) return;
    const n = textNode(el);
    if (n) n.nodeValue = value; else el.textContent = value;
  });
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  store.set('tt-lang', lang);
  emit('tt:lang', { lang });
}

function initLang() {
  $$('[data-i18n]').forEach((el) => {
    const n = textNode(el);
    el.dataset.en = n ? n.nodeValue : el.textContent;
  });
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  const saved = store.get('tt-lang');
  if (saved === 'zh' || (!saved && /^zh/i.test(navigator.language || ''))) setLang('zh');
}

// ---------- Nav ----------
function initNav() {
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  if (!toggle || !nav) return;
  const close = () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', close));
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
}

// ---------- Estimator ----------
function initEstimator() {
  const s = $('#est-service'), z = $('#est-size'), m = $('#est-mat'), out = $('#est-out');
  if (!out) return;
  const run = () => {
    const value = Math.round((Number(s.value) * Number(z.value) + (m.checked ? 300 : 0)) / 50) * 50;
    // The motion layer animates the number when it is active.
    if (!document.documentElement.classList.contains('fx')) out.textContent = 'NT$' + value.toLocaleString('en-US');
    emit('tt:estimate', { value, out });
  };
  [s, z, m].forEach((el) => el.addEventListener('input', run));
  run();

  // "Book this groom": carry the estimate into the booking form, then the
  // #book link scrolls there (smoothly when the motion layer is on).
  $('#est-book')?.addEventListener('click', () => {
    const form = $('#lead-form');
    if (!form || form.hidden) return;
    const service = s.selectedOptions[0]?.dataset.service;
    const size = z.selectedOptions[0]?.dataset.size;
    if (service) form.elements.service.value = service;
    if (size) form.elements.size.value = size;
    if (service === 'cat-calm') form.elements.species.value = 'cat';
    const matting = form.querySelector('input[name="concerns"][value="matting"]');
    if (matting) matting.checked = m.checked;
    ['service', 'size', 'species'].forEach((n) => {
      const el = form.elements[n];
      el.classList.remove('prefilled');
      void el.offsetWidth; // restart the highlight animation
      el.classList.add('prefilled');
    });
  });
}

// ---------- Before / after ----------
function initCompare() {
  const range = $('#cmp-range'), before = $('#cmp-before'), handle = $('#cmp-handle');
  if (!range || !before || !handle) return;
  const update = () => {
    const v = Number(range.value);
    before.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
    handle.style.left = v + '%';
  };
  range.addEventListener('input', update);
  update();
}

// ---------- Booking form ----------
function initForm() {
  const form = $('#lead-form');
  if (!form) return;

  const dateInput = $('#preferredDate');
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  dateInput.min = iso(today);
  dateInput.max = iso(new Date(today.getTime() + 119 * 86400000));

  const notes = $('#notes'), count = $('#notes-count');
  notes.addEventListener('input', () => { count.textContent = String(notes.value.length); });

  let csrfToken = null;
  async function getToken() {
    const res = await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new Error('csrf');
    csrfToken = (await res.json()).token;
  }
  getToken().catch(() => { /* retried on submit */ });

  const status = $('#form-status');
  const submitBtn = $('#submit-btn');

  function setError(name, msg) {
    const el = form.elements[name];
    const holder = $('#err-' + name);
    if (holder) holder.textContent = msg || '';
    if (el && el.setAttribute) {
      if (msg) { el.setAttribute('aria-invalid', 'true'); if (holder) el.setAttribute('aria-describedby', holder.id); }
      else el.removeAttribute('aria-invalid');
    }
  }

  const v = (n) => (form.elements[n].value || '').trim();
  const collect = () => ({
    ownerName: v('ownerName'), phone: v('phone'), email: v('email'), lineId: v('lineId'),
    petName: v('petName'), species: v('species'), breed: v('breed'), size: v('size'), service: v('service'),
    concerns: $$('input[name="concerns"]:checked', form).map((c) => c.value),
    preferredDate: v('preferredDate'), district: v('district'), notes: v('notes'), language: lang,
    consentPrivacy: form.elements.consentPrivacy.checked,
    consentMarketing: form.elements.consentMarketing.checked,
    website: form.elements.website.value,
  });

  function validate(d) {
    const errs = {};
    if (d.ownerName.length < 2) errs.ownerName = t('errRequired');
    if (!d.petName) errs.petName = t('errRequired');
    if (!d.phone && !d.email && !d.lineId) errs.phone = t('errContact');
    if (d.phone && !/^\+?[0-9\s()-]{8,20}$/.test(d.phone)) errs.phone = t('errPhone');
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errs.email = t('errEmail');
    if (d.lineId && !/^[A-Za-z0-9._@-]+$/.test(d.lineId)) errs.lineId = t('errLine');
    if (d.preferredDate && (d.preferredDate < dateInput.min || d.preferredDate > dateInput.max)) errs.preferredDate = t('errDate');
    if (!d.consentPrivacy) errs.consentPrivacy = t('errConsent');
    return errs;
  }

  async function send(data, retry = true) {
    if (!csrfToken) await getToken();
    const res = await fetch('/api/leads', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(data),
    });
    if (res.status === 403 && retry) { await getToken(); return send(data, false); }
    return res;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('error');
    ['ownerName', 'phone', 'email', 'lineId', 'petName', 'breed', 'preferredDate', 'notes', 'consentPrivacy'].forEach((n) => setError(n, ''));

    const data = collect();
    const errs = validate(data);
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, m]) => setError(k, m));
      form.elements[Object.keys(errs)[0]]?.focus?.();
      status.textContent = t('errFields');
      status.classList.add('error');
      emit('tt:form-error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = t('sending');
    try {
      const res = await send(data);
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        $('#ref').textContent = body.reference || '';
        const rect = submitBtn.getBoundingClientRect();
        form.hidden = true;
        const ok = $('#success');
        ok.hidden = false;
        ok.focus({ preventScroll: true });
        form.reset();
        csrfToken = null;
        getToken().catch(() => {});
        emit('tt:lead-success', { rect });
        return;
      }
      if (res.status === 422 && body.fields) Object.keys(body.fields).forEach((k) => setError(k, t('errFields')));
      status.textContent = res.status === 422 ? t('errFields') : (body.error && lang === 'en' ? body.error : t('errServer'));
      status.classList.add('error');
      emit('tt:form-error');
    } catch {
      status.textContent = t('errServer');
      status.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t('submit');
    }
  });

  $('#again')?.addEventListener('click', () => {
    $('#success').hidden = true;
    form.hidden = false;
    form.elements.ownerName.focus();
  });
}

// ---------- Light / dark ----------
// No saved choice: follow the device. Once the visitor picks, remember it.
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
export const currentTheme = () =>
  document.documentElement.getAttribute('data-theme') || (darkQuery.matches ? 'dark' : 'light');

function initTheme() {
  const btn = $('#theme-toggle');
  const meta = $('meta[name="theme-color"]');
  const sync = () => {
    const dark = currentTheme() === 'dark';
    btn?.classList.toggle('is-dark', dark);
    const label = dark ? t('themeLight') : t('themeDark');
    btn?.setAttribute('aria-label', label);
    if (btn) btn.title = label;
    meta?.setAttribute('content', dark ? '#141c1b' : '#f7f1e8');
  };
  sync();
  darkQuery.addEventListener('change', sync);
  document.addEventListener('tt:lang', sync);
  btn?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    // Colours ease across instead of snapping.
    root.classList.add('theme-anim');
    root.setAttribute('data-theme', next);
    store.set('tt-theme', next);
    sync();
    emit('tt:theme', { theme: next });
    setTimeout(() => root.classList.remove('theme-anim'), 500);
  });
}

export function initCore() {
  initTheme();
  initLang();
  initNav();
  initEstimator();
  initCompare();
  initForm();
}
