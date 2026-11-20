//! # Pop engine — WASM interface
//!
//! This crate compiles to WebAssembly and exposes a small, allocation-light
//! API to the TypeScript layer. All game rules and physics live in
//! [`engine`]; this module is only a thin adapter.
//!
//! ## Snapshot protocol
//!
//! Instead of one JS call per balloon, the engine writes every frame into a
//! single flat `Float32Array` in WASM linear memory:
//!
//! ```text
//! [ header: 7 f32 ][ balloon record: 7 f32 ][ balloon record: 7 f32 ] ...
//! ```
//!
//! Header: `score, combo, max_combo, level, active_count, record_count,
//! elapsed_seconds`.
//!
//! Balloon record: `id, x, y, radius, color_index, state, pop_progress`, where
//! `state` is `0` (active) or `1` (popped) and `pop_progress` is `0..1`.
//!
//! The JS side reads `snapshot_ptr()`, `snapshot_len()` and `memory()` once
//! per frame, then wraps the memory in a `Float32Array` view. No data is
//! copied across the WASM boundary.

pub mod engine;

use engine::balloon::VIEW_STRIDE;
use engine::config::{header, Difficulty, DifficultyInfo, PALETTE, SNAPSHOT_HEADER};
use engine::game::{Game, PopResult};
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Opaque handle to one running game, owned by the JavaScript side.
#[wasm_bindgen]
pub struct PopGame {
    inner: Game,
}

#[wasm_bindgen]
impl PopGame {
    /// Creates a game for a play area of `width` x `height` CSS pixels.
    ///
    /// * `difficulty` — 0 = Facile, 1 = Normal, 2 = Difficile, 3 = Extrême.
    /// * `seed` — any finite number; pass `Date.now()` for a fresh round.
    #[wasm_bindgen(constructor)]
    pub fn new(width: f32, height: f32, difficulty: u32, seed: f64) -> Self {
        Self {
            inner: Game::new(
                width,
                height,
                Difficulty::from_u32(difficulty),
                (seed as u64) ^ 0x517C_C1B7_2722_0A95,
            ),
        }
    }

    /// Resizes the play area and clamps every balloon back inside it.
    pub fn resize(&mut self, width: f32, height: f32) {
        self.inner.resize(width, height);
    }

    /// Switches difficulty and starts a fresh round.
    pub fn set_difficulty(&mut self, difficulty: u32) {
        self.inner.set_difficulty(Difficulty::from_u32(difficulty));
    }

    /// Overrides the target balloon count. `0` restores automatic scaling.
    pub fn set_target_count(&mut self, count: u32) {
        self.inner
            .set_target_override(if count == 0 { None } else { Some(count) });
    }

    /// Advances the simulation by `dt` seconds. Deltas above 50 ms are
    /// clamped internally to keep the physics stable after tab switches.
    pub fn update(&mut self, dt: f32) {
        self.inner.update(dt);
    }

    /// Attempts to pop the topmost active balloon covering `(x, y)`.
    ///
    /// Returns `{ popped, id, x, y, color_index, points, combo }`. On a miss,
    /// `popped` is `false` and all other fields are zero.
    pub fn pop_at(&mut self, x: f32, y: f32) -> JsValue {
        let result: PopResult = self.inner.pop_at(x, y);
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// Pauses or resumes the simulation (no movement, no spawning).
    pub fn pause(&mut self) {
        self.inner.pause();
    }

    pub fn resume(&mut self) {
        self.inner.resume();
    }

    pub fn is_running(&self) -> bool {
        self.inner.is_running()
    }

    /// Clears the round, resets score and spawns a fresh population.
    pub fn restart(&mut self) {
        self.inner.restart();
    }

    /// Byte offset of the flat snapshot buffer inside WASM linear memory.
    /// Recompute this every frame: the buffer can move when it is resized.
    pub fn snapshot_ptr(&self) -> usize {
        self.inner.snapshot().as_ptr() as usize
    }

    /// Number of `f32` values in the snapshot buffer.
    pub fn snapshot_len(&self) -> usize {
        self.inner.snapshot().len()
    }

    /// Number of floats in the snapshot header (currently 7).
    pub fn header_len() -> usize {
        SNAPSHOT_HEADER
    }

    /// Number of floats per balloon record (currently 7).
    pub fn view_stride() -> usize {
        VIEW_STRIDE
    }

    /// Header field offsets as a plain JS object.
    pub fn header_offsets() -> JsValue {
        serde_wasm_bindgen::to_value(&HeaderOffsets {
            score: header::SCORE,
            combo: header::COMBO,
            max_combo: header::MAX_COMBO,
            level: header::LEVEL,
            active: header::ACTIVE,
            records: header::RECORDS,
            elapsed: header::ELAPSED,
        })
        .unwrap_or(JsValue::NULL)
    }
}

/// Static metadata describing the available presets and colour palette.
#[derive(Serialize)]
struct Info {
    difficulties: Vec<DifficultyInfo>,
    palette: Vec<String>,
    view_stride: usize,
    header_len: usize,
}

#[derive(Serialize)]
struct HeaderOffsets {
    score: usize,
    combo: usize,
    max_combo: usize,
    level: usize,
    active: usize,
    records: usize,
    elapsed: usize,
}

/// Returns static game configuration as a plain JS object. Call once at
/// startup to build the difficulty selector and the colour palette.
#[wasm_bindgen]
pub fn info() -> JsValue {
    let data = Info {
        difficulties: Difficulty::ALL
            .iter()
            .copied()
            .map(DifficultyInfo::from)
            .collect(),
        palette: PALETTE
            .iter()
            .map(|[r, g, b]| format!("#{r:02X}{g:02X}{b:02X}"))
            .collect(),
        view_stride: VIEW_STRIDE,
        header_len: SNAPSHOT_HEADER,
    };
    serde_wasm_bindgen::to_value(&data).unwrap_or(JsValue::NULL)
}

/// Returns the `WebAssembly.Memory` backing the snapshot buffer.
#[wasm_bindgen]
pub fn wasm_memory() -> JsValue {
    wasm_bindgen::memory()
}
