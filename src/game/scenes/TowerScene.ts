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
  initialHeight?: number;
  onDropBlock?: (data: DropBlockData) => void;
  onTowerCollapsed?: (data: { height: number; tiltSum: number }) => void;
  onBlockMissed?: () => void;
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
  private readonly MAX_TILT = 30;

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
  private dropVy = 0;
  private dropVx = 0;

  // Tower
  private landedBlocks: { container: Phaser.GameObjects.Container; x: number; y: number; rotation: number }[] = [];
  private currentHeight = 0;
  private currentTiltSum = 0;

  // Flags
  private isCollapsed = false;
  private isGameActive = true;
  private isPaused = false;
  private isFrozen = false;

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
    this.dropVy = 0;
    this.dropVx = 0;
    this.landedBlocks = [];
    this.swingingBlock = null;
    this.isGameActive = true;  // SELALU true saat init
    this.isPaused = false;
    this.isFrozen = false;

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
    this.landedBlocks.push({ container: base, x: this.anchorX, y: baseY, rotation: 0 });

    // Restore blocks if reconnected mid-game
    if (this.currentHeight > 0) {
      for (let i = 1; i <= this.currentHeight; i++) {
        const floorY = baseY - i * this.blockHeight;
        const floor = this.createTowerFloor(this.anchorX, floorY, this.blockWidth, this.blockHeight, i % TOWER_FLOOR_THEMES.length, false);
        this.landedBlocks.push({ container: floor, x: this.anchorX, y: floorY, rotation: 0 });
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
      this.updateDimensions(gs.width);
      this.anchorX = gs.width / 2;
    });
  }

  update(_time: number, delta: number) {
    if (this.isCollapsed) return;

    const dt = Math.min(delta / 1000, 0.05);

    // Pendulum selalu bergerak (visual preview) kecuali saat beku
    // Hanya drop yang dicegah saat paused/tidak aktif
    if (!this.isDropping && this.swingingBlock && !this.isFrozen) {
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

    // Dropping physics — hanya berjalan saat game aktif dan tidak paused
    if (this.isDropping && this.swingingBlock && this.isGameActive && !this.isPaused) {
      this.dropVy += 980 * dt;
      this.swingingBlock.y += this.dropVy * dt;
      this.swingingBlock.x += this.dropVx * dt;

      const top = this.landedBlocks[this.landedBlocks.length - 1];
      const targetY = top.y - this.blockHeight;

      if (this.swingingBlock.y >= targetY) {
        this.swingingBlock.y = targetY;
        this.processLanding(top);
      }
    }
  }

  public triggerDrop() {
    this.handleRelease();
  }

  private handleRelease() {
    // Izinkan drop hanya saat game aktif dan tidak paused/frozen
    if (this.isDropping || this.isCollapsed || this.isFrozen || !this.swingingBlock) return;
    if (!this.isGameActive || this.isPaused) return;

    try { navigator?.vibrate?.(25); } catch (_) { /* noop */ }

    this.isDropping = true;
    this.ropeGraphics?.clear();

    const tangent = Math.cos(this.swingTime) * this.pendulumThetaMax * this.pendulumOmega * 48;
    this.dropVx = tangent;
    this.dropVy = 80;
  }

  private processLanding(topBlock: { container: Phaser.GameObjects.Container; x: number; y: number; rotation: number }) {
    if (!this.swingingBlock) return;

    const bx = this.swingingBlock.x;
    const diff = bx - topBlock.x;
    const maxDiff = (this.blockWidth / 2) + 26;

    // Miss: block fell completely off the side
    if (Math.abs(diff) > maxDiff) {
      this.handleMiss();
      return;
    }

    // Land — block is already snapped to targetY by the update loop
    this.isDropping = false;
    const landY = topBlock.y - this.blockHeight;

    const ratio = Math.max(-1, Math.min(1, diff / (this.blockWidth / 2)));
    const precision = Math.max(0, Math.round(100 - Math.abs(ratio) * 100));
    const perfect = Math.abs(ratio) < 0.08;

    const tilt = perfect ? 0 : ratio * 5.2;
    this.currentTiltSum += tilt;

    // Clamp tilt sum display
    const clampedTilt = Math.max(-this.MAX_TILT, Math.min(this.MAX_TILT, this.currentTiltSum));
    this.swingingBlock.setRotation(Phaser.Math.DegToRad(clampedTilt));

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
      rotation: Phaser.Math.DegToRad(clampedTilt),
    });

    this.swingingBlock = null;

    this.currentHeight += 1;

    this.showFeedback(bx, landY - 24, perfect, tilt);

    this.configData.onDropBlock?.({
      precision,
      offsetRatio: ratio,
      tiltAngle: tilt,
      currentHeight: this.currentHeight,
      tiltSum: this.currentTiltSum,
      perfect,
      isAlive: true,
    });

    // Collapse check
    if (Math.abs(this.currentTiltSum) >= this.MAX_TILT) {
      this.triggerCollapse();
      return;
    }

    this.panCameraAndSpawn();
  }

  private handleMiss() {
    if (!this.swingingBlock) return;

    this.isDropping = false;
    const falling = this.swingingBlock;
    this.swingingBlock = null;

    this.tweens.add({
      targets: falling,
      alpha: 0,
      y: falling.y + 350,
      duration: 600,
      onComplete: () => falling.destroy(),
    });

    this.showFeedback(falling.x, falling.y, false, 0, "MELESET!");
    this.configData.onBlockMissed?.();

    this.time.delayedCall(650, () => {
      if (!this.isCollapsed) this.spawnSwingingBlock();
    });
  }

  private triggerCollapse() {
    this.isCollapsed = true;
    this.isDropping = false;
    this.ropeGraphics?.clear();

    this.cameras.main.shake(800, 0.03);

    const dir = this.currentTiltSum > 0 ? 1 : -1;
    this.landedBlocks.forEach((item, i) => {
      if (i === 0) return;
      this.tweens.add({
        targets: item.container,
        x: item.x + dir * (130 + i * 30),
        y: item.y + 440 + i * 30,
        rotation: item.rotation + dir * 1.6,
        alpha: 0,
        duration: 900 + i * 80,
        ease: "Cubic.easeIn",
      });
    });

    this.showFeedback(this.anchorX, this.anchorY + 120, false, 0, "RUNTUH!");

    this.configData.onTowerCollapsed?.({
      height: this.currentHeight,
      tiltSum: this.currentTiltSum,
    });
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

    this.isDropping = false;
    this.dropVy = 0;
    this.dropVx = 0;

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
  public resetScene() { this.scene.restart(); }
}
