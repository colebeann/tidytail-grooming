# Tidytail Grooming Studio: landing page mock-up

A landing page for a fictional pet grooming studio in Dajia, Taichung, with a secure lead form.
**Every name, price, review and number is dummy data**; the site is for mock-ups only.

Its structure follows the agency business plan and leads tracker:

- **Free entry offer:** a 15-minute *coat & skin check* with a one-page report card (Good / Needs care / See a vet), in the same role as the plan's free Google Maps health check.
- **One-off services + monthly Care Club:** the plan's setup and monthly care tiers, prepaid.
- **Trust promises:** real reviews only (never bought, faked, filtered or deleted), the owner keeps their records, the price is agreed first, and messages stop on request.
- **LINE-first contact, English / Traditional Chinese toggle.**
- **Lead capture** with the tracker's fields (status, owner, *Do not contact*) plus explicit privacy and marketing consent and an opt-out page.

## Run it

```bash
npm run dev        # installs deps if needed, builds the client bundle, serves http://localhost:3000
npm test
npm run build:watch   # optional: rebuild the bundle on every change in client/
```

You don't need to run `npm ci` yourself. `npm run dev` runs it only on a fresh clone or when
`package-lock.json` changed (for example after a `git pull` that updated dependencies);
otherwise it skips straight to starting. `npm run setup` does just that check.

Production:

```bash
cp .env.example .env
npm run keys       # paste output into .env / your host's secret store
NODE_ENV=production npm start
# or
docker build -t tidytail . && docker run --env-file .env -p 3000:3000 -v tidytail-data:/app/data tidytail
```

## Leads

| Task | How |
| --- | --- |
| List leads (JSON) | `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://host/api/admin/leads` |
| Export CSV (on server) | `npm run leads:export > leads.csv` (treat as confidential) |
| Delete old leads | `npm run leads:purge` (schedule daily) |

Each lead gets `status` (`New`, or `Do not contact` after an opt-out), `owner` (`Not set`) and `marketingAllowed`.

## Motion & effects

Everything is themed on the grooming story and the brand's **soap-film palette**
(`--iris-1…4`: mint, lilac, peach, sky), defined once in `public/assets/styles.css`.

| Effect | Where | Library |
| --- | --- | --- |
| Real-time 3D soap bubbles with a custom iridescent shader; drift from the cursor, pop into droplets on click | Hero | three.js |
| Headline "rinses" up letter by letter, foam squiggle draws in, stats count up | Hero | GSAP SplitText |
| Smooth inertial scrolling, header tucks away, paw runs along an iridescent progress bar | Whole page | Lenis + GSAP ScrollTrigger |
| Bilingual marquee that speeds up and skews with scroll speed | Under hero | GSAP + Lenis |
| Report card gets "scanned" and each result pops in | Free check | GSAP |
| Wavy line draws between the three steps as you scroll | How it works | GSAP ScrollTrigger |
| Cards tilt in 3D with a soap-film glare; buttons are magnetic | Cards, buttons | GSAP |
| Price "ticks" to the new estimate | Estimator | GSAP |
| Before/after slider sweeps itself once | Before & after | GSAP |
| Custom bubble cursor that leaves a trail of paw prints | Desktop | GSAP |
| Paw-print + bubble confetti on booking; form shakes on errors | Booking | canvas-confetti |
| Optional synthesised "bloop" and chime (off by default) | Header toggle | Web Audio API |
| Bubbly "suds" edges, aurora wash, film grain, rotating iridescent borders, footer wordmark | CSS | — |

**Accessibility & performance:** visitors with *reduce motion* switched on get the plain page (no
motion JS loads at all). The 3D scene loads lazily after the page is idle, pauses when off-screen
or in a background tab, caps pixel density, and uses fewer, smaller bubbles on phones.

**Supply chain:** libraries come from npm (not cloned repos), pinned to exact versions at least two
weeks old, installed with `ignore-scripts=true`, checked by `npm audit` and `npm audit signatures`,
bundled with esbuild and served from our own domain, so the strict CSP (`script-src 'self'`) is
unchanged. A test fails the build if any bundled file uses `eval`/`new Function` or imports remote code.

## Layout

```
client/            browser source (bundled by esbuild into public/assets/dist/)
  app.js  core.js  i18n.js
  fx/          bubbles3d  scroll  reveal  tilt  cursor  confetti  sound
public/            static landing page (no inline JS/CSS, works under strict CSP)
  index.html  privacy.html  opt-out.html  404.html
  assets/      styles.css  opt-out.js  favicon.svg  dist/ (build output, git-ignored)
src/
  app.js       Express app + security middleware + routes
  config.js    env config, refuses weak or missing secrets in production
  lib/         crypto (AES-GCM, HMAC), csrf, validation (zod), store (JSONL), logger
scripts/       build, generate-secrets, export-leads, purge-leads
test/          node:test + supertest security tests
```

See [SECURITY.md](SECURITY.md) for the full list of security controls and the operating checklist.
