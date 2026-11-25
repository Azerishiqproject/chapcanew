import test, { before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import DateCaptcha from '../src/components/DateCaptcha';
import BirthDateCaptcha from '../src/components/BirthDateCaptcha';
import NumberCaptcha from '../src/components/NumberCaptcha';
import TextCaptcha from '../src/components/TextCaptcha';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import CaptchaSettingsPanel from '../src/components/CaptchaSettingsPanel';
import captchaReducer, { replaceCaptchaSettings } from '../src/store/slices/captchaSlice';
import authReducer from '../src/store/slices/authSlice';
import { defaultCaptchaSettings } from '../src/lib/captcha-config';
import PersonalInfoCaptcha from '../src/components/PersonalInfoCaptcha';

let ui: typeof import('@testing-library/react');
let painted = '';
before(async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', { value: () => ({ createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillText(text: string) { painted += text; } }) });
  ui = await import('@testing-library/react');
});
afterEach(() => { ui.cleanup(); painted = ''; });
function enterDigits(view: ReturnType<typeof ui.render>, digits: string) { for (const digit of digits) ui.fireEvent.click(view.getByRole('button', { name: digit })); }

for (const [label, Component] of [['date', DateCaptcha], ['birthdate', BirthDateCaptcha]] as const) {
  test(`${label} emits one wrong result, ignores rerenders, retries and accepts the configured date once`, context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const answers: boolean[] = [];
    const view = ui.render(<Component correctDate="29.02.2000" onVerify={value => answers.push(value)} />);
    enterDigits(view, '28022000'); assert.deepEqual(answers, [false]);
    view.rerender(<Component correctDate="29.02.2000" onVerify={value => answers.push(value)} />);
    assert.deepEqual(answers, [false]);
    ui.act(() => context.mock.timers.tick(1500));
    enterDigits(view, '29022000'); assert.deepEqual(answers, [false, true]);
    view.rerender(<Component correctDate="29.02.2000" onVerify={value => answers.push(value)} />);
    assert.deepEqual(answers, [false, true]);
  });
}
test('number challenge reports wrong answers and creates a fresh usable retry', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const answers: boolean[] = [];
  const view = ui.render(<NumberCaptcha onVerify={value => answers.push(value)} />);
  enterDigits(view, '000000'); assert.deepEqual(answers, [false]);
  view.rerender(<NumberCaptcha onVerify={value => answers.push(value)} />); assert.equal(answers.length, 1);
  ui.act(() => context.mock.timers.tick(1500));
  const target = view.getByText(/^\d{6}$/).textContent!;
  enterDigits(view, target); assert.deepEqual(answers, [false, true]);
});
test('text challenge emits wrong once, retries and accepts the newly drawn text', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const answers: boolean[] = [];
  const view = ui.render(<TextCaptcha onVerify={value => answers.push(value)} />);
  const input = view.getByRole('textbox', { name: 'Şəkildəki mətn' });
  ui.fireEvent.change(input, { target: { value: '!!!!!' } });
  ui.fireEvent.click(view.getByRole('button', { name: 'Təsdiqlə' }));
  ui.fireEvent.click(view.getByRole('button', { name: 'Təsdiqlə' })); assert.deepEqual(answers, [false]);
  painted = ''; ui.act(() => context.mock.timers.tick(1500)); assert.equal(painted.length, 5);
  ui.fireEvent.change(input, { target: { value: painted.toUpperCase() } });
  ui.fireEvent.keyDown(input, { key: 'Enter' }); assert.deepEqual(answers, [false, true]);
});
for (const [type, expected, entered] of [['fin', 'AB12CD3', 'ab12cd3'], ['religion', 'İslam', '  İSLAM '], ['favoriteCar', 'Mercedes Benz', 'mercedes   BENZ']] as const) {
  test(`${type} honors the configured answer and reports each submission only once`, context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const answers: boolean[] = [];
    const view = ui.render(<PersonalInfoCaptcha type={type} correctAnswer={expected} onVerify={value => answers.push(value)} />);
    const input = view.getByRole('textbox');
    ui.fireEvent.change(input, { target: { value: 'WRONG12' } });
    ui.fireEvent.click(view.getByRole('button', { name: 'Təsdiqlə' })); assert.deepEqual(answers, [false]);
    ui.act(() => context.mock.timers.tick(1500));
    ui.fireEvent.change(input, { target: { value: entered } });
    ui.fireEvent.keyDown(input, { key: 'Enter' });
    ui.fireEvent.click(view.getByRole('button', { name: 'Təsdiqlə' })); assert.deepEqual(answers, [false, true]);
  });
}

