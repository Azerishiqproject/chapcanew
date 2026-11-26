import { addQuestionAttempt, validCondition, legacyType, type CaptchaQuestion } from '../captcha-metrics';
import { CAPTCHA_TYPES, captchaSettingsErrors, normalizeCaptchaSettings, type CaptchaState } from '@/lib/captcha-config';
import { Timestamp, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore';
import { ApiError, emailAddress, record, text } from './security';

export function publicUser(doc: DocumentSnapshot) {
  const data = doc.data()!;
  // Explicit allowlist: password hashes and session versions never leave the server.
  return {
    id: doc.id, email: data.email, name: data.name, phone: data.phone || '', status: 'user' as const,
    createdAt: data.createdAt?.toDate().toISOString(), updatedAt: data.updatedAt?.toDate().toISOString(),
  };
}
export function userFields(input: Record<string, unknown>) {
  if (input.status !== undefined && input.status !== 'user') throw new ApiError(400, 'Admin hesabı yalnızca Authentication üzerinden oluşturulur.');
  return { email: emailAddress(input.email), name: text(input.name, 120), phone: text(input.phone ?? '', 40, 0), status: 'user' as const };
}
export function wire(value: unknown): unknown {
  if (value instanceof Timestamp) return { $timestamp: value.toMillis() };
  if (Array.isArray(value)) return value.map(wire);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, wire(v)]));
  return value;
}
function time(value: unknown): Timestamp {
  const milliseconds = record(value).$timestamp;
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > Date.now() + 60000) {
    throw new ApiError(400, 'Geçersiz tarih.');
  }
  return Timestamp.fromMillis(milliseconds);
}
function number(value: unknown, max = 1e12): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new ApiError(400, 'Geçersiz sayı.');
  return value;
}
function times(input: Record<string, unknown>) {
  const startTime = time(input.startTime), endTime = time(input.endTime);
  if (endTime.toMillis() < startTime.toMillis()) throw new ApiError(400, 'Geçersiz zaman aralığı.');
  return { startTime, endTime };
}
export const SESSION_COLLECTIONS = { chapca: 'chapcaSessions', aim: 'aimSessions', sales: 'salesSessions' } as const;
export type SessionKind = keyof typeof SESSION_COLLECTIONS;
export function sessionKind(value: string): SessionKind {
  if (!Object.hasOwn(SESSION_COLLECTIONS, value)) throw new ApiError(404, 'Kayıt türü bulunamadı.');
  return value as SessionKind;
}
export function sessionFields(kind: SessionKind, input: Record<string, unknown>): DocumentData {
  const result: DocumentData = {
    ...times(input), totalDuration: number(input.totalDuration), totalDurationSeconds: number(input.totalDurationSeconds),
  };
  if (kind === 'chapca') {
    if (!Array.isArray(input.chapcas) || input.chapcas.length > 300) throw new ApiError(400, 'Geçersiz CAPTCHA listesi.');
    result.chapcas = input.chapcas.map((value) => {
      const attempt = record(value);
      if (!['tarih', 'dogum', 'text', 'rakam', 'puzzle'].includes(String(attempt.type)) || typeof attempt.isCorrect !== 'boolean') {
        throw new ApiError(400, 'Geçersiz CAPTCHA sonucu.');
      }
      return { ...times(attempt), type: attempt.type, isCorrect: attempt.isCorrect, duration: number(attempt.duration), durationSeconds: number(attempt.durationSeconds) };
    });
    if (input.metricsVersion === 2) {
      if ((input.chapcas as unknown[]).length > 200) throw new ApiError(400, 'Antrenman cəhd həddi aşıldı.');
      const allowed = ['date', 'birthdate', 'text', 'number', 'puzzle'];
      if (!Array.isArray(input.plan) || !input.plan.length || input.plan.length > 50 || input.plan.some(type => !allowed.includes(String(type))) || !['completed', 'aborted'].includes(String(input.status)) || !['sequential', 'random'].includes(String(input.order))) throw new ApiError(400, 'Geçersiz antrenman planı.');
      const questions: CaptchaQuestion[] = []; let progress = 0, previousEnd = result.startTime.toMillis();
      result.chapcas = result.chapcas.map((attempt: DocumentData, index: number) => {
        const raw = record((input.chapcas as unknown[])[index]), type = legacyType(String(attempt.type));
        const question = questions.find(item => item.index === progress);
        if (!type || type !== (input.plan as unknown[])[progress] || raw.questionIndex !== progress || raw.attemptIndex !== (question?.attempts ?? 0) || attempt.startTime.toMillis() < previousEnd || attempt.endTime.toMillis() > result.endTime.toMillis() || attempt.duration > attempt.endTime.toMillis() - attempt.startTime.toMillis()) throw new ApiError(400, 'Antrenman sırası veya süresi uyuşmuyor.');
        let condition;
        try { condition = validCondition(type, raw.condition); addQuestionAttempt(questions, progress, type, attempt.duration, attempt.isCorrect, condition); } catch { throw new ApiError(400, 'Geçersiz CAPTCHA ölçümü.'); }
        previousEnd = attempt.endTime.toMillis();
        if (attempt.isCorrect) progress++;
        return { ...attempt, durationSeconds: attempt.duration / 1000, questionIndex: raw.questionIndex, attemptIndex: raw.attemptIndex, condition };
      });
      if (input.status === 'completed' && progress !== input.plan.length) throw new ApiError(400, 'Antrenman tamamlanmadı.');
      const runId = text(input.clientRunId, 80); if (!/^[A-Za-z0-9_-]{8,80}$/.test(runId)) throw new ApiError(400, 'Geçersiz tur kimliği.');
      const duration = result.endTime.toMillis() - result.startTime.toMillis(); if (duration > 12 * 60 * 60 * 1000) throw new ApiError(400, 'Tur süresi aşıldı.');
      Object.assign(result, { clientRunId: runId, metricsVersion: 2, status: input.status, order: input.order, plan: input.plan, captchaQuestions: questions, totalDuration: duration, totalDurationSeconds: duration / 1000 });
    }
  } else if (kind === 'aim') {
    if (!['normal', 'drag-drop', 'dual-targets', 'moving-targets'].includes(String(input.gameMode))) throw new ApiError(400, 'Geçersiz oyun modu.');
    result.gameMode = input.gameMode;
    for (const key of ['score', 'misses', 'expiredTargets', 'level']) result[key] = number(input[key]);
    result.accuracy = number(input.accuracy, 100);
  } else {
    for (const key of ['step1Duration', 'step2Duration', 'captchaDuration', 'correctCaptchas', 'incorrectCaptchas']) result[key] = number(input[key]);
    result.project = text(input.project);
    if (input.selection !== undefined) {
      const selection = record(input.selection);
      if (!['own', 'mortgage'].includes(String(selection.paymentMethod)) || selection.method !== 'address') throw new ApiError(400, 'Geçersiz satış seçimi.');
      result.selection = { paymentMethod: selection.paymentMethod, method: 'address' };
      for (const key of ['projectId', 'building', 'entrance', 'floor', 'apartment', 'catalogVersion']) result.selection[key] = text(selection[key], 80);
      for (const key of ['rooms', 'internalArea', 'externalArea', 'floorCount']) result.selection[key] = number(selection[key], 10000);
    }
  }
  return result;
}
export function settingsFields(input: Record<string, unknown>) {
  if (!Array.isArray(input.allowedTypes) || input.allowedTypes.length > CAPTCHA_TYPES.length ||
      input.allowedTypes.some(value => !CAPTCHA_TYPES.includes(value as typeof CAPTCHA_TYPES[number])) || typeof input.enabled !== 'boolean') {
    throw new ApiError(400, 'Geçersiz CAPTCHA ayarları.');
  }
  const date = record(input.dateConfig), personal = record(input.personalConfig);
  const settings = normalizeCaptchaSettings({
    allowedTypes: input.allowedTypes as CaptchaState['allowedTypes'], requiredCount: input.requiredCount as number, enabled: input.enabled,
    dateConfig: { todayDate: text(date.todayDate, 20, 0), birthDate: text(date.birthDate, 20, 0) },
    personalConfig: { fin: text(personal.fin, 100, 0), religion: text(personal.religion, 200, 0), favoriteCar: text(personal.favoriteCar, 200, 0) },
  });
  const errors = captchaSettingsErrors(settings);
  if (errors.length) throw new ApiError(400, errors.join(' '));
  return settings;
}
