import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-test-'));
const ADMIN = 'test-admin-token';
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = dataDir;
process.env.MIN_FILL_MS = '0';
process.env.ADMIN_TOKEN_SHA256 = crypto.createHash('sha256').update(ADMIN).digest('hex');

const { default: request } = await import('supertest');
const { createApp } = await import('../src/app.js');
const app = createApp({ formLimit: 1000 });

after(() => fs.rm(dataDir, { recursive: true, force: true }));

const validLead = () => ({
  ownerName: 'Test Owner', phone: '0912 345 678', email: '', lineId: 'test.owner',
  petName: 'Mochi', species: 'dog', breed: 'Shiba', size: 'small', service: 'free-check',
  concerns: ['matting'], preferredDate: '', district: 'dajia', notes: 'Shy with dryers',
  language: 'en', consentPrivacy: true, consentMarketing: true, website: '',
});

async function session() {
  const agent = request.agent(app);
  const res = await agent.get('/api/csrf');
  return { agent, token: res.body.token };
}

test('security headers are set', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  const csp = res.headers['content-security-policy'];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
  assert.ok(res.headers['permissions-policy']);
});

test('index.html has no inline scripts or styles (CSP compatible)', async () => {
  for (const f of ['index.html', 'privacy.html', 'opt-out.html', '404.html']) {
    const html = await fs.readFile(new URL('../public/' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, f + ' inline script');
    assert.doesNotMatch(html, /\sstyle=/i, f + ' inline style');
    assert.doesNotMatch(html, /\son[a-z]+=/i, f + ' inline handler');
  }
});

test('lead is rejected without CSRF token', async () => {
  const res = await request(app).post('/api/leads').send(validLead());
  assert.equal(res.status, 403);
});

test('lead is rejected with a forged token', async () => {
  const { agent } = await session();
  const res = await agent.post('/api/leads').set('X-CSRF-Token', 'abc.def.ghi').send(validLead());
  assert.equal(res.status, 403);
});

test('cross-site request is blocked', async () => {
  const { agent, token } = await session();
  const res = await agent.post('/api/leads').set('X-CSRF-Token', token).set('Origin', 'https://evil.example').send(validLead());
  assert.equal(res.status, 403);
});

test('non-JSON body is rejected', async () => {
  const { agent, token } = await session();
  const res = await agent.post('/api/leads').set('X-CSRF-Token', token).type('form').send('ownerName=x');
  assert.equal(res.status, 415);
});

test('oversized body is rejected', async () => {
  const { agent, token } = await session();
  const res = await agent.post('/api/leads').set('X-CSRF-Token', token).send({ ...validLead(), notes: 'x'.repeat(20000) });
  assert.equal(res.status, 413);
});

test('valid lead is stored encrypted', async () => {
  const { agent, token } = await session();
  const res = await agent.post('/api/leads').set('X-CSRF-Token', token).send(validLead());
  assert.equal(res.status, 201);
  assert.match(res.body.reference, /^TT-[0-9A-F]{8}$/);
  const raw = await fs.readFile(path.join(dataDir, 'leads.jsonl'), 'utf8');
  assert.doesNotMatch(raw, /Test Owner|0912|Mochi|test\.owner/);
  const stat = await fs.stat(path.join(dataDir, 'leads.jsonl'));
  assert.equal(stat.mode & 0o077, 0, 'file must not be group/world readable');
});

test('validation rejects unknown fields, bad values, missing consent and formula injection', async () => {
  const cases = [
    { ...validLead(), isAdmin: true },
    { ...validLead(), species: 'dragon' },
    { ...validLead(), consentPrivacy: false },
    { ...validLead(), phone: '', email: '', lineId: '' },
    { ...validLead(), ownerName: '=HYPERLINK("http://x")' },
    { ...validLead(), ownerName: 'Bad\u0000Name' },
    { ...validLead(), preferredDate: '2001-01-01' },
  ];
  for (const body of cases) {
    const { agent, token } = await session();
    const res = await agent.post('/api/leads').set('X-CSRF-Token', token).send(body);
    assert.equal(res.status, 422, JSON.stringify(body).slice(0, 80));
    assert.doesNotMatch(JSON.stringify(res.body), /HYPERLINK|dragon/, 'errors must not echo input');
  }
});

test('honeypot submissions get a fake success and are not stored', async () => {
  const before = (await fs.readFile(path.join(dataDir, 'leads.jsonl'), 'utf8')).split('\n').length;
  const { agent, token } = await session();
  const res = await agent.post('/api/leads').set('X-CSRF-Token', token).send({ ...validLead(), website: 'http://spam' });
  assert.equal(res.status, 201);
  const afterLen = (await fs.readFile(path.join(dataDir, 'leads.jsonl'), 'utf8')).split('\n').length;
  assert.equal(afterLen, before);
});

test('admin API requires the token', async () => {
  assert.equal((await request(app).get('/api/admin/leads')).status, 401);
  assert.equal((await request(app).get('/api/admin/leads').set('Authorization', 'Bearer wrong')).status, 401);
  const res = await request(app).get('/api/admin/leads').set('Authorization', `Bearer ${ADMIN}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.leads[0].ownerName, 'Test Owner');
  assert.equal(res.body.leads[0].marketingAllowed, true);
});

test('opt-out marks existing leads as Do not contact', async () => {
  const { agent, token } = await session();
  const res = await agent.post('/api/opt-out').set('X-CSRF-Token', token).send({ contact: '+886 912-345-678' });
  assert.equal(res.status, 200);
  const list = await request(app).get('/api/admin/leads').set('Authorization', `Bearer ${ADMIN}`);
  const lead = list.body.leads.find((l) => l.ownerName === 'Test Owner');
  assert.equal(lead.status, 'Do not contact');
  assert.equal(lead.marketingAllowed, false);
});

test('unknown API routes return JSON 404 and no stack traces', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.ok, false);
  const bad = await request(app).post('/api/opt-out').set('Content-Type', 'application/json').send('{bad json');
  assert.ok(bad.status >= 400 && bad.status < 500);
  assert.doesNotMatch(bad.text, /at .*\.js:\d+/);
});

test('dotfiles are not served', async () => {
  const res = await request(app).get('/.env');
  assert.notEqual(res.status, 200);
});

test('form endpoint is rate limited', async () => {
  const limited = createApp({ formLimit: 2 });
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await request(limited).post('/api/opt-out').send({ contact: 'a@b.co' })).status);
  assert.equal(codes[2], 429);
});
