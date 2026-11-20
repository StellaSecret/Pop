import type { AudioStatus } from "./audio";
import type { DifficultyInfo, FrameStats } from "./engine";

export interface UICallbacks {
  onDifficulty(id: number): void;
  onTarget(count: number): void;
  onVolume(value: number): void;
  onSound(enabled: boolean): void;
  onPause(): void;
  onRestart(): void;
  onFullscreen(): void;
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Élément #${id} introuvable`);
  }
  return element as T;
}

export class UI {
  private readonly score = required<HTMLElement>("score");
  private readonly combo = required<HTMLElement>("combo");
  private readonly level = required<HTMLElement>("level");
  private readonly active = required<HTMLElement>("active");
  private readonly fps = required<HTMLElement>("fps");
  private readonly difficulty = required<HTMLSelectElement>("difficulty");
  private readonly balloons = required<HTMLInputElement>("balloons");
  private readonly balloonsValue = required<HTMLOutputElement>("balloons-value");
  private readonly volume = required<HTMLInputElement>("volume");
  private readonly volumeValue = required<HTMLOutputElement>("volume-value");
  private readonly sound = required<HTMLInputElement>("sound");
  private readonly pauseButton = required<HTMLButtonElement>("pause");
  private readonly restartButton = required<HTMLButtonElement>("restart");
  private readonly fullscreenButton = required<HTMLButtonElement>("fullscreen");
  private readonly audioStatus = required<HTMLParagraphElement>("audio-status");
  private readonly engineStatus = required<HTMLElement>("engine-status");
  private readonly loading = required<HTMLElement>("loading");
  private readonly pauseOverlay = required<HTMLElement>("pause-overlay");

  constructor(difficulties: DifficultyInfo[], callbacks: UICallbacks) {
    for (const difficulty of difficulties) {
      const option = document.createElement("option");
      option.value = String(difficulty.id);
      option.textContent = difficulty.name;
      this.difficulty.append(option);
    }

    this.difficulty.addEventListener("change", () => {
      callbacks.onDifficulty(Number(this.difficulty.value));
    });
    this.balloons.addEventListener("input", () => {
      const count = Number(this.balloons.value);
      this.balloonsValue.textContent = count === 0 ? "auto" : String(count);
      callbacks.onTarget(count);
    });
    this.volume.addEventListener("input", () => {
      const value = Number(this.volume.value);
      this.volumeValue.textContent = `${value} %`;
      callbacks.onVolume(value / 100);
    });
    this.sound.addEventListener("change", () => {
      callbacks.onSound(this.sound.checked);
    });
    this.pauseButton.addEventListener("click", callbacks.onPause);
    this.restartButton.addEventListener("click", callbacks.onRestart);
    this.fullscreenButton.addEventListener("click", callbacks.onFullscreen);
  }

  hideLoading(): void {
    this.loading.classList.add("hidden");
  }

  setEngineStatus(message: string): void {
    this.engineStatus.textContent = `Moteur : ${message}`;
  }

  setAudioStatus(status: AudioStatus, message: string): void {
    this.audioStatus.textContent = message || `Audio : ${status}`;
    this.audioStatus.classList.toggle("error", status === "error" || status === "unsupported");
  }

  setRunning(running: boolean): void {
    this.pauseButton.textContent = running ? "Pause" : "Reprendre";
    this.pauseOverlay.classList.toggle("hidden", running);
  }

  setDifficulty(id: number): void {
    this.difficulty.value = String(id);
  }

  updateStats(stats: FrameStats, fps: number): void {
    this.score.textContent = String(stats.score);
    this.combo.textContent = `x${Math.max(1, stats.combo)}`;
    this.level.textContent = String(stats.level);
    this.active.textContent = String(stats.active);
    this.fps.textContent = String(Math.round(fps));
  }
}
