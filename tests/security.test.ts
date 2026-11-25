import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSameOrigin, emailAddress, hashPassword, passwordInput, readBody, verifyPassword } from '../src/lib/server/security';
import { sessionFields, settingsFields } from '../src/lib/server/data';

test('salted password hashes reject wrong passwords and plaintext records', async () => {
  const one = await hashPassword('test-password-123');
  const two = await hashPassword('test-password-123');
  assert.notEqual(one, two);
  assert.equal(await verifyPassword('test-password-123', one), true);
  assert.equal(await verifyPassword('wrong-password', one), false);
  assert.equal(await verifyPassword('test-password-123', 'test-password-123'), false);
  assert.throws(() => passwordInput('short', true));
  assert.throws(() => passwordInput('x'.repeat(129), true));
  assert.equal(emailAddress(' USER@EXAMPLE.COM '), 'user@example.com');
});
test('cross-origin requests and oversized/malformed JSON are rejected', async () => {
  assert.throws(() => assertSameOrigin(new Request('http://localhost/api/auth/login', { headers: { origin: 'https://evil.example' } })));
  assert.throws(() => assertSameOrigin(new Request('http://localhost/api/auth/login')));
  assertSameOrigin(new Request('http://localhost/api/auth/login', { headers: { origin: 'http://localhost' } }));
  await assert.rejects(readBody(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })));
  await assert.rejects(readBody(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(65536) }) })));
});
test('session validation bounds metrics and only returns allowed fields', () => {
  const time = { $timestamp: Date.now() - 1000 };
  const valid = { startTime: time, endTime: time, totalDuration: 0, totalDurationSeconds: 0, gameMode: 'normal', score: 1, misses: 0, expiredTargets: 0, level: 1, accuracy: 100 };
  assert.throws(() => sessionFields('aim', { ...valid, accuracy: 101 }));
  assert.throws(() => sessionFields('aim', { ...valid, score: -1 }));
  const saved = sessionFields('aim', { ...valid, email: 'forged@example.com', userId: 'forged', status: 'admin' });
  assert.equal(saved.email, undefined);
  assert.equal(saved.userId, undefined);
  assert.equal(saved.status, undefined);
  assert.throws(() => settingsFields({ allowedTypes: ['unknown'] }));
});
