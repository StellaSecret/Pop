import { BALLOON_STATE, BALLOON_VIEW, type Snapshot } from "./engine";

const TAU = Math.PI * 2;

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private colors: string[] = [];
  private highlights: string[] = [];
  private background: CanvasGradient | null = null;
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

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.dpr = Math.min(3, Math.max(1, dpr));
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);

    this.background = this.ctx.createLinearGradient(0, 0, this.cssWidth, this.cssHeight);
    this.background.addColorStop(0, "#0d1638");
    this.background.addColorStop(0.55, "#0a1129");
    this.background.addColorStop(1, "#111033");
  }

  draw(snapshot: Snapshot): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.background ?? "#0a1129";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

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
