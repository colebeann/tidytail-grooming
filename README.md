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
npm ci
npm run dev        # http://localhost:3000 (ephemeral dev keys)
npm test
```

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

## Layout

```
public/            static landing page (no inline JS/CSS, works under strict CSP)
  index.html  privacy.html  opt-out.html  404.html
  assets/      styles.css  main.js  i18n.js  opt-out.js  favicon.svg
src/
  app.js       Express app + security middleware + routes
  config.js    env config, refuses weak or missing secrets in production
  lib/         crypto (AES-GCM, HMAC), csrf, validation (zod), store (JSONL), logger
scripts/       generate-secrets, export-leads, purge-leads
test/          node:test + supertest security tests
```

See [SECURITY.md](SECURITY.md) for the full list of security controls and the operating checklist.
