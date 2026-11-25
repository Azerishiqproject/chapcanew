import { NextRequest, NextResponse } from 'next/server';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { adminServices } from '@/lib/server/firebase-admin';
import { ApiError, assertSameOrigin, digest, emailAddress, hashPassword, newSessionToken, passwordInput, readBody, text, verifyPassword } from '@/lib/server/security';
import { ADMIN_COOKIE, USER_COOKIE, clearCookies, consumeLoginAttempt, cookieOptions, createUserSession, getIdentity, isConfiguredAdmin, removeUserSession, requireAdmin, requireOwner } from '@/lib/server/session';
import { publicUser, SESSION_COLLECTIONS, sessionFields, sessionKind, settingsFields, userFields, wire } from '@/lib/server/data';
import { ADMIN_EMAIL, SESSION_SECONDS } from '@/lib/auth-config';
import { aimOverview, aimRunEvents, appendAimEvents, publicAimSession, startAimRun, trainingComparison } from '@/lib/server/aim-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Cookie' } });

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const route = path.join('/');
    const method = request.method;
    if (method !== 'GET') assertSameOrigin(request);
    const { db, auth } = adminServices();

    if (route === 'auth/login' && method === 'POST') {
      const body = await readBody(request);
      const email = emailAddress(body.email), password = passwordInput(body.password);
      await consumeLoginAttempt(email);
      if (email === ADMIN_EMAIL) throw new ApiError(401, 'auth/invalid-credential');
      const userDoc = await db.collection('users').doc(digest(email)).get();
      const user = userDoc.data();
      // Do equal-cost password work for nonexistent accounts as well.
      const hash = user?.passwordHash || `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
      if (!await verifyPassword(password, hash) || !user || user.disabled === true || user.status !== 'user') {
        throw new ApiError(401, 'auth/invalid-credential');
      }
      const token = await createUserSession(userDoc.id, hash);
      await removeUserSession(request);
      const response = json({ user: { uid: userDoc.id, email: user.email, name: user.name, status: 'user' } });
      clearCookies(response);
      response.cookies.set(USER_COOKIE, token, cookieOptions);
      return response;
    }
    if (route === 'auth/admin' && method === 'POST') {
      const body = await readBody(request);
      const idToken = text(body.idToken, 10000);
      await consumeLoginAttempt(ADMIN_EMAIL);
      let claims;
      try { claims = await auth.verifyIdToken(idToken, true); }
      catch { throw new ApiError(401, 'auth/invalid-credential'); }
      const account = await auth.getUser(claims.uid);
      if (!isConfiguredAdmin(claims.uid, claims.email) || account.email !== ADMIN_EMAIL ||
          account.disabled || Date.now() / 1000 - claims.auth_time > 300) {
        throw new ApiError(403, 'Admin yetkisi bulunamadı.');
      }
      const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_SECONDS * 1000 });
      await removeUserSession(request);
      const response = json({ user: { uid: claims.uid, email: ADMIN_EMAIL, name: account.displayName || 'Admin', status: 'admin' } });
      clearCookies(response);
      response.cookies.set(ADMIN_COOKIE, cookie, cookieOptions);
      return response;
    }
    if (route === 'auth/logout' && method === 'POST') {
      await removeUserSession(request);
      const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
      if (cookie) {
        let claims;
        try { claims = await auth.verifySessionCookie(cookie, true); } catch { /* already expired */ }
        if (claims && isConfiguredAdmin(claims.uid, claims.email)) await auth.revokeRefreshTokens(claims.uid);
      }
      const response = json({ ok: true });
      clearCookies(response);
      return response;
    }

    const identity = await getIdentity(request);
    if (route === 'auth/session' && method === 'GET') return json({ user: identity });

    if (route === 'aim/runs' && method === 'POST') return json(await startAimRun(identity, await readBody(request)), 201);
    if (route === 'aim/comparison' && method === 'GET') return json(await trainingComparison(identity, Number(request.nextUrl.searchParams.get('stage') || 1), request.nextUrl.searchParams.get('condition'), request.nextUrl.searchParams.get('protocol') || undefined));
    if (route === 'aim/overview' && method === 'GET') {
      return json(await aimOverview(identity, emailAddress(request.nextUrl.searchParams.get('email'))));
    }
    if (path[0] === 'aim' && path[1] === 'runs' && path[3] === 'events' && path.length === 4) {
      const runId = documentId(path[2]);
      if (method === 'POST') return json(await appendAimEvents(identity, runId, await readBody(request)));
      if (method === 'GET') return json(await aimRunEvents(identity, runId, request.nextUrl.searchParams.get('cursor')));
    }

    if (path[0] === 'users') {
      requireAdmin(identity);
      if (path.length === 1 && method === 'GET') {
        const email = request.nextUrl.searchParams.get('email');
        if (email) {
          const doc = await db.collection('users').doc(digest(emailAddress(email))).get();
          return json({ user: doc.exists ? publicUser(doc) : null });
        }
        const size = pageSize(request);
        let query = db.collection('users').orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(size);
        const cursor = request.nextUrl.searchParams.get('cursor');
        if (cursor) {
          const doc = await db.collection('users').doc(documentId(cursor)).get();
          if (!doc.exists) throw new ApiError(400, 'Sayfalama kaydı bulunamadı.');
          query = query.startAfter(doc);
        }
        const snapshot = await query.get();
        return json({ users: snapshot.docs.map(publicUser), lastDoc: snapshot.docs.at(-1)?.id || null });
      }
      if (path.length === 1 && method === 'POST') {
        const body = await readBody(request);
        const fields = userFields(body);
        if (fields.email === ADMIN_EMAIL) throw new ApiError(400, 'Admin Firestore users koleksiyonuna eklenemez.');
        const passwordHash = await hashPassword(passwordInput(body.password, true));
        const ref = db.collection('users').doc(digest(fields.email));
        await db.runTransaction(async (transaction) => {
          if ((await transaction.get(ref)).exists) throw new ApiError(409, 'Bu e-posta zaten kayıtlı.');
          transaction.create(ref, { ...fields, passwordHash, sessionVersion: newSessionToken(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        });
        return json({ user: publicUser(await ref.get()) }, 201);
      }
      if (path.length === 2) {
        const ref = db.collection('users').doc(documentId(path[1]));
        if (method === 'PATCH') {
          const body = await readBody(request);
          // Never spread arbitrary request fields into a user document.
          if (body.status !== undefined && body.status !== 'user') throw new ApiError(400, 'Admin Auth üzerinden yönetilir.');
          const passwordHash = body.password === undefined ? undefined : await hashPassword(passwordInput(body.password, true));
          await db.runTransaction(async (transaction) => {
            const user = (await transaction.get(ref)).data();
            if (!user) throw new ApiError(404, 'Kullanıcı bulunamadı.');
            if (body.email !== undefined && emailAddress(body.email) !== user.email) throw new ApiError(400, 'E-posta değiştirilemez.');
            const update: Record<string, unknown> = { updatedAt: Timestamp.now() };
            if (body.name !== undefined) update.name = text(body.name, 120);
            if (body.phone !== undefined) update.phone = text(body.phone, 40, 0);
            if (passwordHash) { update.passwordHash = passwordHash; update.sessionVersion = newSessionToken(); }
            transaction.update(ref, update);
          });
          return json({ user: publicUser(await ref.get()) });
        }
        if (method === 'DELETE') {
          await ref.delete(); // Existing sessions immediately fail their user lookup.
          return json({ ok: true });
        }
      }
    }

    if (path[0] === 'sessions' && path.length === 2) {
      const kind = sessionKind(path[1]);
      const collection = db.collection(SESSION_COLLECTIONS[kind]);
      if (method === 'POST') {
        const body = await readBody(request);
        if (body.email !== undefined && emailAddress(body.email) !== identity.email) throw new ApiError(403, 'Başkasının adına sonuç yazamazsınız.');
        const doc = await collection.add({ ...sessionFields(kind, body), userId: identity.uid, email: identity.email, createdAt: Timestamp.now() });
        return json({ id: doc.id }, 201);
      }
      if (method === 'GET') {
        const email = emailAddress(request.nextUrl.searchParams.get('email') || identity.email);
        if (identity.status !== 'admin' && email !== identity.email) throw new ApiError(403, 'Başkasının geçmişini okuyamazsınız.');
        let query = collection.where('email', '==', email).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(pageSize(request));
        const cursor = request.nextUrl.searchParams.get('cursor');
        if (cursor) {
          const doc = await collection.doc(documentId(cursor)).get();
          if (!doc.exists || doc.data()?.email !== email) throw new ApiError(400, 'Geçersiz sayfalama kaydı.');
          query = query.startAfter(doc);
        }
        const snapshot = await query.get();
        return json({ sessions: snapshot.docs.map((doc) => kind === 'aim' ? wire(publicAimSession(doc)) : ({ ...wire(doc.data()) as object, id: doc.id })), lastDoc: snapshot.docs.at(-1)?.id || null });
      }
    }
    if (path[0] === 'captcha-settings' && path.length === 2) {
      const userId = documentId(path[1]);
      requireOwner(identity, userId);
      const ref = db.collection('captchaSettings').doc(userId);
      if (method === 'GET') {
        const data = (await ref.get()).data();
        return json({ settings: data ? settingsFields(data) : null });
      }
      if (method === 'PUT') {
        await ref.set({ ...settingsFields(await readBody(request)), updatedAt: Timestamp.now() });
        return json({ ok: true });
      }
    }
    throw new ApiError(404, 'İşlem bulunamadı.');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    // Avoid returning credentials, account records, or Admin SDK internals.
    console.error('API request failed:', error instanceof Error ? error.name : 'UnknownError');
    return json({ error: 'Sunucu yapılandırmasını veya bağlantısını kontrol edin.' }, 500);
  }
}
function documentId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new ApiError(400, 'Geçersiz kayıt kimliği.');
  return value;
}
function pageSize(request: NextRequest) {
  const size = Number(request.nextUrl.searchParams.get('pageSize') || 20);
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new ApiError(400, 'Geçersiz sayfa boyutu.');
  return size;
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE, handle as PUT };
