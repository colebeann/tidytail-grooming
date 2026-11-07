// Central configuration. All secrets come from the environment.
// In production the server refuses to start if any secret is missing or weak.
import crypto from 'node:crypto';
import path from 'node:path';

const env = process.env;
const NODE_ENV = env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

function secret(name, { bytes = 32 } = {}) {
  const value = env[name];
  if (value) {
    const raw = Buffer.from(value, 'base64');
    if (raw.length < bytes) {
      throw new Error(`${name} must be at least ${bytes} bytes, base64 encoded. Run "npm run keys".`);
    }
    return raw;
  }
  if (isProd) {
    throw new Error(`${name} is required in production. Run "npm run keys" and set it in the environment.`);
  }
  // Development / test only: an ephemeral key. Data encrypted with it is unreadable after a restart.
  if (NODE_ENV !== 'test') {
    console.warn(`[config] ${name} not set, using an ephemeral development key.`);
  }
  return crypto.randomBytes(bytes);
}

function list(value, fallback) {
  return (value ? value.split(',') : fallback).map((s) => s.trim()).filter(Boolean);
}

export const config = Object.freeze({
  env: NODE_ENV,
  isProd,
  port: Number(env.PORT || 3000),
  // Number of reverse proxies in front of the app (e.g. 1 behind a load balancer). 0 = trust none.
  trustProxy: Number(env.TRUST_PROXY || 0),
  allowedOrigins: list(env.ALLOWED_ORIGINS, isProd ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']),
  dataDir: path.resolve(env.DATA_DIR || 'data'),
  retentionDays: Number(env.LEAD_RETENTION_DAYS || 365),
  csrfSecret: secret('CSRF_SECRET'),
  encryptionKey: secret('LEAD_ENCRYPTION_KEY'),
  hashPepper: secret('HASH_PEPPER'),
  // SHA-256 hex of the admin token. The plain token is never stored on the server.
  adminTokenSha256: env.ADMIN_TOKEN_SHA256 || '',
  // Form submissions allowed per IP per 15 minutes.
  formRateLimit: Number(env.FORM_RATE_LIMIT || 8),
  // Minimum time a human needs to fill the form. Faster submissions are treated as bots.
  minFillMs: Number(env.MIN_FILL_MS ?? 3000),
  csrfMaxAgeMs: 2 * 60 * 60 * 1000,
});

if (isProd && config.allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS is required in production (e.g. https://tidytail.example).');
}
if (isProd && !/^[a-f0-9]{64}$/.test(config.adminTokenSha256)) {
  console.warn('[config] ADMIN_TOKEN_SHA256 not set: the admin leads API is disabled.');
}
