import type { CaptchaQuestion } from './captcha-metrics';
import type { SalesOverview } from './sales-analytics';
import type { RecordedSalesEvent, SalesStage } from './sales-telemetry';
import type { CaptchaChallenge } from './sales-flow';
import type { CaptchaType } from './captcha-config';
export type { SalesOverview } from './sales-analytics';
import type { SalesApartment } from './sales-catalog';
import { Timestamp } from 'firebase/firestore';
import { api, errorMessage, type PageCursor } from './api-client';

export interface SalesSession {
    metricsVersion?: number; captchaQuestions?: CaptchaQuestion[]; captchaWallDurationMs?: number; interactionDurationMs?: number;
    email: string;
    startTime: Timestamp;
    endTime: Timestamp | null;
    totalDuration: number; // milisaniye
    totalDurationSeconds: number;
    step1Duration: number;
    step2Duration: number;
    captchaDuration: number;
    correctCaptchas: number;
    incorrectCaptchas: number;
    project: string;
    selection?: SalesApartment & { paymentMethod: 'own' | 'mortgage'; method: 'address'; catalogVersion: string };
    createdAt: Timestamp;
    schemaVersion?: number; status?: 'playing' | 'completed' | 'aborted'; endReason?: string | null; updatedAt?: Timestamp;
    phase?: SalesStage; phaseDurations?: Record<SalesStage, number>; searches?: number; resets?: number; backCount?: number; selectionChanges?: number; focusCount?: number; catalogErrors?: number; eventCount?: number;
    address?: { projectId: string; building: string; entrance: string; floor: string; apartment: string }; paymentMethod?: string;
    captchaTypes?: Partial<Record<CaptchaType, { correct: number; incorrect: number; solveMs: number }>>;
    captchaConfig?: { enabled: boolean; requiredCount: number; allowedTypes: CaptchaType[]; plan: CaptchaChallenge[] };
}

export async function saveSalesSession(session: Omit<SalesSession, 'createdAt'>) {
  try {
    const result = await api<{ id: string }>('sessions/sales', 'POST', session);
    return { id: result.id, error: null };
  } catch (error) { return { id: null, error: errorMessage(error) }; }
}
export async function getUserSalesSessions(email: string, pageSize = 10, lastDoc: PageCursor | null = null) {
  try {
    const params = new URLSearchParams({ email, pageSize: String(pageSize) });
    if (lastDoc) params.set('cursor', lastDoc);
    const result = await api<{ sessions: (SalesSession & { id: string })[]; lastDoc: PageCursor | null }>(`sessions/sales?${params}`);
    return { ...result, error: null };
  } catch (error) { return { sessions: [], lastDoc: null, error: errorMessage(error) }; }
}

export function startSalesRun(clientRunId: string, plan: CaptchaChallenge[]) { return api<{ id: string }>('sales/runs', 'POST', { clientRunId, plan, metricsVersion: 2 }); }
export function getSalesOverview(email: string) { return api<SalesOverview>(`sales/overview?${new URLSearchParams({ email })}`); }
export function getSalesEvents(id: string, cursor: string | null = null) { return api<{ events: RecordedSalesEvent[]; cursor: string | null; legacy: boolean }>(`sales/runs/${id}/events${cursor ? '?' + new URLSearchParams({ cursor }) : ''}`); }
