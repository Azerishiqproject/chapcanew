import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Geçersiz veri.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 200, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new ApiError(400, 'Geçersiz metin alanı.');
  }
  return value.trim();
}
export function emailAddress(value: unknown): string {
  const email = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'auth/invalid-email');
  return email;
}
export function passwordInput(value: unknown, creating = false): string {
  if (typeof value !== 'string' || value.length < (creating ? 8 : 1) || value.length > 128) {
    throw new ApiError(400, 'Şifre 8–128 karakter olmalıdır.');
  }
  return value;
}
export function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function newSessionToken(): string { return randomBytes(32).toString('hex'); }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: unknown): Promise<boolean> {
  if (typeof encoded !== 'string' || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded)) return false;
  const [, salt, hash] = encoded.split('$');
  const key = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(Buffer.from(hash, 'hex'), key);
}

export function assertSameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'Geçersiz istek kaynağı.');
  }
}
export async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'JSON gereklidir.');
  if (Number(request.headers.get('content-length')) > 65536) throw new ApiError(413, 'İstek çok büyük.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Boş istek.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) { await reader.cancel(); throw new ApiError(413, 'İstek çok büyük.'); }
    chunks.push(value);
  }
  try { return record(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
  catch { throw new ApiError(400, 'Geçersiz JSON.'); }
}
