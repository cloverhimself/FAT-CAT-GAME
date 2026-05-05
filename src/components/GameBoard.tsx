import { PointerEvent, TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import { Coord, GRID_SIZE, TileValue } from "@/lib/game/types";
import { isAdjacent } from "@/lib/game/tileMatching";

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

type PointerGesture = {
  active: boolean;
  coord: Coord | null;
  startX: number;
  startY: number;
  triggeredSwap: boolean;
};

function coordToKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function inBounds(coord: Coord): boolean {
  return coord.row >= 0 && coord.row < GRID_SIZE && coord.col >= 0 && coord.col < GRID_SIZE;
}

function getSwipeTarget(from: Coord, dx: number, dy: number): Coord | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < 8) return null;

  // Ignore near-diagonal swipes; require a clear cardinal direction.
  if (absX > 0 && absY > 0) {
    const ratio = absX > absY ? absX / absY : absY / absX;
    if (ratio < 1.2) return null;
  }

  const target = { ...from };
  if (absX > absY) {
    target.col += dx > 0 ? 1 : -1;
  } else {
    target.row += dy > 0 ? 1 : -1;
  }

  return inBounds(target) ? target : null;
}

export function GameBoard({ board, clearingSet, locked, onSwap, pendingSwap, fxTick }: Props) {
  const [selected, setSelected] = useState<Coord | null>(null);
  const [dragging, setDragging] = useState<Coord | null>(null);
  const [dropPulse, setDropPulse] = useState(0);
  const lastBoardSig = useRef("");
  const gestureRef = useRef<PointerGesture>({
    active: false,
    coord: null,
    startX: 0,
    startY: 0,
    triggeredSwap: false,
  });

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
    return { x: (to.col - from.col) * 100, y: (to.row - from.row) * 100 };
  };

  const trySwap = (a: Coord, b: Coord) => {
    if (locked) return;
    if (!isAdjacent(a, b)) {
      setSelected(b);
      return;
    }
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

  const handlePointerDown = (coord: Coord, clientX: number, clientY: number) => {
    if (locked) return;
    gestureRef.current = {
      active: true,
      coord,
      startX: clientX,
      startY: clientY,
      triggeredSwap: false,
    };
    setDragging(coord);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") event.preventDefault();
    const gesture = gestureRef.current;
    if (!gesture.active || !gesture.coord || gesture.triggeredSwap || locked) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const target = getSwipeTarget(gesture.coord, dx, dy);
    if (!target) return;

    gestureRef.current = { ...gesture, triggeredSwap: true };
    setDragging(null);
    trySwap(gesture.coord, target);
  };

  const handleTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    const gesture = gestureRef.current;
    if (!gesture.active || !gesture.coord || gesture.triggeredSwap || locked) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;
    const target = getSwipeTarget(gesture.coord, dx, dy);
    if (!target) return;

    gestureRef.current = { ...gesture, triggeredSwap: true };
    setDragging(null);
    trySwap(gesture.coord, target);
  };

  const handlePointerUp = () => {
    const gesture = gestureRef.current;
    if (gesture.active && !gesture.triggeredSwap && gesture.coord) {
      onTileClick(gesture.coord);
    }

    gestureRef.current = {
      active: false,
      coord: null,
      startX: 0,
      startY: 0,
      triggeredSwap: false,
    };
    setDragging(null);
  };

  return (
    <div className="game-grid-shell mx-auto w-full max-w-[560px] rounded-[28px] p-3 touch-none" style={{ touchAction: "none" }}>
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
              const isSelected = selected?.row === r && selected?.col === c;
              const isDragging = dragging?.row === r && dragging?.col === c;
              const isClearing = clearingSet.has(coordToKey(r, c));
              const vector = pendingSwapVector(r, c);
              const translateStyle =
                vector !== null ? { transform: `translate3d(${vector.x}%, ${vector.y}%, 0)` } : undefined;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  style={translateStyle}
                  className={`tile-shell relative aspect-square w-full overflow-hidden rounded-full border border-white/30 transition-transform duration-150 ${
                    isSelected ? "tile-selected" : ""
                  } ${isClearing ? "tile-clearing" : ""} ${pendingSwap ? "tile-swapping" : ""} ${isDragging ? "tile-dragging" : ""}`}
                  onPointerDown={(event) => {
                    handlePointerDown({ row: r, col: c }, event.clientX, event.clientY);
                  }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onTouchStart={(event) => {
                    const touch = event.changedTouches[0];
                    if (!touch) return;
                    handlePointerDown({ row: r, col: c }, touch.clientX, touch.clientY);
                  }}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handlePointerUp}
                  onTouchCancel={handlePointerUp}
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
