import { AggregateField, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { adminServices } from './firebase-admin';
import { ApiError, digest, text } from './security';
import { requireAdmin, type Identity } from './session';
import { applyTelemetry, bounded, endReason, initialAccumulator, runConfiguration, runSummary, type AimAccumulator } from './aim-telemetry';
import { MAX_RUN_MS, isProgressive, type AimSettings } from '../aim-game';
import { TRAINING_DURATION_MS, TRAINING_PROTOCOL, REFERENCE_PROTOCOL, comparisonCondition, type TrainingEnvironment } from '../aim-training';
import { compareTrainingCohorts, mergeTrainingRun, type TrainingCohort } from '../aim-comparison';
import { record } from './security';

function trainingEnvironment(input: unknown): TrainingEnvironment {
  const data = record(input);
  if (!['mouse', 'touchpad', 'touch'].includes(String(data.inputDevice))) throw new ApiError(400, 'Giriş aygıtını seçin.');
  return { inputDevice: data.inputDevice as TrainingEnvironment['inputDevice'],
    arenaWidth: bounded(data.arenaWidth, 200, 10000), arenaHeight: bounded(data.arenaHeight, 100, 10000),
    devicePixelRatio: bounded(data.devicePixelRatio, 0.5, 8) };
}

export function publicAimSession(doc: DocumentSnapshot) {
  const data = { ...doc.data() };
  delete data.runtimeState; delete data.nextBatchIndex;
  return { ...data, id: doc.id };
}
export async function startAimRun(identity: Identity, input: Record<string, unknown>) {
  const clientRunId = text(input.clientRunId, 80);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(clientRunId)) throw new ApiError(400, 'Geçersiz tur kimliği.');
  const { profile, settings } = runConfiguration(input);
  const environment = settings.training ? trainingEnvironment(input.environment) : null;
  const { db } = adminServices();
  const ref = db.collection('aimSessions').doc(digest(`${identity.uid}:${clientRunId}`));
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(ref)).exists) return;
    transaction.create(ref, {
      schemaVersion: 2, userId: identity.uid, email: identity.email,
      profile, settings, gameMode: settings.mode, status: 'playing', endReason: null,
      createdAt: Timestamp.now(), startTime: Timestamp.now(), updatedAt: Timestamp.now(), endTime: null,
      ...runSummary(initialAccumulator(), 0, settings),
      completedCount: 0, abortedCount: 0, runtimeState: initialAccumulator(), nextBatchIndex: 0,
      ...(environment ? { environment, comparisonCondition: comparisonCondition(environment), comparable: true } : {}),
    });
  });
  return { id: ref.id };
}
export async function appendAimEvents(identity: Identity, runId: string, input: Record<string, unknown>) {
  const { db } = adminServices();
  const batchIndex = bounded(input.batchIndex, 0, 100000);
  if (!Number.isInteger(batchIndex) || typeof input.ended !== 'boolean') throw new ApiError(400, 'Geçersiz atış paketi.');
  const throughMs = bounded(input.throughMs, 0, MAX_RUN_MS);
  const ref = db.collection('aimSessions').doc(runId);
  const batchRef = ref.collection('batches').doc(String(batchIndex).padStart(8, '0'));
  const payloadHash = digest(JSON.stringify(input));
  await db.runTransaction(async (transaction) => {
    const [runDoc, existing] = await transaction.getAll(ref, batchRef);
    const run = runDoc.data();
    if (!run || run.schemaVersion !== 2) throw new ApiError(404, 'Tur bulunamadı.');
    if (run.userId !== identity.uid) throw new ApiError(403, 'Başkasının turuna atış ekleyemezsiniz.');
    if (existing.exists) {
      if (existing.data()?.payloadHash !== payloadHash) throw new ApiError(409, 'Aynı paket farklı içerikle gönderilemez.');
      return;
    }
    if (run.status !== 'playing') throw new ApiError(409, 'Tur zaten kaydedildi.');
    if (run.nextBatchIndex !== batchIndex) throw new ApiError(409, 'Atış paketi sırası uyuşmuyor.');
    if (throughMs < run.totalDuration || throughMs > Date.now() - run.startTime.toMillis() + 5000) {
      throw new ApiError(400, 'Tur süresi uyuşmuyor.');
    }
    const settings = run.settings as AimSettings;
    const { state, events } = applyTelemetry(run.runtimeState as AimAccumulator, input.events, settings, throughMs);
    const reason = input.ended ? endReason(input.endReason) : null;
    if (reason === 'practice-complete' && (!isProgressive(settings) || throughMs !== TRAINING_DURATION_MS)) throw new ApiError(400, 'Antrenman süresi tamamlanmadı.');
    if (isProgressive(settings) && (throughMs > TRAINING_DURATION_MS || reason === 'lives' || reason === 'time-limit')) throw new ApiError(400, 'Geçersiz antrenman bitişi.');
    if (reason === 'lives' && state.expired !== settings.lives) throw new ApiError(400, 'Can kaybı sayısı uyuşmuyor.');
    if (reason === 'time-limit' && throughMs < MAX_RUN_MS) throw new ApiError(400, 'Süre sınırına ulaşılmadı.');
    const status = !reason ? 'playing' : reason === 'lives' || reason === 'time-limit' || reason === 'practice-complete' ? 'completed' : 'aborted';
    const environment = run.environment as TrainingEnvironment | undefined;
    const pointerMatches = environment && (environment.inputDevice === 'touch'
      ? state.pointerTypes.every((value) => value === 'touch') : state.pointerTypes.every((value) => value === 'mouse'));
    const comparable = !!environment && !state.environmentChanged && !!pointerMatches && state.hits + state.misses > 0;
    let cohortUpdate: { ref: ReturnType<typeof db.doc>; data: TrainingCohort } | null = null;
    if (settings.training && status === 'completed' && comparable && environment) {
      const cohortRef = db.collection('aimComparison').doc(digest(`${identity.uid}:${run.comparisonCondition}:${settings.training}`));
      const previous = (await transaction.get(cohortRef)).data() as TrainingCohort | undefined;
      cohortUpdate = { ref: cohortRef, data: mergeTrainingRun(previous || null, {
        userId: identity.uid, name: identity.name, email: identity.email, protocol: settings.training,
        conditionKey: run.comparisonCondition, inputDevice: environment.inputDevice,
        arenaWidth: Math.round(environment.arenaWidth / 20) * 20, arenaHeight: Math.round(environment.arenaHeight / 20) * 20,
      }, { id: runId, atMs: Date.now(), maxLevel: state.progress.maxLevel, stages: state.stages }) };
    }
    transaction.create(batchRef, { events, payloadHash, createdAt: Timestamp.now(), throughMs });
    transaction.update(ref, {
      ...runSummary(state, throughMs, settings), status, endReason: reason,
      endTime: reason ? Timestamp.fromMillis(run.startTime.toMillis() + throughMs) : null,
      updatedAt: Timestamp.now(), completedCount: status === 'completed' ? 1 : 0,
      abortedCount: status === 'aborted' ? 1 : 0, runtimeState: state, nextBatchIndex: batchIndex + 1,
      ...(settings.training ? { comparable, comparisonExclusion: comparable ? null : state.environmentChanged ? 'arena-changed' : !pointerMatches ? 'input-mismatch' : 'no-input' } : {}),
    });
    if (cohortUpdate) transaction.set(cohortUpdate.ref, cohortUpdate.data);
  });
  return { ok: true, nextBatchIndex: batchIndex + 1 };
}
export async function trainingComparison(identity: Identity, level: number, condition: string | null, protocol: string = TRAINING_PROTOCOL) {
  requireAdmin(identity);
  if (![TRAINING_PROTOCOL, REFERENCE_PROTOCOL].includes(protocol)) throw new ApiError(400, 'Geçersiz karşılaştırma türü.');
  if (!Number.isInteger(level) || level < 1 || level > (protocol === REFERENCE_PROTOCOL ? 3 : 5)) throw new ApiError(400, 'Geçersiz kademe.');
  const { db } = adminServices();
  const snapshot = await db.collection('aimComparison').where('protocol', '==', protocol).get();
  const all = snapshot.docs.map((doc) => doc.data() as TrainingCohort);
  const ids = [...new Set(all.map((data) => data.userId))];
  const existing = ids.length ? await db.getAll(...ids.map((id) => db.collection('users').doc(id))) : [];
  const active = new Set(existing.filter((doc) => doc.exists).map((doc) => doc.id));
  const cohorts = all.filter((data) => active.has(data.userId) || data.userId === process.env.FIREBASE_ADMIN_UID);
  const keys = [...new Set(cohorts.map((data) => data.conditionKey))];
  const conditions = keys.map((key) => ({ key, players: cohorts.filter((data) => data.conditionKey === key).length,
    inputDevice: cohorts.find((data) => data.conditionKey === key)!.inputDevice }));
  conditions.sort((a, b) => b.players - a.players || a.key.localeCompare(b.key));
  const selected = condition && keys.includes(condition) ? condition : conditions[0]?.key || null;
  return { protocol, stage: level, condition: selected, conditions,
    ...compareTrainingCohorts(cohorts.filter((data) => data.conditionKey === selected), level) };
}
export async function aimRunEvents(identity: Identity, runId: string, cursor: string | null) {
  const { db } = adminServices();
  const ref = db.collection('aimSessions').doc(runId);
  const run = (await ref.get()).data();
  if (!run) throw new ApiError(404, 'Tur bulunamadı.');
  if (identity.status !== 'admin' && run.userId !== identity.uid) throw new ApiError(403, 'Bu turun atışlarını okuyamazsınız.');
  if (cursor && !/^\d{8}$/.test(cursor)) throw new ApiError(400, 'Geçersiz sayfalama kaydı.');
  let query = ref.collection('batches').orderBy('__name__').limit(10);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  return { events: page.docs.flatMap((doc) => doc.data().events), cursor: page.size === 10 ? page.docs.at(-1)!.id : null };
}
export async function aimOverview(identity: Identity, email: string) {
  requireAdmin(identity);
  const query = adminServices().db.collection('aimSessions').where('email', '==', email);
  const [totals, timing, status, versionTwo, best] = await Promise.all([
    query.aggregate({ plays: AggregateField.count(), hits: AggregateField.sum('score'), misses: AggregateField.sum('misses'), durationMs: AggregateField.sum('totalDuration') }).get(),
    query.aggregate({ reactionTotal: AggregateField.sum('reactionTimeTotalMs'), reactionCount: AggregateField.sum('reactionSampleCount'), intervalTotal: AggregateField.sum('shotIntervalTotalMs'), intervalCount: AggregateField.sum('shotIntervalCount') }).get(),
    query.aggregate({ completed: AggregateField.sum('completedCount'), aborted: AggregateField.sum('abortedCount'), expired: AggregateField.sum('expiredTargets') }).get(),
    query.where('schemaVersion', '==', 2).count().get(),
    query.orderBy('score', 'desc').limit(1).get(),
  ]);
  const total = totals.data(), times = timing.data(), statuses = status.data();
  const legacy = total.plays - versionTwo.data().count;
  const completed = statuses.completed + legacy;
  return {
    totalPlays: total.plays, completedPlays: completed, abortedPlays: statuses.aborted,
    unfinishedPlays: Math.max(0, total.plays - completed - statuses.aborted),
    totalHits: total.hits, totalMisses: total.misses, totalExpired: statuses.expired, totalDurationMs: total.durationMs,
    accuracy: total.hits + total.misses > 0 ? total.hits / (total.hits + total.misses) * 100 : 0,
    averageHits: total.plays ? total.hits / total.plays : 0, bestScore: best.docs[0]?.data().score || 0,
    averageReactionMs: times.reactionCount ? times.reactionTotal / times.reactionCount : null,
    averageShotIntervalMs: times.intervalCount ? times.intervalTotal / times.intervalCount : null,
    hitsPerSecond: total.durationMs ? total.hits * 1000 / total.durationMs : 0,
  };
}
