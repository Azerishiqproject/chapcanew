import { Timestamp } from 'firebase/firestore';

export type PageCursor = string;
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'İşlem başarısız.'; }
function encode(value: unknown): unknown {
  if (value instanceof Timestamp) return { $timestamp: value.toMillis() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}
function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>;
    if (typeof data.$timestamp === 'number') return Timestamp.fromMillis(data.$timestamp);
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}
export async function api<T>(path: string, method = 'GET', body?: unknown, options: { keepalive?: boolean } = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method, credentials: 'same-origin', cache: 'no-store', keepalive: options.keepalive,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(encode(body)),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('auth/')) window.dispatchEvent(new Event('chapca-session-expired'));
    throw new Error(data.error || 'İşlem başarısız.');
  }
  return decode(data) as T;
}
