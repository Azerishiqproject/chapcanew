import type { CaptchaType } from '@/store/slices/captchaSlice';
export type SalesPhase = 'project' | 'payment' | 'method' | 'search' | 'complete';
export interface CaptchaChallenge { type: CaptchaType; step: 1 | 2 }
export function captchaPlan(enabled: boolean, count: number, allowed: CaptchaType[], random = Math.random): CaptchaChallenge[] {
  if (!enabled) return [];
  const types: CaptchaType[] = allowed.length ? allowed : ['text'];
  const firstCount = count <= 2 ? 1 : 1 + Math.floor(random() * (count - 1));
  const plan: CaptchaChallenge[] = [];
  for (let i = 0; i < count; i++) {
    const candidates = types.filter(type => type !== plan[i - 1]?.type);
    const pool = candidates.length ? candidates : types;
    plan.push({ type: pool[Math.floor(random() * pool.length)], step: i < firstCount ? 1 : 2 });
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
