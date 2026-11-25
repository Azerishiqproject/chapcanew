import assert from 'node:assert/strict';
import { AimGame, PROGRESSIVE, targetPosition } from '../../src/lib/aim-game';
import { TRAINING_DURATION_MS } from '../../src/lib/aim-training';

export function simulatedTraining(delay = 350) {
  let seed = 76543;
  const game = new AimGame({ ...PROGRESSIVE }, () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; });
  let cursor = { x: 400, y: 240 };
  game.move(cursor.x, cursor.y, 0);
  for (let at = 100; at < TRAINING_DURATION_MS; at += 100) {
    game.advance(at);
    assert.ok(game.targets.length <= 3);
    const target = game.targets[0];
    if (!target) continue;
    const point = targetPosition(target, at, game.settings);
    cursor = { x: cursor.x + (point.x - cursor.x) / 2, y: cursor.y + (point.y - cursor.y) / 2 };
    game.move(cursor.x, cursor.y, at);
    if (at - target.bornAt >= delay) {
      game.move(point.x, point.y, at, 'mouse', true); game.shoot(point.x, point.y, at);
      cursor = point;
    }
  }
  game.advance(TRAINING_DURATION_MS);
  return game;
}
