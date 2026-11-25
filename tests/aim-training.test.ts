import test from 'node:test';
import assert from 'node:assert/strict';
import { AimGame, PROGRESSIVE, targetRadius } from '../src/lib/aim-game';
import { TRAINING_DURATION_MS, TRAINING_PROTOCOL, emptyStageStats, initialProgress, trainingStage, updateProgress } from '../src/lib/aim-training';
import { applyTelemetry, initialAccumulator, runConfiguration, runSummary } from '../src/lib/server/aim-telemetry';
import { simulatedTraining } from './helpers/aim-training';
import { compareTrainingCohorts, mergeTrainingRun, type TrainingCohort } from '../src/lib/aim-comparison';

test('the same game starts slowly with one large target and never ends merely because of misses', () => {
  assert.deepEqual(runConfiguration({ profile: 'progressive', settings: { diameter: 1, level: 5 } }).settings, PROGRESSIVE);
  const game = new AimGame({ ...PROGRESSIVE }, () => 0.5);
  game.advance(1799); assert.equal(game.targets.length, 0);
  game.advance(1800); assert.equal(game.targets.length, 1); assert.equal(game.targets[0].stage, 1);
  game.advance(4000); assert.equal(game.targets.length, 1);
  game.advance(TRAINING_DURATION_MS);
  assert.equal(game.ended, 'practice-complete'); assert.equal(game.progress.level, 1);
  assert.ok(game.lostLives > PROGRESSIVE.lives);
});
test('promotion needs a successful block; repeated errors ease the level and cannot exceed stage five', () => {
  let progress = initialProgress();
  for (let i = 0; i < 7; i++) progress = updateProgress(progress, 'hit');
  assert.equal(progress.level, 1);
  progress = updateProgress(progress, 'hit'); assert.equal(progress.level, 2);
  for (let i = 0; i < 3; i++) progress = updateProgress(progress, 'miss');
  assert.equal(progress.level, 1);
  for (let i = 0; i < 80; i++) progress = updateProgress(progress, 'hit');
  assert.equal(progress.level, 5); assert.equal(progress.maxLevel, 5);
});
test('full progression stays inside target caps, respects gaps, and replays identically on the server', () => {
  const game = simulatedTraining(); assert.equal(game.ended, 'practice-complete'); assert.equal(game.progress.maxLevel, 5);
  let state = initialAccumulator(), lastSpawn = -Infinity;
  const active = new Map<number, number>();
  for (const event of game.events) {
    if (event.type === 'spawn') {
      assert.ok(event.atMs - lastSpawn >= 750); lastSpawn = event.atMs;
      active.set(event.targetId, event.stage!);
      assert.ok(active.size <= trainingStage(event.stage!).maxTargets);
    }
    if (event.type === 'hit' || event.type === 'expire') active.delete(event.targetId!);
  }
  for (let index = 0; index < game.events.length; index += 100) {
    const chunk = game.events.slice(index, index + 100);
    state = applyTelemetry(state, chunk, PROGRESSIVE, chunk.at(-1)!.atMs).state;
  }
  assert.deepEqual(state.progress, game.progress);
  const summary = runSummary(state, game.elapsedMs, PROGRESSIVE);
  assert.equal(summary.level, game.progress.level); assert.equal(summary.score, game.hits);
  assert.equal(summary.maxLevel, 5); assert.equal(summary.trainingProtocol, TRAINING_PROTOCOL);
  assert.ok(state.stages[0].pathSamples > 0);
  assert.ok(state.stages[0].pathEfficiencySum / state.stages[0].pathSamples > 99);
});
test('server rejects jumping stages and adding extra targets before the first target is resolved', () => {
  const spawn = { seq: 0, type: 'spawn', atMs: 1800, targetId: 1, x: 200, y: 200, vx: 0, vy: 0, stage: 1 };
  assert.throws(() => applyTelemetry(initialAccumulator(), [{ ...spawn, stage: 5 }], PROGRESSIVE, 2000));
  assert.throws(() => applyTelemetry(initialAccumulator(), [spawn, { ...spawn, seq: 1, targetId: 2, atMs: 1900 }], PROGRESSIVE, 2000));
});
function exampleRun(id: string, response: number) {
  const stages = [1, 2, 3, 4, 5].map(emptyStageStats);
  stages[0] = { ...stages[0], spawned: 8, hits: 8, responseSumMs: response * 8, responseSquares: response ** 2 * 8, responseSamples: Array(8).fill(response), pathEfficiencySum: 800, pathSamples: 8 };
  return { id, atMs: Number(id), maxLevel: 2, stages };
}
const metadata = { userId: 'a', name: 'A', email: 'a@example.com', protocol: TRAINING_PROTOCOL, conditionKey: 'mouse:800x480', inputDevice: 'mouse' as const, arenaWidth: 800, arenaHeight: 480 };
test('personal change uses six non-overlapping games, and long-term totals remain bounded', () => {
  let cohort: TrainingCohort | null = null;
  for (let i = 1; i <= 3; i++) cohort = mergeTrainingRun(cohort, metadata, exampleRun(String(i), 600));
  assert.equal(compareTrainingCohorts([cohort!], 1).rows[0].improvementPercent, null);
  for (let i = 4; i <= 6; i++) cohort = mergeTrainingRun(cohort, metadata, exampleRun(String(i), 450));
  const row = compareTrainingCohorts([cohort!], 1).rows[0];
  assert.equal(row.improvementPercent, 25); assert.equal(row.accuracyChangePp, 0);
  for (let i = 7; i <= 100; i++) cohort = mergeTrainingRun(cohort, metadata, exampleRun(String(i), 450));
  assert.equal(cohort!.baseline.length, 3); assert.equal(cohort!.recent.length, 3);
  assert.equal(cohort!.totals[0].responseSamples.length, 0); assert.equal(cohort!.completedPlays, 100);
});
test('group comparisons show sample counts and omit group differences when a stage has too little data', () => {
  const first = mergeTrainingRun(null, metadata, exampleRun('1', 300));
  const second = mergeTrainingRun(null, { ...metadata, userId: 'b', name: 'B' }, exampleRun('2', 500));
  const data = compareTrainingCohorts([first, second], 1);
  assert.equal(data.groupMedianResponseMs, 400);
  assert.equal(data.rows[0].differenceFromGroupMs, -100); assert.equal(data.rows[1].differenceFromGroupMs, 100);
  const missing = compareTrainingCohorts([first], 5).rows[0];
  assert.equal(missing.comparisonReady, false); assert.equal(missing.differenceFromGroupMs, null);
});

