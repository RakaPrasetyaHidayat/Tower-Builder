import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import Phaser from "phaser";
import { TowerScene } from "../game/scenes/TowerScene";
import type { DropBlockData } from "../game/scenes/TowerScene";

export interface PhaserTowerGameHandle {
  triggerDrop: () => void;
}

interface PhaserTowerGameProps {
  isPlaying: boolean;
  isPaused: boolean;
  isFrozen: boolean;
  onDropBlock: (data: DropBlockData) => void;
  onTowerCollapsed: (data: { height: number; tiltSum: number }) => void;
}

export const PhaserTowerGame = forwardRef<PhaserTowerGameHandle, PhaserTowerGameProps>(
  (
    { isPlaying, isPaused, isFrozen, onDropBlock, onTowerCollapsed },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<TowerScene | null>(null);

    useImperativeHandle(ref, () => ({
      triggerDrop: () => {
        if (sceneRef.current) {
          sceneRef.current.triggerDrop();
        }
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: "#0c1524",
        transparent: false,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        // Prevent Phaser from pausing on blur/visibility change
        callbacks: {
          postBoot: (game) => {
            game.events.off("blur");
            game.events.off("focus");
          },
        },
        // Disable right-click context menu on canvas
        input: {
          touch: {
            capture: true,
          },
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
        className="absolute inset-0 w-full h-full select-none touch-none"
        style={{ touchAction: "none" }}
      />
    );
  }
);
