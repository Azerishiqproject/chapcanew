import test, { before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import CaptchaAnalyticsPanel from '../src/components/analytics/CaptchaAnalyticsPanel';
import { normalizeCaptchaRun, type CaptchaDataset } from '../src/lib/captcha-analytics';
let ui: typeof import('@testing-library/react');
before(async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, self: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  ui = await import('@testing-library/react');
});
afterEach(() => ui.cleanup());
function fixture(): CaptchaDataset {
  return { generatedAt: 1795651200000, runs: [[2, 'ali@example.com', 'Ali', [2000, 4000]], [5, 'veli@example.com', 'Veli', [5000, 5000, 5000, 5000, 5000]]].map(([count, email, name, times]) => normalizeCaptchaRun(String(count), 'sales', {
    email, startTime: 1795651200000, status: 'completed', metricsVersion: 2, totalDuration: Number(count) * 10000, captchaConfig: { plan: Array.from({ length: Number(count) }, () => ({ type: 'number', step: 1 })) }, captchaQuestions: (times as number[]).map((activeMs, index) => ({ index, type: 'number', completed: true, attempts: 1, incorrect: 0, activeMs, conditions: ['standard:6'] })), correctCaptchas: count,
  }, String(name))) };
}
test('Coach can separate 2/5 tasks, inspect each CAPTCHA, switch exact scenario and compare users without another database read', async context => {
  let reads = 0;
  context.mock.method(globalThis, 'fetch', async () => { reads++; return Response.json(fixture()); });
  const view = ui.render(<CaptchaAnalyticsPanel source="sales" />);
  await ui.waitFor(() => assert.ok(view.getAllByText('4.43 san').length > 0));
  const count = view.getByLabelText('Tur CAPTCHA sayı');
  ui.fireEvent.change(count, { target: { value: '5' } });
  assert.ok(view.getAllByText('5.00 san').length > 0); assert.equal(reads, 1);
  ui.fireEvent.click(view.getByRole('button', { name: /Tur və CAPTCHA detalları/ }));
  const row = view.getByRole('button', { name: /Veli.*Satış demosu/ }); ui.fireEvent.click(row);
  assert.equal(view.getAllByText(/Standart · 6 simvol/).length >= 5, true);
  assert.ok(view.getByText('5. Rəqəm'));
  ui.fireEvent.change(count, { target: { value: 'all' } });
  ui.fireEvent.click(view.getByRole('button', { name: /İstifadəçi müqayisəsi/ }));
  assert.ok(view.getByRole('link', { name: 'Ali' })); assert.ok(view.getByRole('link', { name: 'Veli' }));
  const scenario = view.getByLabelText('Müqayisə ssenarisi') as HTMLSelectElement;
  ui.fireEvent.change(scenario, { target: { value: fixture().runs[0].scenario } });
  assert.ok(view.getByRole('link', { name: 'Ali' })); assert.equal(view.queryByRole('link', { name: 'Veli' }), null);
  assert.equal(reads, 1);
});
test('Legacy runs are visible with missing-measurement labels and never receive invented normalized averages', async context => {
  const data = fixture(); data.runs.push(normalizeCaptchaRun('legacy', 'sales', { email: 'ali@example.com', totalDuration: 4000, startTime: 1795651200000, correctCaptchas: 5 }, 'Ali'));
  context.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const view = ui.render(<CaptchaAnalyticsPanel source="sales" email="ali@example.com" />);
  await ui.waitFor(() => assert.ok(view.getByText(/1 əvvəlki tur saxlanılıb/)));
  ui.fireEvent.change(view.getByLabelText('Ölçüm üsulu'), { target: { value: 'legacy' } });
  assert.equal(view.queryByText('CAPTCHA başına'), null);
  ui.fireEvent.click(view.getByRole('button', { name: /Ali.*Plan sayı bilinmir/ }));
  assert.ok(view.getByText(/fərdi aktiv həll müddəti və şərtlər saxlanılmadığı/));
});
