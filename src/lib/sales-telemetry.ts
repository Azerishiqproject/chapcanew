import { addQuestionAttempt, validCondition, type CaptchaQuestion, type CaptchaCondition } from './captcha-metrics';
import { CAPTCHA_TYPES, type CaptchaType } from './captcha-config';
import type { CaptchaChallenge } from './sales-flow';
import { addressOptions, changeAddress, emptyAddress, findApartment, projectFor, salesCatalog, type SalesAddress, type SalesApartment } from './sales-catalog';
export const SALES_PHASES = ['project', 'payment', 'method', 'search'] as const;
export type SalesStage = typeof SALES_PHASES[number];
export type SalesField = keyof SalesAddress | 'payment' | 'method';
export type SalesAction =
  | { type: 'phase'; phase: SalesStage }
  | { type: 'select'; field: SalesField; value: string }
  | { type: 'focus'; field: SalesField }
  | { type: 'search'; found: boolean }
  | { type: 'reset' }
  | { type: 'catalog'; projectId: string; building: string; status: 'loading' | 'ready' | 'error' }
  | { type: 'captcha-open' | 'captcha-close' | 'captcha-retry'; index: number }
  | { type: 'captcha-condition'; index: number; condition: CaptchaCondition }
  | { type: 'captcha-result'; index: number; correct: boolean }
  | { type: 'visibility'; visible: boolean }
  | { type: 'finish'; reason: 'selected' | 'navigation' | 'logout' | 'recovered' };
