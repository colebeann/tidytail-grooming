// Minimal structured logger. It never receives request bodies, so personal data
// (names, phones, emails, notes) cannot end up in logs. Keys that look sensitive
// are redacted as a second line of defence.
const SENSITIVE = /pass|token|secret|key|cookie|authorization|phone|email|name|line/i;

function redact(meta) {
  const out = {};
  for (const [k, v] of Object.entries(meta || {})) out[k] = SENSITIVE.test(k) ? '[redacted]' : v;
  return out;
}

function write(level, msg, meta) {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...redact(meta) });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

export const log = {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
