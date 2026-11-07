// Signed double-submit CSRF tokens that also act as a "time trap" for bots.
//
// GET /api/csrf sets an HttpOnly, SameSite=Strict cookie holding a random nonce and
// returns a token = nonce.issuedAt.signature. A state-changing request must send the
// token in the X-CSRF-Token header; the server checks the signature, that the nonce
// matches the cookie, and that the token is neither too fresh (bot) nor too old.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { timingSafeEqualStr } from './crypto.js';

export const CSRF_COOKIE = config.isProd ? '__Host-tt_csrf' : 'tt_csrf';
export const CSRF_HEADER = 'x-csrf-token';

function sign(nonce, issuedAt) {
  return crypto.createHmac('sha256', config.csrfSecret).update(`${nonce}.${issuedAt}`).digest('base64url');
}

export function issueToken(res) {
  const nonce = crypto.randomBytes(18).toString('base64url');
  const issuedAt = Date.now().toString(36);
  res.cookie(CSRF_COOKIE, nonce, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: config.csrfMaxAgeMs,
  });
  return `${nonce}.${issuedAt}.${sign(nonce, issuedAt)}`;
}

/** Returns null when valid, otherwise a short reason code (logged, never shown to users). */
export function checkToken(req, { minAgeMs = 0 } = {}) {
  const header = req.get(CSRF_HEADER);
  const cookie = req.cookies?.[CSRF_COOKIE];
  if (!header || !cookie) return 'missing';
  const [nonce, issuedAt, sig] = header.split('.');
  if (!nonce || !issuedAt || !sig) return 'malformed';
  if (!timingSafeEqualStr(sig, sign(nonce, issuedAt))) return 'bad_signature';
  if (!timingSafeEqualStr(nonce, cookie)) return 'cookie_mismatch';
  const age = Date.now() - parseInt(issuedAt, 36);
  if (!Number.isFinite(age) || age < 0 || age > config.csrfMaxAgeMs) return 'expired';
  if (age < minAgeMs) return 'too_fast';
  return null;
}
