export const TRAINING_PROTOCOL = 'progressive-v1';
export const LEGACY_REFERENCE_PROTOCOL = 'reference-video-v1';
export const REFERENCE_PROTOCOL = 'reference-compact-v2';
export const isReferenceProtocol = (value: string | undefined) => value === REFERENCE_PROTOCOL || value === LEGACY_REFERENCE_PROTOCOL;
// Labels describe a continuous rate; changing sections never resets spawning.
export const REFERENCE_PHASES = [
  { level: 1, name: 'Başlangıç', fromMs: 0 },
  { level: 2, name: 'Orta tempo', fromMs: 30000 },
  { level: 3, name: 'Yüksek tempo', fromMs: 90000 },
] as const;
export const referencePhaseAt = (atMs: number) => atMs < 30000 ? 1 : atMs < 90000 ? 2 : 3;
export const TRAINING_DURATION_MS = 180000;
export const TRAINING_STAGES = [
  { level: 1, name: 'Alışma', gapMs: 1600, diameter: 88, lifetimeMs: 4500, maxTargets: 1 },
  { level: 2, name: 'Kontrol', gapMs: 1350, diameter: 80, lifetimeMs: 4200, maxTargets: 1 },
  { level: 3, name: 'Hız', gapMs: 1100, diameter: 72, lifetimeMs: 3800, maxTargets: 2 },
  { level: 4, name: 'Geçiş', gapMs: 900, diameter: 64, lifetimeMs: 3400, maxTargets: 2 },
  { level: 5, name: 'İleri', gapMs: 750, diameter: 56, lifetimeMs: 3000, maxTargets: 3 },
] as const;
export interface TrainingProgress { level: number; maxLevel: number; resolved: number; hits: number; misses: number; consecutiveErrors: number }
export const initialProgress = (): TrainingProgress => ({ level: 1, maxLevel: 1, resolved: 0, hits: 0, misses: 0, consecutiveErrors: 0 });
export const trainingStage = (level: number) => TRAINING_STAGES[Math.max(0, Math.min(4, level - 1))];
export function updateProgress(before: TrainingProgress, outcome: 'hit' | 'miss' | 'expire'): TrainingProgress {
  const next = { ...before };
  if (outcome !== 'miss') next.resolved++;
  if (outcome === 'hit') { next.hits++; next.consecutiveErrors = 0; }
  else { next.consecutiveErrors++; if (outcome === 'miss') next.misses++; }
  const drop = next.consecutiveErrors >= 3 || (next.resolved >= 8 && next.hits <= 4);
  const advance = next.resolved >= 8 && next.hits >= 7 && next.hits / Math.max(1, next.hits + next.misses) >= 0.85;
  if (drop || advance || next.resolved >= 8) {
    next.level = Math.max(1, Math.min(5, next.level + (drop ? -1 : advance ? 1 : 0)));
    next.maxLevel = Math.max(next.maxLevel, next.level);
    next.resolved = 0; next.hits = 0; next.misses = 0; next.consecutiveErrors = 0;
  }
  return next;
}
export interface TrainingStageStats {
  level: number; spawned: number; hits: number; misses: number; expired: number;
  responseSumMs: number; responseSquares: number; responseSamples: number[];
  centerErrorSum: number; pathEfficiencySum: number; pathSamples: number;
}
export const emptyStageStats = (level: number): TrainingStageStats => ({ level, spawned: 0, hits: 0, misses: 0, expired: 0, responseSumMs: 0, responseSquares: 0, responseSamples: [], centerErrorSum: 0, pathEfficiencySum: 0, pathSamples: 0 });
export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function stageMetrics(stage: TrainingStageStats) {
  const accuracy = stage.hits + stage.misses ? stage.hits / (stage.hits + stage.misses) * 100 : 0;
  const mean = stage.hits ? stage.responseSumMs / stage.hits : null;
  return { level: stage.level, targets: stage.spawned, hits: stage.hits, misses: stage.misses, expired: stage.expired,
    accuracy, hitRate: stage.hits + stage.expired ? stage.hits / (stage.hits + stage.expired) * 100 : 0,
    averageResponseMs: mean, medianResponseMs: median(stage.responseSamples),
    deviationMs: mean === null ? null : Math.sqrt(Math.max(0, stage.responseSquares / stage.hits - mean * mean)),
    centerAccuracy: stage.hits ? Math.max(0, 100 - stage.centerErrorSum / stage.hits * 100) : null,
    pathEfficiency: stage.pathSamples ? stage.pathEfficiencySum / stage.pathSamples : null,
    pathSamples: stage.pathSamples,
  };
}
export type InputDevice = 'mouse' | 'touchpad' | 'touch';
export interface TrainingEnvironment { inputDevice: InputDevice; arenaWidth: number; arenaHeight: number; devicePixelRatio: number }
export const comparisonCondition = (environment: TrainingEnvironment) => `${environment.inputDevice}:${Math.round(environment.arenaWidth / 20) * 20}x${Math.round(environment.arenaHeight / 20) * 20}`;
