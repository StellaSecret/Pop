import init, { PopGame, info, wasm_memory } from "./wasm/pop_engine.js";

export interface DifficultyInfo {
  id: number;
  name: string;
  base_speed: number;
  target_count: number;
}

export interface GameInfo {
  difficulties: DifficultyInfo[];
  palette: string[];
  view_stride: number;
  header_len: number;
}

export interface HeaderOffsets {
  score: number;
  combo: number;
  max_combo: number;
  level: number;
  active: number;
  records: number;
  elapsed: number;
  completed: number;
  finish_time: number;
}

export interface PopEvent {
  popped: boolean;
  id: number;
  x: number;
  y: number;
  color_index: number;
  points: number;
  combo: number;
}

export interface FrameStats {
  score: number;
  combo: number;
  maxCombo: number;
  level: number;
  active: number;
  records: number;
  elapsed: number;
  completed: boolean;
  finishTime: number;
}

/** One per-frame read of the WASM snapshot buffer. Reused between frames. */
export interface Snapshot {
  view: Float32Array;
  headerLen: number;
  stride: number;
  records: number;
  stats: FrameStats;
}

/** Field offsets inside one balloon record (mirrors `src/engine/balloon.rs`). */
export const BALLOON_VIEW = {
  id: 0,
  x: 1,
  y: 2,
  radius: 3,
  color: 4,
  state: 5,
  popProgress: 6,
} as const;

export const BALLOON_STATE = { active: 0, popped: 1 } as const;

export class Engine {
  readonly gameInfo: GameInfo;

  private readonly game: PopGame;
  private readonly memory: WebAssembly.Memory;
  private readonly offsets: HeaderOffsets;
  private readonly headerLen: number;
  private readonly stride: number;
  private readonly snapshotData: Snapshot;

  private cachedPtr = -1;
  private cachedLen = -1;
  private cachedBuffer: ArrayBuffer | null = null;

  private constructor(width: number, height: number, difficulty: number) {
    this.game = new PopGame(width, height, difficulty, Date.now());
    this.memory = wasm_memory() as WebAssembly.Memory;
    this.gameInfo = info() as GameInfo;
    this.offsets = PopGame.header_offsets() as HeaderOffsets;
    this.headerLen = PopGame.header_len();
    this.stride = PopGame.view_stride();
    this.snapshotData = {
      view: new Float32Array(0),
      headerLen: this.headerLen,
      stride: this.stride,
      records: 0,
      stats: {
        score: 0,
        combo: 0,
        maxCombo: 0,
        level: 1,
        active: 0,
        records: 0,
        elapsed: 0,
        completed: false,
        finishTime: 0,
      },
    };
    this.readSnapshot();
  }

  static async create(width: number, height: number, difficulty: number): Promise<Engine> {
    await init();
    return new Engine(width, height, difficulty);
  }

  resize(width: number, height: number): void {
    this.game.resize(width, height);
  }

  setDifficulty(difficulty: number): void {
    this.game.set_difficulty(difficulty);
  }

  startChallenge(count: number): void {
    this.game.start_challenge(count);
  }

  setArcadeMode(): void {
    this.game.set_arcade_mode();
  }

  setTargetCount(count: number): void {
    this.game.set_target_count(count);
  }

  pause(): void {
    this.game.pause();
  }

  resume(): void {
    this.game.resume();
  }

  isRunning(): boolean {
    return this.game.is_running();
  }

  restart(): void {
    this.game.restart();
  }

  pop(x: number, y: number): PopEvent {
    return this.game.pop_at(x, y) as PopEvent;
  }

  /** Advances the simulation and returns a fresh view of the shared buffer. */
  tick(dt: number): Snapshot {
    this.game.update(dt);
    return this.readSnapshot();
  }

  private readSnapshot(): Snapshot {
    const ptr = this.game.snapshot_ptr();
    const len = this.game.snapshot_len();
    const buffer = this.memory.buffer;

    if (this.cachedPtr !== ptr || this.cachedLen !== len || this.cachedBuffer !== buffer) {
      this.snapshotData.view = new Float32Array(buffer, ptr, len);
      this.cachedPtr = ptr;
      this.cachedLen = len;
      this.cachedBuffer = buffer;
    }

    const view = this.snapshotData.view;
    const o = this.offsets;
    const stats = this.snapshotData.stats;
    stats.score = view[o.score] ?? 0;
    stats.combo = view[o.combo] ?? 0;
    stats.maxCombo = view[o.max_combo] ?? 0;
    stats.level = view[o.level] ?? 1;
    stats.active = view[o.active] ?? 0;
    stats.records = view[o.records] ?? 0;
    stats.elapsed = view[o.elapsed] ?? 0;
    stats.completed = (view[o.completed] ?? 0) !== 0;
    stats.finishTime = view[o.finish_time] ?? 0;
    this.snapshotData.records = stats.records;
    return this.snapshotData;
  }
}
