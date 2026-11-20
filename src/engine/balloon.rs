/// A single balloon record in the flat snapshot buffer.
///
/// Layout (7 consecutive `f32` values):
/// `id, x, y, radius, color_index, state, pop_progress`.
pub const VIEW_STRIDE: usize = 7;

/// Offset of each field inside a balloon record.
pub mod view {
    pub const ID: usize = 0;
    pub const X: usize = 1;
    pub const Y: usize = 2;
    pub const RADIUS: usize = 3;
    pub const COLOR: usize = 4;
    pub const STATE: usize = 5;
    pub const POP_PROGRESS: usize = 6;
}

/// Lifecycle state of a balloon.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum BalloonState {
    Active = 0,
    Popped = 1,
}

/// Pure simulation data for one balloon. No rendering or platform types.
#[derive(Clone, Debug)]
pub struct Balloon {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub radius: f32,
    pub color_index: u8,
    pub state: BalloonState,
    /// `0..1` fade/shrink progress, only meaningful while `Popped`.
    pub pop_progress: f32,
}

impl Balloon {
    #[must_use]
    pub const fn new(
        id: u32,
        x: f32,
        y: f32,
        vx: f32,
        vy: f32,
        radius: f32,
        color_index: u8,
    ) -> Self {
        Self {
            id,
            x,
            y,
            vx,
            vy,
            radius,
            color_index,
            state: BalloonState::Active,
            pop_progress: 0.0,
        }
    }

    #[must_use]
    pub const fn is_active(&self) -> bool {
        matches!(self.state, BalloonState::Active)
    }

    /// Returns true when the point lies inside (or on) the balloon.
    #[must_use]
    pub fn contains_point(&self, px: f32, py: f32) -> bool {
        let dx = px - self.x;
        let dy = py - self.y;
        dx * dx + dy * dy <= self.radius * self.radius
    }

    /// Writes this balloon into `out` at `offset`. `out` must have room for
    /// [`VIEW_STRIDE`] values starting at `offset`.
    pub fn write_view(&self, out: &mut [f32], offset: usize) {
        out[offset + view::ID] = self.id as f32;
        out[offset + view::X] = self.x;
        out[offset + view::Y] = self.y;
        out[offset + view::RADIUS] = self.radius;
        out[offset + view::COLOR] = self.color_index as f32;
        out[offset + view::STATE] = self.state as u8 as f32;
        out[offset + view::POP_PROGRESS] = self.pop_progress;
    }
}

#[cfg(test)]
mod tests {
    use super::{Balloon, BalloonState};

    #[test]
    fn hit_test_uses_radius() {
        let b = Balloon::new(1, 10.0, 20.0, 0.0, 0.0, 5.0, 0);
        assert!(b.contains_point(13.0, 20.0));
        assert!(!b.contains_point(16.0, 20.0));
    }

    #[test]
    fn new_balloon_is_active() {
        let b = Balloon::new(1, 0.0, 0.0, 1.0, 1.0, 4.0, 2);
        assert_eq!(b.state, BalloonState::Active);
        assert!(b.is_active());
    }
}
