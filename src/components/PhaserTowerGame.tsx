import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import Phaser from "phaser";
import { TowerScene } from "../game/scenes/TowerScene";
import type { DropBlockData, TowerSceneConfig } from "../game/scenes/TowerScene";

export interface PhaserTowerGameHandle {
  triggerDrop: () => void;
}

interface PhaserTowerGameProps {
  isPlaying: boolean;
  isPaused: boolean;
  isFrozen: boolean;
  initialHeight?: number;
  onDropBlock: (data: DropBlockData) => void;
  onTowerCollapsed: (data: { height: number; tiltSum: number }) => void;
}

export const PhaserTowerGame = forwardRef<PhaserTowerGameHandle, PhaserTowerGameProps>(
  ({ isPlaying, isPaused, isFrozen, initialHeight, onDropBlock, onTowerCollapsed }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<TowerScene | null>(null);

    // Ref untuk selalu punya callback terbaru tanpa restart Phaser
    const callbacksRef = useRef({ onDropBlock, onTowerCollapsed });
    useEffect(() => {
      callbacksRef.current = { onDropBlock, onTowerCollapsed };
    }, [onDropBlock, onTowerCollapsed]);

    useImperativeHandle(ref, () => ({
      triggerDrop: () => {
        sceneRef.current?.triggerDrop();
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      // Config scene yang akan dipakai — pakai proxy agar callback selalu fresh
      const sceneConfig: TowerSceneConfig = {
        initialHeight: initialHeight ?? 0,
        onDropBlock: (data) => callbacksRef.current.onDropBlock(data),
        onTowerCollapsed: (data) => callbacksRef.current.onTowerCollapsed(data),
      };

      // Buat subclass TowerScene dengan config sudah tertanam
      // Ini memastikan configData tersedia SEBELUM create() berjalan
      class ConfiguredTowerScene extends TowerScene {
        constructor() {
          super();
          // Inject config langsung ke instance sebelum Phaser lifecycle berjalan
          (this as any).configData = sceneConfig;
          (this as any).currentHeight = sceneConfig.initialHeight ?? 0;
        }
      }

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
        callbacks: {
          postBoot: (game) => {
            // Cegah Phaser pause saat tab tidak aktif
            game.events.off("blur");
            game.events.off("focus");
          },
        },
        input: {
          touch: { capture: true },
        },
        scene: [ConfiguredTowerScene],
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;

      // Ambil referensi scene setelah ready
      game.events.once("ready", () => {
        const scenes = game.scene.getScenes(false);
        const scene = scenes[0] as TowerScene;
        if (scene) {
          sceneRef.current = scene;
          // JANGAN set pause berdasarkan props awal — biarkan scene aktif
          // State akan di-sync lewat useEffect di bawah saat props berubah
          scene.setPauseState(false);  // default: aktif
          scene.setFrozenState(false);
        }
      });

      return () => {
        game.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Mount sekali saja

    // Sync pause/frozen state
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
