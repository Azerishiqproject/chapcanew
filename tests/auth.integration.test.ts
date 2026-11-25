import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { deleteApp } from 'firebase-admin/app';
import { GET, POST, PATCH, DELETE, PUT } from '../src/app/api/[...path]/route';
import { adminServices } from '../src/lib/server/firebase-admin';
import { ADMIN_COOKIE, USER_COOKIE } from '../src/lib/server/session';
import { digest } from '../src/lib/server/security';
import { simulatedTraining } from './helpers/aim-training';
import { TRAINING_DURATION_MS } from '../src/lib/aim-training';
import { AimGame, CHALLENGE, targetPosition } from '../src/lib/aim-game';

const project = 'demo-chapca-auth';
const origin = 'http://localhost:3000';
const password = 'emulator-only-password-123';
let adminCookie = '';
const methods = { GET, POST, PATCH, DELETE, PUT };
type Method = keyof typeof methods;
async function call(path: string, method: Method = 'GET', body?: unknown, cookie = '', requestOrigin = origin) {
  const headers: Record<string, string> = { origin: requestOrigin, cookie };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const request = new NextRequest(`${origin}/api/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const response = await methods[method](request, { params: Promise.resolve({ path: path.split('?')[0].split('/') }) });
  return { response, data: await response.json() };
}
async function adminLogin(email = 'admin@admin.com') {
  const result = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  assert.equal(result.status, 200);
  const { idToken } = await result.json();
  return call('auth/admin', 'POST', { idToken });
}
function cookieFrom(response: Response, name: string) {
  const item = response.headers.getSetCookie().find((value) => value.startsWith(name + '=') && !value.startsWith(name + '=;'));
  assert.ok(item, `missing ${name}`);
  assert.match(item, /HttpOnly/i);
  assert.match(item, /SameSite=strict/i);
  return item.split(';')[0];
}
before(async () => {
  // Refuse to run integration tests against any real Firebase project.
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^127\.0\.0\.1:\d+$/);
  assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST || '', /^127\.0\.0\.1:\d+$/);
  process.env.CHAPCA_EMULATORS = 'true';
  process.env.FIREBASE_PROJECT_ID = project;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = project;
  process.env.FIREBASE_ADMIN_UID = 'test-admin-uid';
  process.env.APP_ORIGIN = origin;
  const { auth, db } = adminServices();
  await db.recursiveDelete(db.collection('users'));
  for (const collection of ['serverSessions', 'loginAttempts', 'chapcaSessions', 'aimSessions', 'salesSessions', 'captchaSettings', 'aimComparison']) await db.recursiveDelete(db.collection(collection));
  for (const user of (await auth.listUsers()).users) await auth.deleteUser(user.uid);
  await auth.createUser({ uid: 'test-admin-uid', email: 'admin@admin.com', password });
  const result = await adminLogin();
  assert.equal(result.response.status, 200);
  adminCookie = cookieFrom(result.response, ADMIN_COOKIE);
});
after(async () => { await deleteApp(adminServices().auth.app); });

test('Auth admin and Firestore-only users retain isolation through the full lifecycle', async () => {
  const { auth, db } = adminServices();
  assert.equal((await db.collection('users').get()).size, 0, 'admin must not have a users document');
  assert.equal((await call('users')).response.status, 401);
  assert.equal((await call('auth/admin', 'POST', { idToken: 'forged' }, '', 'https://evil.example')).response.status, 403);
  assert.equal((await call('auth/admin', 'POST', { idToken: 'forged' })).response.status, 401);
  assert.equal((await call('auth/session', 'GET', undefined, `${ADMIN_COOKIE}=forged`)).response.status, 401);
  assert.equal((await call('users', 'POST', { email: 'otheradmin@example.com', name: 'Admin', password, status: 'admin' }, adminCookie)).response.status, 400);
  assert.equal((await call('users', 'POST', { email: 'admin@admin.com', name: 'Admin', password }, adminCookie)).response.status, 400);

  const created = await call('users', 'POST', { email: ' STUDENT@EXAMPLE.COM ', name: 'Student', password, phone: '', status: 'user', passwordHash: 'forged' }, adminCookie);
  assert.equal(created.response.status, 201);
  const uid = created.data.user.id;
  assert.equal(created.data.user.email, 'student@example.com');
  assert.equal(created.data.user.password, undefined);
  assert.equal(created.data.user.passwordHash, undefined);
  const raw = (await db.collection('users').doc(uid).get()).data()!;
  assert.match(raw.passwordHash, /^scrypt\$/);
  assert.equal(raw.password, undefined);
  await assert.rejects(auth.getUserByEmail('student@example.com'), { code: 'auth/user-not-found' });
  assert.equal((await call('users', 'POST', { email: 'student@example.com', name: 'Duplicate', password }, adminCookie)).response.status, 409);

  const wrong = await call('auth/login', 'POST', { email: 'student@example.com', password: 'wrong-password' });
  assert.equal(wrong.response.status, 401);
  const loggedIn = await call('auth/login', 'POST', { email: 'student@example.com', password });
  assert.equal(loggedIn.response.status, 200);
  assert.equal(loggedIn.data.user.status, 'user');
  const cookie = cookieFrom(loggedIn.response, USER_COOKIE);
  assert.equal((await call('auth/session', 'GET', undefined, cookie)).data.user.uid, uid);
  assert.equal((await call('users', 'GET', undefined, cookie)).response.status, 403);
  assert.equal((await call(`users/${uid}`, 'PATCH', { status: 'admin' }, cookie)).response.status, 403);
  assert.equal((await call(`users/${uid}`, 'PATCH', { status: 'admin' }, adminCookie)).response.status, 400);

  const time = { $timestamp: Date.now() - 2000 };
  const session = { email: 'student@example.com', startTime: time, endTime: time, totalDuration: 0, totalDurationSeconds: 0, gameMode: 'normal', score: 1, misses: 0, expiredTargets: 0, accuracy: 100, level: 1 };
  for (let i = 0; i < 2; i++) assert.equal((await call('sessions/aim', 'POST', session, cookie)).response.status, 201);
  assert.equal((await call('sessions/aim', 'POST', { ...session, email: 'someone@example.com' }, cookie)).response.status, 403);
  assert.equal((await call('sessions/aim?email=someone@example.com', 'GET', undefined, cookie)).response.status, 403);
  const page = await call('sessions/aim?pageSize=1', 'GET', undefined, cookie);
  assert.equal(page.response.status, 200);
  assert.equal(page.data.sessions.length, 1);
  assert.equal(typeof page.data.sessions[0].createdAt.$timestamp, 'number');
  const next = await call(`sessions/aim?pageSize=1&cursor=${page.data.lastDoc}`, 'GET', undefined, cookie);
  assert.equal(next.data.sessions.length, 1);
  assert.notEqual(page.data.sessions[0].id, next.data.sessions[0].id);
  assert.equal((await call('sessions/aim?email=student@example.com', 'GET', undefined, adminCookie)).data.sessions.length, 2);
  const chapca = { ...session, chapcas: [{ type: 'text', startTime: time, endTime: time, duration: 0, durationSeconds: 0, isCorrect: true }] };
  assert.equal((await call('sessions/chapca', 'POST', chapca, cookie)).response.status, 201);
  const sales = { ...session, project: 'Test project', step1Duration: 1, step2Duration: 1, captchaDuration: 1, correctCaptchas: 1, incorrectCaptchas: 0 };
  assert.equal((await call('sessions/sales', 'POST', sales, cookie)).response.status, 201);

  const settings = { allowedTypes: ['text'], requiredCount: 1, enabled: true, dateConfig: { todayDate: '', birthDate: '' }, personalConfig: { fin: '', religion: '', favoriteCar: '' } };
  assert.equal((await call(`captcha-settings/${uid}`, 'PUT', settings, cookie)).response.status, 200);
  assert.equal((await call(`captcha-settings/${uid}`, 'GET', undefined, cookie)).data.settings.requiredCount, 1);
  assert.equal((await call('captcha-settings/someone-else', 'PUT', settings, cookie)).response.status, 403);

  const firestoreRest = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents`;
  assert.equal((await fetch(`${firestoreRest}/users/${uid}`)).status, 403, 'rules must deny direct reads');
  assert.equal((await fetch(`${firestoreRest}/users/forged`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields: { status: { stringValue: 'admin' } } }) })).status, 403);

  assert.equal((await call(`users/${uid}`, 'PATCH', { password: 'new-password-123', name: 'Updated' }, adminCookie)).response.status, 200);
  assert.equal((await call('auth/session', 'GET', undefined, cookie)).response.status, 401, 'password changes revoke old sessions');
  const relogin = await call('auth/login', 'POST', { email: 'student@example.com', password: 'new-password-123' });
  const newCookie = cookieFrom(relogin.response, USER_COOKIE);
  assert.equal((await call('auth/logout', 'POST', {}, newCookie)).response.status, 200);
  assert.equal((await call('auth/session', 'GET', undefined, newCookie)).response.status, 401, 'logout invalidates replay');
  const anotherLogin = await call('auth/login', 'POST', { email: 'student@example.com', password: 'new-password-123' });
  const deletedCookie = cookieFrom(anotherLogin.response, USER_COOKIE);
  assert.equal((await call(`users/${uid}`, 'DELETE', {}, adminCookie)).response.status, 200);
  assert.equal((await call('auth/session', 'GET', undefined, deletedCookie)).response.status, 401);
  await call('users', 'POST', { email: 'student@example.com', name: 'Recreated', password }, adminCookie);
  assert.equal((await call('auth/session', 'GET', undefined, deletedCookie)).response.status, 401, 'recreating email must not revive sessions');
  assert.equal((await auth.listUsers()).users.length, 1, 'only the admin exists in Auth');
  const expired = await call('auth/login', 'POST', { email: 'student@example.com', password });
  const expiredCookie = cookieFrom(expired.response, USER_COOKIE);
  await db.collection('serverSessions').doc(digest(expiredCookie.split('=')[1])).update({ expiresAt: Timestamp.fromMillis(0) });
  assert.equal((await call('auth/session', 'GET', undefined, expiredCookie)).response.status, 401);
});
test('Direct Aim tracks every started run, validates batches, and exposes complete admin totals and shot history', async () => {
  const login = await call('auth/login', 'POST', { email: 'student@example.com', password });
  const studentCookie = cookieFrom(login.response, USER_COOKIE);
  const initial = await call('aim/overview?email=student@example.com', 'GET', undefined, adminCookie);
  assert.equal(initial.response.status, 200);
  const start = await call('aim/runs', 'POST', { clientRunId: 'tracked-round-001', profile: 'challenge' }, studentCookie);
  assert.equal(start.response.status, 201);
  const id = start.data.id;
  assert.equal((await call('aim/runs', 'POST', { clientRunId: 'tracked-round-001', profile: 'challenge' }, studentCookie)).data.id, id);
  const game = new AimGame({ ...CHALLENGE }, () => 0.4);
  game.advance(700);
  const point = targetPosition(game.targets[0], 700, game.settings);
  game.shoot(point.x, point.y, 700); game.shoot(0, 0, 800); game.finish('manual', 1800);
  const batch = { batchIndex: 0, events: game.events.slice(0, 2), throughMs: 700, ended: false };
  assert.equal((await call(`aim/runs/${id}/events`, 'POST', batch, studentCookie)).response.status, 200);
  assert.equal((await call(`aim/runs/${id}/events`, 'POST', batch, studentCookie)).response.status, 200);
  assert.equal((await call(`aim/runs/${id}/events`, 'POST', { ...batch, throughMs: 701 }, studentCookie)).response.status, 409);
  assert.equal((await call(`aim/runs/${id}/events`, 'POST', { batchIndex: 1, events: [{ seq: 2, type: 'hit', targetId: 1, atMs: 750, x: point.x, y: point.y }], throughMs: 750, ended: false }, studentCookie)).response.status, 400);
  const final = { batchIndex: 1, events: game.events.slice(2), throughMs: 1800, ended: true, endReason: 'manual', score: 999 };
  assert.equal((await call(`aim/runs/${id}/events`, 'POST', final, studentCookie)).response.status, 200);
  assert.equal((await call(`aim/runs/${id}/events`, 'POST', final, studentCookie)).response.status, 200);
  const detail = await call(`aim/runs/${id}/events`, 'GET', undefined, adminCookie);
  const shots = detail.data.events.filter((event: { type: string }) => event.type === 'hit' || event.type === 'miss');
  const reactionMs = 700 - game.events[0].atMs;
  assert.equal(shots.length, 2); assert.equal(shots[0].reactionMs, reactionMs); assert.equal(shots[1].intervalMs, 100);
  const list = await call('sessions/aim?email=student@example.com', 'GET', undefined, adminCookie);
  const session = list.data.sessions.find((session: { id: string }) => session.id === id);
  assert.equal(session.score, 1); assert.equal(session.misses, 1); assert.equal(session.averageReactionMs, reactionMs);
  assert.equal(session.accuracy, 50); assert.equal(session.runtimeState, undefined); assert.equal(session.status, 'aborted');
  const before = (await call('aim/overview?email=student@example.com', 'GET', undefined, adminCookie)).data;
  for (let i = 0; i < 21; i++) assert.equal((await call('aim/runs', 'POST', { clientRunId: `counted-round-${String(i).padStart(3, '0')}`, profile: 'challenge' }, studentCookie)).response.status, 201);
  const overview = (await call('aim/overview?email=student@example.com', 'GET', undefined, adminCookie)).data;
  assert.equal(overview.totalPlays, before.totalPlays + 21);
  assert.equal(overview.totalHits, initial.data.totalHits + 1);
  assert.equal(overview.averageReactionMs, reactionMs);
  assert.equal((await call('aim/overview?email=student@example.com', 'GET', undefined, studentCookie)).response.status, 403);
  await call('users', 'POST', { email: 'isolated@example.com', name: 'Other', password }, adminCookie);
  const other = await call('auth/login', 'POST', { email: 'isolated@example.com', password });
  const otherCookie = cookieFrom(other.response, USER_COOKIE);
  assert.equal((await call(`aim/runs/${id}/events`, 'GET', undefined, otherCookie)).response.status, 403);
  assert.equal((await call(`aim/runs/${id}/events`, 'POST', batch, otherCookie)).response.status, 403);
});
test('the same progressive game writes stage comparisons privately and separates device conditions', async () => {
  const { db } = adminServices();
  const student = await call('auth/login', 'POST', { email: 'student@example.com', password });
  const studentCookie = cookieFrom(student.response, USER_COOKIE);
  const isolated = await call('auth/login', 'POST', { email: 'isolated@example.com', password });
  const otherCookie = cookieFrom(isolated.response, USER_COOKIE);
  async function completed(cookie: string, id: string, device: 'mouse' | 'touchpad', delay: number, resized = false) {
    const game = simulatedTraining(delay);
    if (resized) {
      // Insert a real screen-change event early in the replay and resequence.
      game.events.splice(1, 0, { seq: 1, type: 'resize', atMs: 0, width: 1000, height: 600 });
      game.events.forEach((event, index) => { event.seq = index; });
    }
    const started = await call('aim/runs', 'POST', { clientRunId: id, profile: 'progressive', environment: { inputDevice: device, arenaWidth: 800, arenaHeight: 480, devicePixelRatio: 1 } }, cookie);
    assert.equal(started.response.status, 201);
    await db.collection('aimSessions').doc(started.data.id).update({ startTime: Timestamp.fromMillis(Date.now() - TRAINING_DURATION_MS) });
    let batchIndex = 0;
    for (let i = 0; i < game.events.length; i += 100) {
      const events = game.events.slice(i, i + 100), last = i + 100 >= game.events.length;
      const body = { batchIndex, events, throughMs: last ? TRAINING_DURATION_MS : events.at(-1)!.atMs, ended: last, ...(last ? { endReason: 'practice-complete' } : {}) };
      const saved = await call(`aim/runs/${started.data.id}/events`, 'POST', body, cookie);
      assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
      if (last) assert.equal((await call(`aim/runs/${started.data.id}/events`, 'POST', body, cookie)).response.status, 200);
      batchIndex++;
    }
    return started.data.id;
  }
  await completed(studentCookie, 'progressive-student-001', 'mouse', 350);
  await completed(otherCookie, 'progressive-other-001', 'mouse', 650);
  await completed(otherCookie, 'progressive-other-touchpad', 'touchpad', 650);
  const result = await call('aim/comparison?stage=1&condition=mouse%3A800x480', 'GET', undefined, adminCookie);
  assert.equal(result.response.status, 200); assert.equal(result.data.rows.length, 2);
  assert.equal(result.data.conditions.length, 2);
  const row = result.data.rows.find((row: { email: string }) => row.email === 'student@example.com');
  assert.equal(row.completedPlays, 1, 'final retries must not count the game twice');
  assert.equal(row.maxLevel, 5); assert.equal(row.improvementPercent, null);
  assert.ok(row.pathEfficiency > 99);
  await completed(studentCookie, 'progressive-resize-001', 'mouse', 350, true);
  const after = await call('aim/comparison?stage=1&condition=mouse%3A800x480', 'GET', undefined, adminCookie);
  assert.equal(after.data.rows.find((row: { email: string }) => row.email === 'student@example.com').completedPlays, 1, 'resized games are not mixed with stable-condition games');
  assert.equal((await call('aim/comparison', 'GET', undefined, studentCookie)).response.status, 403);
});
test('pinned admin UID rejects other Auth accounts and server limits repeated login attempts', async () => {
  const { auth } = adminServices();
  const other = await auth.createUser({ email: 'other@example.com', password });
  assert.equal((await adminLogin('other@example.com')).response.status, 403);
  await auth.deleteUser(other.uid);
  for (let i = 0; i < 10; i++) assert.equal((await call('auth/login', 'POST', { email: 'missing@example.com', password })).response.status, 401);
  assert.equal((await call('auth/login', 'POST', { email: 'missing@example.com', password })).response.status, 429);
  assert.equal((await call('auth/logout', 'POST', {}, adminCookie)).response.status, 200);
});
