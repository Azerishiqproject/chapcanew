import { CAPTCHA_TYPES, type CaptchaType } from './captcha-config';
import { SALES_PHASES, type SalesStage } from './sales-telemetry';
export interface SalesOverview {
  totalPlays: number; completedPlays: number; abortedPlays: number; unfinishedPlays: number; legacyPlays: number;
  averageDurationMs: number | null; bestDurationMs: number | null; averageStep1Ms: number | null; averageStep2Ms: number | null; averageCaptchaMs: number | null;
  totalCorrect: number; totalIncorrect: number; accuracy: number | null; totalSearches: number; totalResets: number; totalBack: number; totalCatalogErrors: number;
  phaseAverages: Record<SalesStage, number | null>;
  captchaTypes: Partial<Record<CaptchaType, { correct: number; incorrect: number; averageSolveMs: number | null }>>;
}
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
export function summarizeSalesSessions(rows: Record<string, unknown>[]): SalesOverview {
  const completed = rows.filter(row => !row.status || row.status === 'completed');
  const average = (field: string, multiplier = 1) => { const values = completed.filter(row => typeof row[field] === 'number' && Number.isFinite(row[field])).map(row => numeric(row[field]) * multiplier); return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; };
  const total = (field: string) => rows.reduce((sum, row) => sum + numeric(row[field]), 0);
  const correct = total('correctCaptchas'), wrong = total('incorrectCaptchas');
  const phases = Object.fromEntries(SALES_PHASES.map(phase => { const values = completed.flatMap(row => { const value = (row.phaseDurations as Record<string, unknown> | undefined)?.[phase]; return typeof value === 'number' && Number.isFinite(value) ? [value * 1000] : []; }); return [phase, values.length ? values.reduce((a, b) => a + b, 0) / values.length : null]; })) as SalesOverview['phaseAverages'];
  const types: SalesOverview['captchaTypes'] = {};
  for (const type of CAPTCHA_TYPES) {
    const stats = rows.flatMap(row => { const value = (row.captchaTypes as Record<string, unknown> | undefined)?.[type]; return value && typeof value === 'object' ? [value as Record<string, unknown>] : []; });
    if (!stats.length) continue;
    const solved = stats.reduce((sum, s) => sum + numeric(s.correct), 0);
    const finishedStats = completed.flatMap(row => { const value = (row.captchaTypes as Record<string, unknown> | undefined)?.[type]; return value && typeof value === 'object' ? [value as Record<string, unknown>] : []; });
    const finishedSolved = finishedStats.reduce((sum, s) => sum + numeric(s.correct), 0);
    types[type] = { correct: solved, incorrect: stats.reduce((sum, s) => sum + numeric(s.incorrect), 0), averageSolveMs: finishedSolved ? finishedStats.reduce((sum, s) => sum + numeric(s.solveMs), 0) / finishedSolved : null };
  }
  const durations = completed.flatMap(row => typeof row.totalDuration === 'number' ? [numeric(row.totalDuration)] : []);
  return { totalPlays: rows.length, completedPlays: completed.length, abortedPlays: rows.filter(row => row.status === 'aborted').length, unfinishedPlays: rows.filter(row => row.status === 'playing').length,
    legacyPlays: rows.filter(row => row.schemaVersion !== 2).length, averageDurationMs: average('totalDuration'), bestDurationMs: durations.length ? durations.reduce((best, value) => Math.min(best, value), Infinity) : null,
    averageStep1Ms: average('step1Duration', 1000), averageStep2Ms: average('step2Duration', 1000), averageCaptchaMs: average('captchaDuration', 1000), totalCorrect: correct, totalIncorrect: wrong, accuracy: correct + wrong ? correct / (correct + wrong) * 100 : null,
    totalSearches: total('searches'), totalResets: total('resets'), totalBack: total('backCount'), totalCatalogErrors: total('catalogErrors'), phaseAverages: phases, captchaTypes: types };
}
