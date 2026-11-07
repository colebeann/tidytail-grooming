// Express application with a layered security setup:
//  1. Hardened HTTP headers (strict CSP, HSTS, no framing, no sniffing, Permissions-Policy)
//  2. Rate limits: global, plus tight limits on form and admin endpoints
//  3. Small JSON-only bodies, strict schema validation, unknown fields rejected
//  4. CSRF (signed double-submit + SameSite=Strict cookie) and Origin / Fetch-Metadata checks
//  5. Bot defences: honeypot field + minimum fill time
//  6. Personal data encrypted at rest; contacts hashed for opt-out matching
//  7. Admin API behind a hashed bearer token with timing-safe comparison
//  8. Errors never leak stack traces; logs never contain personal data
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { issueToken, checkToken } from './lib/csrf.js';
import { leadSchema, optOutSchema, fieldErrors } from './lib/validation.js';
import { saveLead, addSuppression, listLeads, newReference } from './lib/store.js';
import { sha256Hex, timingSafeEqualStr } from './lib/crypto.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp({ formLimit = config.formRateLimit } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Request id for correlating logs without logging who the visitor is.
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api') || res.statusCode >= 400) {
        log.info('request', { id: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
      }
    });
    next();
  });

  // 1. Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          manifestSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          objectSrc: ["'none'"],
          ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      strictTransportSecurity: config.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
    next();
  });

  // 2. Rate limits
  const limiter = (windowMin, limit) =>
    rateLimit({
      windowMs: windowMin * 60 * 1000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { ok: false, error: 'Too many requests. Please try again later.' },
    });
  app.use(limiter(15, 600));
  const formLimiter = limiter(15, formLimit);
  const adminLimiter = limiter(15, 30);

  app.use(cookieParser());

  // 3. Body parsing: JSON only, small bodies
  app.use('/api', express.json({ limit: '8kb', strict: true, type: 'application/json' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ ok: false, error: 'Content-Type must be application/json' });
    }
    next();
  });

  // 4. Cross-site request checks for state-changing requests
  function sameOrigin(req, res, next) {
    const origin = req.get('origin');
    const site = req.get('sec-fetch-site');
    const selfOrigin = `${req.protocol}://${req.get('host')}`;
    const okOrigin = !origin || origin === selfOrigin || config.allowedOrigins.includes(origin);
    const okSite = !site || site === 'same-origin' || site === 'none';
    if (!okOrigin || !okSite) {
      log.warn('blocked_cross_site', { id: req.id });
      return res.status(403).json({ ok: false, error: 'Request blocked' });
    }
    next();
  }

  function csrf({ timeTrap }) {
    return (req, res, next) => {
      const reason = checkToken(req, { minAgeMs: timeTrap ? config.minFillMs : 0 });
      if (reason === 'too_fast') {
        // 5. Bot defence: pretend success so bots learn nothing.
        log.warn('bot_suspected', { id: req.id, reason });
        return res.status(201).json({ ok: true, reference: newReference() });
      }
      if (reason) {
        log.warn('csrf_rejected', { id: req.id, reason });
        return res.status(403).json({ ok: false, error: 'Your session expired. Please reload the page and try again.' });
      }
      next();
    };
  }

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.get('/api/csrf', (req, res) => {
    res.json({ token: issueToken(res) });
  });

  app.post('/api/leads', formLimiter, sameOrigin, csrf({ timeTrap: true }), async (req, res, next) => {
    try {
      const parsed = leadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({ ok: false, error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) });
      }
      const { website, ...lead } = parsed.data;
      if (website) {
        log.warn('honeypot_triggered', { id: req.id });
        return res.status(201).json({ ok: true, reference: newReference() });
      }
      const record = await saveLead(lead);
      log.info('lead_saved', { id: req.id, lead: record.id, service: lead.service });
      res.status(201).json({ ok: true, reference: record.reference });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/opt-out', formLimiter, sameOrigin, csrf({ timeTrap: false }), async (req, res, next) => {
    try {
      const parsed = optOutSchema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ ok: false, error: 'Please enter the phone number or email you gave us.' });
      if (!parsed.data.website) await addSuppression(parsed.data.contact);
      // Same answer whether or not we know the contact, so the endpoint cannot be used to look people up.
      res.json({ ok: true, message: 'Done. We will not contact you for marketing again.' });
    } catch (err) {
      next(err);
    }
  });

  // 7. Admin API: Authorization: Bearer <token>; server only knows SHA-256(token).
  function requireAdmin(req, res, next) {
    const expected = config.adminTokenSha256;
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!/^[a-f0-9]{64}$/.test(expected) || !token || !timingSafeEqualStr(sha256Hex(token), expected)) {
      log.warn('admin_denied', { id: req.id });
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    next();
  }

  app.get('/api/admin/leads', adminLimiter, requireAdmin, async (req, res, next) => {
    try {
      res.json({ ok: true, leads: await listLeads() });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

  // Static landing page
  app.use(
    express.static(publicDir, {
      dotfiles: 'deny',
      extensions: ['html'],
      index: 'index.html',
      setHeaders(res, file) {
        res.setHeader('Cache-Control', file.endsWith('.html') ? 'no-cache' : 'public, max-age=86400');
      },
    }),
  );

  app.use((req, res) => res.status(404).sendFile(path.join(publicDir, '404.html')));

  // 8. Error handler: generic message only
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) log.error('server_error', { id: req.id, error: err.message });
    const message = status === 413 ? 'Request too large' : status < 500 ? 'Bad request' : 'Something went wrong';
    res.status(status).json({ ok: false, error: message, requestId: req.id });
  });

  return app;
}
