import { TRAINING_DURATION_MS, TRAINING_PROTOCOL, REFERENCE_PROTOCOL, LEGACY_REFERENCE_PROTOCOL, isReferenceProtocol, referencePhaseAt, initialProgress, trainingStage, updateProgress } from './aim-training';
// The clock is supplied by the caller so rendering frequency never changes game speed.
export const ARENA = { width: 800, height: 480 };
export type AimMode = 'normal' | 'dual-targets' | 'moving-targets';
export type EndReason = 'lives' | 'manual' | 'hidden' | 'navigation' | 'time-limit' | 'practice-complete';
export interface AimSettings {
  mode: AimMode;
  targetsPerSecond: number;
  acceleration: number;
  lifetimeMs: number;
  diameter: number;
  lives: number;
  movementSpeed: number;
  spawnInset?: number;
  animation?: 'reference-pulse' | 'smooth-pulse' | 'legacy' | 'training-pulse' | 'video-pulse';
  training?: typeof TRAINING_PROTOCOL | typeof REFERENCE_PROTOCOL | typeof LEGACY_REFERENCE_PROTOCOL;
}
export const CHALLENGE: AimSettings = {
  mode: 'normal', targetsPerSecond: 2, acceleration: 0.01,
  lifetimeMs: 3500, diameter: 60, lives: 3, movementSpeed: 70,
  animation: 'reference-pulse',
};
// Reference Custom Challenge / Easy: measured 2.00 -> 2.02 targets/s over 6s.
export const EASY: AimSettings = { ...CHALLENGE, acceleration: 0.003, lives: 5 };
export const PROGRESSIVE: AimSettings = { ...CHALLENGE, targetsPerSecond: 0.625, acceleration: 0, diameter: 88, lifetimeMs: 4500, animation: 'training-pulse', training: TRAINING_PROTOCOL };
// Measured from the supplied video: 2.00 -> 2.15 t/s in ~15s,
// 60px peak diameter and ~30px/s growth/shrink over a four-second life.
export const LEGACY_DIRECT: AimSettings = { ...CHALLENGE, lifetimeMs: 4000, animation: 'video-pulse', training: LEGACY_REFERENCE_PROTOCOL };
// Smaller peak over the same 2s growth + 2s shrink: 24px/s instead of 30px/s.
export const DIRECT: AimSettings = { ...LEGACY_DIRECT, diameter: 48, spawnInset: 24, training: REFERENCE_PROTOCOL };
export const isProgressive = (settings: AimSettings) => settings.training === TRAINING_PROTOCOL;
export const MAX_RUN_MS = 30 * 60 * 1000;
export interface AimTarget { id: number; x: number; y: number; bornAt: number; vx: number; vy: number; stage?: number }
export type AimEvent =
  | { seq: number; type: 'spawn'; atMs: number; targetId: number; x: number; y: number; vx: number; vy: number; stage?: number }
  | { seq: number; type: 'hit' | 'miss'; atMs: number; targetId: number | null; x: number; y: number }
  | { seq: number; type: 'expire'; atMs: number; targetId: number }
  | { seq: number; type: 'move'; atMs: number; x: number; y: number; pointerType: 'mouse' | 'touch' | 'pen' }
  | { seq: number; type: 'resize'; atMs: number; width: number; height: number };
