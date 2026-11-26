import { CAPTCHA_TYPES, type CaptchaType } from './captcha-config';
import { CAPTCHA_LABELS, conditionLabel, type CaptchaQuestion } from './captcha-metrics';
export type AnalyticsSource = 'training' | 'sales';
export interface CaptchaRun {
  id: string; email: string; name: string; source: AnalyticsSource; startMs: number; status: 'completed' | 'aborted' | 'playing';
  protocol: 'current' | 'legacy'; plannedCount: number | null; plan: CaptchaType[]; questions: CaptchaQuestion[];
  durationMs: number; interactionMs: number | null; correct: number; incorrect: number; scenario: string; scenarioLabel: string; order: string;
}
export interface CaptchaDataset { runs: CaptchaRun[]; generatedAt: number }
export interface CaptchaFilters { source: 'all' | AnalyticsSource; email: string; count: string; type: 'all' | CaptchaType; condition: string; scenario: string; status: 'all' | CaptchaRun['status']; protocol: 'current' | 'legacy'; from: string; to: string }
export const defaultCaptchaFilters: CaptchaFilters = { source: 'all', email: '', count: 'all', type: 'all', condition: 'all', scenario: 'all', status: 'completed', protocol: 'current', from: '', to: '' };
export interface CaptchaMetrics { runs: number; completedRuns: number; abortedRuns: number; openRuns: number; solved: number; attempts: number; incorrect: number; meanMs: number | null; medianMs: number | null; p90Ms: number | null; firstTryRate: number | null; accuracy: number | null; meanAttempts: number | null; meanRunMs: number | null; meanInteractionMs: number | null }
const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function timestampMs(value: unknown): number { if (typeof value === 'number') return finite(value); const data = value as { toMillis?: () => number; $timestamp?: number } | null; return data?.toMillis ? data.toMillis() : finite(data?.$timestamp); }
export function normalizeCaptchaRun(id: string, source: AnalyticsSource, raw: Record<string, unknown>, name: string): CaptchaRun {
  const config = record(raw.captchaConfig);
  const planRaw = source === 'sales' ? config.plan : raw.plan;
  const plan = Array.isArray(planRaw) ? planRaw.map(item => source === 'sales' ? record(item).type : item).filter((type): type is CaptchaType => CAPTCHA_TYPES.includes(type as CaptchaType)) : [];
  const questions: CaptchaQuestion[] = Array.isArray(raw.captchaQuestions) ? raw.captchaQuestions.flatMap(value => {
    const q = record(value); if (!CAPTCHA_TYPES.includes(q.type as CaptchaType) || !Number.isInteger(q.index) || !Array.isArray(q.conditions)) return [];
    return [{ index: finite(q.index), type: q.type as CaptchaType, ...(typeof q.stage === 'string' ? { stage: q.stage } : {}), completed: q.completed === true, attempts: finite(q.attempts), incorrect: finite(q.incorrect), activeMs: finite(q.activeMs), conditions: q.conditions.filter((c): c is string => typeof c === 'string' && c.length <= 30).slice(0, 8) }];
  }) : [];
  const protocol = raw.metricsVersion === 2 ? 'current' : 'legacy';
  const mix = CAPTCHA_TYPES.flatMap(type => { const count = plan.filter(item => item === type).length; return count ? [`${count} × ${CAPTCHA_LABELS[type]}`] : []; }).join(' · ');
  const order = source === 'training' ? raw.order === 'random' ? 'random' : raw.order === 'sequential' ? 'sequential' : 'unknown' : 'address';
  const conditions = questions.map(q => `${q.stage ?? 'training'}/${q.type}=${[...q.conditions].sort().join('+') || 'unknown'}`);
  const scenario = JSON.stringify([source, protocol, order, plan, conditions]);
  const variants = [...new Set(questions.flatMap(q => q.conditions))].map(conditionLabel).join(' / ');
  const legacyAttempts = Array.isArray(raw.chapcas) ? raw.chapcas : [];
  return { id, email: String(raw.email ?? ''), name, source, startMs: timestampMs(raw.startTime) || timestampMs(raw.createdAt), status: raw.status === 'playing' || raw.status === 'aborted' ? raw.status : 'completed', protocol, plannedCount: Array.isArray(planRaw) ? plan.length : null, plan, questions,
    durationMs: finite(raw.totalDuration), interactionMs: protocol === 'current' && source === 'sales' && typeof raw.interactionDurationMs === 'number' ? finite(raw.interactionDurationMs) : null,
    correct: source === 'sales' ? finite(raw.correctCaptchas) : legacyAttempts.filter(item => record(item).isCorrect === true).length,
    incorrect: source === 'sales' ? finite(raw.incorrectCaptchas) : legacyAttempts.filter(item => record(item).isCorrect === false).length,
    scenario, scenarioLabel: `${source === 'sales' ? 'Satış' : 'Antrenman'} · ${plan.length} CAPTCHA${mix ? ' · ' + plan.map(type => CAPTCHA_LABELS[type]).join(' → ') : ''}${variants ? ' · ' + variants : ''}${source === 'training' ? order === 'random' ? ' · Qarışıq sıra' : ' · Ardıcıl sıra' : ''}`, order };
}
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit' });
export const bakuDay = (at: number) => dayFormatter.format(at);
export function filterCaptchaRuns(runs: CaptchaRun[], filters: CaptchaFilters, ignoreScenario = false) {
  return runs.filter(run => (filters.source === 'all' || run.source === filters.source) && (!filters.email || run.email === filters.email) && (filters.count === 'all' || run.plannedCount === Number(filters.count)) && run.protocol === filters.protocol && (filters.status === 'all' || run.status === filters.status) && (!filters.from || bakuDay(run.startMs) >= filters.from) && (!filters.to || bakuDay(run.startMs) <= filters.to) && (ignoreScenario || filters.scenario === 'all' || run.scenario === filters.scenario) && (filters.type === 'all' || run.plan.includes(filters.type) || run.questions.some(q => q.type === filters.type)) && (filters.condition === 'all' || run.questions.some(q => (filters.type === 'all' || q.type === filters.type) && q.conditions.length === 1 && q.conditions[0] === filters.condition)));
}
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function quantile(values: number[], fraction: number): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return fraction === .5 && sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]; }
export function questionsFor(run: CaptchaRun, filters: Pick<CaptchaFilters, 'type' | 'condition'>) { return run.questions.filter(q => (filters.type === 'all' || q.type === filters.type) && (filters.condition === 'all' || (q.conditions.length === 1 && q.conditions[0] === filters.condition))); }
export function captchaMetrics(runs: CaptchaRun[], filters: Pick<CaptchaFilters, 'type' | 'condition'>): CaptchaMetrics {
  const questions = runs.flatMap(run => questionsFor(run, filters)), solved = questions.filter(q => q.completed), values = solved.map(q => q.activeMs);
  const attempts = questions.reduce((sum, q) => sum + q.attempts, 0), incorrect = questions.reduce((sum, q) => sum + q.incorrect, 0);
  const completed = runs.filter(run => run.status === 'completed');
  return { runs: runs.length, completedRuns: completed.length, abortedRuns: runs.filter(run => run.status === 'aborted').length, openRuns: runs.filter(run => run.status === 'playing').length, solved: solved.length, attempts, incorrect,
    meanMs: mean(values), medianMs: quantile(values, .5), p90Ms: quantile(values, .9), firstTryRate: solved.length ? solved.filter(q => q.incorrect === 0).length / solved.length * 100 : null,
    accuracy: attempts ? solved.length / attempts * 100 : null, meanAttempts: solved.length ? solved.reduce((sum, q) => sum + q.attempts, 0) / solved.length : null,
    meanRunMs: mean(completed.map(run => run.durationMs)), meanInteractionMs: mean(completed.flatMap(run => run.interactionMs == null ? [] : [run.interactionMs])) };
}
export function captchaReport(runs: CaptchaRun[], filters: CaptchaFilters) {
  const filtered = filterCaptchaRuns(runs, filters), base = filterCaptchaRuns(runs, filters, true);
  const grouped = <K,>(items: CaptchaRun[], key: (run: CaptchaRun) => K) => {
    const groups = new Map<K, CaptchaRun[]>(); for (const run of items) { const id = key(run); const group = groups.get(id); if (group) group.push(run); else groups.set(id, [run]); } return [...groups.entries()];
  };
  const scenarios = grouped(base, run => run.scenario).map(([key, rows]) => ({ key, label: rows[0].scenarioLabel, runs: rows.length }));
  const types = (filters.type === 'all' ? CAPTCHA_TYPES : [filters.type]).map(type => ({ type, ...captchaMetrics(filtered.filter(run => run.questions.some(q => q.type === type)), { ...filters, type }) })).filter(item => item.attempts > 0);
  const counts = grouped(filtered, run => run.plannedCount).sort((a, b) => (a[0] ?? -1) - (b[0] ?? -1)).map(([count, rows]) => ({ count, ...captchaMetrics(rows, filters) }));
  const users = grouped(filtered, run => run.email).map(([email, rows]) => ({ email, name: rows[0].name, ...captchaMetrics(rows, filters) }));
  const trend = grouped(filtered, run => bakuDay(run.startMs)).sort((a, b) => a[0].localeCompare(b[0])).map(([day, rows]) => ({ day, ...captchaMetrics(rows, filters) }));
  return { summary: captchaMetrics(filtered, filters), runs: filtered.sort((a, b) => b.startMs - a.startMs || a.id.localeCompare(b.id)), scenarios, types, counts, users, trend, legacyCount: runs.filter(run => run.protocol === 'legacy' && (!filters.email || run.email === filters.email) && (filters.source === 'all' || run.source === filters.source)).length };
}
