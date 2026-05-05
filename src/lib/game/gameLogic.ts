import { GRID_SIZE, TILE_KIND_COUNT, Coord, TileValue, CascadeResult } from "./types";
import { findMatches, isAdjacent } from "./tileMatching";

const randomTile = (): TileValue => Math.floor(Math.random() * TILE_KIND_COUNT);

export function cloneBoard(board: TileValue[][]): TileValue[][] {
  return board.map((row) => [...row]);
}

export function createBoard(): TileValue[][] {
  const board: TileValue[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => randomTile()),
  );

  while (findMatches(board).groups.length > 0) {
    const { matchedSet } = findMatches(board);
    matchedSet.forEach((key) => {
      const [row, col] = key.split(":").map(Number);
      board[row][col] = randomTile();
    });
  }

  return board;
}

export function swapTiles(board: TileValue[][], a: Coord, b: Coord): TileValue[][] {
  const next = cloneBoard(board);
  const temp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = temp;
  return next;
}

export function canSwap(board: TileValue[][], a: Coord, b: Coord): boolean {
  if (!isAdjacent(a, b)) return false;
  const swapped = swapTiles(board, a, b);
  return findMatches(swapped).groups.length > 0;
}

export function clearAndDrop(board: TileValue[][], matchedSet: Set<string>): TileValue[][] {
  const next = cloneBoard(board);

  for (let col = 0; col < GRID_SIZE; col += 1) {
    const kept: TileValue[] = [];

    for (let row = GRID_SIZE - 1; row >= 0; row -= 1) {
      if (!matchedSet.has(`${row}:${col}`)) {
        kept.push(next[row][col]);
      }
    }

    while (kept.length < GRID_SIZE) {
      kept.push(randomTile());
    }

    for (let row = GRID_SIZE - 1, idx = 0; row >= 0; row -= 1, idx += 1) {
      next[row][col] = kept[idx];
    }
  }

  return next;
}

export function runCascade(board: TileValue[][]): CascadeResult {
  let current = cloneBoard(board);
  let totalMatches = 0;
  let cascadeSteps = 0;

  while (true) {
    const result = findMatches(current);
    if (result.groups.length === 0) break;

    totalMatches += result.matchedSet.size;
    cascadeSteps += 1;
    current = clearAndDrop(current, result.matchedSet);
  }

  return { board: current, totalMatches, cascadeSteps };
}

export function scoreForMatch(matchCount: number, cascadeSteps: number): number {
  const base = matchCount * 10;
  const cascadeBonus = Math.max(0, cascadeSteps - 1) * 25;
  return base + cascadeBonus;
}