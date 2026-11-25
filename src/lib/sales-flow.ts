import type { CaptchaType } from '@/lib/captcha-config';
export type SalesPhase = 'project' | 'payment' | 'method' | 'search' | 'complete';
export interface CaptchaChallenge { type: CaptchaType; step: 1 | 2 }
export function captchaPlan(enabled: boolean, count: number, allowed: CaptchaType[], random = Math.random): CaptchaChallenge[] {
  if (!enabled) return [];
  const types: CaptchaType[] = allowed.length ? allowed : ['text'];
  const firstCount = count <= 2 ? 1 : 1 + Math.floor(random() * (count - 1));
  const plan: CaptchaChallenge[] = [];
  let bag: CaptchaType[] = [];
  for (let i = 0; i < count; i++) {
    if (!bag.length) bag = [...new Set(types)];
    const candidates = bag.filter(type => type !== plan[i - 1]?.type);
    const pool = candidates.length ? candidates : bag;
    const type = pool[Math.floor(random() * pool.length)];
    bag.splice(bag.indexOf(type), 1);
    plan.push({ type, step: i < firstCount ? 1 : 2 });
  }
  return plan;
}
/** Accumulates time on both stages, including visits made through Previous. */
export class SalesClock {
  private current: 1 | 2 = 1;
  private since: number;
  private durations = { 1: 0, 2: 0 };
  private stopped = false;
  constructor(private now: () => number = () => Date.now()) { this.since = now(); }
  enter(step: 1 | 2) {
    if (this.stopped || step === this.current) return;
    const at = this.now();
    this.durations[this.current] += at - this.since;
    this.current = step; this.since = at;
  }
  finish() {
    if (!this.stopped) {
      this.durations[this.current] += this.now() - this.since;
      this.stopped = true;
    }
    return { step1Duration: this.durations[1] / 1000, step2Duration: this.durations[2] / 1000 };
  }
}

/** One run owns one sequence: answers and transitions can each be applied once. */
export class CaptchaSequence {
  progress = 0;
  status: 'idle' | 'answering' | 'wrong' | 'correct' = 'idle';
  incorrect = 0;
  readonly logs: { type: CaptchaType; duration: number }[] = [];
  private startedAt: number | null = null;
  private spentMs = 0;
  constructor(readonly plan: readonly CaptchaChallenge[], private now: () => number = () => Date.now()) {}
  get current() { return this.plan[this.progress]; }
  open(step: 1 | 2) {
    if (this.current?.step !== step) return false;
    if (this.status === 'idle') { this.status = 'answering'; this.startedAt = this.now(); }
    return this.status === 'answering';
  }
  private pause() {
    if (this.startedAt !== null) this.spentMs += Math.max(0, this.now() - this.startedAt);
    this.startedAt = null;
  }
  close() {
    if (this.status !== 'answering') return false;
    this.pause(); this.status = 'idle'; return true;
  }
  answer(correct: boolean) {
    if (this.status !== 'answering' || !this.current) return false;
    this.pause();
    if (correct) { this.logs.push({ type: this.current.type, duration: this.spentMs / 1000 }); this.status = 'correct'; }
    else { this.incorrect++; this.status = 'wrong'; }
    return true;
  }
  retry() {
    if (this.status !== 'wrong') return;
    this.status = 'answering'; this.startedAt = this.now();
  }
  advance() {
    if (this.status !== 'correct') return false;
    this.progress++; this.status = 'idle'; this.spentMs = 0; return true;
  }
}
