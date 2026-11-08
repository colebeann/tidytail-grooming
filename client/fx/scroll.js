// Smooth scrolling (Lenis) wired into GSAP's ticker, a "paw runner" progress bar,
// a header that tucks away on scroll down, and smooth anchor jumps.
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap.js';
import { $, $$ } from '../core.js';

export let lenis = null;

export function initScroll() {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anchor links glide instead of jumping.
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id.length > 1 ? $(id) : null;
      if (!target && id !== '#top') return;
      e.preventDefault();
      lenis.scrollTo(target || 0, { offset: -76, duration: 1.4 });
      history.replaceState(null, '', id);
    });
  });

  // Progress bar with a paw that runs along it.
  const bar = $('.scroll-progress .bar');
  const runner = $('.scroll-progress .runner');
  if (bar && runner) {
    const setBar = gsap.quickSetter(bar, 'scaleX');
    const setRun = gsap.quickSetter(runner, 'x', 'px');
    let step = 0;
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate(self) {
        setBar(self.progress);
        setRun(self.progress * (window.innerWidth - 28));
        runner.style.opacity = self.progress > 0.005 ? '1' : '0';
        // Alternate the paw's tilt so it looks like it's trotting.
        const s = Math.floor(self.scroll() / 90) % 2;
        if (s !== step) { step = s; runner.classList.toggle('step', s === 1); }
      },
    });
  }

  // Header hides when scrolling down, returns when scrolling up.
  const header = $('.site-header');
  if (header) {
    ScrollTrigger.create({
      start: 120,
      end: 'max',
      onUpdate(self) { header.classList.toggle('tucked', self.direction === 1 && self.scroll() > 400); },
      onLeaveBack() { header.classList.remove('tucked'); },
    });
  }

  // Marquee speeds up and skews with scroll velocity.
  const track = $('.marquee-track');
  if (track) {
    const skew = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3' });
    const loop = gsap.to(track, { xPercent: -50, repeat: -1, duration: 38, ease: 'none' });
    let boost = 0, lean = 0;
    lenis.on('scroll', ({ velocity }) => {
      boost = Math.max(boost, Math.min(Math.abs(velocity) / 6, 4));
      lean = gsap.utils.clamp(-12, 12, velocity * -0.6);
    });
    // Ease back to normal speed and upright once scrolling stops.
    gsap.ticker.add(() => {
      boost *= 0.94;
      lean *= 0.9;
      loop.timeScale(1 + boost);
      skew(lean);
    });
  }
}
