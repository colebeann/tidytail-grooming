# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private
[security advisory](../../security/advisories/new) form for this repository, or email
security@tidytail.example (placeholder). We aim to reply within 3 working days.

## What is protected and how

| Layer | Control |
| --- | --- |
| Transport | HTTPS only in production (HSTS 2 years + preload, `upgrade-insecure-requests`) |
| Browser | Strict CSP (`default-src 'none'`, no inline script/style, no third-party origins), `frame-ancestors 'none'`, `nosniff`, strict Referrer-Policy, locked-down Permissions-Policy, COOP/CORP |
| Abuse | Global rate limit, 8 form posts / 15 min / IP, admin API limited, 8 KB JSON body cap, server timeouts against slow clients |
| Forgery | Signed double-submit CSRF token + `SameSite=Strict` `__Host-` cookie, Origin and `Sec-Fetch-Site` checks |
| Bots | Hidden honeypot field and minimum fill time; bots receive a fake success |
| Input | Zod allow-list schemas, unknown fields rejected, length caps, control/bidi characters blocked, spreadsheet formula-injection blocked |
| Data at rest | Lead details encrypted with AES-256-GCM; phones/emails stored as HMAC-SHA256 hashes for matching; files `0600`, folder `0700` |
| Consent | Required privacy consent, separate optional marketing consent, `/opt-out` page; opted-out contacts show as **Do not contact** and lose marketing permission |
| Retention | `npm run leads:purge` deletes leads older than `LEAD_RETENTION_DAYS` (default 365) |
| Admin | Bearer token; only its SHA-256 is on the server; timing-safe compare |
| Errors & logs | Generic error messages, no stack traces; logs never include form contents and redact sensitive keys |
| Supply chain | Exact-pinned dependencies (versions ≥ 2 weeks old when added), lockfile integrity hashes, `ignore-scripts=true` (no package install scripts run), `npm audit` + `npm audit signatures` in CI, Dependabot, CodeQL, secret scanning (gitleaks) |
| Front-end libraries | three.js, GSAP, Lenis, canvas-confetti are bundled and self-hosted (no CDNs), so CSP stays `script-src 'self'`; a test rejects `eval`, `new Function` or remote imports in the bundle; confetti runs without Web Workers |
| Compression | Gzip for static files only; API responses are never compressed (BREACH) |
| Runtime | Docker image runs as non-root `node` user, dev dependencies excluded |

## Operating checklist

- [ ] Generate secrets with `npm run keys`; store them in the host's secret manager, never in git.
- [ ] Keep the admin token in a password manager. Rotate it and `CSRF_SECRET` at least yearly.
- [ ] `LEAD_ENCRYPTION_KEY` cannot be changed without re-encrypting data: back it up separately from the data.
- [ ] Turn on GitHub branch protection for `main` (require PR + passing CI), secret scanning and push protection.
- [ ] Enable code scanning (needs GitHub Code Security on a private repo), then add repo variable `CODE_SCANNING=true` so the CodeQL workflow runs.
- [ ] Schedule `npm run leads:purge` daily.
- [ ] Back up `data/` encrypted, and test a restore.
- [ ] Have the privacy notice reviewed against Taiwan's PDPA before going live.
