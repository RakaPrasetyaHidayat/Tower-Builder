import Phaser from "phaser";

export interface DropBlockData {
  precision: number;
  offsetRatio: number;
  tiltAngle: number;
  currentHeight: number;
  tiltSum: number;
  perfect: boolean;
  isAlive: boolean;
}

export interface TowerSceneConfig {
  onDropBlock?: (data: DropBlockData) => void;
  onTowerCollapsed?: (data: { height: number; tiltSum: number }) => void;
  onBlockMissed?: () => void;
}

// Tower Bloxx / Babel Tower Indonesian Palace & Stone Brick Palette
const TOWER_FLOOR_THEMES = [
  { stone: 0xd6c7a1, brickLine: 0xb5a47e, window: 0x292524, roof: 0x92400e, name: "Batu Candi Klasik" },
  { stone: 0xe2d4b7, brickLine: 0xc4b28f, window: 0x1e293b, roof: 0xb45309, name: "Batu Keraton" },
  { stone: 0xd97706, brickLine: 0xb45309, window: 0x451a03, roof: 0x78350f, name: "Bata Trowulan" },
  { stone: 0x94a3b8, brickLine: 0x64748b, window: 0x0f172a, roof: 0x334155, name: "Batu Andesit Hitam" },
  { stone: 0xfde047, brickLine: 0xeab308, window: 0x713f12, roof: 0xa16207, name: "Batu Emas Pusaka" },
];

export class TowerScene extends Phaser.Scene {
  private configData: TowerSceneConfig = {};

  // Dimensions
  private readonly BLOCK_WIDTH = 170;
  private readonly BLOCK_HEIGHT = 46;
  private readonly ROPE_LENGTH = 190;
  private readonly MAX_TILT_THRESHOLD = 30; // 30 degrees max tilt

  // Pendulum variables
  private anchorX = 200;
  private anchorY = 110;
  private pendulumAngle = 0;
  private pendulumOmega = 2.4;
  private pendulumThetaMax = 0.52;
  private swingTime = 0;

  // Active Block State
  private swingingBlock: Phaser.GameObjects.Container | null = null;
  private ropeGraphics: Phaser.GameObjects.Graphics | null = null;
  private isDropping = false;
  private dropVy = 0;
  private dropVx = 0;

  // Tower Structure
  private landedBlocks: {
    container: Phaser.GameObjects.Container;
    x: number;
    y: number;
    rotation: number;
  }[] = [];
  private currentHeight = 0;
  private currentTiltSum = 0;

  // Background layers
  private bgSkyGraphics: Phaser.GameObjects.Graphics | null = null;
  private moonObject: Phaser.GameObjects.Container | null = null;

  // Game Control Flags
  private isCollapsed = false;
  private isGameActive = true;
  private isPaused = false;
  private isFrozen = false;

  constructor() {
    super({ key: "TowerScene" });
  }

  init(data: TowerSceneConfig) {
    this.configData = data;
    this.currentHeight = 0;
    this.currentTiltSum = 0;
    this.isCollapsed = false;
    this.isDropping = false;
    this.landedBlocks = [];
  }

  create() {
    const { width, height } = this.scale;
    this.anchorX = width / 2;
    this.anchorY = height * 0.26;

    // 1. Draw Multi-Altitude Sky Background (Day Blue -> Sunset -> Space Moon)
    this.createAltitudeBackground(width, height);

    // 2. Foundation Base Ground & Palace Entrance (Pondasi Candi / Gerbang Pintu Kayu)
    const baseY = height - 90;
    const baseContainer = this.createTowerFloor(this.anchorX, baseY, this.BLOCK_WIDTH + 24, this.BLOCK_HEIGHT + 14, 0, true);

    this.landedBlocks.push({
      container: baseContainer,
      x: this.anchorX,
      y: baseY,
      rotation: 0,
    });

    this.ropeGraphics = this.add.graphics();

    // Spawn first swinging block
    this.spawnSwingingBlock();

    // Input handlers
    this.input.on("pointerdown", () => this.handleRelease());
    this.input.keyboard?.on("keydown-SPACE", () => this.handleRelease());
  }

