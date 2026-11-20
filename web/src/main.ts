import "./style.css";
import { AudioManager, type AudioStatus } from "./audio";
import {
  BALLOON_STATE,
  BALLOON_VIEW,
  Engine,
  type FrameStats,
  type PopEvent,
  type Snapshot,
} from "./engine";
import { Renderer } from "./renderer";
import { UI } from "./ui";

declare global {
  interface Window {
    __POP__?: {
      getStats(): FrameStats;
      getAudioStatus(): AudioStatus;
      getLoadedSounds(): number;
      isRunning(): boolean;
      getDifficulty(): number;
      firstActiveBalloon(): { x: number; y: number; radius: number } | null;
      popAt(x: number, y: number): PopEvent;
    };
  }
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Élément #${id} introuvable`);
  }
  return element as T;
}

async function main(): Promise<void> {
  const stage = required<HTMLElement>("stage");
  const canvas = required<HTMLCanvasElement>("game");

  const initial = stage.getBoundingClientRect();
  const engine = await Engine.create(initial.width, initial.height, 1);
  const renderer = new Renderer(canvas);
  renderer.setPalette(engine.gameInfo.palette);

  const audio = new AudioManager();
  let currentDifficulty = 1;
  let playerName = "";
  let challengeAnnounced = false;
  let latestStats: FrameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    level: 1,
    active: 0,
    records: 0,
    elapsed: 0,
    completed: false,
    finishTime: 0,
  };

  function challengeTarget(): number {
    const value = ui.target();
    if (value > 0) {
      return value;
    }
    return (
      engine.gameInfo.difficulties.find((d) => d.id === currentDifficulty)?.target_count ?? 60
    );
  }

  const ui = new UI(engine.gameInfo.difficulties, {
    onMode(mode) {
      ui.setMode(mode);
      ui.hideChallengeSetup();
      ui.hideChallengeComplete();
      challengeAnnounced = false;
      if (mode === "challenge") {
        const target = challengeTarget();
        ui.setTarget(target);
        ui.showChallengeSetup(target);
        return;
      }
      engine.setArcadeMode();
      ui.setTarget(0);
      ui.setRunning(true);
    },
    onDifficulty(id) {
      currentDifficulty = id;
      engine.setDifficulty(id);
      ui.hideChallengeComplete();
      challengeAnnounced = false;
      ui.setRunning(true);
    },
    onTarget(count) {
      engine.setTargetCount(count);
    },
    onVolume(value) {
      audio.setVolume(value);
    },
    onSound(enabled) {
      audio.setEnabled(enabled);
    },
    onPause() {
      if (engine.isRunning()) {
        engine.pause();
      } else {
        engine.resume();
      }
      ui.setRunning(engine.isRunning());
    },
    onRestart() {
      engine.restart();
      ui.hideChallengeComplete();
      challengeAnnounced = false;
      ui.setRunning(true);
    },
    onFullscreen() {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      } else {
        void stage.requestFullscreen().catch(() => undefined);
      }
    },
    onChallengeStart(name) {
      playerName = name.trim();
      const target = challengeTarget();
      ui.setTarget(target);
      ui.hideChallengeSetup();
      ui.hideChallengeComplete();
      challengeAnnounced = false;
      engine.startChallenge(target);
      ui.setRunning(true);
    },
    onChallengeCancel() {
      ui.hideChallengeSetup();
      ui.hideChallengeComplete();
      challengeAnnounced = false;
      engine.setArcadeMode();
      ui.setTarget(0);
      ui.setMode("arcade");
      ui.setRunning(true);
    },
    onChallengeReplay() {
      ui.hideChallengeComplete();
      challengeAnnounced = false;
      engine.startChallenge(challengeTarget());
      ui.setRunning(true);
    },
    onChallengeBack() {
      ui.hideChallengeComplete();
      challengeAnnounced = false;
      engine.setArcadeMode();
      ui.setTarget(0);
      ui.setMode("arcade");
      ui.setRunning(true);
    },
  });

  ui.hideLoading();
  ui.setDifficulty(currentDifficulty);
  ui.setEngineStatus(`WASM prêt · ${engine.gameInfo.difficulties.length} difficultés`);
  ui.setAudioStatus(audio.status, "Audio : chargement des enregistrements…");
  void audio.load().then(() => {
    ui.setAudioStatus(
      audio.status,
      audio.errorMessage || `Audio : ${audio.loadedCount} enregistrement(s) prêt(s)`,
    );
  });

  function resize(): void {
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    renderer.resize(rect.width, rect.height, dpr);
    engine.resize(rect.width, rect.height);
  }
  resize();
  new ResizeObserver(resize).observe(stage);
  window.addEventListener("resize", resize);

  canvas.addEventListener("pointerdown", (event) => {
    audio.unlock();
    const rect = canvas.getBoundingClientRect();
    const result = engine.pop(event.clientX - rect.left, event.clientY - rect.top);
    if (result.popped) {
      audio.play();
    }
  });

  window.__POP__ = {
    getStats: () => latestStats,
    getAudioStatus: () => audio.status,
    getLoadedSounds: () => audio.loadedCount,
    isRunning: () => engine.isRunning(),
    getDifficulty: () => currentDifficulty,
    firstActiveBalloon() {
      const snapshot = engine.tick(0) as Snapshot;
      const { view, headerLen, stride, records } = snapshot;
      for (let record = 0; record < records; record += 1) {
        const offset = headerLen + record * stride;
        if (view[offset + BALLOON_VIEW.state] === BALLOON_STATE.active) {
          return {
            x: view[offset + BALLOON_VIEW.x]!,
            y: view[offset + BALLOON_VIEW.y]!,
            radius: view[offset + BALLOON_VIEW.radius]!,
          };
        }
      }
      return null;
    },
    popAt(x, y) {
      return engine.pop(x, y);
    },
  };

  let previous = performance.now();
  let smoothedFps = 60;
  function frame(now: number): void {
    const dt = (now - previous) / 1000;
    previous = now;
    const snapshot = engine.tick(dt);
    renderer.draw(snapshot);
    latestStats = snapshot.stats;
    if (snapshot.stats.completed && !challengeAnnounced) {
      challengeAnnounced = true;
      ui.showChallengeComplete(playerName, snapshot.stats.finishTime);
    }
    if (dt > 0) {
      smoothedFps += (1 / dt - smoothedFps) * 0.08;
    }
    ui.updateStats(snapshot.stats, smoothedFps);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const loading = document.getElementById("loading");
  if (loading) {
    loading.textContent = `Erreur de démarrage : ${message}`;
  }
  const status = document.getElementById("engine-status");
  if (status) {
    status.textContent = `Moteur : échec (${message})`;
  }
  console.error(error);
});
