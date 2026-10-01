import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import { TowerScene } from "../game/scenes/TowerScene";
import type { DropBlockData } from "../game/scenes/TowerScene";

interface PhaserTowerGameProps {
  isPlaying: boolean;
  isPaused: boolean;
  isFrozen: boolean;
  onDropBlock: (data: DropBlockData) => void;
  onTowerCollapsed: (data: { height: number; tiltSum: number }) => void;
}

export const PhaserTowerGame: React.FC<PhaserTowerGameProps> = ({
  isPlaying,
  isPaused,
  isFrozen,
  onDropBlock,
  onTowerCollapsed,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<TowerScene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: containerRef.current.clientWidth || 380,
      height: containerRef.current.clientHeight || 560,
      backgroundColor: "#070b14",
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [TowerScene],
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    game.events.once("ready", () => {
      const scene = game.scene.getScene("TowerScene") as TowerScene;
      sceneRef.current = scene;
      scene.init({
        onDropBlock,
        onTowerCollapsed,
      });
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Sync state changes with scene
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setPauseState(isPaused || !isPlaying);
      sceneRef.current.setFrozenState(isFrozen);
    }
  }, [isPlaying, isPaused, isFrozen]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[64vh] sm:h-[70vh] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-indigo-950/40 select-none"
    />
  );
};
