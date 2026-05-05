import { Coord, GRID_SIZE, MatchResult, TileValue } from "./types";

const keyFor = (coord: Coord): string => `${coord.row}:${coord.col}`;

export function findMatches(board: TileValue[][]): MatchResult {
  const groups: Coord[][] = [];
  const matchedSet = new Set<string>();

  for (let row = 0; row < GRID_SIZE; row += 1) {
    let runStart = 0;
    for (let col = 1; col <= GRID_SIZE; col += 1) {
      const atEnd = col === GRID_SIZE;
      const sameAsStart = !atEnd && board[row][col] === board[row][runStart];
      if (sameAsStart) continue;

      const runLength = col - runStart;
      if (runLength >= 3) {
        const group: Coord[] = [];
        for (let c = runStart; c < col; c += 1) {
          const coord = { row, col: c };
          matchedSet.add(keyFor(coord));
          group.push(coord);
        }
        groups.push(group);
      }
      runStart = col;
    }
  }

  for (let col = 0; col < GRID_SIZE; col += 1) {
    let runStart = 0;
    for (let row = 1; row <= GRID_SIZE; row += 1) {
      const atEnd = row === GRID_SIZE;
      const sameAsStart = !atEnd && board[row][col] === board[runStart][col];
      if (sameAsStart) continue;

      const runLength = row - runStart;
      if (runLength >= 3) {
        const group: Coord[] = [];
        for (let r = runStart; r < row; r += 1) {
          const coord = { row: r, col };
          matchedSet.add(keyFor(coord));
          group.push(coord);
        }
        groups.push(group);
      }
      runStart = row;
    }
  }

  return { groups, matchedSet };
}

export function isAdjacent(a: Coord, b: Coord): boolean {
  const rowDiff = Math.abs(a.row - b.row);
  const colDiff = Math.abs(a.col - b.col);
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

export function matchedKey(row: number, col: number): string {
  return `${row}:${col}`;
}