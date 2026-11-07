// Tidytail landing page behaviour. No inline scripts (strict CSP), no innerHTML with user data.
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked: ignore */ } },
  };

  // ---------- Language ----------
  const EN = {
    errRequired: 'Please fill this in.', errContact: 'Please give at least one way to reach you.', errEmail: 'Please enter a valid email.',
    errPhone: 'Please enter a valid mobile number.', errLine: 'LINE ID can only use letters, numbers and . _ - @',
    errConsent: 'We need your consent to handle the request.', errDate: 'Please pick a date within the next 120 days.',
    errServer: "We couldn't send this right now. Please try again, or message us on LINE.", errFields: 'Please check the highlighted fields.',
    sending: 'Sending…', submit: 'Send request',
  };
  let lang = 'en';

  // Replace only the first text node so child elements (like <small>) survive.
  function textNode(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return n;
    return null;
  }
  $$('[data-i18n]').forEach((el) => {
    const n = textNode(el);
    el.dataset.en = n ? n.nodeValue : el.textContent;
  });

  function t(key) {
    if (lang === 'zh' && window.TT_ZH && window.TT_ZH[key]) return window.TT_ZH[key];
    return EN[key] || key;
  }

  function setLang(next) {
    lang = next === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant-TW' : 'en';
    $$('[data-i18n]').forEach((el) => {
      const value = lang === 'zh' ? (window.TT_ZH || {})[el.dataset.i18n] : el.dataset.en;
      if (!value) return;
      const n = textNode(el);
      if (n) n.nodeValue = value; else el.textContent = value;
    });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    store.set('tt-lang', lang);
  }
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  const saved = store.get('tt-lang');
  if (saved === 'zh' || (!saved && /^zh/i.test(navigator.language || ''))) setLang('zh');

  // ---------- Mobile nav ----------
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
    $$('a', nav).forEach((a) => a.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    }));
  }

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  // ---------- Price estimator ----------
  const estService = $('#est-service');
  const estSize = $('#est-size');
  const estMat = $('#est-mat');
  const estOut = $('#est-out');
  function estimate() {
    if (!estOut) return;
    const base = Number(estService.value) * Number(estSize.value) + (estMat.checked ? 300 : 0);
    const rounded = Math.round(base / 50) * 50;
    estOut.textContent = 'NT$' + rounded.toLocaleString('en-US');
  }
  [estService, estSize, estMat].forEach((el) => el && el.addEventListener('input', estimate));
  estimate();

  // ---------- Before / after slider ----------
  const range = $('#cmp-range');
  const before = $('#cmp-before');
  const handle = $('#cmp-handle');
  if (range && before && handle) {
    const update = () => {
      const v = Number(range.value);
      before.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
      handle.style.left = v + '%';
    };
    range.addEventListener('input', update);
    update();
  }

  // ---------- Booking form ----------
  const form = $('#lead-form');
  if (!form) return;

  const dateInput = $('#preferredDate');
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (dateInput) {
    dateInput.min = iso(today);
    dateInput.max = iso(new Date(today.getTime() + 119 * 86400000));
  }

  const notes = $('#notes');
  const count = $('#notes-count');
  if (notes && count) notes.addEventListener('input', () => { count.textContent = String(notes.value.length); });

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

  function collect() {
    const v = (n) => (form.elements[n].value || '').trim();
    return {
      ownerName: v('ownerName'),
      phone: v('phone'),
      email: v('email'),
      lineId: v('lineId'),
      petName: v('petName'),
      species: v('species'),
      breed: v('breed'),
      size: v('size'),
      service: v('service'),
      concerns: $$('input[name="concerns"]:checked', form).map((c) => c.value),
      preferredDate: v('preferredDate'),
      district: v('district'),
      notes: v('notes'),
      language: lang,
      consentPrivacy: form.elements.consentPrivacy.checked,
      consentMarketing: form.elements.consentMarketing.checked,
      website: form.elements.website.value,
    };
  }

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
      const first = form.elements[Object.keys(errs)[0]];
      if (first && first.focus) first.focus();
      status.textContent = t('errFields');
      status.classList.add('error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = t('sending');
    try {
      const res = await send(data);
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        $('#ref').textContent = body.reference || '';
        form.hidden = true;
        const ok = $('#success');
        ok.hidden = false;
        ok.focus();
        form.reset();
        csrfToken = null;
        getToken().catch(() => {});
        return;
      }
      if (res.status === 422 && body.fields) {
        Object.keys(body.fields).forEach((k) => setError(k, t('errFields')));
        status.textContent = t('errFields');
      } else {
        status.textContent = body.error && lang === 'en' ? body.error : t('errServer');
      }
      status.classList.add('error');
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
})();
