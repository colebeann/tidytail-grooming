// Decrypts leads and writes a CSV to stdout. Run on the server: npm run leads:export > leads.csv
// Cells are escaped against CSV/formula injection. Treat the output file as confidential.
import { listLeads } from '../src/lib/store.js';

const cols = ['reference', 'createdAt', 'status', 'owner', 'marketingAllowed', 'ownerName', 'phone', 'email', 'lineId',
  'petName', 'species', 'breed', 'size', 'service', 'concerns', 'preferredDate', 'district', 'language', 'notes'];

function cell(v) {
  let s = Array.isArray(v) ? v.join('|') : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

const leads = await listLeads();
process.stdout.write(cols.join(',') + '\n');
for (const l of leads) process.stdout.write(cols.map((c) => cell(l[c])).join(',') + '\n');
