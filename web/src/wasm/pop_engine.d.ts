/* tslint:disable */
/* eslint-disable */

/**
 * Opaque handle to one running game, owned by the JavaScript side.
 */
export class PopGame {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Number of floats in the snapshot header (currently 7).
     */
    static header_len(): number;
    /**
     * Header field offsets as a plain JS object.
     */
    static header_offsets(): any;
    is_running(): boolean;
    /**
     * Creates a game for a play area of `width` x `height` CSS pixels.
     *
     * * `difficulty` — 0 = Facile, 1 = Normal, 2 = Difficile, 3 = Extrême.
     * * `seed` — any finite number; pass `Date.now()` for a fresh round.
     */
    constructor(width: number, height: number, difficulty: number, seed: number);
    /**
     * Pauses or resumes the simulation (no movement, no spawning).
     */
    pause(): void;
    /**
     * Attempts to pop the topmost active balloon covering `(x, y)`.
     *
     * Returns `{ popped, id, x, y, color_index, points, combo }`. On a miss,
     * `popped` is `false` and all other fields are zero.
     */
    pop_at(x: number, y: number): any;
    /**
     * Resizes the play area and clamps every balloon back inside it.
     */
    resize(width: number, height: number): void;
    /**
     * Clears the round, resets score and spawns a fresh population.
     */
    restart(): void;
    resume(): void;
    /**
     * Switches difficulty and starts a fresh round.
     */
    set_difficulty(difficulty: number): void;
    /**
     * Overrides the target balloon count. `0` restores automatic scaling.
     */
    set_target_count(count: number): void;
    /**
     * Number of `f32` values in the snapshot buffer.
     */
    snapshot_len(): number;
    /**
     * Byte offset of the flat snapshot buffer inside WASM linear memory.
     * Recompute this every frame: the buffer can move when it is resized.
     */
    snapshot_ptr(): number;
    /**
     * Advances the simulation by `dt` seconds. Deltas above 50 ms are
     * clamped internally to keep the physics stable after tab switches.
     */
    update(dt: number): void;
    /**
     * Number of floats per balloon record (currently 7).
     */
    static view_stride(): number;
}

/**
 * Returns static game configuration as a plain JS object. Call once at
 * startup to build the difficulty selector and the colour palette.
 */
export function info(): any;

/**
 * Returns the `WebAssembly.Memory` backing the snapshot buffer.
 */
export function wasm_memory(): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_popgame_free: (a: number, b: number) => void;
    readonly info: () => any;
    readonly popgame_header_len: () => number;
    readonly popgame_header_offsets: () => any;
    readonly popgame_is_running: (a: number) => number;
    readonly popgame_new: (a: number, b: number, c: number, d: number) => number;
    readonly popgame_pause: (a: number) => void;
    readonly popgame_pop_at: (a: number, b: number, c: number) => any;
    readonly popgame_resize: (a: number, b: number, c: number) => void;
    readonly popgame_restart: (a: number) => void;
    readonly popgame_resume: (a: number) => void;
    readonly popgame_set_difficulty: (a: number, b: number) => void;
    readonly popgame_set_target_count: (a: number, b: number) => void;
    readonly popgame_snapshot_len: (a: number) => number;
    readonly popgame_snapshot_ptr: (a: number) => number;
    readonly popgame_update: (a: number, b: number) => void;
    readonly popgame_view_stride: () => number;
    readonly wasm_memory: () => any;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
