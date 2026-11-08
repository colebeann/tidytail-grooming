// Runs `npm ci` only when it is actually needed: on a fresh clone, or when
// package-lock.json (or the Node version / platform) changed since the last install.
// Uses Node built-ins only, because it runs before dependencies exist.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const STAMP = 'node_modules/.tidytail-deps-stamp';

const fingerprint = crypto
  .createHash('sha256')
  .update(fs.readFileSync('package-lock.json'))
  .update(`${process.version}|${process.platform}|${process.arch}`)
  .digest('hex');

let current = '';
try {
  current = fs.readFileSync(STAMP, 'utf8').trim();
} catch {
  // No stamp yet: fresh clone or deps installed by hand.
}

if (current === fingerprint) process.exit(0);

console.log('Dependencies changed or missing: running npm ci…');
// shell is required to run npm.cmd on Windows; the arguments are fixed, not user input.
const result = spawnSync('npm', ['ci'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) {
  console.error('npm ci failed. Fix the error above, then run npm run dev again.');
  process.exit(result.status ?? 1);
}
fs.writeFileSync(STAMP, fingerprint + '\n');
