use serde::Serialize;

/// Number of `f32` values reserved for game statistics at the head of the
/// snapshot buffer: `score, combo, max_combo, level, active, records, elapsed,
/// completed, finish_time`.
pub const SNAPSHOT_HEADER: usize = 9;

/// Offsets inside the snapshot header.
pub mod header {
    pub const SCORE: usize = 0;
    pub const COMBO: usize = 1;
    pub const MAX_COMBO: usize = 2;
    pub const LEVEL: usize = 3;
    pub const ACTIVE: usize = 4;
    pub const RECORDS: usize = 5;
    pub const ELAPSED: usize = 6;
    pub const COMPLETED: usize = 7;
    pub const FINISH_TIME: usize = 8;
}

/// Game mode. Arcade keeps respawning balloons; Challenge has a fixed
/// population and finishes when every balloon has been popped.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Arcade,
    Challenge,
}

/// Hard cap matching the performance target: 200 simultaneous balloons.
pub const MAX_BALLOONS: u32 = 200;

/// Built-in difficulty presets.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Difficulty {
    Easy = 0,
    Normal = 1,
    Hard = 2,
    Insane = 3,
}

impl Difficulty {
    pub const ALL: [Self; 4] = [Self::Easy, Self::Normal, Self::Hard, Self::Insane];

    #[must_use]
    pub const fn from_u32(value: u32) -> Self {
        match value {
            0 => Self::Easy,
            2 => Self::Hard,
            3 => Self::Insane,
            _ => Self::Normal,
        }
    }

    #[must_use]
    pub const fn as_u32(self) -> u32 {
        self as u32
    }

    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Easy => "Facile",
            Self::Normal => "Normal",
            Self::Hard => "Difficile",
            Self::Insane => "Extrême",
        }
    }

    #[must_use]
    pub const fn params(self) -> DifficultyParams {
        match self {
            Self::Easy => DifficultyParams {
                base_speed: 42.0,
                speed_variance: 18.0,
                spawn_interval: 1.10,
                target_count: 60,
                min_radius: 19.0,
                max_radius: 31.0,
            },
            Self::Normal => DifficultyParams {
                base_speed: 68.0,
                speed_variance: 28.0,
                spawn_interval: 0.80,
                target_count: 100,
                min_radius: 17.0,
                max_radius: 28.0,
            },
            Self::Hard => DifficultyParams {
                base_speed: 96.0,
                speed_variance: 42.0,
                spawn_interval: 0.55,
                target_count: 150,
                min_radius: 15.0,
                max_radius: 26.0,
            },
            Self::Insane => DifficultyParams {
                base_speed: 130.0,
                speed_variance: 58.0,
                spawn_interval: 0.35,
                target_count: 200,
                min_radius: 13.0,
                max_radius: 24.0,
            },
        }
    }
}

/// Numeric tuning values for one difficulty preset.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DifficultyParams {
    /// Magnitude of the mean velocity, in pixels per second.
    pub base_speed: f32,
    /// Uniform spread added to the speed, in pixels per second.
    pub speed_variance: f32,
    /// Delay between two spawns, in seconds.
    pub spawn_interval: f32,
    /// Number of active balloons the game tries to maintain.
    pub target_count: u32,
    pub min_radius: f32,
    pub max_radius: f32,
}

/// Serializable description sent to the UI once at startup.
#[derive(Clone, Debug, Serialize)]
pub struct DifficultyInfo {
    pub id: u32,
    pub name: &'static str,
    pub base_speed: f32,
    pub target_count: u32,
}

impl From<Difficulty> for DifficultyInfo {
    fn from(value: Difficulty) -> Self {
        let params = value.params();
        Self {
            id: value.as_u32(),
            name: value.label(),
            base_speed: params.base_speed,
            target_count: params.target_count,
        }
    }
}

/// Balloon colour palette, indexed by `Balloon::color_index`.
pub const PALETTE: [[u8; 3]; 8] = [
    [0xF2, 0x4B, 0x5A],
    [0x3D, 0xA8, 0xFF],
    [0xFF, 0xC8, 0x3D],
    [0x5C, 0xD3, 0x8B],
    [0xB0, 0x7B, 0xFF],
    [0xFF, 0x8B, 0x4A],
    [0x36, 0xD6, 0xD0],
    [0xF3, 0x7A, 0xC4],
];

/// Level reached for a given score (capped to keep difficulty bounded).
#[must_use]
pub const fn level_for_score(score: u32) -> u32 {
    let level = 1 + score / 400;
    if level > 25 {
        25
    } else {
        level
    }
}

/// Speed multiplier applied to a difficulty at a given level.
#[must_use]
pub fn speed_multiplier(level: u32) -> f32 {
    1.0 + (level.saturating_sub(1) as f32) * 0.045
}

/// Target balloon count at a given level, clamped to [`MAX_BALLOONS`].
#[must_use]
pub fn target_for_level(base: u32, level: u32) -> u32 {
    base.saturating_add(level.saturating_sub(1) * 4)
        .min(MAX_BALLOONS)
}

#[cfg(test)]
mod tests {
    use super::{level_for_score, target_for_level, Difficulty, MAX_BALLOONS};

    #[test]
    fn difficulty_round_trip() {
        for d in Difficulty::ALL {
            assert_eq!(Difficulty::from_u32(d.as_u32()), d);
        }
        assert_eq!(Difficulty::from_u32(99), Difficulty::Normal);
    }

    #[test]
    fn level_and_target_are_bounded() {
        assert_eq!(level_for_score(0), 1);
        assert_eq!(level_for_score(400), 2);
        assert!(level_for_score(u32::MAX) <= 25);
        assert_eq!(target_for_level(200, 10), MAX_BALLOONS);
    }
}
