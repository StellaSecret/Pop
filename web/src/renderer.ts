import type { PlayEffects } from "./effects";
import {
  BALLOON_STATE,
  BALLOON_VIEW,
  OBSTACLE_KIND,
  OBSTACLE_VIEW,
  type MapId,
  type Snapshot,
} from "./engine";

const TAU = Math.PI * 2;

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private colors: string[] = [];
  private highlights: string[] = [];
  private readonly backgrounds = new Map<MapId, CanvasGradient>();
  private map: MapId = "night";
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Canvas 2D indisponible");
    }
    this.canvas = canvas;
    this.ctx = ctx;
  }

  setPalette(palette: string[]): void {
    this.colors = palette;
    this.highlights = palette.map(lighten);
  }

  setMap(map: MapId): void {
    this.map = map;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.dpr = Math.min(3, Math.max(1, dpr));
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);

    this.backgrounds.clear();

    const night = this.ctx.createLinearGradient(0, 0, this.cssWidth, this.cssHeight);
    night.addColorStop(0, "#0d1638");
    night.addColorStop(0.55, "#0a1129");
    night.addColorStop(1, "#111033");
    this.backgrounds.set("night", night);

    const forest = this.ctx.createLinearGradient(0, 0, 0, this.cssHeight);
    forest.addColorStop(0, "#7ec8f2");
    forest.addColorStop(0.55, "#b9e3c4");
    forest.addColorStop(1, "#2f6b45");
    this.backgrounds.set("forest", forest);

    const house = this.ctx.createLinearGradient(0, 0, 0, this.cssHeight);
    house.addColorStop(0, "#4b3348");
    house.addColorStop(0.66, "#2d2032");
    house.addColorStop(1, "#1d151b");
    this.backgrounds.set("house", house);
  }

  draw(snapshot: Snapshot, effects: PlayEffects): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground();
    this.drawObstacles(snapshot);

    const { view, headerLen, stride, records } = snapshot;
    let offset = headerLen;
    for (let i = 0; i < records; i += 1, offset += stride) {
      const x = view[offset + BALLOON_VIEW.x]!;
      const y = view[offset + BALLOON_VIEW.y]!;
      const radius = view[offset + BALLOON_VIEW.radius]!;
      const color = view[offset + BALLOON_VIEW.color]! | 0;

      if (view[offset + BALLOON_VIEW.state] === BALLOON_STATE.popped) {
        this.drawPop(x, y, radius, view[offset + BALLOON_VIEW.popProgress]!, color);
        continue;
      }
      this.drawBalloon(x, y, radius, color);
    }
    effects.draw(ctx);
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    ctx.fillStyle = this.backgrounds.get(this.map) ?? "#0a1129";
    ctx.fillRect(0, 0, w, h);

    if (this.map === "night") {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 42; i += 1) {
        ctx.fillRect((i * 137.5) % w, (i * 83.7) % (h * 0.7), 1.5, 1.5);
      }
      return;
    }

    if (this.map === "forest") {
      ctx.fillStyle = "rgba(255,246,188,0.75)";
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.16, 42, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "#4f9a6a";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.72);
      ctx.quadraticCurveTo(w * 0.22, h * 0.48, w * 0.48, h * 0.72);
      ctx.quadraticCurveTo(w * 0.72, h * 0.52, w, h * 0.70);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#2f6b45";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.82);
      ctx.quadraticCurveTo(w * 0.30, h * 0.62, w * 0.62, h * 0.84);
      ctx.quadraticCurveTo(w * 0.82, h * 0.68, w, h * 0.80);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      for (let i = 0; i < 8; i += 1) {
        const x = ((i + 0.5) * w) / 8;
        const base = h * 0.76 + (i % 2) * h * 0.03;
        const size = 26 + (i % 3) * 10;
        ctx.fillStyle = "#4a3527";
        ctx.fillRect(x - 4, base - 42, 8, 46);
        ctx.fillStyle = "#1f5338";
        ctx.beginPath();
        ctx.moveTo(x, base - 42 - size);
        ctx.lineTo(x - size * 0.65, base - 34);
        ctx.lineTo(x + size * 0.65, base - 34);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }

    ctx.fillStyle = "#1d151b";
    ctx.fillRect(0, h * 0.66, w, h * 0.34);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = h * 0.70; y < h; y += 18) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.fillStyle = "#8a6a55";
    ctx.fillRect(w * 0.70, h * 0.09, w * 0.20, h * 0.22);
    ctx.fillStyle = "#243b55";
    ctx.fillRect(w * 0.715, h * 0.105, w * 0.17, h * 0.19);
    ctx.strokeStyle = "#d6c3a5";
    ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.70, h * 0.09, w * 0.20, h * 0.22);
    ctx.beginPath();
    ctx.moveTo(w * 0.80, h * 0.09);
    ctx.lineTo(w * 0.80, h * 0.31);
    ctx.moveTo(w * 0.70, h * 0.20);
    ctx.lineTo(w * 0.90, h * 0.20);
    ctx.stroke();

    ctx.fillStyle = "#5d2f3e";
    ctx.beginPath();
    ctx.ellipse(w * 0.50, h * 0.86, w * 0.26, h * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(214,195,165,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawObstacles(snapshot: Snapshot): void {
    const { view, headerLen, stride, records, obstacleStride, obstacles } = snapshot;
    let offset = headerLen + records * stride;
    for (let i = 0; i < obstacles; i += 1, offset += obstacleStride) {
      this.drawObstacle(
        view[offset + OBSTACLE_VIEW.x]!,
        view[offset + OBSTACLE_VIEW.y]!,
        view[offset + OBSTACLE_VIEW.radius]!,
        view[offset + OBSTACLE_VIEW.hp]!,
        view[offset + OBSTACLE_VIEW.kind]! | 0,
      );
    }
  }

  private drawObstacle(x: number, y: number, radius: number, hp: number, kind: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.82 + hp * 0.18;
    ctx.strokeStyle = "rgba(15,20,25,0.65)";
    ctx.lineWidth = 2;

    if (kind === OBSTACLE_KIND.bush) {
      ctx.fillStyle = "#2f8b57";
      for (const [dx, dy, scale] of [
        [-0.45, 0.12, 0.70],
        [0.42, 0.10, 0.72],
        [0, -0.30, 0.85],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x + dx * radius, y + dy * radius, radius * scale, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    } else if (kind === OBSTACLE_KIND.rock) {
      ctx.fillStyle = "#7d8792";
      ctx.beginPath();
      ctx.moveTo(x - radius, y + radius * 0.45);
      ctx.lineTo(x - radius * 0.55, y - radius * 0.75);
      ctx.lineTo(x + radius * 0.35, y - radius * 0.9);
      ctx.lineTo(x + radius, y + radius * 0.25);
      ctx.lineTo(x + radius * 0.35, y + radius * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (kind === OBSTACLE_KIND.crate) {
      ctx.fillStyle = "#a56b3a";
      ctx.fillRect(x - radius * 0.8, y - radius * 0.8, radius * 1.6, radius * 1.6);
      ctx.strokeRect(x - radius * 0.8, y - radius * 0.8, radius * 1.6, radius * 1.6);
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.8, y - radius * 0.8);
      ctx.lineTo(x + radius * 0.8, y + radius * 0.8);
      ctx.moveTo(x + radius * 0.8, y - radius * 0.8);
      ctx.lineTo(x - radius * 0.8, y + radius * 0.8);
      ctx.stroke();
    } else if (kind === OBSTACLE_KIND.sofa) {
      ctx.fillStyle = "#7b4a75";
      ctx.fillRect(x - radius, y - radius * 0.4, radius * 2, radius * 1.4);
      ctx.fillStyle = "#986096";
      ctx.fillRect(x - radius, y - radius * 0.9, radius * 2, radius * 0.75);
      ctx.strokeRect(x - radius, y - radius * 0.9, radius * 2, radius * 1.9);
      ctx.beginPath();
      ctx.moveTo(x, y - radius * 0.9);
      ctx.lineTo(x, y + radius);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#8a5b36";
      ctx.fillRect(x - radius * 0.18, y, radius * 0.36, radius);
      ctx.fillRect(x - radius * 0.65, y + radius * 0.35, radius * 1.3, radius * 0.22);
      ctx.beginPath();
      ctx.ellipse(x, y - radius * 0.15, radius, radius * 0.50, 0, 0, TAU);
      ctx.fillStyle = "#b77b4a";
      ctx.fill();
      ctx.stroke();
    }

    if (hp < 0.99) {
      ctx.globalAlpha = 1 - hp;
      ctx.strokeStyle = "#2b0d0d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.5, y - radius * 0.7);
      ctx.lineTo(x - radius * 0.1, y - radius * 0.15);
      ctx.lineTo(x - radius * 0.35, y + radius * 0.25);
      ctx.moveTo(x + radius * 0.55, y - radius * 0.3);
      ctx.lineTo(x + radius * 0.15, y + radius * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBalloon(x: number, y: number, radius: number, color: number): void {
    const ctx = this.ctx;
    const base = this.colors[color] ?? "#ffffff";
    const highlight = this.highlights[color] ?? "#ffffff";

    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.32, y - radius * 0.34, radius * 0.2, radius * 0.32, -0.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.13, y + radius * 0.93);
    ctx.lineTo(x + radius * 0.13, y + radius * 0.93);
    ctx.lineTo(x, y + radius * 1.18);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + radius * 1.18);
    ctx.quadraticCurveTo(x + radius * 0.4, y + radius * 1.55, x, y + radius * 1.9);
    ctx.stroke();
  }

  private drawPop(x: number, y: number, radius: number, progress: number, color: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.strokeStyle = this.colors[color] ?? "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius * (1 + progress * 1.3), 0, TAU);
    ctx.stroke();

    if (progress < 0.6) {
      ctx.fillStyle = this.highlights[color] ?? "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, radius * (1 - progress / 0.6) * 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function lighten(hex: string): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const mix = (channel: number): number => Math.round(channel + (255 - channel) * 0.55);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
