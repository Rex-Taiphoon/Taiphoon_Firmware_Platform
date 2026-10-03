import { createCipheriv, createDecipheriv, randomBytes, createSign } from 'node:crypto';

export function seal(value: unknown, key: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'base64url'), iv);
  return Buffer.concat([iv, cipher.update(JSON.stringify(value), 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64url');
}
export function unseal<T>(token: string, key: string): T {
  const data = Buffer.from(token, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64url'), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]).toString()) as T;
}
export function appJwt(appId: string, pem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const body = [ { alg: 'RS256', typ: 'JWT' }, { iat: now - 60, exp: now + 540, iss: appId } ].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  const signature = createSign('RSA-SHA256').update(body).sign(pem.replace(/\\n/g, '\n'), 'base64url');
  return `${body}.${signature}`;
}