  update(_time: number, delta: number) {
    if (this.isCollapsed || this.isPaused || !this.isGameActive) return;

    const dt = delta / 1000;

    // 1. Swining State
    if (!this.isDropping && this.swingingBlock && !this.isFrozen) {
      this.swingTime += dt * this.pendulumOmega;
      this.pendulumAngle = Math.sin(this.swingTime) * this.pendulumThetaMax;

      const blockX = this.anchorX + Math.sin(this.pendulumAngle) * this.ROPE_LENGTH;
      const blockY = this.anchorY + Math.cos(this.pendulumAngle) * this.ROPE_LENGTH;

      this.swingingBlock.setPosition(blockX, blockY);
      this.swingingBlock.setRotation(this.pendulumAngle);

      // Draw Coconut Fiber Rope & Golden Hook Ring
      if (this.ropeGraphics) {
        this.ropeGraphics.clear();
        // Rope shadow & fiber twine
        this.ropeGraphics.lineStyle(3.5, 0x5c2b08, 0.95);
        this.ropeGraphics.beginPath();
        this.ropeGraphics.moveTo(this.anchorX, this.anchorY);
        this.ropeGraphics.lineTo(blockX, blockY - this.BLOCK_HEIGHT / 2);
        this.ropeGraphics.strokePath();

        this.ropeGraphics.lineStyle(1.5, 0xd97706, 0.9);
        this.ropeGraphics.beginPath();
        this.ropeGraphics.moveTo(this.anchorX, this.anchorY);
        this.ropeGraphics.lineTo(blockX, blockY - this.BLOCK_HEIGHT / 2);
        this.ropeGraphics.strokePath();

        // Hook ring
        this.ropeGraphics.fillStyle(0xf59e0b, 1);
        this.ropeGraphics.fillCircle(this.anchorX, this.anchorY, 5);
      }
    }

    // 2. Dropping Physics State
    if (this.isDropping && this.swingingBlock) {
      this.dropVy += 980 * dt;
      this.swingingBlock.y += this.dropVy * dt;
      this.swingingBlock.x += this.dropVx * dt;

      const topLanded = this.landedBlocks[this.landedBlocks.length - 1];
      const targetLandingY = topLanded.y - this.BLOCK_HEIGHT;

      if (this.swingingBlock.y >= targetLandingY) {
        this.processLanding(topLanded);
      }
    }
  }

  private handleRelease() {
    if (!this.isGameActive || this.isDropping || this.isCollapsed || this.isPaused || this.isFrozen) {
      return;
    }

    this.isDropping = true;
    if (this.ropeGraphics) {
      this.ropeGraphics.clear();
    }

    const tangentialSpeed = Math.cos(this.swingTime) * this.pendulumThetaMax * this.pendulumOmega * 48;
    this.dropVx = tangentialSpeed;
    this.dropVy = 75;
  }

  private processLanding(topBlock: { container: Phaser.GameObjects.Container; x: number; y: number; rotation: number }) {
    if (!this.swingingBlock) return;

    const blockX = this.swingingBlock.x;
    const diff = blockX - topBlock.x;
    const maxAllowedDiff = (this.BLOCK_WIDTH / 2) + 26;

    // 1. Total Miss (Falls off tower)
    if (Math.abs(diff) > maxAllowedDiff) {
      this.handleMiss();
      return;
    }

    // 2. Successful Landing with Tilt
    this.isDropping = false;
    const landedY = topBlock.y - this.BLOCK_HEIGHT;
    this.swingingBlock.setPosition(blockX, landedY);

    const offsetRatio = Math.max(-1, Math.min(1, diff / (this.BLOCK_WIDTH / 2)));
    const precision = Math.max(0, Math.round(100 - Math.abs(offsetRatio) * 100));
    const isPerfect = Math.abs(offsetRatio) < 0.08;

    const blockTilt = isPerfect ? 0 : offsetRatio * 5.2;
    this.currentTiltSum += blockTilt;

    const radRotation = Phaser.Math.DegToRad(this.currentTiltSum);
    this.swingingBlock.setRotation(radRotation);

    // Dust particles puff at landing spot
    this.createLandingDust(blockX, landedY + this.BLOCK_HEIGHT / 2);

    this.landedBlocks.push({
      container: this.swingingBlock,
      x: blockX,
      y: landedY,
      rotation: radRotation,
    });

    this.currentHeight += 1;

    // Floating feedback text
    this.showFeedbackText(blockX, landedY - 24, isPerfect, blockTilt);

    this.configData.onDropBlock?.({
      precision,
      offsetRatio,
      tiltAngle: blockTilt,
      currentHeight: this.currentHeight,
      tiltSum: this.currentTiltSum,
      perfect: isPerfect,
      isAlive: true,
    });

    // 3. Check for Collapse
    if (Math.abs(this.currentTiltSum) >= this.MAX_TILT_THRESHOLD) {
      this.triggerCollapse();
      return;
    }

    // 4. Smooth Camera Elevation & Spawn Next Floor
    this.panCameraAndRaiseAnchor();
  }