test('progressive targets retain a gentle visible grow and shrink pulse', () => {
  const game = new AimGame({ ...PROGRESSIVE }, () => 0.5);
  game.advance(1800);
  const target = game.targets[0];
  assert.equal(targetRadius(target, 1800, PROGRESSIVE), 28.6);
  assert.equal(targetRadius(target, 4050, PROGRESSIVE), 44);
  assert.ok(Math.abs(targetRadius(target, 1800, PROGRESSIVE) - targetRadius(target, 6300, PROGRESSIVE)) < 0.001);
});
test('server rejects accelerated target injection even after a valid hit', () => {
  const game = new AimGame({ ...PROGRESSIVE }, () => 0.5);
  game.advance(1800); game.shoot(game.targets[0].x, game.targets[0].y, 1900);
  const state = applyTelemetry(initialAccumulator(), game.events, PROGRESSIVE, 1900).state;
  assert.throws(() => applyTelemetry(state, [{ seq: 2, type: 'spawn', atMs: 2000, targetId: 2, x: 200, y: 200, vx: 0, vy: 0, stage: 1 }], PROGRESSIVE, 2000));
});

test('a single player or a single lucky hit cannot establish the group speed comparison', () => {
  const first = mergeTrainingRun(null, metadata, exampleRun('1', 300));
  assert.equal(compareTrainingCohorts([first], 1).groupMedianResponseMs, null);
  const sparse = mergeTrainingRun(null, { ...metadata, userId: 'b' }, exampleRun('2', 500));
  sparse.totals[0].hits = 1; sparse.totals[0].expired = 20;
  const result = compareTrainingCohorts([first, sparse], 1);
  assert.equal(result.groupMedianResponseMs, null);
  assert.equal(result.rows[1].comparisonReady, false);
});
