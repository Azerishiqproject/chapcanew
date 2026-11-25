import { api } from './api-client';
import { type AimEvent, type AimGame, type EndReason } from './aim-game';

interface Batch { batchIndex: number; events: AimEvent[]; throughMs: number; ended: boolean; endReason?: EndReason }
interface Outbox { runId: string; nextBatch: number; acknowledgedMs: number; ended: boolean; queue: Batch[] }
export type AimSender = (path: string, body: Batch) => Promise<unknown>;
const send: AimSender = (path, body) => api(path, 'POST', body, { keepalive: true });
export class AimRecorder {
  private capturedEvents = 0;
  private flight: Promise<void> | null = null;
  private key: string;
  private outbox: Outbox;
  constructor(runId: string, uid: string, private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    private sender: AimSender = send) {
    this.key = `chapca_aim_outbox_${uid}`;
    this.outbox = { runId, nextBatch: 0, acknowledgedMs: 0, ended: false, queue: [] };
  }
  static restore(uid: string, storage: Storage, sender: AimSender = send) {
    const key = `chapca_aim_outbox_${uid}`;
    let saved: Outbox;
    try { saved = JSON.parse(storage.getItem(key) || 'null'); } catch { storage.removeItem(key); return null; }
    if (!saved) return null;
    if (!/^[a-f0-9]{64}$/.test(saved.runId) || !Array.isArray(saved.queue) || !Number.isInteger(saved.nextBatch)) {
      storage.removeItem(key); return null;
    }
    const recorder = new AimRecorder(saved.runId, uid, storage, sender);
    recorder.outbox = saved;
    if (!saved.ended) {
      const throughMs = saved.queue.at(-1)?.throughMs ?? saved.acknowledgedMs;
      saved.queue.push({ batchIndex: saved.nextBatch + saved.queue.length, events: [], throughMs, ended: true, endReason: 'navigation' });
      saved.ended = true;
    }
    recorder.persist();
    return recorder;
  }
  private persist() {
    if (this.outbox.ended && this.outbox.queue.length === 0) this.storage.removeItem(this.key);
    else this.storage.setItem(this.key, JSON.stringify(this.outbox));
  }
  capture(game: AimGame) {
    if (this.outbox.ended) return;
    const fresh = game.events.slice(this.capturedEvents);
    const chunks: AimEvent[][] = [];
    for (let index = 0; index < fresh.length; index += 100) chunks.push(fresh.slice(index, index + 100));
    if (!chunks.length) chunks.push([]);
    chunks.forEach((events, index) => {
      const last = index === chunks.length - 1;
      this.outbox.queue.push({
        batchIndex: this.outbox.nextBatch + this.outbox.queue.length,
        events, throughMs: last ? game.elapsedMs : events.at(-1)!.atMs,
        ended: last && !!game.ended, ...(last && game.ended ? { endReason: game.ended } : {}),
      });
    });
    this.capturedEvents = game.events.length;
    this.outbox.ended = !!game.ended;
    this.persist();
  }
  drain() {
    if (this.flight) return this.flight;
    this.flight = this.upload().finally(() => { this.flight = null; });
    return this.flight;
  }
  private async upload() {
    while (this.outbox.queue.length) {
      const batch = this.outbox.queue[0];
      await this.sender(`aim/runs/${this.outbox.runId}/events`, batch);
      this.outbox.queue.shift();
      this.outbox.nextBatch++;
      this.outbox.acknowledgedMs = batch.throughMs;
      this.persist();
    }
  }
}
