#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}

loadDotEnv();

const key = process.env.CLERK_SECRET_KEY || '';
if (!key) { console.error('CLERK_SECRET_KEY not set'); process.exit(1); }

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/make-admin.mjs <email@example.com>');
  process.exit(1);
}

async function listUsers(limit=100) {
  let offset = 0; const all = [];
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(`https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`List users failed: ${res.status}`);
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
  console.log('[clerk] Looking up user by email:', email);
  const users = await listUsers();
  const user = users.find(u => (u?.email_addresses || u?.emailAddresses || []).some(e => (e.email_address || e.emailAddress || '').toLowerCase() === email));
  if (!user) { console.error('User not found'); process.exit(2); }

  const id = user.id;
  const currentPub = (user.public_metadata || user.publicMetadata || {}) || {};
  const nextPub = { ...currentPub, role: 'admin' };
  console.log('[clerk] Granting admin via public_metadata.role=admin for', id);

  const res = await fetch(`https://api.clerk.com/v1/users/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_metadata: nextPub })
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`Update failed: ${res.status} ${txt}`);
  }
  console.log('[clerk] Done. Re-login or refresh session to reflect changes.');
}

main().catch((e)=>{ console.error(e); process.exit(1); });

