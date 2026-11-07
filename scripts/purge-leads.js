// Deletes leads older than LEAD_RETENTION_DAYS (default 365). Schedule it daily.
import { purgeOlderThan } from '../src/lib/store.js';
import { config } from '../src/config.js';

const removed = await purgeOlderThan();
console.log(`Removed ${removed} lead(s) older than ${config.retentionDays} days.`);