  private handleMiss() {
    if (!this.swingingBlock) return;

    this.isDropping = false;
    const fallingRef = this.swingingBlock;
    this.swingingBlock = null;

    this.tweens.add({
      targets: fallingRef,
      alpha: 0,
      y: fallingRef.y + 350,
      duration: 650,
      onComplete: () => fallingRef.destroy(),
    });

    this.showFeedbackText(fallingRef.x, fallingRef.y, false, 0, "MELESET!");
    this.configData.onBlockMissed?.();

    this.time.delayedCall(700, () => {
      if (!this.isCollapsed) {
        this.spawnSwingingBlock();
      }
    });
  }

  private triggerCollapse() {
    this.isCollapsed = true;
    this.isDropping = false;
    if (this.ropeGraphics) this.ropeGraphics.clear();

    this.cameras.main.shake(850, 0.03);

    const toppleDir = this.currentTiltSum > 0 ? 1 : -1;
    this.landedBlocks.forEach((item, idx) => {
      if (idx === 0) return;
      this.tweens.add({
        targets: item.container,
        x: item.x + toppleDir * (130 + idx * 30),
        y: item.y + 440 + idx * 30,
        rotation: item.rotation + toppleDir * 1.6,
        alpha: 0,
        duration: 900 + idx * 80,
        ease: "Cubic.easeIn",
      });
    });

    this.showFeedbackText(this.anchorX, this.anchorY + 120, false, 0, "MENARA RUNTUH!");

    this.configData.onTowerCollapsed?.({
      height: this.currentHeight,
      tiltSum: this.currentTiltSum,
    });
  }

  private panCameraAndRaiseAnchor() {
    this.anchorY -= this.BLOCK_HEIGHT;

    const targetScrollY = Math.max(0, (this.currentHeight - 2.5) * this.BLOCK_HEIGHT);
    this.cameras.main.pan(
      this.scale.width / 2,
      (this.scale.height / 2) - targetScrollY,
      380,
      "Quad.easeOut"
    );

    this.time.delayedCall(300, () => {
      this.spawnSwingingBlock();
    });
  }

  private spawnSwingingBlock() {
    if (this.isCollapsed || !this.isGameActive) return;

    this.isDropping = false;
    this.dropVy = 0;
    this.dropVx = 0;

    const themeIndex = this.currentHeight % TOWER_FLOOR_THEMES.length;
    this.swingingBlock = this.createTowerFloor(
      this.anchorX,
      this.anchorY + this.ROPE_LENGTH,
      this.BLOCK_WIDTH,
      this.BLOCK_HEIGHT,
      themeIndex,
      false
    );

    this.pendulumOmega = Math.min(3.6, 2.4 + this.currentHeight * 0.04);
  }

