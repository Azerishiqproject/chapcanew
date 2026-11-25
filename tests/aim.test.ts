import test from 'node:test';
import assert from 'node:assert/strict';
import { AimGame, CHALLENGE, EASY, calculateMetrics, nextSpawnTime, targetPosition, targetRadius, targetOpacity, speedAt, type AimEvent } from '../src/lib/aim-game';
import { applyTelemetry, initialAccumulator, runConfiguration, runSummary } from '../src/lib/server/aim-telemetry';
import { AimRecorder } from '../src/lib/aim-recorder';

function random() { let seed = 1234567; return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }; }
function hit(game: AimGame, time: number) {
  game.advance(time);
  const target = game.targets[0]; assert.ok(target);
  const point = targetPosition(target, time, game.settings);
  return game.shoot(point.x, point.y, time);
}
test('Challenge starts at 2 targets/s, accelerates by .01/s and ends on exactly three expired targets', () => {
  const game = new AimGame({ ...CHALLENGE }, random());
  game.advance(499); assert.equal(game.targets.length, 0);
  game.advance(500); assert.equal(game.targets.length, 1);
  assert.equal(speedAt(CHALLENGE, 5000), 2.05);
  game.advance(6000);
  assert.equal(game.ended, 'lives'); assert.equal(game.lostLives, 3);
  assert.ok(Math.abs(game.elapsedMs - 5000) < 10);
});
test('frame frequency never changes spawning or expiry and a miss does not consume a life', () => {
  const coarse = new AimGame({ ...CHALLENGE }, random()), fine = new AimGame({ ...CHALLENGE }, random());
  coarse.advance(6000);
  for (let time = 0; time < 6000; time += 7) fine.advance(time);
  assert.deepEqual(fine.events, coarse.events);
  const game = new AimGame({ ...CHALLENGE }, random());
  game.shoot(0, 0, 200); assert.equal(game.misses, 1); assert.equal(game.lostLives, 0);
  hit(game, 700); assert.equal(game.hits, 1); assert.equal(game.lostLives, 0);
});
test('moving targets bounce within the arena, grow and shrink; doubleshot creates a simultaneous pair', () => {
  const game = new AimGame({ ...CHALLENGE, mode: 'moving-targets' }, random());
  game.advance(700); const target = game.targets[0];
  assert.ok(target.vx !== 0 || target.vy !== 0);
  const point = targetPosition(target, 100000, game.settings);
  assert.ok(point.x >= 30 && point.x <= 770 && point.y >= 30 && point.y <= 450);
  assert.equal(targetRadius(target, target.bornAt, game.settings), 3.75);
  assert.ok(targetRadius(target, target.bornAt + 200, game.settings) < 7);
  assert.equal(targetRadius(target, target.bornAt + 1750, game.settings), 30);
  assert.ok(targetOpacity(target, target.bornAt + 3400, game.settings) < 0.5);
  const dual = new AimGame({ ...CHALLENGE, mode: 'dual-targets' }, random());
  dual.advance(500); assert.equal(dual.targets.length, 2); assert.equal(dual.targets[0].bornAt, dual.targets[1].bornAt);
});
test('reference target size matches the measured steady-growth and shrink snapshots', () => {
  const target = { id: 1, x: 200, y: 200, bornAt: 100, vx: 0, vy: 0 };
  const measured = [[500, 24], [1000, 38], [1500, 54], [2500, 38]];
  for (const [age, diameter] of measured) assert.ok(Math.abs(targetRadius(target, target.bornAt + age, CHALLENGE) * 2 - diameter) <= 3);
  for (let age = 50; age <= 3500; age += 50) assert.ok(Math.abs(targetRadius(target, target.bornAt + age, CHALLENGE) - targetRadius(target, target.bornAt + age - 50, CHALLENGE)) <= 0.8);
  assert.equal(targetRadius(target, target.bornAt + 1750, CHALLENGE), 30);
  assert.equal(targetOpacity(target, target.bornAt + 3500, CHALLENGE), 0);
  assert.equal(targetRadius(target, target.bornAt + 200, { ...CHALLENGE, animation: undefined }), 30);
  assert.ok(targetRadius(target, target.bornAt + 200, { ...CHALLENGE, animation: 'smooth-pulse' }) < 2);
});
test('Easy reproduces the observed slow reference tempo and five lives', () => {
  assert.deepEqual(runConfiguration({ profile: 'easy', settings: { ...CHALLENGE, targetsPerSecond: 10 } }).settings, EASY);
  assert.equal(speedAt(EASY, 6000).toFixed(2), '2.02');
  assert.equal(speedAt(EASY, 30000), 2.09);
  const game = new AimGame({ ...EASY }, random()); game.advance(10000);
  assert.equal(game.lostLives, 5); assert.ok(Math.abs(game.elapsedMs - 6000) < 20);
});
test('Doubleshot never accumulates more than one target pair', () => {
  const game = new AimGame({ ...CHALLENGE, mode: 'dual-targets', lives: 10 }, random());
  for (let at = 0; at < 10000; at += 50) { game.advance(at); assert.ok(game.targets.length <= 2); }
  const shots = new AimGame({ ...CHALLENGE, mode: 'dual-targets' }, random());
  hit(shots, 800); hit(shots, 900); assert.equal(shots.targets.length, 0);
  shots.advance(1400); assert.equal(shots.targets.length, 2);
});
test('spawn intervals shorten continuously at the configured slow acceleration', () => {
  let at = 0, previousGap = Infinity;
  for (let i = 0; i < 200; i++) {
    const next = nextSpawnTime(CHALLENGE, at), gap = next - at;
    assert.ok(gap < previousGap);
    if (Number.isFinite(previousGap)) assert.ok(previousGap - gap < 2);
    const seconds = gap / 1000;
    assert.ok(Math.abs(speedAt(CHALLENGE, at) * seconds + CHALLENGE.acceleration * seconds * seconds / 2 - 1) < 1e-12);
    at = next; previousGap = gap;
  }
  assert.equal(speedAt(CHALLENGE, 30000), 2.3);
  assert.equal(nextSpawnTime({ ...CHALLENGE, acceleration: 0 }, 1000), 1500);
});
test('pending legacy hits retain their original geometry while new rounds use the slow pulse', () => {
  const events: AimEvent[] = [
    { seq: 0, type: 'spawn', atMs: 500, targetId: 1, x: 200, y: 200, vx: 0, vy: 0 },
    { seq: 1, type: 'hit', atMs: 700, targetId: 1, x: 220, y: 200 },
  ];
  assert.equal(applyTelemetry(initialAccumulator(), events, { ...CHALLENGE, animation: undefined }, 700).state.hits, 1);
  assert.throws(() => applyTelemetry(initialAccumulator(), events, CHALLENGE, 700));
});
test('server recomputes reaction, shot/hit intervals, accuracy and streak from events across checkpoints', () => {
  const game = new AimGame({ ...CHALLENGE }, random());
  hit(game, 700); hit(game, 1200); game.shoot(0, 0, 1300); game.finish('manual', 1800);
  const first = applyTelemetry(initialAccumulator(), game.events.slice(0, 2), CHALLENGE, 700);
  const second = applyTelemetry(first.state, game.events.slice(2), CHALLENGE, 1800);
  const computed = runSummary(second.state, 1800, CHALLENGE), local = calculateMetrics(game.events, 1800, CHALLENGE);
  for (const key of ['score', 'misses', 'accuracy', 'averageReactionMs', 'averageShotIntervalMs', 'averageHitIntervalMs', 'bestStreak', 'hitsPerSecond'] as const) assert.equal(computed[key], local[key]);
  const shots = [...first.events, ...second.events].filter((event) => event.type === 'hit' || event.type === 'miss');
  assert.equal(shots[0].intervalMs, null); assert.equal(shots[0].reactionMs, 700 - game.events[0].atMs);
  assert.equal(shots[1].intervalMs, 500); assert.equal(shots[2].intervalMs, 100); assert.equal(shots[2].reactionMs, null);
});
test('server rejects duplicate hits, forged sequences, early expiry and out-of-target hits', () => {
  const game = new AimGame({ ...CHALLENGE }, random()); hit(game, 700);
  assert.throws(() => applyTelemetry(initialAccumulator(), [{ ...game.events[0], seq: 20 }], CHALLENGE, 700));
  assert.throws(() => applyTelemetry(initialAccumulator(), [game.events[0], { seq: 1, type: 'expire', atMs: 600, targetId: 1 }], CHALLENGE, 700));
  assert.throws(() => applyTelemetry(initialAccumulator(), [game.events[0], { seq: 1, type: 'hit', atMs: 700, targetId: 1, x: 0, y: 0 }], CHALLENGE, 700));
  assert.throws(() => applyTelemetry(initialAccumulator(), [...game.events, { ...game.events[1], seq: 2 }], CHALLENGE, 700));
  assert.throws(() => applyTelemetry(initialAccumulator(), game.events, CHALLENGE, Number.NaN));
});
class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
}
test('recorder persists failed batches and retries the identical payload after reload without losing shots', async () => {
  const storage = new MemoryStorage(), game = new AimGame({ ...CHALLENGE }, random());
  hit(game, 700); game.finish('manual', 900);
  const sent: string[] = [];
  const recorder = new AimRecorder('a'.repeat(64), 'student', storage, async (_, body) => { sent.push(JSON.stringify(body)); throw new Error('offline'); });
  recorder.capture(game); await assert.rejects(recorder.drain()); assert.equal(storage.length, 1);
  const restored = AimRecorder.restore('student', storage, async (_, body) => { sent.push(JSON.stringify(body)); });
  assert.ok(restored); await restored.drain();
  assert.equal(sent[0], sent[1]); assert.equal(storage.length, 0);
});
test('an interrupted checkpoint is finalized on recovery and batches are split under the request size limit', async () => {
  const storage = new MemoryStorage(), game = new AimGame({ ...CHALLENGE }, random());
  const batches: { events: AimEvent[]; ended: boolean }[] = [];
  const recorder = new AimRecorder('b'.repeat(64), 'student', storage, async (_, body) => { batches.push(body); });
  for (let time = 0; time < 60000; time += 100) {
    game.advance(time);
    const targets = [...game.targets].filter((target) => time - target.bornAt >= 200);
    for (const target of targets) { const point = targetPosition(target, time, game.settings); game.shoot(point.x, point.y, time); }
  }
  recorder.capture(game); await recorder.drain();
  assert.ok(batches.length > 1);
  assert.equal(batches.flatMap((batch) => batch.events).length, game.events.length);
  for (const batch of batches) { assert.ok(batch.events.length <= 100); assert.ok(JSON.stringify(batch).length < 65536); }
  assert.equal(storage.length, 1);
  const restored = AimRecorder.restore('student', storage, async (_, body) => { batches.push(body); });
  await restored!.drain(); assert.equal(batches.at(-1)!.ended, true); assert.equal(storage.length, 0);
});
