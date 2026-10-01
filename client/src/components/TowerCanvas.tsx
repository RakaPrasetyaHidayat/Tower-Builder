import React, { useEffect, useRef, useState, useCallback } from "react";
import type { BlockPlacePayload } from "../types/game";
import { Sparkles } from "lucide-react";

interface TowerCanvasProps {
  isPlaying: boolean;
  isPaused: boolean;
  scoreMultiplier: number;
  onPlaceBlock: (payload: BlockPlacePayload) => void;
  onGameOver: () => void;
}

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface FallingPiece extends Block {
  vy: number;
  rotation: number;
  vr: number;
  opacity: number;
}

interface FloatingText {
  text: string;
  x: number;
  y: number;
  opacity: number;
  color: string;
}

export const TowerCanvas: React.FC<TowerCanvasProps> = ({
  isPlaying,
  isPaused,
  scoreMultiplier,
  onPlaceBlock,
  onGameOver,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [combo, setCombo] = useState(0);
  const [towerHeight, setTowerHeight] = useState(0);
  const [localScore, setLocalScore] = useState(0);
  const [isDead, setIsDead] = useState(false);

  // References for animation state
  const stateRef = useRef({
    placedBlocks: [] as Block[],
    currentBlock: null as (Block & { vx: number; dir: number }) | null,
    fallingPieces: [] as FallingPiece[],
    floatingTexts: [] as FloatingText[],
    cameraY: 0,
    targetCameraY: 0,
    blockHeight: 28,
    baseWidth: 200,
    combo: 0,
    score: 0,
    height: 0,
    isDead: false,
    speed: 3.5,
  });

  const getBlockColor = (h: number) => {
    const hue = (h * 12 + 200) % 360;
    return `hsl(${hue}, 88%, 62%)`;
  };

  // Reset or init game
  const resetGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const blockH = 28;
    const initialWidth = Math.min(220, width * 0.6);

    const baseBlock: Block = {
      x: (width - initialWidth) / 2,
      y: height - 120,
      width: initialWidth,
      height: blockH,
      color: getBlockColor(0),
    };

    stateRef.current = {
      placedBlocks: [baseBlock],
      currentBlock: {
        x: 0,
        y: baseBlock.y - blockH,
        width: initialWidth,
        height: blockH,
        color: getBlockColor(1),
        vx: 3.6,
        dir: 1,
      },
      fallingPieces: [],
      floatingTexts: [],
      cameraY: 0,
      targetCameraY: 0,
      blockHeight: blockH,
      baseWidth: initialWidth,
      combo: 0,
      score: 0,
      height: 0,
      isDead: false,
      speed: 3.6,
    };

    setCombo(0);
    setTowerHeight(0);
    setLocalScore(0);
    setIsDead(false);
  }, []);

  // Drop block handler
  const dropBlock = useCallback(() => {
    if (!isPlaying || isPaused || stateRef.current.isDead) return;

    const state = stateRef.current;
    const { currentBlock, placedBlocks, blockHeight } = state;
    if (!currentBlock) return;

    const prevBlock = placedBlocks[placedBlocks.length - 1];
    const diff = currentBlock.x - prevBlock.x;
    const tolerance = 4.0; // Perfect tolerance in pixels

    let isPerfect = false;
    let newWidth = currentBlock.width;
    let placedX = currentBlock.x;

    if (Math.abs(diff) <= tolerance) {
      // PERFECT placement!
      isPerfect = true;
      placedX = prevBlock.x;
      state.combo += 1;

      // Small width restoration reward if shrunken
      if (newWidth < state.baseWidth) {
        newWidth = Math.min(state.baseWidth, newWidth + 6);
      }

      state.floatingTexts.push({
        text: `PERFECT! x${state.combo}`,
        x: placedX + newWidth / 2,
        y: currentBlock.y - 10,
        opacity: 1,
        color: "#38bdf8",
      });
    } else if (diff > 0) {
      // Overhang to the right
      const overhang = diff;
      if (overhang >= currentBlock.width) {
        // Complete Miss!
        handleFall(currentBlock);
        return;
      }

      newWidth = currentBlock.width - overhang;
      placedX = currentBlock.x;
      state.combo = 0;

      // Add falling piece
      state.fallingPieces.push({
        x: currentBlock.x + newWidth,
        y: currentBlock.y,
        width: overhang,
        height: blockHeight,
        color: currentBlock.color,
        vy: 1,
        rotation: 0,
        vr: 0.04,
        opacity: 1,
      });
    } else {
      // Overhang to the left
      const overhang = -diff;
      if (overhang >= currentBlock.width) {
        // Complete Miss!
        handleFall(currentBlock);
        return;
      }

      newWidth = currentBlock.width - overhang;
      placedX = prevBlock.x;
      state.combo = 0;

      // Add falling piece
      state.fallingPieces.push({
        x: currentBlock.x,
        y: currentBlock.y,
        width: overhang,
        height: blockHeight,
        color: currentBlock.color,
        vy: 1,
        rotation: 0,
        vr: -0.04,
        opacity: 1,
      });
    }

    // Successfully placed
    const placed: Block = {
      x: placedX,
      y: currentBlock.y,
      width: newWidth,
      height: blockHeight,
      color: currentBlock.color,
    };

    state.placedBlocks.push(placed);
    state.height += 1;

    // Score computation
    const basePoints = 100;
    const comboPoints = state.combo * 50;
    const addedScore = Math.round((basePoints + comboPoints) * scoreMultiplier);
    state.score += addedScore;

    // Speed progression
    state.speed = Math.min(8.5, 3.6 + state.height * 0.08);

    // Update camera target to follow tower top
    const canvas = canvasRef.current;
    if (canvas) {
      const topBlockY = placed.y;
      const idealScreenY = canvas.height * 0.55;
      if (topBlockY - state.cameraY < idealScreenY) {
        state.targetCameraY = topBlockY - idealScreenY;
      }
    }

    // Spawn next block
    const nextHeight = state.height + 1;
    const spawnFromLeft = nextHeight % 2 === 0;
    const canvasW = canvas?.width || 400;

    state.currentBlock = {
      x: spawnFromLeft ? -newWidth : canvasW,
      y: placed.y - blockHeight,
      width: newWidth,
      height: blockHeight,
      color: getBlockColor(nextHeight),
      vx: state.speed,
      dir: spawnFromLeft ? 1 : -1,
    };

    setCombo(state.combo);
    setTowerHeight(state.height);
    setLocalScore(state.score);

    onPlaceBlock({
      height: state.height,
      diff,
      width: newWidth,
      scoreAdded: addedScore,
      combo: state.combo,
      isAlive: true,
      perfect: isPerfect,
    });
  }, [isPlaying, isPaused, scoreMultiplier, onPlaceBlock]);

  const handleFall = (missedBlock: Block) => {
    const state = stateRef.current;
    state.isDead = true;
    state.currentBlock = null;

    // Turn missed block into falling debris
    state.fallingPieces.push({
      ...missedBlock,
      vy: 2,
      rotation: 0,
      vr: 0.08,
      opacity: 1,
    });

    setIsDead(true);
    onPlaceBlock({
      height: state.height,
      diff: 999,
      width: 0,
      scoreAdded: 0,
      combo: 0,
      isAlive: false,
      perfect: false,
    });
    onGameOver();
  };

  // Keyboard Space listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        dropBlock();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dropBlock]);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Resize handling for high-DPI screens
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        resetGame();
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      // Clear with background gradient (deep space / twilight atmosphere)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#090d16");
      grad.addColorStop(0.5, "#0f172a");
      grad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Smooth camera interpolation
      const state = stateRef.current;
      state.cameraY += (state.targetCameraY - state.cameraY) * 0.1;

      ctx.save();
      ctx.translate(0, -state.cameraY);

      // 1. Draw Placed Blocks
      for (let i = 0; i < state.placedBlocks.length; i++) {
        const b = state.placedBlocks[i];
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(b.x, b.y, b.width, b.height);

        // Highlight top rim
        ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
        ctx.fillRect(b.x, b.y, b.width, 2);
      }

      // 2. Draw Moving Block (if alive and playing)
      if (state.currentBlock && !state.isDead) {
        const b = state.currentBlock;
        if (!isPaused && isPlaying) {
          b.x += b.vx * b.dir;
          if (b.x + b.width > width + 40) {
            b.dir = -1;
          } else if (b.x < -40) {
            b.dir = 1;
          }
        }

        ctx.fillStyle = b.color;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 14;
        ctx.fillRect(b.x, b.y, b.width, b.height);

        // Top highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillRect(b.x, b.y, b.width, 3);
      }

      // 3. Draw Falling Pieces (Physics Slices)
      for (let i = state.fallingPieces.length - 1; i >= 0; i--) {
        const p = state.fallingPieces[i];
        p.vy += 0.45; // gravity
        p.y += p.vy;
        p.rotation += p.vr;
        p.opacity -= 0.015;

        if (p.opacity <= 0 || p.y > height + state.cameraY + 200) {
          state.fallingPieces.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }

      // 4. Draw Floating Combo / Perfect texts
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= 1.2;
        ft.opacity -= 0.02;

        if (ft.opacity <= 0) {
          state.floatingTexts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.opacity);
        ctx.font = "bold 16px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore(); // Restore camera translation
      ctx.restore(); // Restore DPR scale

      animationFrameId = requestAnimationFrame(render);
    };

    resetGame();
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [resetGame, isPaused, isPlaying]);

  return (
    <div
      onClick={dropBlock}
      className="relative w-full h-[62vh] sm:h-[68vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 cursor-pointer select-none group"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating combo pill */}
      {combo > 1 && !isDead && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/50 backdrop-blur-md text-sky-300 text-xs font-black tracking-widest uppercase animate-bounce flex items-center gap-1.5 shadow-lg shadow-sky-500/20 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Combo {combo}x</span>
        </div>
      )}

      {/* Click instruction banner for touch/desktop */}
      {!isDead && isPlaying && !isPaused && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-medium text-slate-400/80 bg-slate-950/60 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-800/80 pointer-events-none">
          Klik layar atau tekan Spasi untuk meletakkan balok
        </div>
      )}

      {/* Dead / Fallen Overlay */}
      {isDead && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn pointer-events-auto">
          <div className="text-3xl font-black text-rose-500 mb-1 tracking-wider uppercase">
            Tower Runtuh!
          </div>
          <div className="text-xs text-slate-400 mb-4">
            Balok meleset dari pondasi menara
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs space-y-1.5 w-full max-w-xs mb-4">
            <div className="flex justify-between">
              <span className="text-slate-400">Tinggi Akhir:</span>
              <span className="font-bold text-sky-300">{towerHeight} Blok</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Skor:</span>
              <span className="font-bold text-emerald-400">{localScore}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Menunggu giliran round berikutnya dari Game Master...
          </div>
        </div>
      )}
    </div>
  );
};
