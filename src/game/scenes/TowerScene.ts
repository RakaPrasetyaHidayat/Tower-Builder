import Phaser from "phaser";
import { findUnstableStackStart, overlapsSupport, projectedOffset } from "./towerPhysics";

export interface DropBlockData {
  precision: number;
  offsetRatio: number;
  tiltAngle: number;
  currentHeight: number;
  tiltSum: number;
  perfect: boolean;
  isAlive: boolean;
  isAutoPlace?: boolean;
}

export interface TowerSceneConfig {
  initialHeight?: number;
  onDropStarted?: () => void;
  onDropBlock?: (data: DropBlockData) => void;
  onTowerCollapsed?: (data: { height: number; tiltSum: number; blocksFell: number; isAlive: boolean }) => void;
}

// Stone brick palette for tower floors
const TOWER_FLOOR_THEMES = [
  { stone: 0xd6c7a1, brick: 0xb5a47e, window: 0x292524, roof: 0x92400e },
  { stone: 0xe2d4b7, brick: 0xc4b28f, window: 0x1e293b, roof: 0xb45309 },
  { stone: 0xd97706, brick: 0xb45309, window: 0x451a03, roof: 0x78350f },
  { stone: 0x94a3b8, brick: 0x64748b, window: 0x0f172a, roof: 0x334155 },
  { stone: 0xfde047, brick: 0xeab308, window: 0x713f12, roof: 0xa16207 },
];

export class TowerScene extends Phaser.Scene {
  private configData: TowerSceneConfig = {};

  // Dimensions
  private blockWidth = 170;
  private blockHeight = 46;
  private ropeLength = 190;
  private readonly MAX_TILT = 25;

  // Pendulum
  private anchorX = 200;
  private anchorY = 110;
  private pendulumAngle = 0;
  private pendulumOmega = 2.4;
  private pendulumThetaMax = 0.48;
  private swingTime = 0;

  // Active block
  private swingingBlock: Phaser.GameObjects.Container | null = null;
  private ropeGraphics: Phaser.GameObjects.Graphics | null = null;
  private isDropping = false;
  private isUnsupportedFall = false;
  private dropVy = 0;
  private dropVx = 0;

  // Tower
  private landedBlocks: {
    container: Phaser.GameObjects.Container;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
  }[] = [];
  private currentHeight = 0;
  private currentTiltSum = 0;

  // Flags
  private isCollapsed = false;
  private isResolvingFall = false;
  private isGameActive = true;
  private isPaused = false;
  private isFrozen = false;
  private autoBlocksQueued = 0;
  private isAutoPlacing = false;

  constructor() {
    super({ key: "TowerScene" });
  }

  private updateDimensions(w: number) {
    if (w < 420) {
      this.blockWidth = Math.max(120, Math.min(150, w * 0.42));
      this.blockHeight = 38;
      this.ropeLength = Math.max(130, Math.min(160, w * 0.45));
      this.pendulumThetaMax = 0.42;
    } else if (w < 640) {
      this.blockWidth = 155;
      this.blockHeight = 42;
      this.ropeLength = 170;
      this.pendulumThetaMax = 0.46;
    } else {
      this.blockWidth = 170;
      this.blockHeight = 46;
      this.ropeLength = 190;
      this.pendulumThetaMax = 0.48;
    }
  }

  init(data: TowerSceneConfig) {
    // Selalu reset game state flags
    this.currentTiltSum = 0;
    this.isCollapsed = false;
    this.isDropping = false;
    this.isUnsupportedFall = false;
    this.dropVy = 0;
    this.dropVx = 0;
    this.landedBlocks = [];
    this.swingingBlock = null;
    this.isGameActive = true;  // SELALU true saat init
    this.isPaused = false;
    this.isFrozen = false;
    this.isResolvingFall = false;

    // Update configData hanya jika ada data callback yang dipass
    if (data && (data.onDropBlock || data.onTowerCollapsed || data.initialHeight !== undefined)) {
      this.configData = data;
      this.currentHeight = data.initialHeight ?? 0;
    }
  }

