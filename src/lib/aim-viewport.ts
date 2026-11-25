import { ARENA } from './aim-game';

// Fit the entire arena without stretching circles or clipping the bottom in fullscreen.
export function arenaViewport(width: number, height: number) {
  const scale = Math.max(0, Math.min(width / ARENA.width, height / ARENA.height));
  return { scale, width: ARENA.width * scale, height: ARENA.height * scale,
    x: (width - ARENA.width * scale) / 2, y: (height - ARENA.height * scale) / 2 };
}

export function arenaPoint(x: number, y: number, width: number, height: number) {
  const view = arenaViewport(width, height);
  if (!view.scale || x < view.x || y < view.y || x > view.x + view.width || y > view.y + view.height) return null;
  return { x: (x - view.x) / view.scale, y: (y - view.y) / view.scale };
}