export type SalesEvent = SalesAction & { seq: number; atMs: number };
export type RecordedSalesEvent = SalesEvent & { stage: SalesStage; captchaType?: CaptchaType; durationMs?: number; solveDurationMs?: number };
export const MAX_SALES_MS = 12 * 60 * 60 * 1000;
export interface SalesRuntime {
  atMs: number; nextSeq: number; phase: SalesStage; phaseMs: Record<SalesStage, number>;
  address: SalesAddress; payment: '' | 'own' | 'mortgage'; method: boolean; result: SalesApartment | null;
  searches: number; resets: number; backCount: number; selectionChanges: number; focusCount: number; catalogErrors: number;
  progress: number; captchaActive: boolean; captchaRetry: boolean; captchaMs: number; currentCaptchaMs: number; currentAttemptMs: number;
  correct: number; incorrect: number; captchaTypes: Partial<Record<CaptchaType, { correct: number; incorrect: number; solveMs: number }>>;
  metricsVersion?: number; captchaQuestions?: CaptchaQuestion[]; captchaCondition?: CaptchaCondition; captchaWallMs?: number; captchaFeedback?: boolean; visible?: boolean; interactionMs?: number;
  ended: 'selected' | 'navigation' | 'logout' | 'recovered' | null;
}
const fail = (message: string): never => { throw new Error(message); };
export function initialSalesRuntime(): SalesRuntime {
  return { atMs: 0, nextSeq: 0, phase: 'project', phaseMs: { project: 0, payment: 0, method: 0, search: 0 }, address: { ...emptyAddress }, payment: '', method: false, result: null,
    searches: 0, resets: 0, backCount: 0, selectionChanges: 0, focusCount: 0, catalogErrors: 0, progress: 0, captchaActive: false, captchaRetry: false, captchaMs: 0, currentCaptchaMs: 0, currentAttemptMs: 0, correct: 0, incorrect: 0, captchaTypes: {}, metricsVersion: 2, captchaQuestions: [], captchaCondition: { variant: 'unknown' }, captchaWallMs: 0, captchaFeedback: false, visible: true, interactionMs: 0, ended: null };
}
export function validateSalesPlan(enabled: boolean, count: number, allowed: CaptchaType[], plan: CaptchaChallenge[]) {
  if (!Number.isInteger(count) || count < 1 || count > 5 || plan.length !== (enabled ? count : 0) || allowed.some(type => !CAPTCHA_TYPES.includes(type))) fail('Geçersiz CAPTCHA planı.');
  if (enabled && (!allowed.length || plan[0]?.step !== 1 || (count > 1 && plan.at(-1)?.step !== 2))) fail('Geçersiz CAPTCHA dağılımı.');
  let lastStep = 1;
  for (const item of plan) { if (!allowed.includes(item.type) || ![1, 2].includes(item.step) || item.step < lastStep) fail('Geçersiz CAPTCHA türü/sırası.'); lastStep = item.step; }
}
function advance(state: SalesRuntime, atMs: number) {
  if (!Number.isFinite(atMs) || atMs < state.atMs || atMs > MAX_SALES_MS) fail('Geçersiz olay zamanı.');
  const delta = atMs - state.atMs; state.phaseMs[state.phase] += delta;
  const overlay = state.captchaActive || state.captchaRetry || state.captchaFeedback;
  if (overlay) state.captchaWallMs = (state.captchaWallMs ?? 0) + delta;
  else if (state.visible !== false) state.interactionMs = (state.interactionMs ?? 0) + delta;
  if (state.captchaActive && state.visible !== false) { state.captchaMs += delta; state.currentCaptchaMs += delta; state.currentAttemptMs += delta; }
  state.atMs = atMs;
}
export function applySalesEvents(previous: SalesRuntime, events: SalesEvent[], throughMs: number, plan: CaptchaChallenge[], resolveApartment: (address: SalesAddress) => SalesApartment | null = findApartment) {
  const state: SalesRuntime = structuredClone(previous), recorded: RecordedSalesEvent[] = [];
  for (const input of events) {
    if (state.ended || input.seq !== state.nextSeq || input.atMs > throughMs) fail('Satış olayı sırası uyuşmuyor.');
    advance(state, input.atMs);
    const event: RecordedSalesEvent = { ...input, stage: state.phase };
    const blocked = state.captchaActive || state.captchaRetry;
    switch (input.type) {
      case 'phase': {
        if (blocked || !SALES_PHASES.includes(input.phase)) fail('Aşama değiştirilemez.');
        const from = SALES_PHASES.indexOf(state.phase), to = SALES_PHASES.indexOf(input.phase);
        if (Math.abs(to - from) !== 1) fail('Geçersiz aşama geçişi.');
        if (to > from && ((input.phase === 'payment' && !state.address.projectId) || (input.phase === 'method' && !state.payment) || (input.phase === 'search' && (!state.method || plan[state.progress]?.step === 1)))) fail('Seçimler tamamlanmadı.');
        if (to < from) state.backCount++;
        state.captchaFeedback = false; state.phase = input.phase; state.result = null; break;
      }
      case 'select': {
        if (blocked) fail('Önce CAPTCHA tamamlanmalı.');
        if (input.field === 'payment') { if (state.phase !== 'payment' || !['own', 'mortgage'].includes(input.value)) fail('Geçersiz ödeme.'); state.payment = input.value as 'own' | 'mortgage'; }
        else if (input.field === 'method') { if (state.phase !== 'method' || input.value !== 'address') fail('Geçersiz yöntem.'); state.method = true; }
        else {
          if (input.field === 'projectId') { if (state.phase !== 'project' || (input.value && !projectFor(input.value))) fail('Geçersiz proje.'); }
          else {
            if (state.phase !== 'search') fail('Geçersiz adres aşaması.');
            const choices = addressOptions(state.address);
            const key = { building: 'buildings', entrance: 'entrances', floor: 'floors', apartment: 'apartments' } as const;
            const building = projectFor(state.address.projectId)?.buildings.find(item => item.number === state.address.building);
            if (input.value && (input.field === 'building' || building?.complete) && !choices[key[input.field]].includes(input.value)) fail('Geçersiz adres seçimi.');
          }
          state.address = changeAddress(state.address, input.field, input.value);
        }
        state.selectionChanges++; state.result = null; break;
      }
      case 'focus': state.focusCount++; break;
      case 'search': {
        if (state.phase !== 'search' || blocked || state.progress !== plan.length) fail('Arama henüz yapılamaz.');
        state.captchaFeedback = false; state.searches++; state.result = resolveApartment(state.address);
        if (input.found && !state.result) fail('Daire katalogda bulunamadı.');
        if (!input.found) state.result = null;
        break;
      }
      case 'reset': if (blocked || state.phase !== 'search') fail('Adres sıfırlanamaz.'); state.address = { ...emptyAddress, projectId: state.address.projectId }; state.result = null; state.resets++; break;
      case 'catalog': if (input.status === 'error') state.catalogErrors++; break;
      case 'captcha-open': {
        const challenge = plan[state.progress];
        if (blocked || !challenge || input.index !== state.progress || (challenge.step === 1 ? state.phase !== 'method' : state.phase !== 'search')) fail('Geçersiz CAPTCHA açılışı.');
        state.captchaFeedback = false; state.captchaCondition = { variant: 'unknown' }; state.captchaActive = true; event.captchaType = challenge.type; break;
      }
      case 'captcha-close': if (!state.captchaActive || input.index !== state.progress) fail('CAPTCHA açık değil.'); state.captchaActive = false; event.captchaType = plan[state.progress].type; break;
      case 'captcha-condition': {
        if ((!state.captchaActive && !state.captchaRetry) || input.index !== state.progress) fail('Geçersiz CAPTCHA koşulu.');
        state.captchaCondition = validCondition(plan[state.progress].type, input.condition); event.captchaType = plan[state.progress].type; break;
      }
      case 'captcha-result': {
        if (!state.captchaActive || input.index !== state.progress) fail('Geçersiz CAPTCHA sonucu.');
        const type = plan[state.progress].type, stats = state.captchaTypes[type] ?? { correct: 0, incorrect: 0, solveMs: 0 };
        event.captchaType = type; event.durationMs = state.currentAttemptMs;
        state.captchaQuestions ??= [];
        addQuestionAttempt(state.captchaQuestions, input.index, type, state.currentAttemptMs, input.correct, state.captchaCondition ?? { variant: 'unknown' }, state.phase);
        state.captchaActive = false; state.captchaFeedback = true;
        if (input.correct) { stats.correct++; stats.solveMs += state.currentCaptchaMs; event.solveDurationMs = state.currentCaptchaMs; state.correct++; state.progress++; state.currentCaptchaMs = 0; state.currentAttemptMs = 0; }
        else { stats.incorrect++; state.incorrect++; state.captchaRetry = true; state.captchaCondition = { variant: 'unknown' }; }
        state.captchaTypes[type] = stats; break;
      }
      case 'captcha-retry': if (!state.captchaRetry || input.index !== state.progress) fail('Geçersiz tekrar.'); state.captchaRetry = false; state.captchaFeedback = false; state.captchaActive = true; state.currentAttemptMs = 0; event.captchaType = plan[state.progress].type; break;
      case 'visibility': state.visible = input.visible; break;
      case 'finish':
        if (input.reason === 'selected' && (state.phase !== 'search' || !state.result || state.progress !== plan.length || blocked)) fail('Daire seçimi tamamlanmadı.');
        state.ended = input.reason; state.captchaActive = false; break;
      default: fail('Geçersiz satış olayı.');
    }
    if (input.type === 'phase') event.stage = state.phase;
    state.nextSeq++; recorded.push(event);
  }
  if (state.ended && throughMs !== state.atMs) fail('Bitiş süresi uyuşmuyor.');
  advance(state, throughMs);
  return { state, events: recorded };
}
export function salesSummary(state: SalesRuntime) {
  return { totalDuration: state.atMs, totalDurationSeconds: state.atMs / 1000,
    step1Duration: (state.phaseMs.project + state.phaseMs.payment + state.phaseMs.method) / 1000, step2Duration: state.phaseMs.search / 1000,
    phaseDurations: Object.fromEntries(SALES_PHASES.map(phase => [phase, state.phaseMs[phase] / 1000])),
    metricsVersion: state.metricsVersion ?? 1, captchaQuestions: state.captchaQuestions ?? [], captchaWallDurationMs: state.captchaWallMs ?? null, interactionDurationMs: state.interactionMs ?? null,
    captchaDuration: state.captchaMs / 1000, correctCaptchas: state.correct, incorrectCaptchas: state.incorrect, captchaTypes: state.captchaTypes,
    project: projectFor(state.address.projectId)?.name ?? '', address: state.address, paymentMethod: state.payment, phase: state.phase,
    selection: state.result ? { ...state.result, paymentMethod: state.payment, method: 'address', catalogVersion: salesCatalog.version } : null,
    searches: state.searches, resets: state.resets, backCount: state.backCount, selectionChanges: state.selectionChanges, focusCount: state.focusCount, catalogErrors: state.catalogErrors, eventCount: state.nextSeq,
    status: state.ended === 'selected' ? 'completed' : state.ended ? 'aborted' : 'playing', endReason: state.ended };
}
