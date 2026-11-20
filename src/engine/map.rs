use crate::engine::obstacle::ObstacleKind;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum MapId {
    Night = 0,
    Forest = 1,
    House = 2,
}

impl MapId {
    pub const ALL: [Self; 3] = [Self::Night, Self::Forest, Self::House];

    pub const fn from_u32(value: u32) -> Self {
        match value {
            1 => Self::Forest,
            2 => Self::House,
            _ => Self::Night,
        }
    }

    pub const fn as_u32(self) -> u32 {
        self as u32
    }

    pub const fn label(self) -> &'static str {
        match self {
            Self::Night => "Nuit",
            Self::Forest => "Clairière",
            Self::House => "Salon",
        }
    }

    pub const fn obstacles(self) -> &'static [ObstacleDef] {
        match self {
            Self::Night => &NIGHT_OBSTACLES,
            Self::Forest => &FOREST_OBSTACLES,
            Self::House => &HOUSE_OBSTACLES,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct ObstacleDef {
    pub nx: f32,
    pub ny: f32,
    pub radius: f32,
    pub hp: u32,
    pub kind: ObstacleKind,
}

const NIGHT_OBSTACLES: [ObstacleDef; 0] = [];

const FOREST_OBSTACLES: [ObstacleDef; 6] = [
    ObstacleDef {
        nx: 0.16,
        ny: 0.28,
        radius: 44.0,
        hp: 2,
        kind: ObstacleKind::Bush,
    },
    ObstacleDef {
        nx: 0.34,
        ny: 0.70,
        radius: 38.0,
        hp: 3,
        kind: ObstacleKind::Rock,
    },
    ObstacleDef {
        nx: 0.52,
        ny: 0.24,
        radius: 42.0,
        hp: 2,
        kind: ObstacleKind::Bush,
    },
    ObstacleDef {
        nx: 0.70,
        ny: 0.66,
        radius: 46.0,
        hp: 3,
        kind: ObstacleKind::Rock,
    },
    ObstacleDef {
        nx: 0.86,
        ny: 0.34,
        radius: 36.0,
        hp: 2,
        kind: ObstacleKind::Bush,
    },
    ObstacleDef {
        nx: 0.48,
        ny: 0.82,
        radius: 34.0,
        hp: 2,
        kind: ObstacleKind::Bush,
    },
];

const HOUSE_OBSTACLES: [ObstacleDef; 6] = [
    ObstacleDef {
        nx: 0.18,
        ny: 0.72,
        radius: 58.0,
        hp: 5,
        kind: ObstacleKind::Sofa,
    },
    ObstacleDef {
        nx: 0.50,
        ny: 0.50,
        radius: 50.0,
        hp: 4,
        kind: ObstacleKind::Table,
    },
    ObstacleDef {
        nx: 0.82,
        ny: 0.74,
        radius: 44.0,
        hp: 3,
        kind: ObstacleKind::Crate,
    },
    ObstacleDef {
        nx: 0.27,
        ny: 0.24,
        radius: 34.0,
        hp: 2,
        kind: ObstacleKind::Crate,
    },
    ObstacleDef {
        nx: 0.74,
        ny: 0.25,
        radius: 38.0,
        hp: 3,
        kind: ObstacleKind::Table,
    },
    ObstacleDef {
        nx: 0.50,
        ny: 0.86,
        radius: 34.0,
        hp: 2,
        kind: ObstacleKind::Sofa,
    },
];

#[cfg(test)]
mod tests {
    use super::MapId;

    #[test]
    fn map_round_trip() {
        for map in MapId::ALL {
            assert_eq!(MapId::from_u32(map.as_u32()), map);
        }
        assert_eq!(MapId::from_u32(99), MapId::Night);
    }

    #[test]
    fn night_has_no_obstacles() {
        assert!(MapId::Night.obstacles().is_empty());
        assert!(!MapId::Forest.obstacles().is_empty());
        assert!(!MapId::House.obstacles().is_empty());
    }
}
