// Field-level encryption and keyed hashing for personal data.
// - Lead details are encrypted at rest with AES-256-GCM (authenticated encryption).
// - Phone numbers and emails are also stored as keyed HMAC hashes so duplicates and
//   opt-outs can be matched without decrypting anything.
import crypto from 'node:crypto';
import { config } from '../config.js';

const VERSION = 'v1';

export function encrypt(obj, key = config.encryptionKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key.subarray(0, 32), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(token, key = config.encryptionKey) {
  const [version, iv, tag, data] = String(token).split('.');
  if (version !== VERSION) throw new Error('Unknown ciphertext version');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key.subarray(0, 32), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const out = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]);
  return JSON.parse(out.toString('utf8'));
}

export function normalizeContact(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('@')) return v;
  // Phone: keep digits only, map Taiwan +886 prefix to a leading 0.
  let digits = v.replace(/\D/g, '');
  if (digits.startsWith('886')) digits = '0' + digits.slice(3);
  return digits;
}

export function contactHash(value) {
  const normalized = normalizeContact(value);
  if (!normalized) return '';
  return crypto.createHmac('sha256', config.hashPepper).update(normalized).digest('hex');
}

export function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
