import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminServices } from './firebase-admin';
import { ApiError, digest, newSessionToken } from './security';
import { ADMIN_EMAIL, SESSION_SECONDS } from '../auth-config';

export const ADMIN_COOKIE = 'chapca_admin_session';
export const USER_COOKIE = 'chapca_user_session';
export interface Identity { uid: string; email: string; name: string; status: 'admin' | 'user' }
export const cookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const, path: '/', maxAge: SESSION_SECONDS,
};
export function clearCookies(response: NextResponse) {
  for (const name of [ADMIN_COOKIE, USER_COOKIE]) response.cookies.set(name, '', { ...cookieOptions, maxAge: 0 });
}
export function requireAdmin(identity: Identity) {
  if (identity.status !== 'admin') throw new ApiError(403, 'Admin yetkisi gereklidir.');
}
export function requireOwner(identity: Identity, uid: string) {
  if (identity.status !== 'admin' && identity.uid !== uid) throw new ApiError(403, 'Bu kayda erişemezsiniz.');
}
export function isConfiguredAdmin(uid: string, email: string | undefined) {
  return !!process.env.FIREBASE_ADMIN_UID && uid === process.env.FIREBASE_ADMIN_UID && email === ADMIN_EMAIL;
}
export async function getIdentity(request: NextRequest): Promise<Identity> {
  const { auth, db } = adminServices();
  const adminCookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (adminCookie) {
    try {
      const claims = await auth.verifySessionCookie(adminCookie, true);
      const account = await auth.getUser(claims.uid);
      if (account.disabled || !isConfiguredAdmin(claims.uid, claims.email) || account.email !== ADMIN_EMAIL) throw new Error('Not admin');
      return { uid: claims.uid, email: ADMIN_EMAIL, name: account.displayName || 'Admin', status: 'admin' };
    } catch { throw new ApiError(401, 'auth/session-expired'); }
  }
  const token = request.cookies.get(USER_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401, 'auth/session-expired');
  const session = (await db.collection('serverSessions').doc(digest(token)).get()).data();
  if (!session || !(session.expiresAt instanceof Timestamp) || session.expiresAt.toMillis() <= Date.now() ||
      typeof session.userId !== 'string') throw new ApiError(401, 'auth/session-expired');
  const user = (await db.collection('users').doc(session.userId).get()).data();
  if (!user || user.status !== 'user' || user.email === ADMIN_EMAIL || user.disabled === true ||
      typeof user.sessionVersion !== 'string' || user.sessionVersion !== session.sessionVersion) throw new ApiError(401, 'auth/session-expired');
  return { uid: session.userId, email: user.email, name: user.name, status: 'user' };
}
export async function createUserSession(userId: string, passwordHash: string) {
  const { db } = adminServices();
  const token = newSessionToken();
  await db.runTransaction(async (transaction) => {
    const user = (await transaction.get(db.collection('users').doc(userId))).data();
    if (!user || user.passwordHash !== passwordHash || user.disabled === true || user.status !== 'user' || user.email === ADMIN_EMAIL) {
      throw new ApiError(401, 'auth/invalid-credential');
    }
    transaction.set(db.collection('serverSessions').doc(digest(token)), {
      userId, sessionVersion: user.sessionVersion,
      createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + SESSION_SECONDS * 1000),
    });
  });
  return token;
}
export async function removeUserSession(request: NextRequest) {
  const token = request.cookies.get(USER_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await adminServices().db.collection('serverSessions').doc(digest(token)).delete();
  }
}

// A persistent per-account limit applies across server instances. The global
// bucket also bounds attempts using randomized/nonexistent email addresses.
export async function consumeLoginAttempt(email: string) {
  const { db } = adminServices();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const buckets = [{ key: digest(email), max: 10 }, { key: 'all-logins', max: 300 }];
  await db.runTransaction(async (transaction) => {
    const refs = buckets.map(({ key }) => db.collection('loginAttempts').doc(key));
    const docs = await transaction.getAll(...refs);
    const states = docs.map((doc) => {
      const data = doc.data();
      return data && data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > now
        ? { count: Number(data.count), expiresAt: data.expiresAt }
        : { count: 0, expiresAt: Timestamp.fromMillis(now + windowMs) };
    });
    if (states.some((state, i) => state.count >= buckets[i].max)) throw new ApiError(429, 'auth/too-many-requests');
    refs.forEach((ref, i) => transaction.set(ref, { ...states[i], count: states[i].count + 1 }));
  });
}