  // Create Detailed Tower Bloxx / Babel Tower Stone Brick Floor with Arched Windows
  private createTowerFloor(
    x: number,
    y: number,
    w: number,
    h: number,
    themeIdx: number,
    isBase: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const theme = TOWER_FLOOR_THEMES[themeIdx];

    // 1. Stone Brick Body
    const body = this.add.rectangle(0, 0, w, h, theme.stone);
    body.setStrokeStyle(2, theme.brickLine, 1);
    container.add(body);

    const graphics = this.add.graphics();

    // 2. Brick Pattern Lines
    graphics.lineStyle(1, theme.brickLine, 0.65);
    // Horizontal row lines
    graphics.beginPath();
    graphics.moveTo(-w / 2, -h / 6);
    graphics.lineTo(w / 2, -h / 6);
    graphics.moveTo(-w / 2, h / 4);
    graphics.lineTo(w / 2, h / 4);
    graphics.strokePath();

    // Vertical brick seams
    for (let bx = -w / 2 + 20; bx < w / 2 - 10; bx += 32) {
      graphics.beginPath();
      graphics.moveTo(bx, -h / 2);
      graphics.lineTo(bx, -h / 6);
      graphics.moveTo(bx + 16, -h / 6);
      graphics.lineTo(bx + 16, h / 4);
      graphics.moveTo(bx, h / 4);
      graphics.lineTo(bx, h / 2);
      graphics.strokePath();
    }

    if (isBase) {
      // Wooden Arched Entrance Door (Pintu Kayu Jati Keraton)
      graphics.fillStyle(0x451a03, 1);
      graphics.fillRect(-18, -h / 2 + 10, 36, h - 10);
      graphics.fillCircle(0, -h / 2 + 10, 18);
      graphics.lineStyle(2, 0xd97706, 1);
      graphics.strokeRect(-18, -h / 2 + 10, 36, h - 10);
      graphics.strokeCircle(0, -h / 2 + 10, 18);

      // Golden door handles
      graphics.fillStyle(0xfde047, 1);
      graphics.fillCircle(-6, 4, 2.5);
      graphics.fillCircle(6, 4, 2.5);
    } else {
      // Double Arched Windows (Jendela Lengkung Khas Tower Bloxx)
      const winW = 18;
      const winH = 22;
      const winOffsets = [-w / 4, w / 4];

      winOffsets.forEach((wx) => {
        // Window frame
        graphics.fillStyle(theme.window, 1);
        graphics.fillRect(wx - winW / 2, -winH / 2 + 4, winW, winH - 4);
        graphics.fillCircle(wx, -winH / 2 + 4, winW / 2);

        // Window stone arch frame
        graphics.lineStyle(1.5, theme.brickLine, 1);
        graphics.strokeRect(wx - winW / 2, -winH / 2 + 4, winW, winH - 4);
        graphics.strokeCircle(wx, -winH / 2 + 4, winW / 2);

        // Window pane dividers
        graphics.lineStyle(1, 0x64748b, 0.8);
        graphics.beginPath();
        graphics.moveTo(wx, -winH / 2);
        graphics.lineTo(wx, winH / 2);
        graphics.moveTo(wx - winW / 2, 0);
        graphics.lineTo(wx + winW / 2, 0);
        graphics.strokePath();

        // Cozy interior golden light glow in some windows
        if ((this.currentHeight + wx) % 2 === 0) {
          graphics.fillStyle(0xfde047, 0.45);
          graphics.fillRect(wx - winW / 2 + 2, -winH / 2 + 6, winW - 4, winH - 8);
        }
      });
    }

    // Top rim molding
    graphics.fillStyle(theme.brickLine, 0.9);
    graphics.fillRect(-w / 2, -h / 2, w, 3.5);

    container.add(graphics);
    return container;
  }

  private createLandingDust(x: number, y: number) {
    const dust = this.add.graphics();
    dust.fillStyle(0xd6c7a1, 0.6);
    dust.fillCircle(x - 30, y, 6);
    dust.fillCircle(x + 30, y, 6);
    dust.fillCircle(x, y, 8);

    this.tweens.add({
      targets: dust,
      alpha: 0,
      scaleX: 2.2,
      scaleY: 0.8,
      duration: 350,
      onComplete: () => dust.destroy(),
    });
  }

