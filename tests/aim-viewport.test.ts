import test from 'node:test';
import assert from 'node:assert/strict';
import { arenaPoint, arenaViewport } from '../src/lib/aim-viewport';

test('wide fullscreen and narrow screens show the complete arena without stretching circles', () => {
  assert.deepEqual(arenaViewport(1600, 600), { scale: 1.25, width: 1000, height: 600, x: 300, y: 0 });
  assert.deepEqual(arenaViewport(320, 280), { scale: 0.4, width: 320, height: 192, x: 0, y: 44 });
  for (const [width, height] of [[1920, 960], [1280, 400], [320, 280], [800, 480]]) {
    const view = arenaViewport(width, height);
    assert.ok(view.x >= 0 && view.y >= 0 && view.x + view.width <= width && view.y + view.height <= height);
    assert.ok(Math.abs(view.width / view.height - 800 / 480) < 1e-10);
  }
});
test('pointer coordinates match the fitted arena and letterbox clicks do not become misses', () => {
  assert.deepEqual(arenaPoint(800, 300, 1600, 600), { x: 400, y: 240 });
  assert.deepEqual(arenaPoint(300, 0, 1600, 600), { x: 0, y: 0 });
  assert.equal(arenaPoint(299, 300, 1600, 600), null);
  assert.equal(arenaPoint(1301, 300, 1600, 600), null);
  assert.equal(arenaPoint(160, 43, 320, 280), null);
  assert.deepEqual(arenaPoint(160, 140, 320, 280), { x: 400, y: 240 });
  assert.equal(arenaPoint(0, 0, 0, 0), null);
});
