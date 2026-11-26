import type { CaptchaQuestion, CaptchaCondition } from './captcha-metrics';
import type { CaptchaType } from './captcha-config';
import { Timestamp } from 'firebase/firestore';
import { api, errorMessage, type PageCursor } from './api-client';

export type ChapcaType = 'tarih' | 'dogum' | 'text' | 'rakam' | 'puzzle';
export interface ChapcaAttempt {
  type: ChapcaType; questionIndex?: number; attemptIndex?: number; condition?: CaptchaCondition;
  startTime: Timestamp;
  endTime: Timestamp;
  duration: number; // milisaniye cinsinden
  durationSeconds: number; // saniye cinsinden (geriye dönük uyumluluk için)
  isCorrect: boolean;
}

export interface ChapcaSession {
  metricsVersion?: number; clientRunId?: string; status?: 'completed' | 'aborted'; plan?: CaptchaType[]; order?: 'sequential' | 'random'; captchaQuestions?: CaptchaQuestion[];
  email: string;
  startTime: Timestamp;
  endTime: Timestamp;
  totalDuration: number; // milisaniye cinsinden
  totalDurationSeconds: number; // saniye cinsinden (geriye dönük uyumluluk için)
  chapcas: ChapcaAttempt[];
  createdAt: Timestamp;
}

export async function saveChapcaSession(session: Omit<ChapcaSession, 'createdAt'>, keepalive = false) {
  try {
    const result = await api<{ id: string }>('sessions/chapca', 'POST', session, { keepalive });
    return { id: result.id, error: null };
  } catch (error) { return { id: null, error: errorMessage(error) }; }
}
export async function getUserChapcaSessions(email: string, pageSize = 10, lastDoc: PageCursor | null = null) {
  try {
    const params = new URLSearchParams({ email, pageSize: String(pageSize) });
    if (lastDoc) params.set('cursor', lastDoc);
    const result = await api<{ sessions: (ChapcaSession & { id: string })[]; lastDoc: PageCursor | null }>(`sessions/chapca?${params}`);
    return { ...result, error: null };
  } catch (error) { return { sessions: [], lastDoc: null, error: errorMessage(error) }; }
}
