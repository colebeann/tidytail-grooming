import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
const { encrypt, decrypt, contactHash } = await import('../src/lib/crypto.js');

test('encrypt/decrypt round trip and tamper detection', () => {
  const token = encrypt({ a: 'secret' });
  assert.deepEqual(decrypt(token), { a: 'secret' });
  const parts = token.split('.');
  parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
  assert.throws(() => decrypt(parts.join('.')));
});

test('contact hash normalises phone formats', () => {
  assert.equal(contactHash('+886 912-345-678'), contactHash('0912345678'));
  assert.equal(contactHash('Foo@Example.com '), contactHash('foo@example.com'));
  assert.notEqual(contactHash('0912345678'), contactHash('0912345679'));
});
