// Append-only lead storage on local disk (JSON Lines), good enough for a mock-up and
// easy to swap for a database later. Files are created owner-read/write only.
//
// leads.jsonl        one record per submission; personal data is encrypted
// suppression.jsonl  hashed contacts that asked not to be contacted ("Do not contact")
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { encrypt, decrypt, contactHash } from './crypto.js';

const files = () => ({
  leads: path.join(config.dataDir, 'leads.jsonl'),
  suppression: path.join(config.dataDir, 'suppression.jsonl'),
});

let queue = Promise.resolve();
// Serialise writes so concurrent requests never interleave lines.
function enqueue(fn) {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

async function ensureDir() {
  await fs.mkdir(config.dataDir, { recursive: true, mode: 0o700 });
}

async function append(file, record) {
  await ensureDir();
  await fs.appendFile(file, JSON.stringify(record) + '\n', { mode: 0o600 });
}

async function readLines(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export function newReference() {
  // Short, non-sequential reference so customers can quote it without exposing volume.
  return 'TT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function isSuppressed(hashes) {
  const list = await readLines(files().suppression);
  const set = new Set(list.map((r) => r.hash));
  return hashes.some((h) => h && set.has(h));
}

export async function saveLead(lead) {
  const phoneHash = contactHash(lead.phone);
  const emailHash = contactHash(lead.email);
  const suppressed = await isSuppressed([phoneHash, emailHash]);
  const record = {
    id: crypto.randomUUID(),
    reference: newReference(),
    createdAt: new Date().toISOString(),
    status: 'New',
    owner: 'Not set',
    // Marketing consent is withdrawn automatically if this contact opted out before.
    marketingAllowed: Boolean(lead.consentMarketing) && !suppressed,
    phoneHash,
    emailHash,
    payload: encrypt(lead),
  };
  await enqueue(() => append(files().leads, record));
  return record;
}

export async function addSuppression(contact) {
  const hash = contactHash(contact);
  if (!hash) return;
  await enqueue(() => append(files().suppression, { hash, createdAt: new Date().toISOString() }));
}

export async function listLeads() {
  const [leads, suppression] = await Promise.all([readLines(files().leads), readLines(files().suppression)]);
  const blocked = new Set(suppression.map((r) => r.hash));
  return leads.map(({ payload, phoneHash, emailHash, ...meta }) => {
    const doNotContact = blocked.has(phoneHash) || blocked.has(emailHash);
    return {
      ...meta,
      status: doNotContact ? 'Do not contact' : meta.status,
      marketingAllowed: meta.marketingAllowed && !doNotContact,
      ...decrypt(payload),
    };
  });
}

/** Deletes leads older than the retention window. Returns the number removed. */
export async function purgeOlderThan(days = config.retentionDays) {
  return enqueue(async () => {
    const cutoff = Date.now() - days * 86400000;
    const leads = await readLines(files().leads);
    const keep = leads.filter((l) => Date.parse(l.createdAt) >= cutoff);
    if (keep.length === leads.length) return 0;
    const tmp = files().leads + '.tmp';
    await fs.writeFile(tmp, keep.map((l) => JSON.stringify(l) + '\n').join(''), { mode: 0o600 });
    await fs.rename(tmp, files().leads);
    return leads.length - keep.length;
  });
}
