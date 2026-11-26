import test from 'node:test';
import assert from 'node:assert/strict';
import { ChapcaTracker } from '../src/lib/chapca-tracker';
import { addQuestionAttempt, validCondition } from '../src/lib/captcha-metrics';
import { captchaReport, defaultCaptchaFilters, normalizeCaptchaRun, type CaptchaRun } from '../src/lib/captcha-analytics';
import { applySalesEvents, initialSalesRuntime, salesSummary } from '../src/lib/sales-telemetry';
import { numbered, salesActions } from './helpers/sales';
import { sessionFields } from '../src/lib/server/data';
function fixture(id: string, count: number, times: number[], email = 'a@example.com'): CaptchaRun {
  return normalizeCaptchaRun(id, 'sales', { email, metricsVersion: 2, status: 'completed', startTime: 1795651200000, totalDuration: 10000 + times.reduce((a, b) => a + b, 0), interactionDurationMs: 9000, captchaConfig: { plan: Array.from({ length: count }, () => ({ type: 'number', step: 1 })) }, captchaQuestions: times.map((activeMs, index) => ({ index, type: 'number', attempts: 1, incorrect: 0, activeMs, completed: true, conditions: ['standard:6'] })), correctCaptchas: times.length }, email);
}
test('Two and five CAPTCHA sessions use seven individual samples, never an average of session averages', () => {
  const two = fixture('two', 2, [20000, 20000]), five = fixture('five', 5, [10000, 10000, 10000, 10000, 10000]);
  const report = captchaReport([two, five], { ...defaultCaptchaFilters });
  assert.equal(report.summary.solved, 7); assert.equal(report.summary.meanMs, 90000 / 7); assert.notEqual(report.summary.meanMs, 15000);
  assert.equal(report.summary.medianMs, 10000); assert.equal(report.summary.p90Ms, 20000);
  assert.deepEqual(report.counts.map(row => [row.count, row.meanMs, row.solved]), [[2, 20000, 2], [5, 10000, 5]]);
  assert.equal(captchaReport([two, five], { ...defaultCaptchaFilters, count: '5' }).summary.solved, 5);
});
test('Type, conditions, source, exact sequence, date and status define comparisons; legacy durations are never fabricated', () => {
  const a = fixture('one', 2, [1000, 3000]), other = { ...fixture('two', 2, [9000, 11000], 'b@example.com'), status: 'aborted' as const };
  const legacy = normalizeCaptchaRun('old', 'sales', { email: 'a@example.com', correctCaptchas: 3, totalDuration: 1000 }, 'A');
  assert.equal(legacy.plannedCount, null); assert.equal(legacy.questions.length, 0);
  assert.equal(captchaReport([a, other, legacy], { ...defaultCaptchaFilters }).summary.runs, 1);
  assert.equal(captchaReport([a, other, legacy], { ...defaultCaptchaFilters, status: 'all' }).summary.runs, 2);
  assert.equal(captchaReport([a, other], { ...defaultCaptchaFilters, from: '2099-01-01' }).summary.runs, 0);
  assert.equal(captchaReport([a], { ...defaultCaptchaFilters, type: 'date' }).summary.solved, 0);
  assert.equal(captchaReport([a], { ...defaultCaptchaFilters, condition: 'year:4' }).summary.solved, 0);
  const full = normalizeCaptchaRun('full', 'sales', { ...a, startTime: a.startMs, metricsVersion: 2, totalDuration: a.durationMs, captchaConfig: { plan: [{ type: 'date', step: 1 }] }, captchaQuestions: [{ index: 0, type: 'date', activeMs: 4000, attempts: 1, incorrect: 0, completed: true, conditions: ['full:8'] }] }, 'A');
  const fixed = normalizeCaptchaRun('fixed', 'sales', { ...a, startTime: a.startMs, metricsVersion: 2, captchaConfig: { plan: [{ type: 'date', step: 1 }] }, captchaQuestions: [{ ...full.questions[0], conditions: ['year:4'] }] }, 'A');
  assert.equal(captchaReport([full, fixed, a], { ...defaultCaptchaFilters, type: 'date' }).types.length, 1);
  assert.notEqual(full.scenario, fixed.scenario);
  assert.equal(captchaReport([full, fixed], { ...defaultCaptchaFilters, scenario: full.scenario }).summary.solved, 1);
  assert.equal(captchaReport([a, legacy], { ...defaultCaptchaFilters }).legacyCount, 1);
});
test('Failed attempts add time once; unfinished attempts affect accuracy but never create a solved sample', () => {
  const run = fixture('retry', 2, []);
  addQuestionAttempt(run.questions, 0, 'number', 2000, false, { variant: 'standard', inputLength: 6 });
  addQuestionAttempt(run.questions, 0, 'number', 3000, true, { variant: 'standard', inputLength: 6 });
  addQuestionAttempt(run.questions, 1, 'number', 8000, false, { variant: 'standard', inputLength: 6 });
  const stats = captchaReport([run], { ...defaultCaptchaFilters }).summary;
  assert.equal(stats.meanMs, 5000); assert.equal(stats.solved, 1); assert.equal(stats.attempts, 3); assert.equal(stats.meanAttempts, 2); assert.equal(stats.firstTryRate, 0); assert.ok(Math.abs(stats.accuracy! - 100 / 3) < 1e-10);
});
test('Training clock separates attempts, ignores feedback waits and hidden intervals, and seals once', () => {
  let now = 1000;
  const tracker = new ChapcaTracker(['number', 'text'], 'sequential', () => now, 'fixture-run');
  tracker.ready(0, { variant: 'standard', inputLength: 6 }); tracker.ready(0, { variant: 'standard', inputLength: 6 });
  now = 3000; assert.equal(tracker.answer(0, false)?.duration, 2000); assert.equal(tracker.answer(0, false), null);
  now = 4500; tracker.ready(0, { variant: 'standard', inputLength: 6 });
  now = 5500; tracker.visibility(false); now = 15500; tracker.visibility(true); now = 17500;
  assert.equal(tracker.answer(0, true)?.duration, 3000); assert.equal(tracker.elapsed(0), 5000);
  now = 18000; tracker.ready(1, { variant: 'standard', inputLength: 5 }); now = 20000; tracker.answer(1, true);
  const result = tracker.finish('completed')!; assert.deepEqual(result.attempts.map(a => a.duration), [2000, 3000, 2000]); assert.equal(result.endMs - result.startMs, 19000); assert.equal(tracker.finish('aborted'), null);
});
test('Server derives training totals and rejects fake order, duration, condition and incomplete completion', () => {
  const body = { metricsVersion: 2, clientRunId: 'fixture-run', status: 'completed', plan: ['number'], order: 'sequential', startTime: { $timestamp: 1000 }, endTime: { $timestamp: 8000 }, totalDuration: 1, totalDurationSeconds: 1, chapcas: [
    { type: 'rakam', questionIndex: 0, attemptIndex: 0, startTime: { $timestamp: 1000 }, endTime: { $timestamp: 3000 }, duration: 2000, durationSeconds: 999, isCorrect: false, condition: { variant: 'standard', inputLength: 6 } },
    { type: 'rakam', questionIndex: 0, attemptIndex: 1, startTime: { $timestamp: 4500 }, endTime: { $timestamp: 8000 }, duration: 3500, durationSeconds: 999, isCorrect: true, condition: { variant: 'standard', inputLength: 6 } },
  ] };
  const parsed = sessionFields('chapca', body);
  assert.equal(parsed.totalDuration, 7000); assert.equal(parsed.chapcas[1].durationSeconds, 3.5); assert.equal(parsed.captchaQuestions[0].activeMs, 5500); assert.equal(parsed.captchaQuestions[0].attempts, 2);
  for (const change of [{ duration: 9000 }, { questionIndex: 1 }, { attemptIndex: 99 }, { condition: { variant: 'year', inputLength: 4 } }]) assert.throws(() => sessionFields('chapca', { ...body, chapcas: [{ ...body.chapcas[0], ...change }, body.chapcas[1]] }));
  assert.throws(() => sessionFields('chapca', { ...body, chapcas: [body.chapcas[0]] }));
  assert.equal(sessionFields('chapca', { ...body, status: 'aborted', chapcas: [] }).captchaQuestions.length, 0);
  assert.throws(() => validCondition('date', { variant: 'day', inputLength: 8 }));
});
test('Sales captures each question, condition and visible active time while removing overlay waits from housing time', () => {
  const before = salesActions().slice(0, 5);
  const events = numbered([...before,
    [4000, { type: 'captcha-open', index: 0 }], [4000, { type: 'captcha-condition', index: 0, condition: { variant: 'standard', inputLength: 6 } }],
    [5000, { type: 'captcha-result', index: 0, correct: false }], [6500, { type: 'captcha-condition', index: 0, condition: { variant: 'standard', inputLength: 6 } }], [6500, { type: 'captcha-retry', index: 0 }],
    [7500, { type: 'visibility', visible: false }], [17500, { type: 'visibility', visible: true }], [19500, { type: 'captcha-result', index: 0, correct: true }], [20500, { type: 'phase', phase: 'search' }], [21500, { type: 'finish', reason: 'navigation' }],
  ]);
  const state = applySalesEvents(initialSalesRuntime(), events, 21500, [{ type: 'number', step: 1 }]).state, summary = salesSummary(state);
  assert.equal(summary.captchaDuration, 4); assert.equal(summary.captchaQuestions[0].activeMs, 4000); assert.equal(summary.captchaQuestions[0].attempts, 2); assert.deepEqual(summary.captchaQuestions[0].conditions, ['standard:6']);
  assert.equal(summary.captchaWallDurationMs, 16500); assert.equal(summary.interactionDurationMs, 5000);
});

test('A retry that changes date conditions is not treated as a pure four-digit or eight-digit sample', () => {
  const run = fixture('mixed', 1, []); run.plan = ['date'];
  addQuestionAttempt(run.questions, 0, 'date', 2000, false, { variant: 'full', inputLength: 8 });
  addQuestionAttempt(run.questions, 0, 'date', 1000, true, { variant: 'year', inputLength: 4 });
  assert.equal(captchaReport([run], { ...defaultCaptchaFilters }).summary.meanMs, 3000);
  assert.equal(captchaReport([run], { ...defaultCaptchaFilters, condition: 'year:4' }).summary.solved, 0);
});
