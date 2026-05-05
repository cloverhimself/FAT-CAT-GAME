export const GRID_SIZE = 8;
export const TILE_KIND_COUNT = 6;

export type TileValue = number;

export type Coord = {
  row: number;
  col: number;
};

export type TileGroup = Coord[];

export type MatchResult = {
  groups: TileGroup[];
  matchedSet: Set<string>;
};

export type CascadeResult = {
  board: TileValue[][];
  totalMatches: number;
  cascadeSteps: number;
};

export type GameState = {
  board: TileValue[][];
  score: number;
  level: number;
  xpEarned: number;
  movesPlayed: number;
};