import { TRAINING_PROTOCOL, emptyStageStats, median, stageMetrics, type InputDevice, type TrainingStageStats } from './aim-training';

export interface TrainingRunSnapshot { id: string; atMs: number; maxLevel: number; stages: TrainingStageStats[] }
export interface TrainingCohort {
  userId: string; name: string; email: string; protocol: string; conditionKey: string;
  inputDevice: InputDevice; arenaWidth: number; arenaHeight: number; completedPlays: number;
  maxLevel: number; totals: TrainingStageStats[]; baseline: TrainingRunSnapshot[]; recent: TrainingRunSnapshot[];
}
function mergeStage(left: TrainingStageStats, right: TrainingStageStats, keepSamples = false): TrainingStageStats {
  return { level: left.level, spawned: left.spawned + right.spawned, hits: left.hits + right.hits,
    misses: left.misses + right.misses, expired: left.expired + right.expired,
    responseSumMs: left.responseSumMs + right.responseSumMs, responseSquares: left.responseSquares + right.responseSquares,
    centerErrorSum: left.centerErrorSum + right.centerErrorSum, pathEfficiencySum: left.pathEfficiencySum + right.pathEfficiencySum,
    pathSamples: left.pathSamples + right.pathSamples, responseSamples: keepSamples ? [...left.responseSamples, ...right.responseSamples] : [] };
}
export function mergeTrainingRun(previous: TrainingCohort | null, metadata: Omit<TrainingCohort, 'totals' | 'baseline' | 'recent' | 'completedPlays' | 'maxLevel'>, run: TrainingRunSnapshot): TrainingCohort {
  return { ...metadata, protocol: TRAINING_PROTOCOL, completedPlays: (previous?.completedPlays || 0) + 1,
    maxLevel: Math.max(previous?.maxLevel || 1, run.maxLevel),
    totals: [1, 2, 3, 4, 5].map((level) => mergeStage(previous?.totals[level - 1] || emptyStageStats(level), run.stages[level - 1])),
    baseline: previous?.baseline.length === 3 ? previous.baseline : [...(previous?.baseline || []), run],
    recent: [...(previous?.recent || []), run].slice(-3),
  };
}
export function cohortStage(cohort: TrainingCohort, level: number) {
  const total = cohort.totals[level - 1] || emptyStageStats(level);
  const metrics = stageMetrics(total);
  const baselineIds = new Set(cohort.baseline.map((run) => run.id));
  const separateRecent = cohort.recent.filter((run) => !baselineIds.has(run.id));
  const sum = (runs: TrainingRunSnapshot[]) => runs.reduce((state, run) => mergeStage(state, run.stages[level - 1], true), emptyStageStats(level));
  const baseline = stageMetrics(sum(cohort.baseline)), recent = stageMetrics(sum(separateRecent));
  const canShowChange = cohort.baseline.length === 3 && separateRecent.length === 3 && baseline.hits >= 8 && recent.hits >= 8;
  return {
    ...metrics, userId: cohort.userId, name: cohort.name, email: cohort.email,
    completedPlays: cohort.completedPlays, maxLevel: cohort.maxLevel,
    comparableSamples: total.hits + total.expired, comparisonReady: total.hits >= 8,
    improvementPercent: canShowChange && baseline.averageResponseMs && recent.averageResponseMs !== null
      ? (baseline.averageResponseMs - recent.averageResponseMs) / baseline.averageResponseMs * 100 : null,
    accuracyChangePp: canShowChange ? recent.accuracy - baseline.accuracy : null,
    baselineResponseMs: canShowChange ? baseline.averageResponseMs : null,
    recentResponseMs: canShowChange ? recent.averageResponseMs : null,
  };
}
export function compareTrainingCohorts(cohorts: TrainingCohort[], level: number) {
  const rows = cohorts.map((cohort) => cohortStage(cohort, level));
  const eligible = rows.filter((row) => row.comparisonReady && row.averageResponseMs !== null);
  const middle = eligible.length >= 2 ? median(eligible.map((row) => row.averageResponseMs!)) : null;
  return { groupMedianResponseMs: middle, rows: rows.map((row) => ({ ...row,
    differenceFromGroupMs: middle !== null && row.comparisonReady && row.averageResponseMs !== null ? row.averageResponseMs - middle : null,
  })) };
}
export type TrainingComparisonRow = ReturnType<typeof compareTrainingCohorts>['rows'][number];