function settingsStore(uid = 'fixture-user') {
  const store = configureStore({ reducer: { auth: authReducer, captcha: captchaReducer } });
  store.dispatch({ type: 'auth/login/fulfilled', payload: { uid, email: `${uid}@example.com`, name: 'Fixture', status: 'user' } });
  return store;
}
test('Settings panel round-trips allowed types and total count, blocks invalid dates, and really disables controls', async context => {
  const config = defaultCaptchaSettings(); config.allowedTypes = ['fin']; config.requiredCount = 3; config.personalConfig.fin = 'AB12CD3';
  const writes: typeof config[] = [];
  context.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    if (init?.method === 'PUT') { writes.push(JSON.parse(init.body as string)); return Response.json({ ok: true }); }
    return Response.json({ settings: config });
  });
  const store = settingsStore();
  const statuses: boolean[] = [];
  const view = ui.render(<Provider store={store}><CaptchaSettingsPanel onStatusChange={status => statuses.push(status.blocked)} /></Provider>);
  const save = view.getByRole('button', { name: 'Yadda saxla' }) as HTMLButtonElement;
  await ui.waitFor(() => assert.equal(save.disabled, false));
  assert.equal((view.getByRole('slider') as HTMLInputElement).value, '3');
  assert.equal((view.getByLabelText('FİN (7 simvol)') as HTMLInputElement).value, 'AB12CD3');
  assert.equal((view.getByLabelText('Bugünkü Tarix (Tarix Captcha)') as HTMLInputElement).disabled, true);
  ui.fireEvent.change(view.getByRole('slider'), { target: { value: '5' } });
  assert.equal(statuses.at(-1), true);
  ui.fireEvent.click(save);
  await ui.waitFor(() => assert.equal(statuses.at(-1), false));
  assert.equal(writes.length, 1); assert.equal(writes[0].requiredCount, 5); assert.deepEqual(writes[0].allowedTypes, ['fin']);
  assert.equal(store.getState().captcha.requiredCount, 5);
  ui.fireEvent.click(view.getByRole('checkbox', { name: 'Tarix Captcha' }));
  ui.fireEvent.change(view.getByLabelText('Bugünkü Tarix (Tarix Captcha)'), { target: { value: '31/02/2026' } });
  ui.fireEvent.click(save); assert.match(view.getByRole('alert').textContent!, /etibarlı/); assert.equal(writes.length, 1);
  ui.fireEvent.click(view.getByRole('switch', { name: 'Captcha Sistemi' }));
  assert.equal((view.getByRole('slider') as HTMLInputElement).matches(':disabled'), true);
  ui.fireEvent.click(save);
  await ui.waitFor(() => assert.equal(writes.length, 2));
  assert.equal(writes[1].enabled, false);
});
test('Late settings for a previous account cannot overwrite new-user defaults', async context => {
  let previousResponse!: (response: Response) => void;
  context.mock.method(globalThis, 'fetch', async (input: string) => input.includes('user-a') ? new Promise<Response>(resolve => { previousResponse = resolve; }) : Response.json({ settings: null }));
  const store = settingsStore('user-a'), stale = defaultCaptchaSettings(); stale.enabled = false; stale.requiredCount = 5; stale.allowedTypes = ['fin'];
  store.dispatch(replaceCaptchaSettings(stale));
  const view = ui.render(<Provider store={store}><CaptchaSettingsPanel /></Provider>);
  ui.act(() => store.dispatch({ type: 'auth/login/fulfilled', payload: { uid: 'user-b', email: 'user-b@example.com', name: 'B', status: 'user' } }));
  await ui.waitFor(() => assert.equal((view.getByRole('button', { name: 'Yadda saxla' }) as HTMLButtonElement).disabled, false));
  await ui.act(async () => { previousResponse(Response.json({ settings: stale })); });
  assert.equal((view.getByRole('switch') as HTMLInputElement).checked, true);
  assert.equal((view.getByRole('slider') as HTMLInputElement).value, '1');
  assert.equal(store.getState().captcha.enabled, true); assert.deepEqual(store.getState().captcha.allowedTypes, ['date', 'number', 'text', 'birthdate']);
});
