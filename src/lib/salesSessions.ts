import { Timestamp } from 'firebase/firestore';
import { api, errorMessage, type PageCursor } from './api-client';

export interface SalesSession {
    email: string;
    startTime: Timestamp;
    endTime: Timestamp;
    totalDuration: number; // milisaniye
    totalDurationSeconds: number;
    step1Duration: number;
    step2Duration: number;
    captchaDuration: number;
    correctCaptchas: number;
    incorrectCaptchas: number;
    project: string;
    createdAt: Timestamp;
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
