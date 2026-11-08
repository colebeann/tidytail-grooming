// Scroll-driven choreography. Every animation here is themed on the grooming story:
// headlines "rinse" up, the report card gets scanned, the steps are joined by a
// comb-tooth path, prices "tick" like a till, and the before/after slider sweeps itself.
import { gsap, ScrollTrigger, SplitText } from './gsap.js';
import { $, $$ } from '../core.js';

function heroIntro() {
  const h1 = $('.hero h1');
  if (!h1) return;
  let split = SplitText.create(h1, { type: 'words,chars', mask: 'words', charsClass: 'ch' });

  const tl = gsap.timeline({ delay: 0.1 });
  tl.from(split.chars, { yPercent: 120, rotate: 8, duration: 1, stagger: 0.018, ease: 'expo.out' })
    .from('.hero .eyebrow', { y: 16, autoAlpha: 0, duration: 0.6 }, 0)
    .from('.hero .foam-line path', { strokeDashoffset: 600, duration: 1.4, ease: 'power2.inOut' }, 0.5)
    .from('.hero .lede, .hero-ctas > *', { y: 24, autoAlpha: 0, stagger: 0.08 }, 0.45)
    .from('.hero-stats > div', { y: 20, autoAlpha: 0, stagger: 0.08 }, 0.7)
    .from('.hero-art .illus', { scale: 0.85, autoAlpha: 0, duration: 1.2, ease: 'back.out(1.6)' }, 0.2)
    .from('.float-card', { y: 30, scale: 0.8, autoAlpha: 0, stagger: 0.15, ease: 'back.out(2)' }, 0.9);

  // Re-split after a language switch so the text stays correct.
  document.addEventListener('tt:before-lang', () => split.revert());
  document.addEventListener('tt:lang', () => {
    split = SplitText.create(h1, { type: 'words,chars', mask: 'words', charsClass: 'ch' });
    gsap.from(split.chars, { yPercent: 120, duration: 0.7, stagger: 0.012, ease: 'expo.out' });
  });

  // The pup bobs in the tub and wiggles its ears; bubbles drift.
  gsap.to('.i-dog', { y: -6, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 100%' });
  gsap.to('.i-ear', { rotate: '+=8', duration: 0.5, yoyo: true, repeat: -1, repeatDelay: 2.4, ease: 'sine.inOut', transformOrigin: '50% 10%', stagger: 0.12 });
  gsap.to('.i-foam circle', { scale: 1.08, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: 'center', stagger: { each: 0.15, from: 'random' } });
  gsap.to('.float-a', { y: -10, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.float-b', { y: 10, duration: 2.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });

  // Parallax: the art drifts slower than the page.
  gsap.to('.hero-art', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

function countUp() {
  $$('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const decimals = (el.dataset.count.split('.')[1] || '').length;
    const obj = { v: 0 };
    gsap.to(obj, {
      v: end, duration: 2, ease: 'power2.out', delay: 0.8,
      onUpdate: () => { el.firstChild.nodeValue = obj.v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); },
    });
  });
}

function sectionReveals() {
  // Headings and eyebrows rise in as their section arrives.
  ScrollTrigger.batch('.section .eyebrow, .section h2, .section .center.muted, .check-grid > div > p, .ba-grid > div > p', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.from(els, { y: 34, autoAlpha: 0, stagger: 0.08, duration: 0.8 }),
  });
  // Cards fan in like freshly dried towels.
  ScrollTrigger.batch('.card, .plan, .promise, .member, .review, .steps li, .estimator, .hours, details', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.from(els, { y: 60, rotateX: -12, autoAlpha: 0, transformOrigin: '50% 0%', stagger: 0.09, duration: 1, ease: 'expo.out' }),
  });
}

function reportScan() {
  const card = $('.report');
  if (!card) return;
  const tl = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 75%', once: true } });
  tl.from(card, { y: 40, rotate: -2, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.4)' })
    .fromTo('.report .scan', { top: '0%', autoAlpha: 1 }, { top: '100%', duration: 1.6, ease: 'power1.inOut' }, 0.4)
    .from('.report-list .pill', { scale: 0, autoAlpha: 0, stagger: 0.22, ease: 'back.out(3)', duration: 0.5 }, 0.55)
    .to('.report .scan', { autoAlpha: 0, duration: 0.3 })
    .from('.report-foot', { y: 10, autoAlpha: 0, duration: 0.5 }, '-=0.2');
}

function stepsPath() {
  const path = $('.steps-path path');
  if (!path) return;
  const len = path.getTotalLength();
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
  gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 80%', end: 'bottom 60%', scrub: 0.6 } });
  $$('.steps .step-n').forEach((n) =>
    gsap.from(n, { scale: 0, rotate: -180, ease: 'back.out(2.5)', duration: 0.8, scrollTrigger: { trigger: n, start: 'top 85%', once: true } }),
  );
}

function priceTicker() {
  document.addEventListener('tt:estimate', ({ detail }) => {
    const { value, out } = detail;
    const from = Number((out.textContent || '').replace(/\D/g, '')) || value;
    const obj = { v: from };
    gsap.to(obj, {
      v: value, duration: 0.6, ease: 'power2.out', overwrite: true,
      onUpdate: () => { out.textContent = 'NT$' + (Math.round(obj.v / 10) * 10).toLocaleString('en-US'); },
    });
    gsap.fromTo(out, { scale: 1.15 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
  });
  // Initial value (core skips setting it when fx is on).
  document.getElementById('est-service')?.dispatchEvent(new Event('input'));
}

function compareSweep() {
  const range = $('#cmp-range');
  if (!range) return;
  const obj = { v: 50 };
  const set = () => { range.value = String(obj.v); range.dispatchEvent(new Event('input')); };
  gsap.timeline({ scrollTrigger: { trigger: '.compare', start: 'top 70%', once: true } })
    .to(obj, { v: 8, duration: 1, ease: 'power2.inOut', onUpdate: set })
    .to(obj, { v: 92, duration: 1.4, ease: 'power2.inOut', onUpdate: set })
    .to(obj, { v: 50, duration: 0.9, ease: 'power2.inOut', onUpdate: set });
}

function checkBand() {
  // The teal "suds" band edges bubble gently.
  gsap.to('.suds', { backgroundPositionX: '+=80px', duration: 6, repeat: -1, ease: 'none' });
}

export function initReveal() {
  heroIntro();
  countUp();
  sectionReveals();
  reportScan();
  stepsPath();
  priceTicker();
  compareSweep();
  checkBand();
  // Layout can shift once fonts and the 3D canvas settle.
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
