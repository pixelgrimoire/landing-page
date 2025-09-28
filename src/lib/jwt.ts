import { createHmac } from 'node:crypto';

function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export type JwtPayload = Record<string, unknown>;

export function signJwtHS256(payload: JwtPayload, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  const encSig = base64url(signature);
  return `${data}.${encSig}`;
}

export function verifyJwtHS256(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = base64url(createHmac('sha256', secret).update(`${h}.${p}`).digest());
  if (expected !== s) return null;
  try {
    const payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && now >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
