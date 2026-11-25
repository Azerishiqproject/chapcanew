import { salesActions, numbered } from './helpers/sales';
import { captchaPlan, CaptchaSequence } from '../src/lib/sales-flow';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { deleteApp } from 'firebase-admin/app';
import { GET, POST, PATCH, DELETE, PUT } from '../src/app/api/[...path]/route';
import { adminServices } from '../src/lib/server/firebase-admin';
import { ADMIN_COOKIE, USER_COOKIE } from '../src/lib/server/session';
import { digest } from '../src/lib/server/security';
import { simulatedDirect } from './helpers/aim-direct';
import { simulatedTraining } from './helpers/aim-training';
import { REFERENCE_PROTOCOL, TRAINING_DURATION_MS } from '../src/lib/aim-training';
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
test('restored video-tempo games keep all admin metrics and compare separately from the old progressive games', async () => {
  const { db } = adminServices();
  const cookie = cookieFrom((await call('auth/login', 'POST', { email: 'student@example.com', password })).response, USER_COOKIE);
  const other = cookieFrom((await call('auth/login', 'POST', { email: 'isolated@example.com', password })).response, USER_COOKIE);
  for (const [index, playerCookie] of [cookie, other].entries()) {
    const game = simulatedDirect(100000, index ? 1000 : 700);
    const start = await call('aim/runs', 'POST', { clientRunId: `video-tempo-player-${index}`, profile: 'direct', environment: { inputDevice: 'mouse', arenaWidth: 800, arenaHeight: 480, devicePixelRatio: 1 } }, playerCookie);
    assert.equal(start.response.status, 201);
    await db.collection('aimSessions').doc(start.data.id).update({ startTime: Timestamp.fromMillis(Date.now() - game.elapsedMs) });
    for (let at = 0, batchIndex = 0; at < game.events.length; at += 100, batchIndex++) {
      const events = game.events.slice(at, at + 100), last = at + 100 >= game.events.length;
      const body = { batchIndex, events, throughMs: last ? game.elapsedMs : events.at(-1)!.atMs, ended: last, ...(last ? { endReason: 'lives' } : {}) };
      const saved = await call(`aim/runs/${start.data.id}/events`, 'POST', body, playerCookie);
      assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
      if (last) assert.equal((await call(`aim/runs/${start.data.id}/events`, 'POST', body, playerCookie)).response.status, 200);
    }
  }
  const result = await call(`aim/comparison?stage=2&protocol=${REFERENCE_PROTOCOL}`, 'GET', undefined, adminCookie);
  assert.equal(result.response.status, 200); assert.equal(result.data.protocol, REFERENCE_PROTOCOL);
  assert.equal(result.data.rows.length, 2); assert.ok(result.data.groupMedianResponseMs > 600);
  assert.ok(result.data.rows.every((row: { completedPlays: number; maxLevel: number; pathEfficiency: number }) => row.completedPlays === 1 && row.maxLevel === 3 && row.pathEfficiency > 0));
  assert.equal((await call(`aim/comparison?stage=5&protocol=${REFERENCE_PROTOCOL}`, 'GET', undefined, adminCookie)).response.status, 400);
  assert.equal((await call('aim/comparison?protocol=unknown', 'GET', undefined, adminCookie)).response.status, 400);
  const legacy = await call('aim/comparison?stage=1', 'GET', undefined, adminCookie);
  assert.equal(legacy.data.rows.length, 2); assert.equal(legacy.data.rows[0].completedPlays, 1);
});
test('sales address flow saves selected housing metadata with ownership and supports legacy sessions', async () => {
  const cookie = cookieFrom((await call('auth/login', 'POST', { email: 'student@example.com', password })).response, USER_COOKIE);
  assert.equal((await call('sales/catalog/300016/2')).response.status, 401);
  const catalog = await call('sales/catalog/300016/2', 'GET', undefined, cookie);
  assert.equal(catalog.response.status, 200); assert.equal(catalog.data.building.complete, true);
  assert.equal((await call('sales/catalog/300016/not-a-building', 'GET', undefined, cookie)).response.status, 404);
  const end = Date.now(), start = end - 10000;
  const selection = { projectId: '300016', building: '2', entrance: '307', floor: '5', apartment: '3', floorCount: 9, rooms: 4, internalArea: 114.6, externalArea: 135.6, method: 'address', paymentMethod: 'mortgage', catalogVersion: 'mida-plans-2026-11-25' };
  const payload = { startTime: { $timestamp: start }, endTime: { $timestamp: end }, totalDuration: 10000, totalDurationSeconds: 10, step1Duration: 6, step2Duration: 4, captchaDuration: 0, correctCaptchas: 0, incorrectCaptchas: 0, project: 'Lənkəran Yaşayış Kompleksi', selection };
  const saved = await call('sessions/sales', 'POST', payload, cookie);
  assert.equal(saved.response.status, 201);
  const listed = await call('sessions/sales?email=student@example.com', 'GET', undefined, adminCookie);
  const session = listed.data.sessions.find((item: { id: string }) => item.id === saved.data.id);
  assert.deepEqual(session.selection, selection); assert.equal(session.email, 'student@example.com');
  assert.equal((await call('sessions/sales', 'POST', { ...payload, email: 'other@example.com' }, cookie)).response.status, 403);
});
test('CAPTCHA settings persist per owner, validate enabled answers, and feed the exact total simulation plan', async () => {
  const { db } = adminServices();
  const first = await call('auth/login', 'POST', { email: 'student@example.com', password });
  const cookie = cookieFrom(first.response, USER_COOKIE), uid = first.data.user.uid;
  const other = await call('auth/login', 'POST', { email: 'isolated@example.com', password });
  const otherCookie = cookieFrom(other.response, USER_COOKIE);
  const config = { enabled: true, allowedTypes: ['fin', 'religion', 'favoriteCar'], requiredCount: 3, dateConfig: { todayDate: '', birthDate: '' }, personalConfig: { fin: 'ab12cd3', religion: '  İslam  ', favoriteCar: 'Mercedes   Benz' } };
  assert.equal((await call(`captcha-settings/${uid}`, 'PUT', config)).response.status, 401);
  assert.equal((await call(`captcha-settings/${uid}`, 'PUT', config, otherCookie)).response.status, 403);
  assert.equal((await call(`captcha-settings/${uid}`, 'PUT', config, cookie)).response.status, 200);
  const saved = (await call(`captcha-settings/${uid}`, 'GET', undefined, cookie)).data.settings;
  assert.deepEqual(saved.personalConfig, { fin: 'AB12CD3', religion: 'İslam', favoriteCar: 'Mercedes Benz' });
  const sequence = new CaptchaSequence(captchaPlan(saved.enabled, saved.requiredCount, saved.allowedTypes, () => .4));
  for (const step of [1, 2] as const) while (sequence.current?.step === step) {
    sequence.open(step); assert.ok(sequence.answer(true)); sequence.advance();
  }
  assert.equal(sequence.logs.length, 3); assert.equal(sequence.progress, 3);
  assert.equal(new Set(sequence.logs.map(log => log.type)).size, 3);
  for (const invalid of [{ ...config, requiredCount: 2.5 }, { ...config, allowedTypes: [] }, { ...config, personalConfig: { ...config.personalConfig, religion: '' } }, { ...config, allowedTypes: ['date'], dateConfig: { todayDate: '31/02/2026', birthDate: '' } }]) {
    assert.equal((await call(`captcha-settings/${uid}`, 'PUT', invalid, cookie)).response.status, 400);
  }
  assert.equal((await call(`captcha-settings/${uid}`, 'GET', undefined, cookie)).data.settings.requiredCount, 3, 'invalid writes preserve saved settings');
  assert.equal((await call(`captcha-settings/${uid}`, 'PUT', { ...config, enabled: false, allowedTypes: [], personalConfig: { fin: '', religion: '', favoriteCar: '' } }, cookie)).response.status, 200);
  const disabled = (await call(`captcha-settings/${uid}`, 'GET', undefined, cookie)).data.settings;
  assert.deepEqual(captchaPlan(disabled.enabled, disabled.requiredCount, disabled.allowedTypes), []);
  await db.collection('captchaSettings').doc(other.data.user.uid).delete();
  assert.equal((await call(`captcha-settings/${other.data.user.uid}`, 'GET', undefined, otherCookie)).data.settings, null);
});
test('picture puzzle settings and standalone attempt history are accepted without changing legacy records', async () => {
  const login = await call('auth/login', 'POST', { email: 'isolated@example.com', password });
  const cookie = cookieFrom(login.response, USER_COOKIE), uid = login.data.user.uid;
  const config = { enabled: true, requiredCount: 3, allowedTypes: ['puzzle'], dateConfig: { todayDate: '', birthDate: '' }, personalConfig: { fin: '', religion: '', favoriteCar: '' } };
  assert.equal((await call(`captcha-settings/${uid}`, 'PUT', config, cookie)).response.status, 200);
  const settings = (await call(`captcha-settings/${uid}`, 'GET', undefined, cookie)).data.settings;
  assert.deepEqual(captchaPlan(settings.enabled, settings.requiredCount, settings.allowedTypes).map(item => item.type), ['puzzle', 'puzzle', 'puzzle']);
  const end = Date.now(), start = end - 5000;
  const body = { startTime: { $timestamp: start }, endTime: { $timestamp: end }, totalDuration: 5000, totalDurationSeconds: 5, chapcas: [{ type: 'puzzle', startTime: { $timestamp: start }, endTime: { $timestamp: end }, duration: 5000, durationSeconds: 5, isCorrect: true }] };
  const saved = await call('sessions/chapca', 'POST', body, cookie);
  assert.equal(saved.response.status, 201);
  const list = await call('sessions/chapca?email=isolated@example.com', 'GET', undefined, adminCookie);
  assert.equal(list.data.sessions.find((item: { id: string }) => item.id === saved.data.id).chapcas[0].type, 'puzzle');
});
test('sales tracks every started run, replays event history idempotently, isolates owners and averages all pages', async () => {
  const created = await call('users', 'POST', { email: 'sales-tracking@example.com', name: 'Sales Tracking', password }, adminCookie);
  assert.equal(created.response.status, 201);
  const uid = created.data.user.id, email = 'sales-tracking@example.com';
  const cookie = cookieFrom((await call('auth/login', 'POST', { email, password })).response, USER_COOKIE);
  const config = { enabled: false, requiredCount: 3, allowedTypes: ['number'], dateConfig: { todayDate: '', birthDate: '' }, personalConfig: { fin: '', religion: '', favoriteCar: '' } };
  assert.equal((await call(`captcha-settings/${uid}`, 'PUT', config, cookie)).response.status, 200);
  assert.equal((await call('sales/runs', 'POST', { clientRunId: 'sales-tracked-run-001', plan: [] })).response.status, 401);
  const start = await call('sales/runs', 'POST', { clientRunId: 'sales-tracked-run-001', plan: [] }, cookie);
  assert.equal(start.response.status, 201); const id = start.data.id;
  assert.equal((await call('sales/runs', 'POST', { clientRunId: 'sales-tracked-run-001', plan: [] }, cookie)).data.id, id);
  assert.equal((await call('sales/overview?email=' + email, 'GET', undefined, cookie)).response.status, 403);
  const { db } = adminServices(); await db.collection('salesSessions').doc(id).update({ startTime: Timestamp.fromMillis(Date.now() - 18000) });
  const events = numbered(salesActions()), first = { batchIndex: 0, events: events.slice(0, 12), throughMs: 9000 };
  assert.equal((await call(`sales/runs/${id}/events`, 'POST', { ...first, events: [{ ...events[0], seq: 7 }] }, cookie)).response.status, 400);
  assert.equal((await call(`sales/runs/${id}/events`, 'POST', first, cookie)).response.status, 200);
  assert.equal((await call(`sales/runs/${id}/events`, 'POST', first, cookie)).response.status, 200);
  assert.equal((await call(`sales/runs/${id}/events`, 'POST', { ...first, throughMs: 9001 }, cookie)).response.status, 409);
  const final = { batchIndex: 1, events: events.slice(12), throughMs: 18000 };
  assert.equal((await call(`sales/runs/${id}/events`, 'POST', final, cookie)).response.status, 200);
  assert.equal((await call(`sales/runs/${id}/events`, 'POST', final, cookie)).response.status, 200);
  assert.equal((await call(`sales/runs/${id}/events`, 'POST', { batchIndex: 2, events: [], throughMs: 18000 }, cookie)).response.status, 409);
  const otherCreated = await call('users', 'POST', { email: 'sales-other@example.com', name: 'Other', password }, adminCookie);
  const other = cookieFrom((await call('auth/login', 'POST', { email: 'sales-other@example.com', password })).response, USER_COOKIE);
  assert.ok(otherCreated.data.user.id);
  assert.equal((await call(`sales/runs/${id}/events`, 'GET', undefined, other)).response.status, 403);
  assert.equal((await call(`sales/runs/${id}/events`, 'POST', final, other)).response.status, 403);
  const history = await call(`sales/runs/${id}/events`, 'GET', undefined, adminCookie);
  assert.equal(history.data.events.length, events.length); assert.equal(history.data.events.at(-1).reason, 'selected');
  const list = await call(`sessions/sales?email=${email}`, 'GET', undefined, adminCookie);
  const run = list.data.sessions.find((session: { id: string }) => session.id === id);
  assert.equal(run.status, 'completed'); assert.equal(run.totalDuration, 18000); assert.equal(run.searches, 2); assert.equal(run.backCount, 1);
  assert.equal(run.selection.entrance, '307'); assert.equal(run.runtimeState, undefined); assert.equal(run.nextBatchIndex, undefined); assert.equal(run.clientRunId, undefined);
  for (let i = 0; i < 22; i++) assert.equal((await call('sales/runs', 'POST', { clientRunId: `sales-open-round-${String(i).padStart(3, '0')}`, plan: [] }, cookie)).response.status, 201);
  const aborted = await call('sales/runs', 'POST', { clientRunId: 'sales-aborted-round-001', plan: [] }, cookie);
  await db.collection('salesSessions').doc(aborted.data.id).update({ startTime: Timestamp.fromMillis(Date.now() - 5000) });
  assert.equal((await call(`sales/runs/${aborted.data.id}/events`, 'POST', { batchIndex: 0, events: [{ seq: 0, atMs: 5000, type: 'finish', reason: 'navigation' }], throughMs: 5000 }, cookie)).response.status, 200);
  const end = Date.now(), legacy = { startTime: { $timestamp: end - 40000 }, endTime: { $timestamp: end }, totalDuration: 40000, totalDurationSeconds: 40, step1Duration: 20, step2Duration: 20, captchaDuration: 2, correctCaptchas: 1, incorrectCaptchas: 1, project: 'Legacy' };
  assert.equal((await call('sessions/sales', 'POST', legacy, cookie)).response.status, 201);
  const overview = await call(`sales/overview?email=${email}`, 'GET', undefined, adminCookie);
  assert.equal(overview.response.status, 200); assert.equal(overview.data.totalPlays, 25); assert.equal(overview.data.completedPlays, 2); assert.equal(overview.data.abortedPlays, 1); assert.equal(overview.data.unfinishedPlays, 22);
  assert.equal(overview.data.averageDurationMs, 29000); assert.equal(overview.data.bestDurationMs, 18000); assert.equal(overview.data.totalSearches, 2); assert.equal(overview.data.accuracy, 50);
  const page1 = await call(`sessions/sales?email=${email}&pageSize=20`, 'GET', undefined, adminCookie);
  const page2 = await call(`sessions/sales?email=${email}&pageSize=20&cursor=${page1.data.lastDoc}`, 'GET', undefined, adminCookie);
  assert.equal(page1.data.sessions.length, 20); assert.equal(page2.data.sessions.length, 5);
});
test('sales computes CAPTCHA attempts and solve durations from events without persisting entered answers', async () => {
  const created = await call('users', 'POST', { email: 'sales-captcha@example.com', name: 'Sales CAPTCHA', password }, adminCookie), uid = created.data.user.id;
  const cookie = cookieFrom((await call('auth/login', 'POST', { email: 'sales-captcha@example.com', password })).response, USER_COOKIE);
  const config = { enabled: true, requiredCount: 1, allowedTypes: ['number'], dateConfig: { todayDate: '', birthDate: '' }, personalConfig: { fin: '', religion: '', favoriteCar: '' } };
  assert.equal((await call(`captcha-settings/${uid}`, 'PUT', config, cookie)).response.status, 200);
  const start = await call('sales/runs', 'POST', { clientRunId: 'sales-captcha-timed-001', plan: [{ type: 'number', step: 1 }] }, cookie);
  assert.equal(start.response.status, 201);
  await adminServices().db.collection('salesSessions').doc(start.data.id).update({ startTime: Timestamp.fromMillis(Date.now() - 21000) });
  const actions = salesActions();
  const events = numbered([...actions.slice(0, 5), [3600, { type: 'captcha-open', index: 0 }], [3800, { type: 'captcha-result', index: 0, correct: false }], [5300, { type: 'captcha-retry', index: 0 }], [6000, { type: 'captcha-result', index: 0, correct: true }], ...actions.slice(5).map(([at, action]) => [at + 3000, action] as typeof actions[number])]);
  const payload = events.map(event => event.type === 'captcha-result' ? { ...event, answer: 'do-not-store-fixture-answer' } : event);
  assert.equal((await call(`sales/runs/${start.data.id}/events`, 'POST', { batchIndex: 0, throughMs: 21000, events: payload }, cookie)).response.status, 200);
  const history = await call(`sales/runs/${start.data.id}/events`, 'GET', undefined, adminCookie);
  assert.equal(JSON.stringify(history.data).includes('do-not-store-fixture-answer'), false);
  const overview = (await call('sales/overview?email=sales-captcha@example.com', 'GET', undefined, adminCookie)).data;
  assert.equal(overview.totalCorrect, 1); assert.equal(overview.totalIncorrect, 1); assert.equal(overview.averageCaptchaMs, 900); assert.equal(overview.captchaTypes.number.averageSolveMs, 900);
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
