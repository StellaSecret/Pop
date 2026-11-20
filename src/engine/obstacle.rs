use crate::engine::balloon::Balloon;

pub const VIEW_STRIDE: usize = 5;

pub mod view {
    pub const X: usize = 0;
    pub const Y: usize = 1;
    pub const RADIUS: usize = 2;
    pub const HP: usize = 3;
    pub const KIND: usize = 4;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum ObstacleKind {
    Bush = 0,
    Rock = 1,
    Crate = 2,
    Sofa = 3,
    Table = 4,
}

#[derive(Clone, Debug)]
pub struct Obstacle {
    pub id: u32,
    pub nx: f32,
    pub ny: f32,
    pub x: f32,
    pub y: f32,
    pub radius: f32,
    pub base_radius: f32,
    pub hp: u32,
    pub max_hp: u32,
    pub kind: ObstacleKind,
}

impl Obstacle {
    pub fn new(id: u32, nx: f32, ny: f32, radius: f32, hp: u32, kind: ObstacleKind) -> Self {
        Self {
            id,
            nx,
            ny,
            x: 0.0,
            y: 0.0,
            radius,
            base_radius: radius,
            hp,
            max_hp: hp,
            kind,
        }
    }

    pub fn layout(&mut self, width: f32, height: f32) {
        let width = width.max(1.0);
        let height = height.max(1.0);
        let radius = self.base_radius.min(width * 0.5).min(height * 0.5);
        self.radius = radius;
        self.x = if width <= radius * 2.0 {
            width * 0.5
        } else {
            (self.nx * width).clamp(radius, width - radius)
        };
        self.y = if height <= radius * 2.0 {
            height * 0.5
        } else {
            (self.ny * height).clamp(radius, height - radius)
        };
    }

    pub const fn is_alive(&self) -> bool {
        self.hp > 0
    }

    pub fn damage(&mut self, amount: u32) -> bool {
        self.hp = self.hp.saturating_sub(amount);
        self.hp == 0
    }

    pub fn contains_point(&self, px: f32, py: f32) -> bool {
        let dx = px - self.x;
        let dy = py - self.y;
        dx * dx + dy * dy <= self.radius * self.radius
    }

    pub fn write_view(&self, out: &mut [f32], offset: usize) {
        out[offset + view::X] = self.x;
        out[offset + view::Y] = self.y;
        out[offset + view::RADIUS] = self.radius;
        out[offset + view::HP] = self.hp as f32 / self.max_hp.max(1) as f32;
        out[offset + view::KIND] = self.kind as u32 as f32;
    }

    pub fn blocks(&self, balloon: &Balloon, gap: f32) -> bool {
        if !self.is_alive() {
            return false;
        }
        let dx = self.x - balloon.x;
        let dy = self.y - balloon.y;
        let min = self.radius + balloon.radius + gap;
        dx * dx + dy * dy <= min * min
    }
}

#[cfg(test)]
mod tests {
    use super::{view, Obstacle, ObstacleKind, VIEW_STRIDE};

    #[test]
    fn layout_clamps_obstacle_inside_play_area() {
        let mut obstacle = Obstacle::new(1, 0.0, 1.0, 40.0, 2, ObstacleKind::Bush);
        obstacle.layout(200.0, 100.0);
        assert_eq!(obstacle.x, 40.0);
        assert_eq!(obstacle.y, 60.0);
    }

    #[test]
    fn damage_destroys_at_zero() {
        let mut obstacle = Obstacle::new(1, 0.5, 0.5, 20.0, 3, ObstacleKind::Crate);
        assert!(!obstacle.damage(2));
        assert!(obstacle.damage(1));
        assert_eq!(obstacle.hp, 0);
    }

    #[test]
    fn view_writes_position_and_health_ratio() {
        let mut obstacle = Obstacle::new(1, 0.5, 0.5, 20.0, 4, ObstacleKind::Table);
        obstacle.layout(200.0, 200.0);
        let mut data = vec![0.0; VIEW_STRIDE];
        obstacle.write_view(&mut data, 0);
        assert_eq!(data[view::X], 100.0);
        assert_eq!(data[view::Y], 100.0);
        assert_eq!(data[view::RADIUS], 20.0);
        assert_eq!(data[view::HP], 1.0);
        assert_eq!(data[view::KIND], ObstacleKind::Table as u32 as f32);
    }
}