  private showFeedbackText(x: number, y: number, isPerfect: boolean, tilt: number, customText?: string) {
    let msg = customText || (isPerfect ? "SEMPURNA! (0°)" : `MIRING ${tilt > 0 ? "+" : ""}${tilt.toFixed(1)}°`);
    let colorStr = isPerfect ? "#fde047" : Math.abs(this.currentTiltSum) > 20 ? "#f87171" : "#fef08a";

    const text = this.add.text(x, y, msg, {
      fontFamily: "Inter, sans-serif",
      fontSize: isPerfect ? "18px" : "14px",
      fontStyle: "bold",
      color: colorStr,
      stroke: "#1c1917",
      strokeThickness: 3.5,
    });
    text.setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy(),
    });
  }

  // Multi-Altitude Background Gradient: Ground Grass -> Blue Sky -> Space Night with Moon
  private createAltitudeBackground(width: number, height: number) {
    this.bgSkyGraphics = this.add.graphics();

    // 1. Deep Space Night Sky at Top (Heights > 15)
    this.bgSkyGraphics.fillStyle(0x020617, 1);
    this.bgSkyGraphics.fillRect(0, -height * 6, width, height * 3);

    // 2. Sunset / Atmosphere Transition (Heights 8 - 15)
    this.bgSkyGraphics.fillGradientStyle(0x020617, 0x020617, 0x1e3a8a, 0x1e3a8a, 1);
    this.bgSkyGraphics.fillRect(0, -height * 3, width, height * 2);

    // 3. Clear Sunny Blue Sky (Heights 0 - 8)
    this.bgSkyGraphics.fillGradientStyle(0x1e3a8a, 0x1e3a8a, 0x38bdf8, 0x60a5fa, 1);
    this.bgSkyGraphics.fillRect(0, -height, width, height * 2);

    // 4. Moon Container at High Altitude (Just like reference image!)
    this.moonObject = this.add.container(width * 0.28, -height * 4.2);
    const moonGraphics = this.add.graphics();

    // Glowing crater moon
    moonGraphics.fillStyle(0xfef08a, 1);
    moonGraphics.fillCircle(0, 0, 48);
    // Craters
    moonGraphics.fillStyle(0xeab308, 0.45);
    moonGraphics.fillCircle(-14, -10, 11);
    moonGraphics.fillCircle(12, 14, 8);
    moonGraphics.fillCircle(16, -16, 7);
    moonGraphics.fillCircle(-8, 18, 9);

    this.moonObject.add(moonGraphics);

    // 5. Ground Level Green Grass & Trees (Altitude 0)
    const ground = this.add.graphics();
    // Green savannah lawn
    ground.fillStyle(0x4ade80, 1);
    ground.fillRect(0, height - 60, width, 60);

    // Brown soil underground
    ground.fillStyle(0x78350f, 1);
    ground.fillRect(0, height - 16, width, 16);

    // Pine / Coconut Tree Silhouettes at ground
    for (let tx = 10; tx < width - 10; tx += 28) {
      if (Math.abs(tx - width / 2) > 110) {
        ground.fillStyle(0x15803d, 1);
        ground.fillTriangle(tx, height - 90, tx - 14, height - 40, tx + 14, height - 40);
        ground.fillTriangle(tx, height - 70, tx - 16, height - 25, tx + 16, height - 25);
      }
    }

    // Floating Clouds at mid-level
    const cloudGraphics = this.add.graphics();
    cloudGraphics.fillStyle(0xffffff, 0.65);
    // Cloud 1
    cloudGraphics.fillCircle(width * 0.15, -height * 0.5, 26);
    cloudGraphics.fillCircle(width * 0.15 + 24, -height * 0.5 - 4, 32);
    cloudGraphics.fillCircle(width * 0.15 + 50, -height * 0.5, 24);
    // Cloud 2
    cloudGraphics.fillCircle(width * 0.8, -height * 1.2, 28);
    cloudGraphics.fillCircle(width * 0.8 + 26, -height * 1.2 - 6, 36);
    cloudGraphics.fillCircle(width * 0.8 + 54, -height * 1.2, 26);

    // Starry sparkles in space
    for (let i = 0; i < 40; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(-height * 6, -height * 2.5);
      this.bgSkyGraphics.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.3, 0.9));
      this.bgSkyGraphics.fillCircle(sx, sy, Phaser.Math.FloatBetween(1, 2.5));
    }
  }

  public setPauseState(paused: boolean) {
    this.isPaused = paused;
  }

  public setFrozenState(frozen: boolean) {
    this.isFrozen = frozen;
  }

  public resetScene() {
    this.scene.restart();
  }
}
