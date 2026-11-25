import { AimGame, DIRECT, targetPosition } from '../../src/lib/aim-game';

export function simulatedDirect(playUntilMs = 100000, delayMs = 700) {
  let seed = 34567;
  const game = new AimGame({ ...DIRECT }, () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; });
  let cursor = { x: 400, y: 240 };
  game.move(cursor.x, cursor.y, 0);
  for (let at = 50; at <= playUntilMs; at += 50) {
    game.advance(at);
    const target = game.targets[0];
    if (!target) continue;
    const point = targetPosition(target, at, game.settings);
    cursor = { x: cursor.x + (point.x - cursor.x) / 2, y: cursor.y + (point.y - cursor.y) / 2 };
    game.move(cursor.x, cursor.y, at);
    if (at - target.bornAt >= delayMs) {
      game.move(point.x, point.y, at, 'mouse', true);
      game.shoot(point.x, point.y, at); cursor = point;
    }
  }
  // Stop hitting: the classic game completes when three targets expire.
  game.advance(playUntilMs + 10000);
  return game;
}
