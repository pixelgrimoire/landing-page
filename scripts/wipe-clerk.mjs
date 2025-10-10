#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Minimal .env loader for standalone scripts
function loadDotEnv() {
  try {
    const file = path.join(process.cwd(), '.env');
    if (!fs.existsSync(file)) return;
    const txt = fs.readFileSync(file, 'utf8');
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      let v = line.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}

loadDotEnv();

const key = process.env.CLERK_SECRET_KEY || '';
if (!key) { console.error('CLERK_SECRET_KEY not set'); process.exit(1); }
if (!key.startsWith('sk_test_')) {
  console.error('Refusing to wipe: Clerk key is not test mode');
  process.exit(2);
}

const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
const includeAdmins = process.argv.includes('--include-admin') || /^true$/i.test(process.env.WIPE_ADMINS || '');
if (includeAdmins) {
  console.warn('[clerk] INCLUDE-ADMIN enabled: admin accounts WILL be deleted.');
}

async function listUsers(limit=100) {
  let offset = 0; const all = [];
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(`https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!res.ok) throw new Error(`List users failed: ${res.status}`);
    // Clerk returns an array for list
    // eslint-disable-next-line no-await-in-loop
    const arr = await res.json();
    const batch = Array.isArray(arr) ? arr : (Array.isArray(arr?.data) ? arr.data : []);
    if (!batch.length) break;
    all.push(...batch);
    offset += batch.length;
  }
  return all;
}

async function main() {
  console.log('[clerk] Listing users...');
  const users = await listUsers();
  for (const u of users) {
    const emails = (u?.email_addresses || u?.emailAddresses || []).map((e)=> (e.email_address || e.emailAddress || '').toLowerCase());
    const isAdmin = emails.some((em)=> adminEmails.includes(em));
    if (isAdmin && !includeAdmins) { console.log('  skip admin', u.id, emails[0]); continue; }
    try {
      // eslint-disable-next-line no-await-in-loop
      const del = await fetch(`https://api.clerk.com/v1/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } });
      if (!del.ok) throw new Error(`status ${del.status}`);
      console.log('  deleted user', u.id, emails[0] || '');
    } catch (e) { console.warn('  delete failed', u.id, e?.message || e); }
  }
  console.log('[clerk] wipe complete');
}

main().catch((e)=>{ console.error(e); process.exit(1); });
