export const PUZZLE = { width: 360, height: 180, size: 44, startX: 8, travel: 300, tolerance: 5, handleSize: 46 } as const;
export interface PuzzleChallenge { x: number; y: number }
export function createPuzzleChallenge(random = Math.random): PuzzleChallenge { return { x: 110 + Math.floor(random() * 177), y: 48 + Math.floor(random() * 70) }; }
export function puzzlePosition(start: number, deltaCss: number, travelCss: number) {
  if (!Number.isFinite(travelCss) || travelCss <= 0) return Math.max(0, Math.min(PUZZLE.travel, start));
  return Math.max(0, Math.min(PUZZLE.travel, start + deltaCss / travelCss * PUZZLE.travel));
}
export function puzzleMatches(challenge: PuzzleChallenge, position: number) { return Number.isFinite(position) && Math.abs(PUZZLE.startX + position - challenge.x) <= PUZZLE.tolerance; }
