import { salesBuilding } from './sales-catalog';
import { changeAddress, emptyAddress, findApartment, type SalesAddress, type CatalogBuilding } from '../sales-catalog';
import { Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { adminServices } from './firebase-admin';
import { ApiError, digest, record, text } from './security';
import { requireAdmin, requireOwner, type Identity } from './session';
import { resolveCaptchaSettings, captchaSettingsErrors, type CaptchaType } from '../captcha-config';
import { applySalesEvents, initialSalesRuntime, MAX_SALES_MS, salesSummary, validateSalesPlan, type SalesEvent, type SalesField, type SalesRuntime, type SalesStage } from '../sales-telemetry';
import type { CaptchaChallenge } from '../sales-flow';
import { summarizeSalesSessions } from '../sales-analytics';
const integer = (value: unknown, max = 1000000) => { if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) throw new ApiError(400, 'Geçersiz sayı.'); return value; };
const boolean = (value: unknown) => { if (typeof value !== 'boolean') throw new ApiError(400, 'Geçersiz mantıksal değer.'); return value; };
const fields = ['projectId', 'building', 'entrance', 'floor', 'apartment', 'payment', 'method'];
function field(value: unknown): SalesField { if (!fields.includes(String(value))) throw new ApiError(400, 'Geçersiz alan.'); return value as SalesField; }
function event(value: unknown): SalesEvent {
  const input = record(value), base = { seq: integer(input.seq), atMs: integer(input.atMs, MAX_SALES_MS) };
  switch (input.type) {
    case 'phase': if (!['project', 'payment', 'method', 'search'].includes(String(input.phase))) break; return { ...base, type: input.type, phase: input.phase as SalesStage };
    case 'select': { const name = field(input.field), value = text(input.value, 80, 0); if (['building', 'entrance', 'floor', 'apartment'].includes(name) && value && !/^\d{1,8}$/.test(value)) throw new ApiError(400, 'Geçersiz adres numarası.'); return { ...base, type: input.type, field: name, value }; }
    case 'focus': return { ...base, type: input.type, field: field(input.field) };
    case 'search': return { ...base, type: input.type, found: boolean(input.found) };
    case 'reset': return { ...base, type: input.type };
    case 'catalog': if (!['loading', 'ready', 'error'].includes(String(input.status))) break; return { ...base, type: input.type, projectId: text(input.projectId, 30), building: text(input.building, 30), status: input.status as 'loading' | 'ready' | 'error' };
    case 'captcha-open': case 'captcha-close': case 'captcha-retry': return { ...base, type: input.type, index: integer(input.index, 4) };
    case 'captcha-result': return { ...base, type: input.type, index: integer(input.index, 4), correct: boolean(input.correct) };
    case 'visibility': return { ...base, type: input.type, visible: boolean(input.visible) };
    case 'finish': if (!['selected', 'navigation', 'logout', 'recovered'].includes(String(input.reason))) break; return { ...base, type: input.type, reason: input.reason as 'selected' | 'navigation' | 'logout' | 'recovered' };
  }
  throw new ApiError(400, 'Geçersiz satış olayı.');
}
export function publicSalesSession(doc: DocumentSnapshot) {
  const data = { ...doc.data() }; delete data.runtimeState; delete data.nextBatchIndex; delete data.clientRunId;
  return { ...data, id: doc.id };
}
export async function startSalesRun(identity: Identity, input: Record<string, unknown>) {
  const clientId = text(input.clientRunId, 80);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(clientId) || !Array.isArray(input.plan) || input.plan.length > 5) throw new ApiError(400, 'Geçersiz satış turu.');
  const { db } = adminServices(), ref = db.collection('salesSessions').doc(digest(`sales:${identity.uid}:${clientId}`));
  const settings = resolveCaptchaSettings((await db.collection('captchaSettings').doc(identity.uid).get()).data());
  const errors = captchaSettingsErrors(settings); if (errors.length) throw new ApiError(400, errors.join(' '));
  const plan: CaptchaChallenge[] = input.plan.map(value => { const item = record(value); return { type: text(item.type, 30) as CaptchaType, step: integer(item.step, 2) as 1 | 2 }; });
  try { validateSalesPlan(settings.enabled, settings.requiredCount, settings.allowedTypes, plan); } catch (error) { throw new ApiError(409, (error as Error).message); }
  await db.runTransaction(async transaction => {
    if ((await transaction.get(ref)).exists) return;
    const now = Timestamp.now(), state = initialSalesRuntime();
    transaction.create(ref, { schemaVersion: 2, userId: identity.uid, email: identity.email, clientRunId: clientId,
      createdAt: now, startTime: now, updatedAt: now, endTime: null, ...salesSummary(state), runtimeState: state, nextBatchIndex: 0,
      captchaConfig: { enabled: settings.enabled, requiredCount: settings.requiredCount, allowedTypes: settings.allowedTypes, plan } });
  });
  return { id: ref.id };
}
export async function appendSalesEvents(identity: Identity, id: string, input: Record<string, unknown>) {
  const batchIndex = integer(input.batchIndex), throughMs = integer(input.throughMs, MAX_SALES_MS);
  if (!Array.isArray(input.events) || input.events.length > 50) throw new ApiError(400, 'Geçersiz satış paketi.');
  const events = input.events.map(event), { db } = adminServices(), ref = db.collection('salesSessions').doc(id);
  const batchRef = ref.collection('batches').doc(String(batchIndex).padStart(8, '0')), hash = digest(JSON.stringify(input));
  const supplemental = new Map<string, CatalogBuilding>();
  if (events.some(event => event.type === 'search' && event.found)) {
    const [beforeDoc, beforeBatch] = await db.getAll(ref, batchRef), before = beforeDoc.data();
    if (!before || before.schemaVersion !== 2) throw new ApiError(404, 'Satış turu bulunamadı.');
    if (before.userId !== identity.uid) throw new ApiError(403, 'Satış turuna erişilemiyor.');
    if (beforeBatch.exists) { if (beforeBatch.data()?.payloadHash !== hash) throw new ApiError(409, 'Paket içeriği değiştirilemez.'); return { ok: true }; }
    let address: SalesAddress = before.runtimeState.address;
    for (const event of events) {
      if (event.type === 'select' && !['payment', 'method'].includes(event.field)) address = changeAddress(address, event.field as keyof SalesAddress, event.value);
      if (event.type === 'reset') address = { ...emptyAddress, projectId: address.projectId };
      if (event.type === 'search' && event.found && !findApartment(address)) {
        const key = `${address.projectId}/${address.building}`;
        if (!supplemental.has(key)) supplemental.set(key, await salesBuilding(address.projectId, address.building));
      }
    }
  }
  await db.runTransaction(async transaction => {
    const [doc, batch] = await transaction.getAll(ref, batchRef), run = doc.data();
    if (!run || run.schemaVersion !== 2) throw new ApiError(404, 'Satış turu bulunamadı.');
    if (run.userId !== identity.uid) throw new ApiError(403, 'Başkasının turuna olay yazamazsınız.');
    if (batch.exists) { if (batch.data()?.payloadHash !== hash) throw new ApiError(409, 'Paket içeriği değiştirilemez.'); return; }
    if (run.status !== 'playing' || run.nextBatchIndex !== batchIndex) throw new ApiError(409, 'Satış paket sırası uyuşmuyor.');
    if (throughMs > Date.now() - run.startTime.toMillis() + 5000) throw new ApiError(400, 'Tur süresi uyuşmuyor.');
    let result;
    try { result = applySalesEvents(run.runtimeState as SalesRuntime, events, throughMs, run.captchaConfig.plan, address => findApartment(address, supplemental.get(`${address.projectId}/${address.building}`))); }
    catch (error) { throw new ApiError(400, (error as Error).message); }
    transaction.create(batchRef, { events: result.events, throughMs, payloadHash: hash, createdAt: Timestamp.now() });
    transaction.update(ref, { ...salesSummary(result.state), runtimeState: result.state, nextBatchIndex: batchIndex + 1, updatedAt: Timestamp.now(), endTime: result.state.ended ? Timestamp.fromMillis(run.startTime.toMillis() + throughMs) : null });
  });
  return { ok: true };
}
export async function salesRunEvents(identity: Identity, id: string, cursor: string | null) {
  const { db } = adminServices(), ref = db.collection('salesSessions').doc(id), doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, 'Satış turu bulunamadı.');
  requireOwner(identity, doc.data()!.userId);
  let query = ref.collection('batches').orderBy('__name__').limit(20);
  if (cursor) { if (!/^\d{8}$/.test(cursor)) throw new ApiError(400, 'Geçersiz sayfa.'); query = query.startAfter(cursor); }
  const snapshot = await query.get();
  return { events: snapshot.docs.flatMap(item => item.data().events), cursor: snapshot.size === 20 ? snapshot.docs.at(-1)!.id : null, legacy: doc.data()!.schemaVersion !== 2 };
}
export async function salesOverview(identity: Identity, email: string) {
  requireAdmin(identity);
  const rows = await adminServices().db.collection('salesSessions').where('email', '==', email).select('schemaVersion', 'status', 'totalDuration', 'step1Duration', 'step2Duration', 'captchaDuration', 'correctCaptchas', 'incorrectCaptchas', 'phaseDurations', 'captchaTypes', 'searches', 'resets', 'backCount', 'catalogErrors').get();
  return summarizeSalesSessions(rows.docs.map(doc => doc.data()));
}
