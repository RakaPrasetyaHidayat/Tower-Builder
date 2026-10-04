import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import Phaser from "phaser";
import { TowerScene } from "../game/scenes/TowerScene";
import type { DropBlockData, TowerSceneConfig } from "../game/scenes/TowerScene";

export interface PhaserTowerGameHandle {
  triggerDrop: () => void;
  autoPlaceBlocks: (count: number) => void;
  syncTowerHeight: (height: number) => void;
  setGameActive: (active: boolean) => void;
  resetTiltSum: () => void;
}

interface PhaserTowerGameProps {
  isPlaying: boolean;
  isPaused: boolean;
  isFrozen: boolean;
  initialHeight?: number;
  onDropStarted: () => void;
  onDropBlock: (data: DropBlockData) => void;
  onTowerCollapsed: (data: { height: number; tiltSum: number; blocksFell: number; isAlive: boolean }) => void;
}

export const PhaserTowerGame = forwardRef<PhaserTowerGameHandle, PhaserTowerGameProps>(
  ({ isPlaying, isPaused, isFrozen, initialHeight, onDropStarted, onDropBlock, onTowerCollapsed }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<TowerScene | null>(null);
    const latestHeightRef = useRef(initialHeight ?? 0);
    const latestPausedRef = useRef(isPaused);
    const latestPlayingRef = useRef(isPlaying);
    const latestFrozenRef = useRef(isFrozen);
    latestHeightRef.current = initialHeight ?? 0;
    latestPausedRef.current = isPaused;
    latestPlayingRef.current = isPlaying;
    latestFrozenRef.current = isFrozen;

    // Ref untuk selalu punya callback terbaru tanpa restart Phaser
    const callbacksRef = useRef({ onDropStarted, onDropBlock, onTowerCollapsed });
    useEffect(() => {
      callbacksRef.current = { onDropStarted, onDropBlock, onTowerCollapsed };
    }, [onDropStarted, onDropBlock, onTowerCollapsed]);

    useImperativeHandle(ref, () => ({
      triggerDrop: () => {
        sceneRef.current?.triggerDrop();
      },
      autoPlaceBlocks: (count) => sceneRef.current?.autoPlaceBlocks(count),
      syncTowerHeight: (height) => sceneRef.current?.syncTowerHeight(height),
      setGameActive: (active) => sceneRef.current?.setGameActive(active),
      resetTiltSum: () => sceneRef.current?.resetTiltSum(),
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      // Config scene yang akan dipakai — pakai proxy agar callback selalu fresh
      const sceneConfig: TowerSceneConfig = {
        initialHeight: initialHeight ?? 0,
        onDropStarted: () => callbacksRef.current.onDropStarted(),
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
          // Set game active SEBELUM sync height agar spawnSwingingBlock bisa jalan
          scene.setGameActive(latestPlayingRef.current);
          scene.setPauseState(latestPausedRef.current);
          scene.setFrozenState(latestFrozenRef.current);
          scene.syncTowerHeight(latestHeightRef.current);
        }
      });

      return () => {
        game.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Mount sekali saja

    useEffect(() => {
      sceneRef.current?.syncTowerHeight(initialHeight ?? 0);
    }, [initialHeight]);

    // Sync pause/frozen state — pisahkan isPlaying (game active) dari isPaused (GM pause)
    useEffect(() => {
      if (sceneRef.current) {
        sceneRef.current.setGameActive(isPlaying);
        sceneRef.current.setPauseState(isPaused);
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
