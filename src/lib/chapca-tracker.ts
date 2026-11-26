import type { CaptchaType } from './captcha-config';
import type { CaptchaCondition } from './captcha-metrics';
export interface TrainingAttempt { type: CaptchaType; questionIndex: number; attemptIndex: number; startMs: number; endMs: number; duration: number; isCorrect: boolean; condition: CaptchaCondition }
/** Count each attempt once. Feedback waits, hidden tabs and the next question are separate. */
export class ChapcaTracker {
  readonly startMs: number;
  readonly clientRunId: string;
  readonly attempts: TrainingAttempt[] = [];
  private active: { index: number; startMs: number; lastMs: number; duration: number; condition: CaptchaCondition } | null = null;
  private visible = true;
  private ended = false;
  constructor(readonly plan: CaptchaType[], readonly order: 'sequential' | 'random', private now: () => number = Date.now, id?: string) { this.startMs = now(); this.clientRunId = id ?? crypto.randomUUID(); }
  ready(index: number, condition: CaptchaCondition) {
    if (this.ended || this.active || index < 0 || index >= this.plan.length || this.attempts.some(item => item.questionIndex === index && item.isCorrect)) return;
    const at = this.now(); this.active = { index, startMs: at, lastMs: at, duration: 0, condition };
  }
  private advance() { if (this.active) { const at = this.now(); if (this.visible) this.active.duration += Math.max(0, at - this.active.lastMs); this.active.lastMs = at; } }
  visibility(visible: boolean) { this.advance(); this.visible = visible; }
  elapsed(index: number) { this.advance(); return this.attempts.filter(item => item.questionIndex === index).reduce((sum, item) => sum + item.duration, 0) + (this.active?.index === index ? this.active.duration : 0); }
  answer(index: number, correct: boolean) {
    if (this.ended || !this.active || this.active.index !== index) return null;
    this.advance();
    const attempt: TrainingAttempt = { type: this.plan[index], questionIndex: index, attemptIndex: this.attempts.filter(item => item.questionIndex === index).length, startMs: this.active.startMs, endMs: this.now(), duration: this.active.duration, isCorrect: correct, condition: this.active.condition };
    this.attempts.push(attempt); this.active = null; return attempt;
  }
  finish(status: 'completed' | 'aborted') {
    if (this.ended) return null;
    this.ended = true;
    return { clientRunId: this.clientRunId, metricsVersion: 2 as const, status, plan: this.plan, order: this.order, startMs: this.startMs, endMs: this.now(), attempts: [...this.attempts] };
  }
}
