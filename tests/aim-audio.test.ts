import test from 'node:test';
import assert from 'node:assert/strict';
import { AimAudio, synthesizeAimSound } from '../src/lib/aim-audio';

function fakeAudio() {
  const calls = { contexts: 0, resumes: 0, starts: 0, buffers: 0, closes: 0, volume: 0, peak: 0 };
  const create = () => {
    calls.contexts++;
    let state: AudioContextState = 'suspended';
    return {
      get state() { return state; }, currentTime: 0, sampleRate: 44100, destination: {},
      createGain: () => ({ gain: { value: 0, setValueAtTime(value: number) { calls.volume = value; } }, connect() {} }),
      createBuffer: () => { calls.buffers++; return { copyToChannel(samples: Float32Array) { for (const value of samples) calls.peak = Math.max(calls.peak, Math.abs(value)); } }; },
      createBufferSource: () => ({ buffer: null, onended: null, connect() {}, disconnect() {}, start() { calls.starts++; }, stop() {} }),
      async resume() { calls.resumes++; state = 'running'; },
      async close() { calls.closes++; state = 'closed'; },
    } as unknown as AudioContext;
  };
  return { calls, create };
}
test('hit, miss, and expired-target effects contain finite, audible, distinct PCM data', () => {
  const signatures: number[] = [];
  for (const kind of ['hit', 'miss', 'expire'] as const) {
    const samples = synthesizeAimSound(kind, 44100);
    let sum = 0, peak = 0;
    for (const value of samples) { assert.ok(Number.isFinite(value)); sum += value * value; peak = Math.max(peak, Math.abs(value)); }
    assert.ok(Math.sqrt(sum / samples.length) > 0.1);
    assert.ok(peak > 0.3 && peak < 1);
    assert.equal(samples[0], 0); assert.ok(Math.abs(samples.at(-1)!) < 0.01);
    signatures.push(samples[100]);
  }
  assert.equal(new Set(signatures).size, 3);
});
test('enabling sound during play creates and resumes audio without needing a new round', async () => {
  const { calls, create } = fakeAudio(), audio = new AimAudio(create);
  await audio.play('hit'); await audio.play('miss'); await audio.play('expire');
  assert.equal(calls.contexts, 1); assert.equal(calls.resumes, 1);
  assert.equal(calls.starts, 3); assert.equal(calls.buffers, 3); assert.ok(calls.peak > 0.3);
  audio.setVolume(0.5); assert.equal(calls.volume, 0.5);
  await audio.play('hit'); assert.equal(calls.buffers, 3, 'decoded sound is reused');
  await audio.close(); assert.equal(calls.closes, 1);
  await audio.play('hit'); assert.equal(calls.contexts, 2); assert.equal(calls.starts, 5);
});
