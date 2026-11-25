import test, { before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import PuzzleCaptcha from '../src/components/PuzzleCaptcha';
import { DATE_PARTS, DATE_LABELS, createDateChallenge } from '../src/lib/date-challenge';
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
  class TestPointerEvent extends dom.window.MouseEvent {
    pointerId: number; isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.isPrimary = init.isPrimary ?? true; }
  }
  Object.defineProperty(dom.window, 'PointerEvent', { value: TestPointerEvent });
  const captured = new WeakMap<Element, number>();
  Object.assign(dom.window.HTMLElement.prototype, { setPointerCapture(this: Element, id: number) { captured.set(this, id); }, hasPointerCapture(this: Element, id: number) { return captured.get(this) === id; }, releasePointerCapture(this: Element) { captured.delete(this); } });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', { value: () => ({ createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillText(text: string) { painted += text; } }) });
  ui = await import('@testing-library/react');
});
afterEach(() => { ui.cleanup(); painted = ''; });
function enterDigits(view: ReturnType<typeof ui.render>, digits: string) { for (const digit of digits) ui.fireEvent.click(view.getByRole('button', { name: digit })); }

for (const [label, Component] of [['date', DateCaptcha], ['birthdate', BirthDateCaptcha]] as const) {
  test(`${label} emits one wrong result, ignores rerenders, retries and accepts the configured date once`, context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    context.mock.method(Math, 'random', () => 0);
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

for (const [random, fixed] of [[.25, 'day'], [.5, 'month'], [.75, 'year']] as const) for (const [label, Component] of [['date', DateCaptcha], ['birthdate', BirthDateCaptcha]] as const) {
  test(`${label} fills ${fixed}, skips it during entry and preserves it on clear/backspace`, context => {
    context.mock.method(Math, 'random', () => random);
    const answers: boolean[] = [], expected = createDateChallenge('29/02/2000', () => random);
    const view = ui.render(<Component correctDate="29/02/2000" onVerify={value => answers.push(value)} />);
    const fixedGroup = view.getByRole('group', { name: `${DATE_LABELS[fixed]}, hazır` });
    assert.ok(fixedGroup.textContent?.includes(expected.values[fixed]));
    const digits = DATE_PARTS.filter(part => part !== fixed).map(part => expected.values[part]).join('');
    enterDigits(view, digits.slice(0, 2)); ui.fireEvent.click(view.getByRole('button', { name: 'Təmizlə' }));
    assert.ok(fixedGroup.textContent?.includes(expected.values[fixed])); assert.deepEqual(answers, []);
    enterDigits(view, digits.slice(0, -1)); ui.fireEvent.click(view.getByRole('button', { name: 'Geri sil' }));
    enterDigits(view, digits.slice(-2)); assert.deepEqual(answers, [true]);
  });
}
for (const random of [0, .25, .5, .75]) for (const [label, Component] of [['date', DateCaptcha], ['birthdate', BirthDateCaptcha]] as const) {
  test(`${label} accepts the saved non-today date in variant ${random}, despite parent rerenders`, context => {
    context.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12) });
    context.mock.method(Math, 'random', () => random);
    const answers: boolean[] = [], expected = createDateChallenge('16/12/2026', () => random);
    const view = ui.render(<Component correctDate="16.12.2026" onVerify={value => answers.push(value)} />);
    if (label === 'date') {
      assert.match(view.getByRole('heading').textContent!, /Təyin etdiyiniz tarixi/);
      assert.match(view.getByRole('note').textContent!, /ayarlarda saxladığınız tarix/);
    }
    const editable = DATE_PARTS.filter(part => part !== expected.fixed);
    assert.equal(view.getByRole('group', { name: DATE_LABELS[editable[0]], exact: true }).getAttribute('aria-current'), 'step');
    const digits = editable.map(part => expected.values[part]).join('');
    for (const digit of digits) {
      ui.fireEvent.click(view.getByRole('button', { name: digit, exact: true }));
      view.rerender(<Component correctDate="16.12.2026" onVerify={value => answers.push(value)} />);
    }
    assert.deepEqual(answers, [true]);
    assert.equal(view.queryByRole('alert'), null);
    for (const part of DATE_PARTS) assert.match(view.getByRole('group', { name: new RegExp(`^${DATE_LABELS[part]}`) }).textContent!, new RegExp(expected.values[part]));
  });
}
function puzzleFixture(onVerify: (correct: boolean) => void, width = 350) {
  const view = ui.render(<PuzzleCaptcha onVerify={onVerify} />), slider = view.getByRole('slider');
  slider.parentElement!.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, bottom: 50, right: width, width, height: 50, toJSON() {} });
  return { view, slider };
}
test('Puzzle checks only on release, counts a wrong drop once and retries with a working slider', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] }); context.mock.method(Math, 'random', () => 0);
  const answers: boolean[] = [], { view, slider } = puzzleFixture(value => answers.push(value));
  ui.fireEvent.pointerDown(slider, { pointerId: 1, clientX: 10, button: 0 });
  ui.fireEvent.pointerMove(slider, { pointerId: 1, clientX: 112 }); assert.deepEqual(answers, []);
  ui.fireEvent.pointerUp(slider, { pointerId: 1, clientX: 200 });
  ui.fireEvent.pointerUp(slider, { pointerId: 1, clientX: 200 }); assert.deepEqual(answers, [false]);
  assert.ok(view.getByRole('alert'));
  ui.act(() => context.mock.timers.tick(1500)); assert.equal(slider.getAttribute('aria-valuenow'), '0');
  ui.fireEvent.pointerDown(slider, { pointerId: 2, clientX: 10, button: 0 });
  ui.fireEvent.pointerUp(slider, { pointerId: 2, clientX: 112 }); assert.deepEqual(answers, [false, true]);
  ui.fireEvent.lostPointerCapture(slider, { pointerId: 2 }); assert.equal(slider.getAttribute('aria-disabled'), 'true');
});
test('Puzzle cancellation, track clicks and second pointers do not submit; pointer math scales with width', context => {
  context.mock.method(Math, 'random', () => 0);
  const answers: boolean[] = [], { slider } = puzzleFixture(value => answers.push(value), 230);
  ui.fireEvent.pointerDown(slider.parentElement!, { clientX: 110 }); ui.fireEvent.pointerUp(slider.parentElement!, { clientX: 110 });
  ui.fireEvent.pointerDown(slider, { pointerId: 1, clientX: 10, button: 0 }); ui.fireEvent.pointerUp(slider, { pointerId: 1, clientX: 10 });
  ui.fireEvent.pointerDown(slider, { pointerId: 2, clientX: 10, button: 0 }); ui.fireEvent.pointerMove(slider, { pointerId: 2, clientX: 70 });
  ui.fireEvent.pointerCancel(slider, { pointerId: 2 }); assert.deepEqual(answers, []); assert.equal(slider.getAttribute('aria-valuenow'), '0');
  ui.fireEvent.pointerDown(slider, { pointerId: 3, clientX: 10, button: 0 });
  ui.fireEvent.pointerDown(slider, { pointerId: 4, clientX: 110, button: 0, isPrimary: false });
  ui.fireEvent.pointerUp(slider, { pointerId: 4, clientX: 110 }); assert.deepEqual(answers, []);
  ui.fireEvent.pointerUp(slider, { pointerId: 3, clientX: 71.2 }); assert.deepEqual(answers, [true]);
});
test('Puzzle supports keyboard movement and confirms just once', context => {
  context.mock.method(Math, 'random', () => 0);
  const answers: boolean[] = [], { slider } = puzzleFixture(value => answers.push(value));
  ui.fireEvent.keyDown(slider, { key: 'Enter' }); assert.deepEqual(answers, []);
  for (let i = 0; i < 34; i++) ui.fireEvent.keyDown(slider, { key: 'ArrowRight' });
  ui.fireEvent.keyDown(slider, { key: 'Enter' }); ui.fireEvent.keyDown(slider, { key: 'Enter' }); assert.deepEqual(answers, [true]);
});
test('Puzzle type round-trips through user settings without requiring date or personal answers', async context => {
  const config = defaultCaptchaSettings(); config.allowedTypes = ['puzzle'];
  config.dateConfig = { todayDate: '', birthDate: '' }; config.personalConfig = { fin: '', religion: '', favoriteCar: '' };
  const writes: typeof config[] = [];
  context.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    if (init?.method === 'PUT') { writes.push(JSON.parse(init.body as string)); return Response.json({ ok: true }); }
    return Response.json({ settings: config });
  });
  const view = ui.render(<Provider store={settingsStore()}><CaptchaSettingsPanel /></Provider>);
  await ui.waitFor(() => assert.equal((view.getByRole('button', { name: 'Yadda saxla' }) as HTMLButtonElement).disabled, false));
  assert.equal((view.getByRole('checkbox', { name: 'Şəkil sürüşdürmə Captcha' }) as HTMLInputElement).checked, true);
  ui.fireEvent.click(view.getByRole('button', { name: 'Yadda saxla' }));
  await ui.waitFor(() => assert.equal(writes.length, 1)); assert.deepEqual(writes[0].allowedTypes, ['puzzle']);
});
