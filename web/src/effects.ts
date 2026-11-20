import { BALLOON_STATE, BALLOON_VIEW, type Engine, type Snapshot } from "./engine";

export interface EffectCounts {
  bullets: number;
  flames: number;
  grenades: number;
  blasts: number;
}

interface Bullet {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  life: number;
  radius: number;
}

interface Flame {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

interface Grenade {
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  duration: number;
  arc: number;
}

interface Blast {
  x: number;
  y: number;
  age: number;
  life: number;
  radius: number;
  small: boolean;
}

const BULLET_SPEED = 900;
const FLAME_RANGE = 700;
const FLAME_HALF_ANGLE = 0.23;
const FLAME_TICK = 0.09;
const GRENADE_DURATION = 0.7;
const GRENADE_ARC = 120;
const GRENADE_RADIUS = 70;
const MAX_BULLETS = 80;
const MAX_FLAMES = 240;
const MAX_GRENADES = 12;
const MAX_BLASTS = 32;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export class PlayEffects {
  private readonly bullets: Bullet[] = [];
  private readonly flames: Flame[] = [];
  private readonly grenades: Grenade[] = [];
  private readonly blasts: Blast[] = [];
  private flameTimer = 0;

  constructor(private readonly onPop: (popped: boolean) => void) {}

  clear(): void {
    this.bullets.length = 0;
    this.flames.length = 0;
    this.grenades.length = 0;
    this.blasts.length = 0;
    this.flameTimer = 0;
  }

  counts(): EffectCounts {
    return {
      bullets: this.bullets.length,
      flames: this.flames.length,
      grenades: this.grenades.length,
      blasts: this.blasts.length,
    };
  }

  fireBullet(sx: number, sy: number, tx: number, ty: number, radius = 0): void {
    const dx = tx - sx;
    const dy = ty - sy;
    const life = Math.max(0.04, Math.hypot(dx, dy) / BULLET_SPEED);
    this.bullets.push({
      x: sx,
      y: sy,
      tx,
      ty,
      vx: dx / life,
      vy: dy / life,
      life,
      radius,
    });
    if (this.bullets.length > MAX_BULLETS) {
      this.bullets.shift();
    }
  }

  fireBurst(sx: number, sy: number, tx: number, ty: number): void {
    const dx = tx - sx;
    const dy = ty - sy;
    for (const offset of [-0.06, 0, 0.06]) {
      const cos = Math.cos(offset);
      const sin = Math.sin(offset);
      this.fireBullet(
        sx,
        sy,
        sx + dx * cos - dy * sin,
        sy + dx * sin + dy * cos,
        22,
      );
    }
  }

  throwGrenade(sx: number, sy: number, tx: number, ty: number): void {
    this.grenades.push({
      x: sx,
      y: sy,
      sx,
      sy,
      tx,
      ty,
      t: 0,
      duration: GRENADE_DURATION,
      arc: GRENADE_ARC,
    });
    if (this.grenades.length > MAX_GRENADES) {
      this.grenades.shift();
    }
  }

  emitFlame(sx: number, sy: number, tx: number, ty: number): void {
    const base = Math.atan2(ty - sy, tx - sx);
    const angle = base + (Math.random() - 0.5) * 0.45;
    const speed = 520 + Math.random() * 260;
    this.flames.push({
      x: sx,
      y: sy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.55 + Math.random() * 0.3,
      size: 6 + Math.random() * 8,
      color: Math.random() > 0.5 ? "#ffb638" : "#ff6a2b",
    });
    if (this.flames.length > MAX_FLAMES) {
      this.flames.shift();
    }
  }

  update(dt: number, engine: Engine, snapshot: Snapshot, flame: FlameAim | null): void {
    this.updateBullets(dt, engine, snapshot);
    this.updateFlames(dt);
    this.updateGrenades(dt, engine, snapshot);
    this.updateBlasts(dt);
    if (flame) {
      this.flameTimer -= dt;
      if (this.flameTimer <= 0) {
        this.flameTimer = FLAME_TICK;
        this.popCone(engine, snapshot, flame);
      }
    } else {
      this.flameTimer = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.drawBlasts(ctx);
    this.drawFlames(ctx);
    this.drawGrenades(ctx);
    this.drawBullets(ctx);
  }

  private updateBullets(dt: number, engine: Engine, snapshot: Snapshot): void {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i]!;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life > 0) {
        continue;
      }
      let popped = false;
      if (bullet.radius > 0) {
        const targets = activeBalloons(snapshot, (x, y) =>
          Math.hypot(x - bullet.tx, y - bullet.ty) <= bullet.radius,
        );
        for (const [x, y] of targets) {
          if (engine.pop(x, y).popped) {
            popped = true;
          }
        }
      } else {
        popped = engine.pop(bullet.tx, bullet.ty).popped;
      }
      this.onPop(popped);
      this.blasts.push({
        x: bullet.tx,
        y: bullet.ty,
        age: 0,
        life: 0.18,
        radius: bullet.radius > 0 ? bullet.radius : 14,
        small: bullet.radius === 0,
      });
      this.bullets.splice(i, 1);
    }
  }

  private updateFlames(dt: number): void {
    for (let i = this.flames.length - 1; i >= 0; i -= 1) {
      const particle = this.flames[i]!;
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 90 * dt;
      if (particle.age >= particle.life) {
        this.flames.splice(i, 1);
      }
    }
  }

  private updateGrenades(dt: number, engine: Engine, snapshot: Snapshot): void {
    for (let i = this.grenades.length - 1; i >= 0; i -= 1) {
      const grenade = this.grenades[i]!;
      grenade.t = Math.min(1, grenade.t + dt / grenade.duration);
      grenade.x = lerp(grenade.sx, grenade.tx, grenade.t);
      grenade.y =
        lerp(grenade.sy, grenade.ty, grenade.t) -
        grenade.arc * 4 * grenade.t * (1 - grenade.t);
      if (grenade.t < 1) {
        continue;
      }
      this.explode(engine, snapshot, grenade.tx, grenade.ty);
      this.grenades.splice(i, 1);
    }
  }

  private updateBlasts(dt: number): void {
    for (let i = this.blasts.length - 1; i >= 0; i -= 1) {
      const blast = this.blasts[i]!;
      blast.age += dt;
      if (blast.age >= blast.life) {
        this.blasts.splice(i, 1);
      }
    }
  }

  private popCone(engine: Engine, snapshot: Snapshot, aim: FlameAim): void {
    const dx = aim.tx - aim.sx;
    const dy = aim.ty - aim.sy;
    const length = Math.hypot(dx, dy) || 1;
    const dirX = dx / length;
    const dirY = dy / length;
    const limit = Math.cos(FLAME_HALF_ANGLE);
    const targets = activeBalloons(snapshot, (x, y) => {
      const rx = x - aim.sx;
      const ry = y - aim.sy;
      const distance = Math.hypot(rx, ry);
      return distance > 1 && distance <= FLAME_RANGE && (rx * dirX + ry * dirY) / distance >= limit;
    });
    let popped = false;
    for (const [x, y] of targets) {
      if (engine.pop(x, y).popped) {
        popped = true;
      }
    }
    if (popped) {
      this.onPop(true);
    }
  }

  private explode(engine: Engine, snapshot: Snapshot, x: number, y: number): void {
    const targets = activeBalloons(snapshot, (bx, by) => Math.hypot(bx - x, by - y) <= GRENADE_RADIUS);
    let popped = false;
    for (const [bx, by] of targets) {
      if (engine.pop(bx, by).popped) {
        popped = true;
      }
    }
    this.blasts.push({ x, y, age: 0, life: 0.45, radius: GRENADE_RADIUS, small: false });
    if (popped) {
      this.onPop(true);
    }
    if (this.blasts.length > MAX_BLASTS) {
      this.blasts.splice(0, this.blasts.length - MAX_BLASTS);
    }
  }

  private drawBlasts(ctx: CanvasRenderingContext2D): void {
    for (const blast of this.blasts) {
      const progress = blast.age / blast.life;
      const radius = blast.radius * (blast.small ? 0.4 + progress : 0.3 + progress * 1.2);
      ctx.globalAlpha = (1 - progress) * (blast.small ? 0.6 : 0.85);
      ctx.strokeStyle = blast.small ? "#ffffff" : "#ffd36b";
      ctx.lineWidth = blast.small ? 1.5 : 4;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      if (!blast.small && progress < 0.5) {
        ctx.fillStyle = "#ff8a3d";
        ctx.globalAlpha = (0.5 - progress) * 0.9;
        ctx.beginPath();
        ctx.arc(blast.x, blast.y, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFlames(ctx: CanvasRenderingContext2D): void {
    ctx.globalCompositeOperation = "lighter";
    for (const particle of this.flames) {
      const progress = particle.age / particle.life;
      ctx.globalAlpha = (1 - progress) * 0.85;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private drawGrenades(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#5d6b3a";
    ctx.strokeStyle = "#d8e58a";
    ctx.lineWidth = 2;
    for (const grenade of this.grenades) {
      ctx.beginPath();
      ctx.arc(grenade.x, grenade.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawBullets(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "#fff3b0";
    ctx.lineWidth = 2;
    ctx.globalCompositeOperation = "lighter";
    for (const bullet of this.bullets) {
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.022, bullet.y - bullet.vy * 0.022);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
}

export interface FlameAim {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

function activeBalloons(
  snapshot: Snapshot,
  predicate: (x: number, y: number) => boolean,
): Array<[number, number]> {
  const { view, headerLen, stride, records } = snapshot;
  const targets: Array<[number, number]> = [];
  for (let record = 0; record < records; record += 1) {
    const offset = headerLen + record * stride;
    if (view[offset + BALLOON_VIEW.state] !== BALLOON_STATE.active) {
      continue;
    }
    const x = view[offset + BALLOON_VIEW.x]!;
    const y = view[offset + BALLOON_VIEW.y]!;
    if (predicate(x, y)) {
      targets.push([x, y]);
    }
  }
  return targets;
}
