import { useRef, useState } from "react";
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
};

function indexToCoord(index: number): Coord {
  return { row: Math.floor(index / GRID_SIZE), col: index % GRID_SIZE };
}

function coordToKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function GameBoard({ board, clearingSet, locked, onSwap }: Props) {
  const [selected, setSelected] = useState<Coord | null>(null);
  const dragFrom = useRef<number | null>(null);
  const touchStart = useRef<{ idx: number; x: number; y: number } | null>(null);

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
    <div className="mx-auto grid w-full max-w-[520px] grid-cols-8 gap-1 rounded-2xl border border-white/15 bg-black/30 p-2">
      {board.flatMap((row, r) =>
        row.map((tile, c) => {
          const idx = r * GRID_SIZE + c;
          const isSelected = selected?.row === r && selected?.col === c;
          const isClearing = clearingSet.has(coordToKey(r, c));

          return (
            <button
              key={`${r}-${c}`}
              type="button"
              className={`relative aspect-square overflow-hidden rounded-lg border border-white/10 transition ${
                isSelected ? "scale-95 border-accent" : ""
              } ${isClearing ? "opacity-40" : ""}`}
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
              <img src={TILE_ART[tile]} alt={`tile-${tile}`} className="h-full w-full object-cover" />
            </button>
          );
        }),
      )}
    </div>
  );
}