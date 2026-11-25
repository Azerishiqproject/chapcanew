import { salesActions, numbered } from './helpers/sales';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applySalesEvents, initialSalesRuntime, salesSummary, validateSalesPlan, type SalesAction } from '../src/lib/sales-telemetry';
import { summarizeSalesSessions } from '../src/lib/sales-analytics';
import { SalesRecorder, type SalesBatch } from '../src/lib/sales-recorder';
test('Sales events reconstruct selections, back/reset/search actions and every phase duration', () => {
  const events = numbered(salesActions());
  const first = applySalesEvents(initialSalesRuntime(), events.slice(0, 12), 9000, []);
  const final = applySalesEvents(first.state, events.slice(12), 18000, []);
  const summary = salesSummary(final.state);
  assert.equal(summary.status, 'completed'); assert.equal(summary.totalDuration, 18000); assert.equal(summary.step1Duration, 5); assert.equal(summary.step2Duration, 13);
  assert.deepEqual(summary.phaseDurations, { project: 2, payment: 1, method: 2, search: 13 });
  assert.equal(summary.searches, 2); assert.equal(summary.resets, 1); assert.equal(summary.backCount, 1); assert.equal(summary.focusCount, 1);
  assert.equal(summary.selection?.entrance, '307'); assert.equal(summary.selection?.rooms, 4); assert.equal(summary.eventCount, events.length);
  assert.equal(final.events.at(-1)?.stage, 'search');
});
test('Telemetry rejects impossible transitions, malformed order, nonexistent units and premature completion', () => {
  assert.throws(() => applySalesEvents(initialSalesRuntime(), numbered([[1, { type: 'phase', phase: 'search' }]]), 1, []));
  assert.throws(() => applySalesEvents(initialSalesRuntime(), [{ seq: 1, atMs: 0, type: 'focus', field: 'projectId' }], 0, []));
  const actions = salesActions(); actions[8] = [6000, { type: 'select', field: 'entrance', value: '9999' }];
  assert.throws(() => applySalesEvents(initialSalesRuntime(), numbered(actions), 18000, []));
  const early = salesActions().slice(0, 11); early.push([8500, { type: 'finish', reason: 'selected' }]);
  assert.throws(() => applySalesEvents(initialSalesRuntime(), numbered(early), 8500, []));
  assert.throws(() => validateSalesPlan(true, 3, ['number'], [{ type: 'number', step: 1 }]));
});
test('CAPTCHA results are counted once and active solve time excludes closed windows and feedback waits', () => {
  const plan = [{ type: 'number', step: 1 }, { type: 'puzzle', step: 1 }, { type: 'date', step: 2 }] as const;
  const actions: [number, SalesAction][] = [...salesActions().slice(0, 5),
    [4000, { type: 'captcha-open', index: 0 }], [4500, { type: 'captcha-result', index: 0, correct: false }], [6000, { type: 'captcha-retry', index: 0 }], [7000, { type: 'captcha-result', index: 0, correct: true }],
    [8000, { type: 'captcha-open', index: 1 }], [8500, { type: 'captcha-close', index: 1 }], [10000, { type: 'captcha-open', index: 1 }], [11000, { type: 'captcha-result', index: 1, correct: true }],
    [12000, { type: 'phase', phase: 'search' }], [13000, { type: 'select', field: 'building', value: '2' }], [14000, { type: 'select', field: 'entrance', value: '307' }], [15000, { type: 'select', field: 'floor', value: '5' }], [16000, { type: 'select', field: 'apartment', value: '3' }],
    [17000, { type: 'captcha-open', index: 2 }], [19000, { type: 'captcha-result', index: 2, correct: true }], [20000, { type: 'search', found: true }], [21000, { type: 'finish', reason: 'selected' }]];
  const result = applySalesEvents(initialSalesRuntime(), numbered(actions), 21000, [...plan]), summary = salesSummary(result.state);
  assert.equal(summary.captchaDuration, 5); assert.equal(summary.correctCaptchas, 3); assert.equal(summary.incorrectCaptchas, 1);
  assert.deepEqual(summary.captchaTypes.number, { correct: 1, incorrect: 1, solveMs: 1500 }); assert.equal(summary.captchaTypes.puzzle?.solveMs, 1500); assert.equal(summary.captchaTypes.date?.solveMs, 2000);
  const wrong = actions.slice(0, 7); wrong.push([4600, { type: 'captcha-result', index: 0, correct: false }]);
  assert.throws(() => applySalesEvents(initialSalesRuntime(), numbered(wrong), 4600, [...plan]));
});
test('All-history averages include legacy completions, exclude partial durations and weight type samples', () => {
  const complete = salesSummary(applySalesEvents(initialSalesRuntime(), numbered(salesActions()), 18000, []).state);
  const rows = [complete, { ...complete, totalDuration: 40000, phaseDurations: undefined, status: undefined }, ...Array.from({ length: 25 }, () => ({ status: 'playing', schemaVersion: 2, totalDuration: 1000 })), { status: 'aborted', schemaVersion: 2, totalDuration: 2000 }];
  const stats = summarizeSalesSessions(rows);
  assert.equal(stats.totalPlays, 28); assert.equal(stats.completedPlays, 2); assert.equal(stats.averageDurationMs, 29000); assert.equal(stats.bestDurationMs, 18000); assert.equal(stats.phaseAverages.project, 2000);
  const weighted = summarizeSalesSessions([{ status: 'completed', captchaTypes: { date: { correct: 1, incorrect: 0, solveMs: 1000 } } }, { status: 'completed', captchaTypes: { date: { correct: 3, incorrect: 1, solveMs: 15000 } } }]);
  assert.equal(weighted.captchaTypes.date?.averageSolveMs, 4000);
});
class MemoryStorage implements Storage {
  data = new Map<string, string>(); get length() { return this.data.size; } clear() { this.data.clear(); } key(i: number) { return [...this.data.keys()][i] ?? null; } getItem(k: string) { return this.data.get(k) ?? null; } setItem(k: string, v: string) { this.data.set(k, v); } removeItem(k: string) { this.data.delete(k); }
}
test('Recorder persists events, retries identical batches, seals final state once and restores same-tab interruptions', async () => {
  const storage = new MemoryStorage(), id = 'a'.repeat(64); let now = 0, fail = true; const sent: SalesBatch[] = [];
  const send = async (_path: string, body: SalesBatch) => { sent.push(structuredClone(body)); if (fail) throw new Error('offline'); };
  const recorder = new SalesRecorder(id, 'owner', 'tab-a', storage, send, () => now);
  now = 1000; recorder.record({ type: 'focus', field: 'projectId' });
  await assert.rejects(recorder.flush()); assert.equal(storage.length, 1);
  fail = false; await recorder.flush(); assert.deepEqual(sent[0], sent[1]);
  now = 1500; recorder.record({ type: 'select', field: 'projectId', value: '300016' });
  await SalesRecorder.recover('owner', 'tab-b', storage, send); assert.equal(sent.length, 2, 'another active tab must not be closed');
  await SalesRecorder.recover('owner', 'tab-a', storage, send); assert.equal(sent.at(-1)?.events.at(-1)?.type, 'finish'); assert.equal(sent.at(-1)?.throughMs, 1500); assert.equal(storage.length, 0);
});
test('Recorder partitions more than 50 actions and prevents duplicate finish events', async () => {
  const storage = new MemoryStorage(), batches: SalesBatch[] = []; let now = 0;
  const recorder = new SalesRecorder('b'.repeat(64), 'owner', 'tab', storage, async (_path, body) => { batches.push(structuredClone(body)); }, () => now);
  for (let i = 0; i < 121; i++) { now++; recorder.record({ type: 'focus', field: 'projectId' }); }
  await recorder.finish('navigation'); await recorder.finish('navigation');
  assert.deepEqual(batches.map(b => b.events.length), [50, 50, 22]); assert.deepEqual(batches.map(b => b.batchIndex), [0, 1, 2]);
  assert.equal(batches.flatMap(b => b.events).filter(e => e.type === 'finish').length, 1); assert.equal(storage.length, 0);
});