export type RecordedAimEvent = AimEvent & {
  shotNumber?: number;
  intervalMs?: number | null;
  hitIntervalMs?: number | null;
  reactionMs?: number | null;
  targetX?: number;
  targetY?: number;
  distanceFromCenterPx?: number;
  stage?: number;
  pathEfficiency?: number | null;
  normalizedCenterError?: number;
};
export interface AimMetrics {
  score: number; misses: number; expiredTargets: number; shotCount: number;
  spawnedTargets: number; accuracy: number; averageReactionMs: number | null;
  fastestReactionMs: number | null; slowestReactionMs: number | null;
  reactionDeviationMs: number | null; averageShotIntervalMs: number | null;
  averageHitIntervalMs: number | null; hitsPerSecond: number; clicksPerSecond: number;
  bestStreak: number; finalSpeed: number;
}
export function speedAt(settings: AimSettings, atMs: number) {
  return settings.targetsPerSecond + settings.acceleration * atMs / 1000;
}
export function nextSpawnTime(settings: AimSettings, afterMs: number) {
  const rate = speedAt(settings, afterMs);
  // Integrate the continuously increasing rate over the next target interval.
  // This stable form also works when acceleration is zero.
  const seconds = 2 / (rate + Math.sqrt(rate * rate + 2 * settings.acceleration));
  return afterMs + seconds * 1000;
}
function bounce(value: number, low: number, high: number) {
  const width = high - low, period = 2 * width;
  const wrapped = ((value - low) % period + period) % period;
  return low + (wrapped <= width ? wrapped : period - wrapped);
}
export function targetPosition(target: AimTarget, atMs: number, settings: AimSettings) {
  const seconds = Math.max(0, atMs - target.bornAt) / 1000;
  const radius = (target.stage && isProgressive(settings) ? trainingStage(target.stage).diameter : settings.diameter) / 2;
  return { x: bounce(target.x + target.vx * seconds, radius, ARENA.width - radius), y: bounce(target.y + target.vy * seconds, radius, ARENA.height - radius) };
}
export function targetRadius(target: AimTarget, atMs: number, settings: AimSettings) {
  const age = Math.max(0, atMs - target.bornAt);
  if (target.stage && isProgressive(settings)) {
    const stage = trainingStage(target.stage);
    const pulse = Math.sin(Math.PI * Math.min(1, age / stage.lifetimeMs)) ** 2;
    return stage.diameter / 2 * (0.65 + 0.35 * pulse);
  }
  if (settings.animation === 'video-pulse') {
    const progress = Math.min(1, age / settings.lifetimeMs);
    return settings.diameter / 2 * (1 - Math.abs(2 * progress - 1));
  }
  if (settings.animation === 'reference-pulse') {
    const progress = Math.min(1, age / settings.lifetimeMs);
    // Measured from the reference's 500ms screenshots: visible small target at
    // birth, near-constant growth/shrink rate, rather than a fast sine midpoint.
    const scale = 0.125 + 0.875 * (1 - Math.abs(2 * progress - 1));
    return settings.diameter / 2 * scale;
  }
  if (settings.animation === 'smooth-pulse') {
    const progress = Math.min(1, age / settings.lifetimeMs);
    // One gentle pulse: half a lifetime growing, half shrinking, with no hold
    // or abrupt change in velocity at the peak or at either endpoint.
    return settings.diameter / 2 * Math.sin(Math.PI * progress) ** 2;
  }
  // Keep validating already-recorded/pending runs with their original geometry.
  return settings.diameter / 2 * Math.max(0, Math.min(1, age / 180, (settings.lifetimeMs - age) / 1400));
}
export function targetOpacity(target: AimTarget, atMs: number, settings: AimSettings) {
  return settings.animation === 'reference-pulse' ? Math.max(0, Math.min(1, (settings.lifetimeMs - (atMs - target.bornAt)) / 250)) : 1;
}
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function calculateMetrics(events: RecordedAimEvent[], durationMs: number, settings: AimSettings): AimMetrics {
  const shots = events.filter((event) => event.type === 'hit' || event.type === 'miss');
  const hits = shots.filter((event) => event.type === 'hit');
  const spawns = new Map<number, number>();
  const reactions: number[] = [], shotIntervals: number[] = [], hitIntervals: number[] = [];
  let lastShot: number | null = null, lastHit: number | null = null, streak = 0, bestStreak = 0;
  for (const event of events) {
    if (event.type === 'spawn') spawns.set(event.targetId, event.atMs);
    if (event.type === 'expire' || event.type === 'miss') streak = 0;
    if (event.type !== 'hit' && event.type !== 'miss') continue;
    if (lastShot !== null) shotIntervals.push(event.atMs - lastShot);
    lastShot = event.atMs;
    if (event.type === 'hit') {
      const born = spawns.get(event.targetId!);
      if (born !== undefined) reactions.push(event.atMs - born);
      if (lastHit !== null) hitIntervals.push(event.atMs - lastHit);
      lastHit = event.atMs;
      bestStreak = Math.max(bestStreak, ++streak);
    }
  }
  const mean = average(reactions);
  return {
    score: hits.length, misses: shots.length - hits.length, shotCount: shots.length,
    expiredTargets: events.filter((event) => event.type === 'expire').length,
    spawnedTargets: spawns.size, accuracy: shots.length ? hits.length / shots.length * 100 : 0,
    averageReactionMs: mean, fastestReactionMs: reactions.length ? Math.min(...reactions) : null,
    slowestReactionMs: reactions.length ? Math.max(...reactions) : null,
    reactionDeviationMs: mean === null ? null : Math.sqrt(reactions.reduce((sum, value) => sum + (value - mean) ** 2, 0) / reactions.length),
    averageShotIntervalMs: average(shotIntervals), averageHitIntervalMs: average(hitIntervals),
    hitsPerSecond: durationMs > 0 ? hits.length * 1000 / durationMs : 0,
    clicksPerSecond: durationMs > 0 ? shots.length * 1000 / durationMs : 0,
    bestStreak, finalSpeed: speedAt(settings, durationMs),
  };
}
export class AimGame {
  targets: AimTarget[] = [];
  events: AimEvent[] = [];
  elapsedMs = 0;
  ended: EndReason | null = null;
  hits = 0;
  misses = 0;
  lostLives = 0;
  progress = initialProgress();
  private lastMoveMs = -Infinity;
  private nextTargetId = 1;
  private nextSpawnAt: number;
  constructor(public readonly settings: AimSettings = { ...CHALLENGE }, private random: () => number = Math.random) {
    this.nextSpawnAt = isProgressive(settings) ? trainingStage(1).gapMs + this.random() * 400 : nextSpawnTime(settings, 0);
  }
  get stage() { return trainingStage(this.progress.level); }
  private scheduleTraining() { this.nextSpawnAt = this.elapsedMs + this.stage.gapMs + this.random() * 400; }
  advance(nowMs: number) {
    if (this.ended) return;
    const duration = isProgressive(this.settings) ? TRAINING_DURATION_MS : MAX_RUN_MS;
    const now = Math.min(duration, Math.max(this.elapsedMs, nowMs));
    // Process deadlines chronologically, including multiple deadlines in one frame.
    while (!this.ended) {
      const deadline = (target: AimTarget) => target.bornAt + (target.stage && isProgressive(this.settings) ? trainingStage(target.stage).lifetimeMs : this.settings.lifetimeMs);
      const first = this.targets.reduce<AimTarget | undefined>((a, b) => !a || deadline(b) < deadline(a) ? b : a, undefined);
      const expiresAt = first ? deadline(first) : Infinity;
      if (Math.min(expiresAt, this.nextSpawnAt) > now) break;
      if (expiresAt <= this.nextSpawnAt) {
        this.elapsedMs = expiresAt;
        this.targets = this.targets.filter((target) => target.id !== first!.id);
        this.events.push({ seq: this.events.length, type: 'expire', atMs: expiresAt, targetId: first!.id });
        this.lostLives++;
        if (isProgressive(this.settings)) { if (first!.stage === this.progress.level) this.progress = updateProgress(this.progress, 'expire'); this.scheduleTraining(); }
        else if (this.lostLives >= this.settings.lives) this.ended = 'lives';
      } else {
        this.elapsedMs = this.nextSpawnAt;
        if (isProgressive(this.settings) && this.targets.length >= this.stage.maxTargets) { this.nextSpawnAt = expiresAt; continue; }
        const count = this.settings.mode === 'dual-targets' ? 2 : 1;
        for (let i = 0; i < count; i++) this.spawn();
        if (isProgressive(this.settings)) this.scheduleTraining();
        else this.nextSpawnAt = this.settings.mode === 'dual-targets'
          ? this.elapsedMs + this.settings.lifetimeMs
          : nextSpawnTime(this.settings, this.elapsedMs);
      }
    }
    if (!this.ended) this.elapsedMs = now;
    if (isReferenceProtocol(this.settings.training)) {
      this.progress.level = referencePhaseAt(this.elapsedMs);
      this.progress.maxLevel = Math.max(this.progress.maxLevel, this.progress.level);
    }
    if (!this.ended && nowMs >= duration) this.ended = isProgressive(this.settings) ? 'practice-complete' : 'time-limit';
  }
  private spawn() {
    const margin = (isProgressive(this.settings) ? this.stage.diameter : this.settings.diameter) / 2 + (this.settings.spawnInset ?? 10);
    let x = margin, y = margin;
    for (let attempt = 0; attempt < 20; attempt++) {
      x = margin + this.random() * (ARENA.width - margin * 2);
      y = margin + this.random() * (ARENA.height - margin * 2);
      if (this.targets.every((target) => {
        const point = targetPosition(target, this.elapsedMs, this.settings);
        return Math.hypot(point.x - x, point.y - y) > this.settings.diameter + 8;
      })) break;
    }
    const angle = this.random() * Math.PI * 2;
    const velocity = this.settings.mode === 'moving-targets' ? this.settings.movementSpeed : 0;
    const target = { id: this.nextTargetId++, x, y, bornAt: this.elapsedMs, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, ...(this.settings.training ? { stage: isProgressive(this.settings) ? this.progress.level : referencePhaseAt(this.elapsedMs) } : {}) };
    this.targets.push(target);
    this.events.push({ seq: this.events.length, type: 'spawn', atMs: this.elapsedMs, targetId: target.id, x, y, vx: target.vx, vy: target.vy, ...(target.stage ? { stage: target.stage } : {}) });
  }
  move(x: number, y: number, nowMs: number, pointerType: 'mouse' | 'touch' | 'pen' = 'mouse', force = false) {
    if (!this.settings.training || this.ended) return;
    this.advance(nowMs);
    if (this.ended || (!force && this.elapsedMs - this.lastMoveMs < 50)) return;
    this.lastMoveMs = this.elapsedMs;
    this.events.push({ seq: this.events.length, type: 'move', atMs: this.elapsedMs, x, y, pointerType });
  }
  resize(width: number, height: number, nowMs: number) {
    if (!this.settings.training || this.ended) return;
    this.advance(nowMs);
    if (!this.ended) this.events.push({ seq: this.events.length, type: 'resize', atMs: this.elapsedMs, width, height });
  }
  shoot(x: number, y: number, nowMs: number) {
    this.advance(nowMs);
    if (this.ended) return null;
    const target = [...this.targets].reverse().find((target) => {
      const point = targetPosition(target, this.elapsedMs, this.settings);
      return Math.hypot(x - point.x, y - point.y) <= targetRadius(target, this.elapsedMs, this.settings);
    });
    const event: AimEvent = { seq: this.events.length, type: target ? 'hit' : 'miss', atMs: this.elapsedMs, targetId: target?.id ?? null, x, y };
    this.events.push(event);
    if (target) {
      this.hits++; this.targets = this.targets.filter((item) => item.id !== target.id);
      if (isProgressive(this.settings)) { if (target.stage === this.progress.level) this.progress = updateProgress(this.progress, 'hit'); this.scheduleTraining(); }
      // Doubleshot is one pair at a time, never a fresh pair every 500ms.
      if (this.settings.mode === 'dual-targets' && !this.targets.length) this.nextSpawnAt = nextSpawnTime(this.settings, this.elapsedMs);
    }
    else {
      this.misses++;
      if (isProgressive(this.settings)) {
        const level = this.progress.level;
        this.progress = updateProgress(this.progress, 'miss');
        if (this.progress.level !== level) this.scheduleTraining();
      }
    }
    return event;
  }
  finish(reason: Exclude<EndReason, 'lives'>, nowMs: number) {
    this.advance(nowMs);
    this.ended ||= reason;
  }
}
