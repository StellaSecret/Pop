import type { AudioStatus } from "./audio";
import type { DifficultyInfo, FrameStats } from "./engine";

export type GameMode = "arcade" | "challenge";
export type Weapon = "click" | "auto" | "flame" | "grenade";

export interface UICallbacks {
  onMode(mode: GameMode): void;
  onWeapon(weapon: Weapon): void;
  onDifficulty(id: number): void;
  onTarget(count: number): void;
  onVolume(value: number): void;
  onSound(enabled: boolean): void;
  onPause(): void;
  onRestart(): void;
  onFullscreen(): void;
  onChallengeStart(name: string): void;
  onChallengeCancel(): void;
  onChallengeReplay(): void;
  onChallengeBack(): void;
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Élément #${id} introuvable`);
  }
  return element as T;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
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
  private readonly mode = required<HTMLSelectElement>("mode");
  private readonly weapon = required<HTMLSelectElement>("weapon");
  private readonly timerStat = required<HTMLElement>("timer-stat");
  private readonly timer = required<HTMLElement>("timer");
  private readonly challengeSetup = required<HTMLElement>("challenge-setup");
  private readonly setupCount = required<HTMLElement>("setup-count");
  private readonly playerName = required<HTMLInputElement>("player-name");
  private readonly challengeStart = required<HTMLButtonElement>("challenge-start");
  private readonly challengeCancel = required<HTMLButtonElement>("challenge-cancel");
  private readonly challengeComplete = required<HTMLElement>("challenge-complete");
  private readonly challengeMessage = required<HTMLElement>("challenge-message");
  private readonly challengeTime = required<HTMLElement>("challenge-time");
  private readonly challengeReplay = required<HTMLButtonElement>("challenge-replay");
  private readonly challengeBack = required<HTMLButtonElement>("challenge-back");

  constructor(difficulties: DifficultyInfo[], callbacks: UICallbacks) {
    for (const difficulty of difficulties) {
      const option = document.createElement("option");
      option.value = String(difficulty.id);
      option.textContent = difficulty.name;
      this.difficulty.append(option);
    }

    this.mode.addEventListener("change", () => {
      callbacks.onMode(this.mode.value as GameMode);
    });
    this.weapon.addEventListener("change", () => {
      callbacks.onWeapon(this.weapon.value as Weapon);
    });
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
    this.challengeStart.addEventListener("click", () => callbacks.onChallengeStart(this.playerName.value));
    this.challengeCancel.addEventListener("click", callbacks.onChallengeCancel);
    this.challengeReplay.addEventListener("click", callbacks.onChallengeReplay);
    this.challengeBack.addEventListener("click", callbacks.onChallengeBack);
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

  setMode(mode: GameMode): void {
    this.mode.value = mode;
    this.timerStat.classList.toggle("hidden", mode !== "challenge");
  }

  target(): number {
    return Number(this.balloons.value);
  }

  setTarget(count: number): void {
    this.balloons.value = String(count);
    this.balloonsValue.textContent = count === 0 ? "auto" : String(count);
  }

  showChallengeSetup(count: number): void {
    this.setupCount.textContent = String(count);
    this.challengeSetup.classList.remove("hidden");
    this.playerName.focus();
  }

  hideChallengeSetup(): void {
    this.challengeSetup.classList.add("hidden");
  }

  showChallengeComplete(name: string, time: number): void {
    this.challengeMessage.textContent = `Bravo, ${name || "campeur"} !`;
    this.challengeTime.textContent = `Temps : ${formatTime(time)}`;
    this.pauseOverlay.classList.add("hidden");
    this.challengeComplete.classList.remove("hidden");
  }

  hideChallengeComplete(): void {
    this.challengeComplete.classList.add("hidden");
  }

  updateStats(stats: FrameStats, fps: number): void {
    this.score.textContent = String(stats.score);
    this.combo.textContent = `x${Math.max(1, stats.combo)}`;
    this.level.textContent = String(stats.level);
    this.timer.textContent = formatTime(stats.elapsed);
    this.active.textContent = String(stats.active);
    this.fps.textContent = String(Math.round(fps));
  }
}
