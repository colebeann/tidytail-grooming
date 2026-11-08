# Working on this repo

## UI/UX changes: preview first
Before committing any change that affects how the site looks or behaves, publish a
preview artifact of the page and wait for the owner to review it. Only open a pull
request after the owner approves the preview.

## Basics
- `npm run dev`: installs deps only if `package-lock.json` changed (`scripts/ensure-deps.js`), builds `client/` into `public/assets/dist/`, then serves on :3000.
- `npm test` before every commit; CI runs audit, signature check, build and tests.
- Keep the strict CSP: no inline scripts/styles/handlers, no CDNs. New libraries go
  through npm with exact versions at least two weeks old (`ignore-scripts=true`).
- All data on the site is dummy data for mock-ups.
