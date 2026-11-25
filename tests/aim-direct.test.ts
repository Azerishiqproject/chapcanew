import test from 'node:test';
import assert from 'node:assert/strict';
import { AimGame, DIRECT, LEGACY_DIRECT, ARENA, targetPosition, nextSpawnTime, speedAt, targetRadius } from '../src/lib/aim-game';
import { REFERENCE_PROTOCOL, LEGACY_REFERENCE_PROTOCOL, referencePhaseAt } from '../src/lib/aim-training';
import { applyTelemetry, initialAccumulator, runConfiguration, runSummary } from '../src/lib/server/aim-telemetry';
import { mergeTrainingRun } from '../src/lib/aim-comparison';
import { simulatedDirect } from './helpers/aim-direct';

test('Direct Aim reduces peak size and growth speed while retaining the four-second cycle', () => {
  assert.deepEqual(runConfiguration({ profile: 'direct', settings: { lives: 999, diameter: 200 } }).settings, DIRECT);
  assert.equal(DIRECT.targetsPerSecond, 2); assert.equal(DIRECT.acceleration, 0.01); assert.equal(DIRECT.lives, 3);
  const target = { id: 1, bornAt: 0, x: 400, y: 240, vx: 0, vy: 0, stage: 1 };
  assert.deepEqual([0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000].map((at) => targetRadius(target, at, DIRECT) * 2), [0, 12, 24, 36, 48, 36, 24, 12, 0]);
});
test('spawning stays clock-driven when targets are hit or missed', () => {
  const waiting = new AimGame({ ...DIRECT }, () => 0.4), shooting = new AimGame({ ...DIRECT }, () => 0.4);
  waiting.advance(3500);
  for (let at = 0; at <= 3500; at += 10) {
    shooting.advance(at);
    const target = shooting.targets[0];
    if (target && at - target.bornAt >= 100) shooting.shoot(target.x, target.y, at);
    if (at === 1300) shooting.shoot(0, 0, at);
  }
  assert.deepEqual(shooting.events.filter((event) => event.type === 'spawn').map((event) => event.atMs), waiting.events.filter((event) => event.type === 'spawn').map((event) => event.atMs));
  assert.ok(waiting.targets.length > 1);
  assert.ok(nextSpawnTime(DIRECT, 0) < 500);
});
test('the middle tempo is traversed continuously, including phase boundaries', () => {
  assert.equal(speedAt(DIRECT, 15000), 2.15);
  assert.equal(speedAt(DIRECT, 30000), 2.3);
  assert.equal(speedAt(DIRECT, 60000), 2.6);
  assert.equal(speedAt(DIRECT, 90000), 2.9);
  for (const boundary of [30000, 90000]) assert.ok(speedAt(DIRECT, boundary + 1) - speedAt(DIRECT, boundary - 1) < 0.0001);
  assert.deepEqual([0, 29999, 30000, 89999, 90000].map(referencePhaseAt), [1, 1, 2, 2, 3]);
});
test('classic lives, three tempo sections and mouse metrics replay identically on the server', () => {
  const game = simulatedDirect(); assert.equal(game.ended, 'lives'); assert.equal(game.lostLives, 3); assert.equal(game.progress.maxLevel, 3);
  let state = initialAccumulator();
  for (let at = 0; at < game.events.length; at += 100) {
    const events = game.events.slice(at, at + 100);
    state = applyTelemetry(state, events, DIRECT, events.at(-1)!.atMs).state;
  }
  const summary = runSummary(state, game.elapsedMs, DIRECT);
  assert.equal(summary.score, game.hits); assert.equal(summary.trainingProtocol, REFERENCE_PROTOCOL);
  assert.equal(summary.expiredTargets, 3); assert.equal(summary.maxLevel, 3);
  assert.equal(state.stages.reduce((n, stage) => n + stage.hits, 0), game.hits);
  assert.ok(state.stages.slice(0, 3).every((stage) => stage.hits > 8 && stage.pathSamples > 0));
  assert.deepEqual(state.progress, game.progress);
  const cohort = mergeTrainingRun(null, { userId: 'a', name: 'A', email: 'a@example.com', protocol: REFERENCE_PROTOCOL, conditionKey: 'mouse:800x480', inputDevice: 'mouse', arenaWidth: 800, arenaHeight: 480 }, { id: 'run-1', atMs: 1, maxLevel: 3, stages: state.stages });
  assert.equal(cohort.protocol, REFERENCE_PROTOCOL);
});
test('the server rejects a video-tempo spawn that skips the clock or claims a later phase', () => {
  const game = new AimGame({ ...DIRECT }, () => 0.5); game.advance(500);
  assert.throws(() => applyTelemetry(initialAccumulator(), [{ ...game.events[0], atMs: 100 }], DIRECT, 500));
  assert.throws(() => applyTelemetry(initialAccumulator(), [{ ...game.events[0], stage: 3 }], DIRECT, 500));
});

test('all four extreme spawn positions retain a full peak radius plus safe edge space', () => {
  for (const corner of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    let index = 0;
    const game = new AimGame({ ...DIRECT }, () => corner[index++ % 2]);
    game.advance(500); const target = game.targets[0], peakAt = target.bornAt + 2000;
    const radius = targetRadius(target, peakAt, DIRECT), point = targetPosition(target, peakAt, DIRECT);
    assert.equal(radius, 24);
    assert.ok(point.x - radius >= 24 && point.x + radius <= ARENA.width - 24);
    assert.ok(point.y - radius >= 24 && point.y + radius <= ARENA.height - 24);
  }
});
test('already-started 60px rounds retain their original hit geometry and comparison protocol', () => {
  assert.deepEqual(runConfiguration({ profile: 'direct', settings: LEGACY_DIRECT }).settings, LEGACY_DIRECT);
  const game = new AimGame({ ...LEGACY_DIRECT }, () => 0.5);
  game.advance(500); const target = game.targets[0], peakAt = target.bornAt + 2000;
  game.shoot(target.x + 27, target.y, peakAt);
  let state = initialAccumulator();
  state = applyTelemetry(state, game.events, LEGACY_DIRECT, peakAt).state;
  assert.equal(state.hits, 1);
  assert.equal(runSummary(state, peakAt, LEGACY_DIRECT).trainingProtocol, LEGACY_REFERENCE_PROTOCOL);
  assert.throws(() => applyTelemetry(initialAccumulator(), game.events, DIRECT, peakAt));
});
