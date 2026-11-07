// Prints a fresh set of secrets for a .env file. Run: npm run keys
// Keep the ADMIN_TOKEN somewhere safe (a password manager). Only its hash goes on the server.
import crypto from 'node:crypto';

const b64 = () => crypto.randomBytes(32).toString('base64');
const adminToken = crypto.randomBytes(32).toString('base64url');

console.log(`CSRF_SECRET=${b64()}
LEAD_ENCRYPTION_KEY=${b64()}
HASH_PEPPER=${b64()}
ADMIN_TOKEN_SHA256=${crypto.createHash('sha256').update(adminToken).digest('hex')}

# Admin token (store in a password manager, do NOT put it in .env on the server):
# ${adminToken}`);
