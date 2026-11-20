//! Rendering-independent game engine for Pop.
//!
//! The modules here never touch the DOM, Canvas, Web Audio or `wasm_bindgen`.
//! Everything is plain Rust so the simulation can be unit-tested natively.

pub mod balloon;
pub mod config;
pub mod game;
pub mod physics;
pub mod rng;
pub mod rules;
