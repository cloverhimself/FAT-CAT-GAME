import { useEffect, useMemo, useRef, useState } from "react";
import { Coord, GRID_SIZE, TileValue } from "@/lib/game/types";

const TILE_ART = [
  "/img/CAT1.jpg",
  "/img/CAT2.jpg",
  "/img/CAT3.jpg",
  "/img/CAT4.jpg",
  "/img/CAT5.jpg",
  "/img/pumpfun.png",
];

type Props = {
  board: TileValue[][];
  clearingSet: Set<string>;
  locked: boolean;
  onSwap: (a: Coord, b: Coord) => void;
  pendingSwap: { a: Coord; b: Coord } | null;
  fxTick: number;
};

function indexToCoord(index: number): Coord {
  return { row: Math.floor(index / GRID_SIZE), col: index % GRID_SIZE };
}

function coordToKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function GameBoard({ board, clearingSet, locked, onSwap, pendingSwap, fxTick }: Props) {
  const [selected, setSelected] = useState<Coord | null>(null);
  const [dropPulse, setDropPulse] = useState(0);
  const dragFrom = useRef<number | null>(null);
  const touchStart = useRef<{ idx: number; x: number; y: number } | null>(null);
  const lastBoardSig = useRef("");

  useEffect(() => {
    const nextSig = board.flat().join(",");
    if (nextSig !== lastBoardSig.current) {
      setDropPulse((v) => v + 1);
      lastBoardSig.current = nextSig;
    }
  }, [board]);

  const sparkleKey = useMemo(() => `sparkle-${fxTick}`, [fxTick]);

  const pendingSwapVector = (row: number, col: number): { x: number; y: number } | null => {
    if (!pendingSwap) return null;
    const isA = pendingSwap.a.row === row && pendingSwap.a.col === col;
    const isB = pendingSwap.b.row === row && pendingSwap.b.col === col;
    if (!isA && !isB) return null;
    const from = isA ? pendingSwap.a : pendingSwap.b;
    const to = isA ? pendingSwap.b : pendingSwap.a;
    return { x: (to.col - from.col) * 102, y: (to.row - from.row) * 102 };
  };

  const trySwap = (a: Coord, b: Coord) => {
    if (locked) return;
    onSwap(a, b);
    setSelected(null);
  };

  const onTileClick = (coord: Coord) => {
    if (locked) return;
    if (!selected) {
      setSelected(coord);
      return;
    }
    if (selected.row === coord.row && selected.col === coord.col) {
      setSelected(null);
      return;
    }
    trySwap(selected, coord);
  };

  return (
    <div className="game-grid-shell mx-auto w-full max-w-[560px] rounded-[28px] p-3">
      <div className="relative">
        {fxTick > 0 && (
          <div key={sparkleKey} className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[22px]">
            <span className="sparkle sparkle-1" />
            <span className="sparkle sparkle-2" />
            <span className="sparkle sparkle-3" />
          </div>
        )}
        <div className="grid grid-cols-8 gap-1.5 rounded-[22px]">
      {board.flatMap((row, r) =>
        row.map((tile, c) => {
          const idx = r * GRID_SIZE + c;
          const isSelected = selected?.row === r && selected?.col === c;
          const isClearing = clearingSet.has(coordToKey(r, c));
          const vector = pendingSwapVector(r, c);
          const translateStyle =
            vector !== null
              ? { transform: `translate3d(${vector.x}%, ${vector.y}%, 0)` }
              : undefined;

          return (
            <button
              key={`${r}-${c}`}
              type="button"
              style={translateStyle}
              className={`tile-shell relative aspect-square w-full overflow-hidden rounded-full border border-white/30 transition-transform duration-150 ${
                isSelected ? "tile-selected" : ""
              } ${isClearing ? "tile-clearing" : ""} ${pendingSwap ? "tile-swapping" : ""}`}
              onClick={() => onTileClick({ row: r, col: c })}
              draggable={!locked}
              onDragStart={() => {
                dragFrom.current = idx;
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragFrom.current === null) return;
                const from = indexToCoord(dragFrom.current);
                const to = indexToCoord(idx);
                trySwap(from, to);
                dragFrom.current = null;
              }}
              onTouchStart={(event) => {
                const touch = event.changedTouches[0];
                touchStart.current = { idx, x: touch.clientX, y: touch.clientY };
              }}
              onTouchEnd={(event) => {
                const start = touchStart.current;
                if (!start) return;
                const touch = event.changedTouches[0];
                const dx = touch.clientX - start.x;
                const dy = touch.clientY - start.y;
                const absX = Math.abs(dx);
                const absY = Math.abs(dy);

                if (Math.max(absX, absY) < 20) {
                  onTileClick(indexToCoord(start.idx));
                  touchStart.current = null;
                  return;
                }

                const from = indexToCoord(start.idx);
                const to = { ...from };
                if (absX > absY) {
                  to.col += dx > 0 ? 1 : -1;
                } else {
                  to.row += dy > 0 ? 1 : -1;
                }

                if (to.row >= 0 && to.row < GRID_SIZE && to.col >= 0 && to.col < GRID_SIZE) {
                  trySwap(from, to);
                }
                touchStart.current = null;
              }}
            >
              <span className="tile-gloss" />
              <img src={TILE_ART[tile]} alt={`tile-${tile}`} className={`h-full w-full rounded-full object-cover ${dropPulse ? "tile-drop" : ""}`} />
            </button>
          );
        }),
      )}
        </div>
      </div>
    </div>
  );
}
