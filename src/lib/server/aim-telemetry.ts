import { ARENA, CHALLENGE, EASY, DIRECT, LEGACY_DIRECT, PROGRESSIVE, isProgressive, nextSpawnTime, MAX_RUN_MS, targetPosition, targetRadius, speedAt, type AimSettings, type AimTarget, type RecordedAimEvent, type EndReason } from '../aim-game';
import { ApiError, record } from './security';
import { LEGACY_REFERENCE_PROTOCOL, isReferenceProtocol, referencePhaseAt, emptyStageStats, initialProgress, stageMetrics, trainingStage, updateProgress, type TrainingProgress, type TrainingStageStats } from '../aim-training';

interface TracedTarget extends AimTarget { startPointer?: { x: number; y: number }; pathPx?: number; pathSamples?: number }

export interface AimAccumulator {
  targets: TracedTarget[]; nextSequence: number; nextTargetId: number; lastEventMs: number;
  lastShotMs: number | null; lastHitMs: number | null;
  hits: number; misses: number; expired: number; spawned: number; streak: number; bestStreak: number;
  reactionSum: number; reactionSquares: number; fastest: number | null; slowest: number | null;
  shotIntervalSum: number; shotIntervalCount: number; hitIntervalSum: number; hitIntervalCount: number;
  progress: TrainingProgress; stages: TrainingStageStats[];
  cursor: { x: number; y: number } | null; pointerTypes: string[]; environmentChanged: boolean;
  nextTrainingSpawnAt: number; lastReferenceSpawnMs: number;
}
export const initialAccumulator = (): AimAccumulator => ({
  targets: [], nextSequence: 0, nextTargetId: 1, lastEventMs: 0, lastShotMs: null, lastHitMs: null,
  hits: 0, misses: 0, expired: 0, spawned: 0, streak: 0, bestStreak: 0,
  reactionSum: 0, reactionSquares: 0, fastest: null, slowest: null,
  shotIntervalSum: 0, shotIntervalCount: 0, hitIntervalSum: 0, hitIntervalCount: 0,
  progress: initialProgress(), stages: [1, 2, 3, 4, 5].map(emptyStageStats), cursor: null, pointerTypes: [], environmentChanged: false,
  nextTrainingSpawnAt: trainingStage(1).gapMs, lastReferenceSpawnMs: 0,
});
export function bounded(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new ApiError(400, 'Geçersiz oyun ölçümü.');
  return value;
}
function integer(value: unknown, min: number, max: number) {
  const result = bounded(value, min, max);
  if (!Number.isInteger(result)) throw new ApiError(400, 'Geçersiz sıra numarası.');
  return result;
}
export function runConfiguration(body: Record<string, unknown>): { profile: string; settings: AimSettings } {
  if (body.profile === 'direct') {
    const legacy = body.settings && record(body.settings).training === LEGACY_REFERENCE_PROTOCOL;
    return { profile: 'direct', settings: { ...(legacy ? LEGACY_DIRECT : DIRECT) } };
  }
  if (body.profile === 'progressive') return { profile: 'progressive', settings: { ...PROGRESSIVE } };
  // Cached clients and pending rounds retain the geometry they actually used.
  const requested = body.settings ? record(body.settings).animation : CHALLENGE.animation;
  const animation = requested === 'reference-pulse' || requested === 'smooth-pulse' ? requested : 'legacy';
  if (body.profile === 'easy') return { profile: 'easy', settings: { ...EASY, animation } };
  if (body.profile === 'challenge') return { profile: 'challenge', settings: { ...CHALLENGE, animation } };
  if (!['custom', 'doubleshot', 'moving'].includes(String(body.profile))) throw new ApiError(400, 'Geçersiz antrenman türü.');
  const input = record(body.settings);
  return { profile: String(body.profile), settings: {
    mode: body.profile === 'doubleshot' ? 'dual-targets' : body.profile === 'moving' ? 'moving-targets' : 'normal',
    targetsPerSecond: bounded(input.targetsPerSecond, 0.5, 10), acceleration: bounded(input.acceleration, 0, 0.5),
    lives: integer(input.lives, 1, 10), diameter: bounded(input.diameter, 30, 100),
    lifetimeMs: 3500, movementSpeed: bounded(input.movementSpeed, 20, 200),
    animation,
  } };
}
export function applyTelemetry(previous: AimAccumulator, input: unknown, settings: AimSettings, throughMs: number) {
  bounded(throughMs, 0, MAX_RUN_MS);
  if (!Array.isArray(input) || input.length > 100) throw new ApiError(400, 'Atış paketi çok büyük.');
  const state: AimAccumulator = { ...initialAccumulator(), ...previous,
    progress: { ...(previous.progress || initialProgress()) },
    stages: (previous.stages || [1, 2, 3, 4, 5].map(emptyStageStats)).map((stage) => ({ ...stage, responseSamples: [...stage.responseSamples] })),
    pointerTypes: [...(previous.pointerTypes || [])], targets: previous.targets.map((target) => ({ ...target })) };
  const events: RecordedAimEvent[] = [];
  for (const value of input) {
    const event = record(value);
    const seq = integer(event.seq, 0, 1000000);
    if (seq !== state.nextSequence) throw new ApiError(409, 'Olay sırası uyuşmuyor.');
    const atMs = bounded(event.atMs, state.lastEventMs, throughMs);
    state.nextSequence++; state.lastEventMs = atMs;
    if (isReferenceProtocol(settings.training)) { state.progress.level = referencePhaseAt(atMs); state.progress.maxLevel = Math.max(state.progress.maxLevel, state.progress.level); }
    if (event.type === 'move') {
      if (!settings.training || !['mouse', 'touch', 'pen'].includes(String(event.pointerType))) throw new ApiError(400, 'Geçersiz fare örneği.');
      const x = bounded(event.x, 0, ARENA.width), y = bounded(event.y, 0, ARENA.height);
      if (state.cursor) for (const target of state.targets) {
        if (target.startPointer) { const distance = Math.hypot(x - state.cursor.x, y - state.cursor.y); target.pathPx = (target.pathPx || 0) + distance; if (distance > 0.5) target.pathSamples = (target.pathSamples || 0) + 1; }
      }
      state.cursor = { x, y };
      if (!state.pointerTypes.includes(String(event.pointerType))) state.pointerTypes.push(String(event.pointerType));
      events.push({ seq, type: 'move', atMs, x, y, pointerType: event.pointerType as 'mouse' | 'touch' | 'pen' });
      continue;
    }
    if (event.type === 'resize') {
      if (!settings.training) throw new ApiError(400, 'Geçersiz ekran olayı.');
      const width = bounded(event.width, 100, 10000), height = bounded(event.height, 100, 10000);
      state.environmentChanged = true;
      events.push({ seq, type: 'resize', atMs, width, height }); continue;
    }
    if (event.type === 'spawn') {
      const targetId = integer(event.targetId, 1, 1000000);
      if (targetId !== state.nextTargetId++) throw new ApiError(400, 'Hedef sırası uyuşmuyor.');
      const stage = !settings.training ? null : isProgressive(settings) ? trainingStage(state.progress.level)
        : { level: referencePhaseAt(atMs), diameter: settings.diameter, maxTargets: 500, gapMs: 0 };
      if (stage && (event.stage !== stage.level || state.targets.length >= stage.maxTargets)) throw new ApiError(400, 'Kademe veya hedef sınırı uyuşmuyor.');
      if (isProgressive(settings) && atMs + 0.01 < state.nextTrainingSpawnAt) throw new ApiError(400, 'Hedef bekleme aralığı uyuşmuyor.');
      if (isReferenceProtocol(settings.training)) {
        if (Math.abs(atMs - nextSpawnTime(settings, state.lastReferenceSpawnMs)) > 0.01) throw new ApiError(400, 'Hedef çıkış saati uyuşmuyor.');
        state.lastReferenceSpawnMs = atMs;
      }
      const margin = (stage?.diameter || settings.diameter) / 2 + (settings.spawnInset ?? 0);
      const x = bounded(event.x, margin, ARENA.width - margin), y = bounded(event.y, margin, ARENA.height - margin);
      const vx = bounded(event.vx, -200, 200), vy = bounded(event.vy, -200, 200);
      if (settings.mode !== 'moving-targets' && (vx !== 0 || vy !== 0)) throw new ApiError(400, 'Geçersiz hedef hareketi.');
      state.targets.push({ id: targetId, x, y, vx, vy, bornAt: atMs,
        ...(stage ? { stage: stage.level, ...(state.cursor ? { startPointer: { ...state.cursor }, pathPx: 0, pathSamples: 0 } : {}) } : {}) });
      if (state.targets.length > 500) throw new ApiError(400, 'Çok fazla etkin hedef.');
      state.spawned++;
      if (stage) {
        state.stages[stage.level - 1].spawned++;
        state.nextTrainingSpawnAt = atMs + stage.gapMs;
      }
      events.push({ seq, type: 'spawn', atMs, targetId, x, y, vx, vy, ...(stage ? { stage: stage.level } : {}) });
      continue;
    }
    if (event.type === 'expire') {
      const targetId = integer(event.targetId, 1, 1000000);
      const target = state.targets.find((target) => target.id === targetId);
      if (!target || atMs < target.bornAt + (target.stage && isProgressive(settings) ? trainingStage(target.stage).lifetimeMs : settings.lifetimeMs) - 0.01) throw new ApiError(400, 'Geçersiz hedef süresi.');
      state.targets = state.targets.filter((target) => target.id !== targetId);
      state.expired++; state.streak = 0;
      if (!isProgressive(settings) && state.expired > settings.lives) throw new ApiError(400, 'Tur zaten sona erdi.');
      if (target.stage) {
        state.stages[target.stage - 1].expired++;
        if (isProgressive(settings)) {
          if (target.stage === state.progress.level) state.progress = updateProgress(state.progress, 'expire');
          state.nextTrainingSpawnAt = atMs + trainingStage(state.progress.level).gapMs;
        }
      }
      events.push({ seq, type: 'expire', atMs, targetId, ...(target.stage ? { stage: target.stage } : {}) });
      continue;
    }
    if (event.type !== 'hit' && event.type !== 'miss') throw new ApiError(400, 'Geçersiz olay türü.');
    if (!isProgressive(settings) && state.expired >= settings.lives) throw new ApiError(400, 'Tur sona erdikten sonra atış yapılamaz.');
    const x = bounded(event.x, 0, ARENA.width), y = bounded(event.y, 0, ARENA.height);
    const shotNumber = state.hits + state.misses + 1;
    const intervalMs = state.lastShotMs === null ? null : atMs - state.lastShotMs;
    if (intervalMs !== null) { state.shotIntervalSum += intervalMs; state.shotIntervalCount++; }
    state.lastShotMs = atMs;
    if (event.type === 'hit') {
      const targetId = integer(event.targetId, 1, 1000000);
      const target = state.targets.find((target) => target.id === targetId);
      if (!target || atMs >= target.bornAt + (target.stage && isProgressive(settings) ? trainingStage(target.stage).lifetimeMs : settings.lifetimeMs)) throw new ApiError(400, 'Hedef artık etkin değil.');
      const point = targetPosition(target, atMs, settings);
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance > targetRadius(target, atMs, settings) + 0.5) throw new ApiError(400, 'Atış hedef sınırları dışında.');
      const reactionMs = atMs - target.bornAt;
      const hitIntervalMs = state.lastHitMs === null ? null : atMs - state.lastHitMs;
      if (hitIntervalMs !== null) { state.hitIntervalSum += hitIntervalMs; state.hitIntervalCount++; }
      state.lastHitMs = atMs; state.hits++;
      state.reactionSum += reactionMs; state.reactionSquares += reactionMs ** 2;
      state.fastest = state.fastest === null ? reactionMs : Math.min(state.fastest, reactionMs);
      state.slowest = state.slowest === null ? reactionMs : Math.max(state.slowest, reactionMs);
      state.bestStreak = Math.max(state.bestStreak, ++state.streak);
      state.targets = state.targets.filter((target) => target.id !== targetId);
      const normalizedCenterError = distance / Math.max(1, targetRadius(target, atMs, settings));
      const path = target.startPointer && (target.pathSamples || 0) >= 3 && (target.pathPx || 0) > 0
        ? Math.min(100, Math.hypot(x - target.startPointer.x, y - target.startPointer.y) / target.pathPx! * 100) : null;
      if (target.stage) {
        const stats = state.stages[target.stage - 1];
        stats.hits++; stats.responseSumMs += reactionMs; stats.responseSquares += reactionMs ** 2;
        stats.responseSamples.push(reactionMs); stats.centerErrorSum += normalizedCenterError;
        if (path !== null) { stats.pathEfficiencySum += path; stats.pathSamples++; }
        if (isProgressive(settings)) {
          if (target.stage === state.progress.level) state.progress = updateProgress(state.progress, 'hit');
          state.nextTrainingSpawnAt = atMs + trainingStage(state.progress.level).gapMs;
        }
      }
      events.push({ seq, type: 'hit', atMs, targetId, x, y, shotNumber, intervalMs, hitIntervalMs, reactionMs, targetX: point.x, targetY: point.y, distanceFromCenterPx: distance, normalizedCenterError,
        ...(target.stage ? { stage: target.stage, pathEfficiency: path } : {}) });
    } else {
      if (event.targetId !== null) throw new ApiError(400, 'Geçersiz ıskalama kaydı.');
      state.misses++; state.streak = 0;
      const level = state.progress.level;
      if (settings.training) {
        state.stages[level - 1].misses++;
        if (isProgressive(settings)) {
          state.progress = updateProgress(state.progress, 'miss');
          if (state.progress.level !== level) state.nextTrainingSpawnAt = atMs + trainingStage(state.progress.level).gapMs;
        }
      }
      events.push({ seq, type: 'miss', atMs, targetId: null, x, y, shotNumber, intervalMs, reactionMs: null, hitIntervalMs: null, ...(settings.training ? { stage: level } : {}) });
    }
  }
  if (isReferenceProtocol(settings.training)) { state.progress.level = referencePhaseAt(throughMs); state.progress.maxLevel = Math.max(state.progress.maxLevel, state.progress.level); }
  return { state, events };
}
export function runSummary(state: AimAccumulator, throughMs: number, settings: AimSettings) {
  const shotCount = state.hits + state.misses;
  const mean = state.hits ? state.reactionSum / state.hits : null;
  return {
    score: state.hits, misses: state.misses, shotCount, spawnedTargets: state.spawned,
    expiredTargets: state.expired, accuracy: shotCount ? state.hits / shotCount * 100 : 0,
    averageReactionMs: mean, fastestReactionMs: state.fastest, slowestReactionMs: state.slowest,
    reactionDeviationMs: mean === null ? null : Math.sqrt(Math.max(0, state.reactionSquares / state.hits - mean ** 2)),
    averageShotIntervalMs: state.shotIntervalCount ? state.shotIntervalSum / state.shotIntervalCount : null,
    averageHitIntervalMs: state.hitIntervalCount ? state.hitIntervalSum / state.hitIntervalCount : null,
    hitsPerSecond: throughMs > 0 ? state.hits * 1000 / throughMs : 0,
    clicksPerSecond: throughMs > 0 ? shotCount * 1000 / throughMs : 0,
    bestStreak: state.bestStreak, finalSpeed: isProgressive(settings) ? 1000 / trainingStage(state.progress.level).gapMs : speedAt(settings, throughMs),
    totalDuration: throughMs, totalDurationSeconds: throughMs / 1000, level: settings.training ? state.progress.level : 1,
    ...(settings.training ? { trainingProtocol: settings.training, maxLevel: state.progress.maxLevel, trainingStages: state.stages.map(stageMetrics) } : {}),
    reactionTimeTotalMs: state.reactionSum, reactionSampleCount: state.hits,
    shotIntervalTotalMs: state.shotIntervalSum, shotIntervalCount: state.shotIntervalCount,
    hitIntervalTotalMs: state.hitIntervalSum, hitIntervalCount: state.hitIntervalCount,
  };
}
export function endReason(value: unknown): EndReason {
  if (!['lives', 'manual', 'hidden', 'navigation', 'time-limit', 'practice-complete'].includes(String(value))) throw new ApiError(400, 'Geçersiz bitiş nedeni.');
  return value as EndReason;
}
