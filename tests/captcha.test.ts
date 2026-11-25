import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTCHA_TYPES, canonicalDate, captchaSettingsErrors, defaultCaptchaSettings, matchesAnswer, normalizeCaptchaSettings, resolveCaptchaSettings } from '../src/lib/captcha-config';
import { captchaPlan, CaptchaSequence } from '../src/lib/sales-flow';
import { settingsFields } from '../src/lib/server/data';
import captchaReducer, { replaceCaptchaSettings } from '../src/store/slices/captchaSlice';

test('Calendar validation normalizes dates and rejects impossible days and leap years', () => {
  assert.equal(canonicalDate(' 1.2.2026 '), '01/02/2026');
  assert.equal(canonicalDate('29-02-2000'), '29/02/2000');
  for (const value of ['29/02/1900', '29/02/2026', '31/04/2026', '00/10/2026', '25/13/2026', '', 'word']) assert.equal(canonicalDate(value), null);
  assert.equal(matchesAnswer('date', '01/02/2026', '1.2.2026'), true);
  assert.equal(matchesAnswer('birthdate', '31/04/2026', '31/04/2026'), false);
});
test('Only enabled, selected answer types require valid nonempty answers', () => {
  for (const type of ['date', 'birthdate', 'fin', 'religion', 'favoriteCar'] as const) {
    const settings = defaultCaptchaSettings(); settings.allowedTypes = [type];
    settings.dateConfig = { todayDate: '', birthDate: '' }; settings.personalConfig = { fin: '', religion: '', favoriteCar: '' };
    assert.equal(captchaSettingsErrors(settings).length, 1);
    assert.throws(() => settingsFields({ ...settings }));
    settings.enabled = false;
    assert.deepEqual(captchaSettingsErrors(settings), []);
    assert.equal(settingsFields({ ...settings }).enabled, false);
  }
  const settings = defaultCaptchaSettings(); settings.allowedTypes = ['number']; settings.personalConfig.fin = '';
  assert.deepEqual(captchaSettingsErrors(settings), []);
  assert.throws(() => settingsFields({ ...settings, requiredCount: 2.5 }));
  assert.throws(() => settingsFields({ ...settings, allowedTypes: [] }));
});
test('Answers normalize spaces, case and FİN consistently on both save and play', () => {
  const config = defaultCaptchaSettings(); config.allowedTypes = ['fin', 'religion', 'favoriteCar'];
  config.personalConfig = { fin: ' ab12cd3 ', religion: '  İSLAM ', favoriteCar: ' Mercedes   Benz ' };
  const saved = settingsFields({ ...config });
  assert.deepEqual(saved.personalConfig, { fin: 'AB12CD3', religion: 'İSLAM', favoriteCar: 'Mercedes Benz' });
  assert.ok(matchesAnswer('religion', 'islam', saved.personalConfig.religion));
  assert.ok(matchesAnswer('favoriteCar', 'mercedes   BENZ', saved.personalConfig.favoriteCar));
  assert.ok(matchesAnswer('fin', 'ab12cd3', saved.personalConfig.fin));
  assert.equal(matchesAnswer('religion', '', ''), false);
  assert.equal(matchesAnswer('text', 'I2ABC', 'i2abc'), true);
});
test('No saved settings means fresh defaults, independent of previous users and previous dates', () => {
  const first = resolveCaptchaSettings(null, new Date(2026, 10, 25)); first.enabled = false; first.allowedTypes.push('fin');
  const second = resolveCaptchaSettings(null, new Date(2026, 10, 26));
  assert.equal(second.enabled, true); assert.equal(second.dateConfig.todayDate, '26/11/2026'); assert.equal(second.allowedTypes.includes('fin'), false);
  const state = captchaReducer(undefined, replaceCaptchaSettings(first));
  assert.equal(captchaReducer(state, { type: 'auth/logout/fulfilled' }).enabled, true);
  assert.equal(captchaReducer(state, { type: 'auth/checkSession/fulfilled' }).enabled, true);
  const unknown = resolveCaptchaSettings({ ...second, secret: 'not-allowed' } as typeof second);
  assert.equal('secret' in unknown, false);
  assert.deepEqual(normalizeCaptchaSettings(second), second);
});
test('Counts 1–5 are run totals, split across stages with fair allowed-type selection', () => {
  for (let seed = 0; seed < 100; seed++) {
    let value = seed + 1; const random = () => ((value = value * 16807 % 2147483647) - 1) / 2147483646;
    for (const count of [1, 2, 3, 4, 5]) for (const allowed of [['fin'] as const, ['date', 'number', 'text', 'birthdate'] as const]) {
      const plan = captchaPlan(true, count, [...allowed], random);
      assert.equal(plan.length, count); assert.equal(plan[0].step, 1);
      assert.ok(plan.every(item => (allowed as readonly string[]).includes(item.type)));
      if (count > 1) assert.equal(plan.at(-1)!.step, 2);
      if (count >= allowed.length) assert.equal(new Set(plan.slice(0, allowed.length).map(p => p.type)).size, allowed.length);
    }
  }
  assert.deepEqual(captchaPlan(false, 5, [...CAPTCHA_TYPES]), []);
});
test('Wrong answers, double callbacks, closing and returning never advance or erase progress/time', () => {
  let now = 0;
  const sequence = new CaptchaSequence([{ type: 'date', step: 1 }, { type: 'fin', step: 2 }], () => now);
  assert.equal(sequence.open(2), false); assert.ok(sequence.open(1));
  now = 1000; assert.ok(sequence.answer(false)); assert.equal(sequence.answer(false), false); assert.equal(sequence.incorrect, 1);
  assert.equal(sequence.advance(), false); assert.equal(sequence.close(), false);
  now = 2500; sequence.retry(); now = 3500; assert.ok(sequence.close());
  now = 10000; assert.ok(sequence.open(1)); now = 11000; assert.ok(sequence.answer(true));
  assert.equal(sequence.answer(true), false); assert.deepEqual(sequence.logs, [{ type: 'date', duration: 3 }]);
  assert.ok(sequence.advance()); assert.equal(sequence.advance(), false); assert.equal(sequence.open(1), false);
  assert.ok(sequence.open(2)); now = 14000; assert.ok(sequence.answer(true)); sequence.advance();
  assert.equal(sequence.progress, 2); assert.equal(sequence.logs.length, 2); assert.equal(sequence.open(2), false);
});
