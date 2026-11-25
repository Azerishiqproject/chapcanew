export type AimSound = 'hit' | 'miss' | 'expire';

// Locally generated effects: no download/decode race before the first shot.
export function synthesizeAimSound(kind: AimSound, sampleRate: number): Float32Array<ArrayBuffer> {
  const duration = kind === 'expire' ? 0.24 : kind === 'hit' ? 0.11 : 0.13;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let phase = 0, random = 104729;
  for (let index = 0; index < samples.length; index++) {
    const time = index / sampleRate;
    const frequency = kind === 'hit' ? 1050 - 450 * time / duration : kind === 'miss' ? 190 - 80 * time / duration : 350 - 230 * time / duration;
    phase += 2 * Math.PI * frequency / sampleRate;
    random = random * 16807 % 2147483647;
    const noise = (random / 2147483647 * 2 - 1) * Math.exp(-time / 0.009);
    const envelope = (1 - Math.exp(-time / 0.0015)) * Math.exp(-time / (duration / 5));
    samples[index] = (Math.sin(phase) * 0.65 + noise * 0.28) * envelope;
  }
  return samples;
}

export class AimAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffers = new Map<AimSound, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private volume = 0.8;
  constructor(private createContext: () => AudioContext = () => new AudioContext()) {}
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gain && this.context) this.gain.gain.setValueAtTime(this.volume, this.context.currentTime);
  }
  private ensureContext() {
    if (!this.context || this.context.state === 'closed') {
      this.context = this.createContext(); this.buffers.clear();
      this.gain = this.context.createGain(); this.gain.gain.value = this.volume;
      this.gain.connect(this.context.destination);
    }
    return this.context;
  }
  async prepare() {
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
  }
  async play(kind: AimSound) {
    // Also initialize/resume when sound is enabled in the middle of a round.
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    let buffer = this.buffers.get(kind);
    if (!buffer) {
      const samples = synthesizeAimSound(kind, context.sampleRate);
      buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0); this.buffers.set(kind, buffer);
    }
    const source = context.createBufferSource(); source.buffer = buffer;
    source.connect(this.gain!); this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    source.start();
  }
  async close() {
    for (const source of this.sources) { try { source.stop(); } catch { /* already ended */ } }
    this.sources.clear(); this.buffers.clear();
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null; this.gain = null;
  }
}
