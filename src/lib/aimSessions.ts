import { Timestamp } from 'firebase/firestore';
import { api, errorMessage, type PageCursor } from './api-client';
import type { AimMetrics, AimSettings, EndReason, RecordedAimEvent } from './aim-game';
import type { TrainingEnvironment, stageMetrics } from './aim-training';
import type { TrainingComparisonRow } from './aim-comparison';

export interface AimSession extends Partial<AimMetrics> {
  email: string;
  startTime: Timestamp;
  endTime: Timestamp;
  totalDuration: number; // milliseconds
  totalDurationSeconds: number; // seconds (for backward compatibility)
  gameMode: 'normal' | 'drag-drop' | 'dual-targets' | 'moving-targets';
  score: number;
  misses: number;
  expiredTargets: number;
  accuracy: number;
  level: number;
  createdAt: Timestamp;
  schemaVersion?: number;
  profile?: string;
  settings?: AimSettings;
  status?: 'playing' | 'completed' | 'aborted';
  endReason?: EndReason | null;
  updatedAt?: Timestamp;
  trainingProtocol?: string;
  trainingStages?: ReturnType<typeof stageMetrics>[];
  maxLevel?: number;
  environment?: TrainingEnvironment;
  comparable?: boolean;
}
export interface TrainingComparison {
  protocol: string; stage: number; condition: string | null;
  conditions: { key: string; players: number; inputDevice: string }[];
  groupMedianResponseMs: number | null; rows: TrainingComparisonRow[];
}
export async function getTrainingComparison(stage = 1, condition = '') {
  return api<TrainingComparison>(`aim/comparison?${new URLSearchParams({ stage: String(stage), ...(condition ? { condition } : {}) })}`);
}

export interface AimOverview {
  totalPlays: number; completedPlays: number; abortedPlays: number; unfinishedPlays: number;
  totalHits: number; totalMisses: number; totalExpired: number; totalDurationMs: number;
  accuracy: number; averageHits: number; bestScore: number; hitsPerSecond: number;
  averageReactionMs: number | null; averageShotIntervalMs: number | null;
}
export async function getAimOverview(email: string) {
  return api<AimOverview>(`aim/overview?${new URLSearchParams({ email })}`);
}
export async function getAimEvents(runId: string) {
  const events: RecordedAimEvent[] = [];
  let cursor: string | null = null;
  do {
    const params: string = cursor ? `?${new URLSearchParams({ cursor })}` : '';
    const page: { events: RecordedAimEvent[]; cursor: string | null } = await api(`aim/runs/${runId}/events${params}`);
    events.push(...page.events); cursor = page.cursor;
  } while (cursor);
  return events;
}

export async function saveAimSession(session: Omit<AimSession, 'createdAt'>) {
  try {
    const result = await api<{ id: string }>('sessions/aim', 'POST', session);
    return { id: result.id, error: null };
  } catch (error) { return { id: null, error: errorMessage(error) }; }
}
export async function getUserAimSessions(email: string, pageSize = 10, lastDoc: PageCursor | null = null) {
  try {
    const params = new URLSearchParams({ email, pageSize: String(pageSize) });
    if (lastDoc) params.set('cursor', lastDoc);
    const result = await api<{ sessions: (AimSession & { id: string })[]; lastDoc: PageCursor | null }>(`sessions/aim?${params}`);
    return { ...result, error: null };
  } catch (error) { return { sessions: [], lastDoc: null, error: errorMessage(error) }; }
}
