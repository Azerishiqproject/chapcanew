import { api } from './api-client';
import { MAX_SALES_MS, type SalesAction, type SalesEvent } from './sales-telemetry';
export interface SalesBatch { batchIndex: number; events: SalesEvent[]; throughMs: number }
interface Outbox { version: 1; id: string; uid: string; tabId: string; start: number; seq: number; atMs: number; acknowledgedMs: number; nextBatch: number; finished: boolean; queue: SalesBatch[]; pending: SalesEvent[] }
export type SalesSender = (path: string, body: SalesBatch) => Promise<unknown>;
const sender: SalesSender = (path, body) => api(path, 'POST', body, { keepalive: true });
export class SalesRecorder {
  private outbox: Outbox;
  private flight: Promise<void> | null = null;
  private key: string;
  constructor(id: string, uid: string, tabId: string, private storage: Storage | null, private send: SalesSender = sender, private now: () => number = () => Date.now()) {
    this.key = `chapca_sales_outbox_${uid}_${id}`;
    this.outbox = { version: 1, id, uid, tabId, start: now(), seq: 0, atMs: 0, acknowledgedMs: 0, nextBatch: 0, finished: false, queue: [], pending: [] };
    this.persist();
  }
  static async recover(uid: string, tabId: string, storage: Storage | null, send: SalesSender = sender) {
    if (!storage) return;
    const keys: string[] = [];
    try { for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(`chapca_sales_outbox_${uid}_`)) keys.push(key); } } catch { return; }
    await Promise.allSettled(keys.map(async key => {
      let saved: Outbox;
      try { saved = JSON.parse(storage.getItem(key) || 'null'); } catch { return; }
      if (!saved || saved.version !== 1 || saved.uid !== uid || !/^[a-f0-9]{64}$/.test(saved.id) || !Array.isArray(saved.pending) || !Array.isArray(saved.queue) || (!saved.finished && saved.tabId !== tabId)) return;
      const recorder = new SalesRecorder(saved.id, uid, saved.tabId, null, send);
      recorder.storage = storage; recorder.outbox = saved; recorder.key = key;
      if (!saved.finished) recorder.append({ type: 'finish', reason: 'recovered' }, saved.atMs);
      await recorder.flush();
    }));
  }
  private persist() {
    try {
      if (this.outbox.finished && !this.outbox.queue.length && !this.outbox.pending.length) this.storage?.removeItem(this.key);
      else this.storage?.setItem(this.key, JSON.stringify(this.outbox));
    } catch { /* In-memory delivery remains available if browser storage is full/disabled. */ }
  }
  private append(action: SalesAction, atMs: number) {
    if (this.outbox.finished) return;
    this.outbox.pending.push({ ...action, seq: this.outbox.seq++, atMs });
    this.outbox.atMs = atMs;
    if (action.type === 'finish') this.outbox.finished = true;
    this.persist();
  }
  record(action: SalesAction) { this.append(action, Math.max(this.outbox.atMs, Math.min(MAX_SALES_MS, this.now() - this.outbox.start))); }
  finish(reason: 'selected' | 'navigation' | 'logout') { this.record({ type: 'finish', reason }); return this.flush(); }
  flush() {
    const atMs = this.outbox.finished ? this.outbox.atMs : Math.max(this.outbox.atMs, Math.min(MAX_SALES_MS, this.now() - this.outbox.start));
    this.outbox.atMs = atMs;
    const fresh = this.outbox.pending.splice(0), lastQueued = this.outbox.queue.at(-1)?.throughMs ?? this.outbox.acknowledgedMs;
    if (fresh.length || atMs > lastQueued) {
      for (let i = 0; i < Math.max(1, fresh.length); i += 50) {
        const chunk = fresh.slice(i, i + 50), last = i + 50 >= fresh.length;
        this.outbox.queue.push({ batchIndex: this.outbox.nextBatch + this.outbox.queue.length, events: chunk, throughMs: last ? atMs : chunk.at(-1)!.atMs });
      }
      this.persist();
    }
    if (this.flight) return this.flight;
    this.flight = this.upload().finally(() => { this.flight = null; });
    return this.flight;
  }
  private async upload() {
    while (this.outbox.queue.length) {
      const batch = this.outbox.queue[0];
      await this.send(`sales/runs/${this.outbox.id}/events`, batch);
      this.outbox.queue.shift(); this.outbox.nextBatch++; this.outbox.acknowledgedMs = batch.throughMs; this.persist();
    }
  }
}