  create() {
    const { width, height } = this.scale;
    this.updateDimensions(width);

    this.anchorX = width / 2;
    this.anchorY = height * 0.22;

    // Draw kingdom background
    this.drawKingdomBackground(width, height);

    // Foundation base
    const baseY = height - 100;
    const base = this.createTowerFloor(this.anchorX, baseY, this.blockWidth + 24, this.blockHeight + 14, 0, true);
    this.landedBlocks.push({
      container: base,
      x: this.anchorX,
      y: baseY,
      rotation: 0,
      width: this.blockWidth + 24,
      height: this.blockHeight + 14,
    });

    // Restore blocks if reconnected mid-game
    if (this.currentHeight > 0) {
      for (let i = 1; i <= this.currentHeight; i++) {
        const floorY = baseY - i * this.blockHeight;
        const floor = this.createTowerFloor(this.anchorX, floorY, this.blockWidth, this.blockHeight, i % TOWER_FLOOR_THEMES.length, false);
        this.landedBlocks.push({
          container: floor,
          x: this.anchorX,
          y: floorY,
          rotation: 0,
          width: this.blockWidth,
          height: this.blockHeight,
        });
      }
      // Reposition anchor above the restored tower
      this.anchorY = height * 0.22 - this.currentHeight * this.blockHeight;
      const scrollY = Math.max(0, (this.currentHeight - 2.5) * this.blockHeight);
      this.cameras.main.centerOn(this.scale.width / 2, (this.scale.height / 2) - scrollY);
    }

    this.ropeGraphics = this.add.graphics();

    this.spawnSwingingBlock();

    // Input: tap screen or space — only register once
    this.input.off("pointerdown");
    this.input.on("pointerdown", () => this.handleRelease());
    this.input.keyboard?.off("keydown-SPACE");
    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      if (event?.preventDefault) event.preventDefault();
      this.handleRelease();
    });

    this.scale.on("resize", (gs: Phaser.Structs.Size) => {
      this.anchorX = gs.width / 2;
    });
  }

  update(_time: number, delta: number) {
    if (this.isCollapsed) return;

    const dt = Math.min(delta / 1000, 0.05);

    // Pendulum swing — bergerak saat tidak drop dan tidak frozen
    if (!this.isDropping && !this.isResolvingFall && this.swingingBlock && !this.isFrozen) {
      this.swingTime += dt * this.pendulumOmega;
      this.pendulumAngle = Math.sin(this.swingTime) * this.pendulumThetaMax;

      const bx = this.anchorX + Math.sin(this.pendulumAngle) * this.ropeLength;
      const by = this.anchorY + Math.cos(this.pendulumAngle) * this.ropeLength;

      this.swingingBlock.setPosition(bx, by);
      this.swingingBlock.setRotation(this.pendulumAngle);

      // Draw rope
      if (this.ropeGraphics) {
        this.ropeGraphics.clear();
        this.ropeGraphics.lineStyle(3, 0x5c2b08, 0.9);
        this.ropeGraphics.beginPath();
        this.ropeGraphics.moveTo(this.anchorX, this.anchorY);
        this.ropeGraphics.lineTo(bx, by - this.blockHeight / 2);
        this.ropeGraphics.strokePath();
        this.ropeGraphics.lineStyle(1.5, 0xd97706, 0.7);
        this.ropeGraphics.beginPath();
        this.ropeGraphics.moveTo(this.anchorX, this.anchorY);
        this.ropeGraphics.lineTo(bx, by - this.blockHeight / 2);
        this.ropeGraphics.strokePath();
        this.ropeGraphics.fillStyle(0xf59e0b, 1);
        this.ropeGraphics.fillCircle(this.anchorX, this.anchorY, 4);
      }
    }

    // A released block completes its fall even if a freeze arrives mid-drop.
    if (this.isDropping && this.swingingBlock && this.isGameActive && !this.isPaused) {
      this.dropVy += 980 * dt;
      this.swingingBlock.y += this.dropVy * dt;
      this.swingingBlock.x += this.dropVx * dt;

      if (this.isUnsupportedFall) {
        if (this.swingingBlock.y > this.scale.height + this.blockHeight * 4) {
          this.finishUnsupportedFall();
        }
        return;
      }

      const top = this.landedBlocks[this.landedBlocks.length - 1];
      const targetY = this.getContactY(top, this.swingingBlock.x, this.swingingBlock.rotation);

      if (this.swingingBlock.y >= targetY) {
        this.swingingBlock.y = targetY;
        this.processLanding(top);
      }
    }

  }

  public triggerDrop() {
    this.handleRelease();
  }

  public autoPlaceBlocks(count: number) {
    if (!this.isGameActive || this.isCollapsed || this.isResolvingFall) return;
    this.autoBlocksQueued += Math.max(0, Math.floor(count));
    if (this.isAutoPlacing || this.autoBlocksQueued === 0) return;
    this.isAutoPlacing = true;

    const placeNext = () => {
      if (this.autoBlocksQueued <= 0 || this.isCollapsed || !this.isGameActive) {
        this.isAutoPlacing = false;
        return;
      }
      if (this.isPaused || this.isFrozen) {
        this.time.delayedCall(250, placeNext);
        return;
      }
      const topBlock = this.landedBlocks[this.landedBlocks.length - 1];
      if (!topBlock) {
        this.isAutoPlacing = false;
        return;
      }

      this.swingingBlock?.destroy();
      this.swingingBlock = null;
      const landY = this.getContactY(topBlock, topBlock.x, topBlock.rotation);
      const block = this.createTowerFloor(
        topBlock.x,
        landY,
        this.blockWidth,
        this.blockHeight,
        this.currentHeight % TOWER_FLOOR_THEMES.length,
        false
      );
      this.landedBlocks.push({
        container: block,
        x: topBlock.x,
        y: landY,
        rotation: topBlock.rotation,
        width: this.blockWidth,
        height: this.blockHeight,
      });
      this.currentHeight += 1;
      this.autoBlocksQueued -= 1;

      this.configData.onDropBlock?.({
        precision: 100,
        offsetRatio: 0,
        tiltAngle: 0,
        currentHeight: this.currentHeight,
        tiltSum: this.currentTiltSum,
        perfect: true,
        isAlive: true,
        isAutoPlace: true,
      });

      if (this.resolveTowerStability()) {
        this.autoBlocksQueued = 0;
        this.isAutoPlacing = false;
        return;
      }

      this.panCameraAndSpawn();
      if (this.autoBlocksQueued > 0) this.time.delayedCall(360, placeNext);
      else this.isAutoPlacing = false;
    };

    this.time.delayedCall(320, placeNext);
  }

  public syncTowerHeight(height: number) {
    const safeHeight = Math.max(0, Math.floor(height));
    if (safeHeight === this.currentHeight) return;

    while (this.currentHeight > safeHeight && this.landedBlocks.length > 1) {
      this.landedBlocks.pop()?.container.destroy();
      this.currentHeight -= 1;
    }
    while (this.currentHeight < safeHeight) {
      const topBlock = this.landedBlocks[this.landedBlocks.length - 1];
      if (!topBlock) return;
      const floorY = this.getContactY(topBlock, topBlock.x, topBlock.rotation);
      const floor = this.createTowerFloor(
        topBlock.x,
        floorY,
        this.blockWidth,
        this.blockHeight,
        this.currentHeight % TOWER_FLOOR_THEMES.length,
        false
      );
      this.landedBlocks.push({
        container: floor,
        x: topBlock.x,
        y: floorY,
        rotation: topBlock.rotation,
        width: this.blockWidth,
        height: this.blockHeight,
      });
      this.currentHeight += 1;
    }

    // Hancurkan blok pendulum yang sedang swing — akan di-spawn ulang di bawah
    if (this.swingingBlock) {
      this.swingingBlock.destroy();
      this.swingingBlock = null;
    }
    this.isDropping = false;
    this.isUnsupportedFall = false;
    this.isResolvingFall = false;
    this.dropVy = 0;
    this.dropVx = 0;
    // JANGAN reset currentTiltSum di sini — ini hanya sync visual height dari server
    // currentTiltSum harus tetap akumulatif selama sesi game berlangsung
    const scrollY = Math.max(0, (this.currentHeight - 2.5) * this.blockHeight);
    this.anchorY = this.scale.height * 0.22 - this.currentHeight * this.blockHeight;
    this.cameras.main.centerOn(this.scale.width / 2, (this.scale.height / 2) - scrollY);
    // Hanya spawn blok baru jika game aktif
    if (this.isGameActive) {
      this.spawnSwingingBlock();
    }
  }

  // Reset tiltSum — hanya dipanggil eksplisit saat game reset/baru mulai
  public resetTiltSum() {
    this.currentTiltSum = 0;
    this.isCollapsed = false;
  }

  private handleRelease() {
    // Izinkan drop hanya saat game aktif, tidak paused, tidak frozen
    if (this.isDropping || this.isCollapsed || this.isResolvingFall || !this.swingingBlock) return;
    if (!this.isGameActive || this.isPaused || this.isFrozen) return;

    try { navigator?.vibrate?.(25); } catch (_) { /* noop */ }

    this.configData.onDropStarted?.();
    this.isDropping = true;
    this.ropeGraphics?.clear();

    const tangent = Math.cos(this.swingTime) * this.pendulumThetaMax * this.pendulumOmega * 48;
    this.dropVx = tangent;
    this.dropVy = 80;
  }

  private processLanding(topBlock: {
    container: Phaser.GameObjects.Container;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
  }) {
    if (!this.swingingBlock) return;

    const bx = this.swingingBlock.x;
    const supportTopX = topBlock.x + Math.sin(topBlock.rotation) * topBlock.height / 2;
    const supportTopY = topBlock.y - Math.cos(topBlock.rotation) * topBlock.height / 2;
    const tangentOffset = projectedOffset(bx, this.swingingBlock.y, supportTopX, supportTopY, topBlock.rotation);
    if (!overlapsSupport(
      topBlock.width,
      this.blockWidth,
      this.blockHeight,
      this.swingingBlock.rotation,
      topBlock.rotation,
      bx - supportTopX,
      this.swingingBlock.y - supportTopY
    )) {
      this.isDropping = true;
      this.isUnsupportedFall = true;
      this.showFeedback(bx, this.swingingBlock.y, false, 0, "JATUH!");
      return;
    }

    // Land on the rotated support face, not on an assumed horizontal layer.
    this.isDropping = false;

    const ratio = Math.max(-1, Math.min(1, tangentOffset / Math.max(1, topBlock.width / 2)));
    const precision = Math.max(0, Math.round(100 - Math.abs(ratio) * 100));
    const towerIsSteady = Math.abs(this.currentTiltSum) < 15;
    const perfect = Math.abs(ratio) < 0.08 && towerIsSteady;

    const clampedRad = topBlock.rotation;
    const landY = this.getContactY(topBlock, bx, clampedRad);
    this.swingingBlock.setPosition(bx, landY);
    this.swingingBlock.setRotation(clampedRad);

    // Small bounce tween to make landing feel physical
    this.tweens.add({
      targets: this.swingingBlock,
      y: landY - 4,
      duration: 55,
      ease: "Sine.easeOut",
      yoyo: true,
      onComplete: () => {
        this.swingingBlock?.setPosition(bx, landY);
      },
    });

    this.createDustPuff(bx, landY + this.blockHeight / 2);

    this.landedBlocks.push({
      container: this.swingingBlock,
      x: bx,
      y: landY,
      rotation: clampedRad, // simpan dalam radian (konsisten dengan Phaser)
      width: this.blockWidth,
      height: this.blockHeight,
    });

    this.swingingBlock = null;
    this.currentHeight += 1;
    this.currentTiltSum = this.calculateTowerTilt();

    this.showFeedback(bx, landY - 24, perfect, this.currentTiltSum);

    this.configData.onDropBlock?.({
      precision,
      offsetRatio: ratio,
      tiltAngle: this.currentTiltSum,
      currentHeight: this.currentHeight,
      tiltSum: this.currentTiltSum,
      perfect,
      isAlive: true,
    });

    if (this.resolveTowerStability()) return;

    if (Math.abs(this.currentTiltSum) > this.MAX_TILT) {
      this.currentTiltSum = Math.sign(this.currentTiltSum) * this.MAX_TILT;
    }

    if (this.isCollapsed) {
      return;
    }

    this.panCameraAndSpawn();
  }

  private finishUnsupportedFall() {
    this.isDropping = false;
    this.isUnsupportedFall = false;
    const falling = this.swingingBlock;
    this.swingingBlock = null;
    falling?.destroy();
    if (!this.isCollapsed) this.spawnSwingingBlock();
  }

  private resolveTowerStability() {
    const unstableStack = findUnstableStackStart(this.landedBlocks);
    if (!unstableStack) return false;
    this.toppleTower(unstableStack.startIndex, unstableStack.direction);
    return true;
  }

  private toppleTower(startIndex: number, direction: number) {
    const fallingBlocks = this.landedBlocks.slice(startIndex);
    if (fallingBlocks.length === 0) return;

    this.isResolvingFall = true;
    this.isDropping = false;
    this.ropeGraphics?.clear();
    this.swingingBlock?.destroy();
    this.swingingBlock = null;
    this.cameras.main.shake(320, 0.012);

    let completedFalls = 0;
    fallingBlocks.forEach((block, index) => {
      this.tweens.add({
        targets: block.container,
        x: block.x + direction * (60 + Math.min(index, 14) * 7),
        y: block.y + this.blockHeight * (2 + Math.min(index, 14) * 0.12),
        rotation: block.rotation + direction * 0.35,
        alpha: 0,
        duration: 420 + Math.min(index, 14) * 12,
        ease: "Cubic.easeIn",
        onComplete: () => {
          completedFalls += 1;
          if (completedFalls === fallingBlocks.length) {
            this.finishTopple(startIndex, fallingBlocks.length);
          }
        },
      });
    });
  }

  private finishTopple(startIndex: number, blocksFell: number) {
    this.landedBlocks.splice(startIndex, blocksFell).forEach((block) => block.container.destroy());
    this.currentHeight = this.landedBlocks.length - 1;
    this.currentTiltSum = this.calculateTowerTilt();
    this.isCollapsed = this.currentHeight === 0;
    this.isResolvingFall = false;

    this.configData.onTowerCollapsed?.({
      height: this.currentHeight,
      tiltSum: this.currentTiltSum,
      blocksFell,
      isAlive: !this.isCollapsed,
    });

    this.anchorX = this.scale.width / 2;
    this.anchorY = this.scale.height * 0.22 - this.currentHeight * this.blockHeight;
    const scrollY = Math.max(0, (this.currentHeight - 2.5) * this.blockHeight);
    this.cameras.main.pan(
      this.scale.width / 2,
      (this.scale.height / 2) - scrollY,
      420,
      "Cubic.easeInOut"
    );

    if (this.isCollapsed) {
      this.anchorY = this.scale.height * 0.22;
      return;
    }
    this.time.delayedCall(440, () => this.spawnSwingingBlock());
  }

  private calculateTowerTilt() {
    if (this.currentHeight <= 0) return 0;
    const base = this.landedBlocks[0];
    const centerOfMass = this.calculateTowerCenterOfMass();
    if (!centerOfMass) return 0;
    const verticalCenter = base.y - centerOfMass.y;
    const angle = Phaser.Math.RadToDeg(Math.atan2(centerOfMass.x - base.x, verticalCenter));
    return Math.max(-this.MAX_TILT, Math.min(this.MAX_TILT, angle));
  }

  private calculateTowerCenterOfMass() {
    let totalMass = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (const block of this.landedBlocks.slice(1)) {
      const mass = block.width * block.height;
      totalMass += mass;
      weightedX += block.x * mass;
      weightedY += block.y * mass;
    }

    if (totalMass === 0) return null;
    return { x: weightedX / totalMass, y: weightedY / totalMass };
  }

  private getContactY(
    support: {
      container: Phaser.GameObjects.Container;
      x: number;
      y: number;
      rotation: number;
      width: number;
      height: number;
    },
    childX: number,
    childRotation: number
  ) {
    const supportAngle = support.rotation;
    const supportTopX = support.x + Math.sin(supportAngle) * support.height / 2;
    const supportTopY = support.y - Math.cos(supportAngle) * support.height / 2;
    const relativeAngle = childRotation - supportAngle;
    const childBottomExtent =
      (this.blockHeight / 2) * Math.cos(relativeAngle) +
      (this.blockWidth / 2) * Math.abs(Math.sin(relativeAngle));
    const safeCosine = Math.max(0.85, Math.cos(supportAngle));
    return supportTopY + Math.tan(supportAngle) * (childX - supportTopX) - childBottomExtent / safeCosine;
  }

  private panCameraAndSpawn() {
    this.anchorY -= this.blockHeight;

    const scrollY = Math.max(0, (this.currentHeight - 2.5) * this.blockHeight);
    this.cameras.main.pan(
      this.scale.width / 2,
      (this.scale.height / 2) - scrollY,
      350,
      "Quad.easeOut"
    );

    this.time.delayedCall(280, () => this.spawnSwingingBlock());
  }

  private spawnSwingingBlock() {
    if (this.isCollapsed || !this.isGameActive) return;

    // Pastikan state drop bersih setiap spawn blok baru
    this.isDropping = false;
    this.dropVy = 0;
    this.dropVx = 0;
    // Reset swing time agar ayunan mulai smooth dari tengah
    this.swingTime = 0;

    const idx = this.currentHeight % TOWER_FLOOR_THEMES.length;
    this.swingingBlock = this.createTowerFloor(
      this.anchorX,
      this.anchorY + this.ropeLength,
      this.blockWidth,
      this.blockHeight,
      idx,
      false
    );

    this.pendulumOmega = Math.min(3.6, 2.4 + this.currentHeight * 0.04);
  }

  // ─── KINGDOM BACKGROUND ───────────────────────────────────────
  private drawKingdomBackground(w: number, h: number) {
    const bg = this.add.graphics();

    // Space (very high altitude)
    bg.fillStyle(0x020617, 1);
    bg.fillRect(0, -h * 6, w, h * 3);

    // Space → dark blue transition
    bg.fillGradientStyle(0x020617, 0x020617, 0x0f172a, 0x0f172a, 1);
    bg.fillRect(0, -h * 3, w, h * 2);

    // Dark blue → sky blue
    bg.fillGradientStyle(0x0f172a, 0x0f172a, 0x0ea5e9, 0x38bdf8, 1);
    bg.fillRect(0, -h, w, h);

    // Clear sky
    bg.fillGradientStyle(0x0ea5e9, 0x38bdf8, 0x7dd3fc, 0xbae6fd, 1);
    bg.fillRect(0, 0, w, h * 0.7);

    // Warm horizon glow
    bg.fillGradientStyle(0xbae6fd, 0xbae6fd, 0xfef3c7, 0xfef3c7, 1);
    bg.fillRect(0, h * 0.65, w, h * 0.15);

    // ── Ground: Royal courtyard ──
    // Main grass
    bg.fillStyle(0x4ade80, 1);
    bg.fillRect(0, h - 70, w, 35);

    // Darker grass bottom
    bg.fillStyle(0x22c55e, 1);
    bg.fillRect(0, h - 35, w, 15);

    // Soil
    bg.fillStyle(0x78350f, 1);
    bg.fillRect(0, h - 20, w, 20);

    // Cobblestone path under tower
    const pathW = this.blockWidth + 60;
    const pathX = w / 2 - pathW / 2;
    bg.fillStyle(0xd1c4a0, 1);
    bg.fillRect(pathX, h - 70, pathW, 35);
    // Stone pattern
    bg.lineStyle(1, 0xb8a888, 0.5);
    for (let sx = pathX + 10; sx < pathX + pathW - 10; sx += 18) {
      bg.beginPath();
      bg.moveTo(sx, h - 70);
      bg.lineTo(sx, h - 35);
      bg.strokePath();
    }
    bg.beginPath();
    bg.moveTo(pathX, h - 52);
    bg.lineTo(pathX + pathW, h - 52);
    bg.strokePath();

    // ── Kingdom decorative elements ──

    // Left palace wall / gate tower
    this.drawGateTower(bg, 30, h - 70, 36, 80, false);

    // Right palace wall / gate tower
    this.drawGateTower(bg, w - 30, h - 70, 36, 80, true);

    // Stone wall segments connecting gate towers
    bg.fillStyle(0xcbbfa0, 1);
    bg.fillRect(0, h - 70, 30 - 18, 35);
    bg.fillRect(w - 30 + 18, h - 70, 30 - 18, 35);

    // Royal banners on gate towers
    this.drawBanner(bg, 30, h - 155, 0xdc2626); // left red banner
    this.drawBanner(bg, w - 30, h - 155, 0x1d4ed8); // right blue banner

    // Trees / landscaping on far sides
    for (let tx = 10; tx < w - 10; tx += 24) {
      const distFromCenter = Math.abs(tx - w / 2);
      if (distFromCenter > pathW / 2 + 40 && distFromCenter < w / 2 - 50) {
        bg.fillStyle(0x15803d, 1);
        bg.fillTriangle(tx, h - 108, tx - 12, h - 70, tx + 12, h - 70);
        bg.fillTriangle(tx, h - 92, tx - 14, h - 55, tx + 14, h - 55);
      }
    }

    // ── Clouds ──
    const cloud = this.add.graphics();
    cloud.fillStyle(0xffffff, 0.6);

    // Cloud 1 (low)
    cloud.fillCircle(w * 0.12, h * 0.35, 22);
    cloud.fillCircle(w * 0.12 + 22, h * 0.35 - 4, 28);
    cloud.fillCircle(w * 0.12 + 46, h * 0.35, 20);

    // Cloud 2 (higher)
    cloud.fillCircle(w * 0.82, h * 0.2, 26);
    cloud.fillCircle(w * 0.82 + 24, h * 0.2 - 5, 32);
    cloud.fillCircle(w * 0.82 + 50, h * 0.2, 24);

    // ── Moon (deep altitude) ──
    const moonG = this.add.graphics();
    moonG.fillStyle(0xfef9c3, 1);
    moonG.fillCircle(w * 0.25, -h * 4, 44);
    moonG.fillStyle(0xfde68a, 0.4);
    moonG.fillCircle(w * 0.25 - 12, -h * 4 - 8, 10);
    moonG.fillCircle(w * 0.25 + 10, -h * 4 + 12, 7);
    moonG.fillCircle(w * 0.25 + 14, -h * 4 - 14, 6);

    // Stars
    for (let i = 0; i < 35; i++) {
      const sx = Phaser.Math.Between(0, w);
      const sy = Phaser.Math.Between(-h * 6, -h * 2.5);
      bg.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.3, 0.85));
      bg.fillCircle(sx, sy, Phaser.Math.FloatBetween(0.8, 2.2));
    }
  }

  private drawGateTower(g: Phaser.GameObjects.Graphics, cx: number, groundY: number, w: number, h: number, _mirror: boolean) {
    // Tower body
    g.fillStyle(0xc4a87c, 1);
    g.fillRect(cx - w / 2, groundY - h, w, h);
    // Stone lines
    g.lineStyle(1, 0xa3855f, 0.5);
    for (let row = groundY - h + 10; row < groundY; row += 14) {
      g.beginPath();
      g.moveTo(cx - w / 2, row);
      g.lineTo(cx + w / 2, row);
      g.strokePath();
    }
    // Battlements (crenellations)
    g.fillStyle(0xb89a6e, 1);
    const crenW = 8;
    for (let c = cx - w / 2; c < cx + w / 2; c += crenW * 2) {
      g.fillRect(c, groundY - h - 10, crenW, 10);
    }
    // Small window
    g.fillStyle(0x1e293b, 1);
    g.fillRect(cx - 5, groundY - h + 20, 10, 14);
    g.fillCircle(cx, groundY - h + 20, 5);
  }

  private drawBanner(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    // Pole
    g.fillStyle(0x78716c, 1);
    g.fillRect(x - 1.5, y - 10, 3, 50);
    // Flag
    g.fillStyle(color, 0.85);
    g.fillTriangle(x + 1, y - 5, x + 20, y + 8, x + 1, y + 20);
    // Flag border
    g.lineStyle(1, 0xfde047, 0.7);
    g.beginPath();
    g.moveTo(x + 1, y - 5);
    g.lineTo(x + 20, y + 8);
    g.lineTo(x + 1, y + 20);
    g.strokePath();
  }

  // ─── TOWER FLOOR BLOCK ────────────────────────────────────────
  private createTowerFloor(x: number, y: number, w: number, h: number, themeIdx: number, isBase: boolean): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const t = TOWER_FLOOR_THEMES[themeIdx];

    // Body
    const body = this.add.rectangle(0, 0, w, h, t.stone);
    body.setStrokeStyle(2, t.brick, 1);
    c.add(body);

    const g = this.add.graphics();

    // Brick lines
    g.lineStyle(1, t.brick, 0.6);
    g.beginPath();
    g.moveTo(-w / 2, -h / 6);
    g.lineTo(w / 2, -h / 6);
    g.moveTo(-w / 2, h / 4);
    g.lineTo(w / 2, h / 4);
    g.strokePath();

    // Vertical seams
    for (let bx = -w / 2 + 20; bx < w / 2 - 10; bx += 32) {
      g.beginPath();
      g.moveTo(bx, -h / 2);
      g.lineTo(bx, -h / 6);
      g.moveTo(bx + 16, -h / 6);
      g.lineTo(bx + 16, h / 4);
      g.moveTo(bx, h / 4);
      g.lineTo(bx, h / 2);
      g.strokePath();
    }

    if (isBase) {
      // Entrance door
      g.fillStyle(0x451a03, 1);
      g.fillRect(-18, -h / 2 + 10, 36, h - 10);
      g.fillCircle(0, -h / 2 + 10, 18);
      g.lineStyle(2, 0xd97706, 1);
      g.strokeRect(-18, -h / 2 + 10, 36, h - 10);
      g.strokeCircle(0, -h / 2 + 10, 18);
      // Door handles
      g.fillStyle(0xfde047, 1);
      g.fillCircle(-6, 4, 2.5);
      g.fillCircle(6, 4, 2.5);
    } else {
      // Windows
      const winW = 18, winH = 22;
      [-w / 4, w / 4].forEach((wx) => {
        g.fillStyle(t.window, 1);
        g.fillRect(wx - winW / 2, -winH / 2 + 4, winW, winH - 4);
        g.fillCircle(wx, -winH / 2 + 4, winW / 2);

        g.lineStyle(1.5, t.brick, 1);
        g.strokeRect(wx - winW / 2, -winH / 2 + 4, winW, winH - 4);
        g.strokeCircle(wx, -winH / 2 + 4, winW / 2);

        // Panes
        g.lineStyle(1, 0x64748b, 0.7);
        g.beginPath();
        g.moveTo(wx, -winH / 2);
        g.lineTo(wx, winH / 2);
        g.moveTo(wx - winW / 2, 0);
        g.lineTo(wx + winW / 2, 0);
        g.strokePath();

        // Warm light glow
        if ((this.currentHeight + wx) % 2 === 0) {
          g.fillStyle(0xfde047, 0.4);
          g.fillRect(wx - winW / 2 + 2, -winH / 2 + 6, winW - 4, winH - 8);
        }
      });
    }

    // Top rim
    g.fillStyle(t.brick, 0.85);
    g.fillRect(-w / 2, -h / 2, w, 3.5);

    c.add(g);
    return c;
  }

  // ─── EFFECTS ──────────────────────────────────────────────────
  private createDustPuff(x: number, y: number) {
    const d = this.add.graphics();
    d.fillStyle(0xd6c7a1, 0.5);
    d.fillCircle(x - 28, y, 5);
    d.fillCircle(x + 28, y, 5);
    d.fillCircle(x, y, 7);

    this.tweens.add({
      targets: d,
      alpha: 0,
      scaleX: 2,
      scaleY: 0.6,
      duration: 300,
      onComplete: () => d.destroy(),
    });
  }

  private showFeedback(x: number, y: number, perfect: boolean, tilt: number, text?: string) {
    const msg = text || (perfect ? "SEMPURNA!" : `${tilt > 0 ? "+" : ""}${tilt.toFixed(1)}°`);
    const color = perfect ? "#fde047" : Math.abs(this.currentTiltSum) > 20 ? "#f87171" : "#e2e8f0";

    const txt = this.add.text(x, y, msg, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: perfect ? "18px" : "14px",
      fontStyle: "bold",
      color,
      stroke: "#0f172a",
      strokeThickness: 3,
    });
    txt.setOrigin(0.5);

    this.tweens.add({
      targets: txt,
      y: y - 36,
      alpha: 0,
      duration: 900,
      onComplete: () => txt.destroy(),
    });
  }

  // ─── PUBLIC API ───────────────────────────────────────────────
  public setPauseState(paused: boolean) { this.isPaused = paused; }
  public setFrozenState(frozen: boolean) { this.isFrozen = frozen; }
  public setGameActive(active: boolean) {
    this.isGameActive = active;
    if (!active) {
      this.swingingBlock?.destroy();
      this.swingingBlock = null;
      this.ropeGraphics?.clear();
      this.isDropping = false;
      this.isUnsupportedFall = false;
      this.dropVy = 0;
      this.dropVx = 0;
      this.autoBlocksQueued = 0;
      this.isAutoPlacing = false;
      return;
    }
    if (!this.swingingBlock && !this.isResolvingFall && !this.isCollapsed) {
      this.spawnSwingingBlock();
    }
  }
  public resetScene() { this.scene.restart(); }
}
