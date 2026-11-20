use crate::engine::balloon::Balloon;

const COLLISION_EPSILON: f32 = 0.01;
const RESTITUTION: f32 = 0.96;

/// Integrates positions of every active balloon, then clamps them inside the
/// play area and reflects their velocity on the walls.
pub fn integrate(balloons: &mut [Balloon], dt: f32, width: f32, height: f32) {
    for balloon in balloons.iter_mut().filter(|b| b.is_active()) {
        balloon.x += balloon.vx * dt;
        balloon.y += balloon.vy * dt;
        resolve_walls(balloon, width, height);
    }
}

/// Keeps a balloon inside `[0, width] x [0, height]`, reflecting its velocity.
pub fn resolve_walls(balloon: &mut Balloon, width: f32, height: f32) {
    let r = balloon.radius;

    if width <= 2.0 * r {
        balloon.x = width * 0.5;
        balloon.vx = 0.0;
    } else if balloon.x - r < 0.0 {
        balloon.x = r;
        balloon.vx = balloon.vx.abs();
    } else if balloon.x + r > width {
        balloon.x = width - r;
        balloon.vx = -balloon.vx.abs();
    }

    if height <= 2.0 * r {
        balloon.y = height * 0.5;
        balloon.vy = 0.0;
    } else if balloon.y - r < 0.0 {
        balloon.y = r;
        balloon.vy = balloon.vy.abs();
    } else if balloon.y + r > height {
        balloon.y = height - r;
        balloon.vy = -balloon.vy.abs();
    }
}

/// Uniform spatial hash used as broad phase for balloon/balloon collisions.
/// Its buckets are reused between frames to avoid per-frame allocations.
pub struct CollisionGrid {
    cell_size: f32,
    cols: usize,
    rows: usize,
    buckets: Vec<Vec<usize>>,
}

impl CollisionGrid {
    #[must_use]
    pub fn new(cell_size: f32) -> Self {
        assert!(cell_size > 0.0, "cell size must be positive");
        Self {
            cell_size,
            cols: 0,
            rows: 0,
            buckets: Vec::new(),
        }
    }

    /// Rebuilds the grid from the active balloons for the given play area.
    pub fn rebuild(&mut self, balloons: &[Balloon], width: f32, height: f32) {
        let cols = ((width / self.cell_size).ceil() as usize).max(1);
        let rows = ((height / self.cell_size).ceil() as usize).max(1);

        if cols != self.cols || rows != self.rows {
            self.cols = cols;
            self.rows = rows;
            self.buckets.clear();
            self.buckets.resize_with(cols * rows, Vec::new);
        } else {
            for bucket in &mut self.buckets {
                bucket.clear();
            }
        }

        for (index, balloon) in balloons.iter().enumerate() {
            if !balloon.is_active() {
                continue;
            }
            let cx = (balloon.x / self.cell_size) as usize;
            let cy = (balloon.y / self.cell_size) as usize;
            let cell = cy.min(self.rows - 1) * self.cols + cx.min(self.cols - 1);
            self.buckets[cell].push(index);
        }
    }

    /// Resolves all overlapping balloon pairs. Each pair is visited exactly
    /// once thanks to the cell/index ordering check.
    pub fn resolve_collisions(&self, balloons: &mut [Balloon]) {
        for cy in 0..self.rows {
            for cx in 0..self.cols {
                let cell = cy * self.cols + cx;
                if self.buckets[cell].is_empty() {
                    continue;
                }

                for dy in -1isize..=1 {
                    for dx in -1isize..=1 {
                        let nx = cx as isize + dx;
                        let ny = cy as isize + dy;
                        if nx < 0 || nx >= self.cols as isize || ny < 0 || ny >= self.rows as isize
                        {
                            continue;
                        }
                        let other = ny as usize * self.cols + nx as usize;

                        for &i in &self.buckets[cell] {
                            for &j in &self.buckets[other] {
                                if i == j || other < cell || (other == cell && j < i) {
                                    continue;
                                }
                                let (lo, hi) = if i < j { (i, j) } else { (j, i) };
                                let (left, right) = balloons.split_at_mut(hi);
                                resolve_pair(&mut left[lo], &mut right[0]);
                            }
                        }
                    }
                }
            }
        }
    }

    #[must_use]
    pub const fn cols(&self) -> usize {
        self.cols
    }

    #[must_use]
    pub const fn rows(&self) -> usize {
        self.rows
    }
}

/// Elastic circle/circle response with inverse-radius-squared masses and a
/// positional correction that prevents the balloons from sinking into each
/// other.
fn resolve_pair(a: &mut Balloon, b: &mut Balloon) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist_sq = dx * dx + dy * dy;
    let min_dist = a.radius + b.radius;

    if dist_sq >= min_dist * min_dist {
        return;
    }

    let (nx, ny, distance) = if dist_sq < 1e-8 {
        (1.0, 0.0, 0.0)
    } else {
        let distance = dist_sq.sqrt();
        (dx / distance, dy / distance, distance)
    };

    let inv_a = 1.0 / (a.radius * a.radius);
    let inv_b = 1.0 / (b.radius * b.radius);
    let inv_sum = inv_a + inv_b;

    let overlap = min_dist - distance + COLLISION_EPSILON;
    let correction_a = overlap * (inv_a / inv_sum);
    let correction_b = overlap * (inv_b / inv_sum);
    a.x -= nx * correction_a;
    a.y -= ny * correction_a;
    b.x += nx * correction_b;
    b.y += ny * correction_b;

    let vel_along_normal = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if vel_along_normal >= 0.0 {
        return;
    }

    let impulse = -(1.0 + RESTITUTION) * vel_along_normal / inv_sum;
    a.vx -= impulse * inv_a * nx;
    a.vy -= impulse * inv_a * ny;
    b.vx += impulse * inv_b * nx;
    b.vy += impulse * inv_b * ny;
}

#[cfg(test)]
mod tests {
    use super::{integrate, resolve_walls, CollisionGrid};
    use crate::engine::balloon::Balloon;

    #[test]
    fn integration_uses_velocity_and_delta_time() {
        let mut balloons = [Balloon::new(1, 10.0, 30.0, 30.0, -40.0, 5.0, 0)];
        integrate(&mut balloons, 0.5, 1000.0, 1000.0);
        assert_eq!(balloons[0].x, 25.0);
        assert_eq!(balloons[0].y, 10.0);
    }

    #[test]
    fn wall_bounce_clamps_and_reflects() {
        let mut balloon = Balloon::new(1, 2.0, 98.0, -10.0, 10.0, 5.0, 0);
        resolve_walls(&mut balloon, 100.0, 100.0);
        assert_eq!(balloon.x, 5.0);
        assert_eq!(balloon.y, 95.0);
        assert!(balloon.vx > 0.0);
        assert!(balloon.vy < 0.0);
    }

    #[test]
    fn head_on_collision_reverses_velocities() {
        let mut balloons = [
            Balloon::new(1, 10.0, 50.0, 20.0, 0.0, 5.0, 0),
            Balloon::new(2, 19.0, 50.0, -20.0, 0.0, 5.0, 0),
        ];
        let mut grid = CollisionGrid::new(40.0);
        grid.rebuild(&balloons, 100.0, 100.0);
        grid.resolve_collisions(&mut balloons);

        assert!(balloons[0].vx < 0.0, "first balloon should bounce back");
        assert!(balloons[1].vx > 0.0, "second balloon should bounce back");
        let gap = (balloons[1].x - balloons[0].x).abs();
        assert!(gap >= 10.0, "overlap must be resolved, gap = {gap}");
    }

    #[test]
    fn non_overlapping_balloons_are_unaffected() {
        let mut balloons = [
            Balloon::new(1, 10.0, 10.0, 0.0, 0.0, 5.0, 0),
            Balloon::new(2, 90.0, 90.0, 0.0, 0.0, 5.0, 0),
        ];
        let mut grid = CollisionGrid::new(16.0);
        grid.rebuild(&balloons, 100.0, 100.0);
        grid.resolve_collisions(&mut balloons);
        assert_eq!(balloons[0].vx, 0.0);
        assert_eq!(balloons[1].vy, 0.0);
    }

    #[test]
    fn overlapping_pair_in_neighbouring_cells_is_resolved_once() {
        let mut balloons = [
            Balloon::new(0, 41.0, 20.0, 0.0, 0.0, 6.0, 0),
            Balloon::new(1, 39.0, 20.0, 0.0, 0.0, 6.0, 0),
        ];
        let mut grid = CollisionGrid::new(20.0);
        grid.rebuild(&balloons, 100.0, 100.0);
        assert_eq!(grid.cols(), 5);
        assert_eq!(grid.buckets[6].len(), 1);
        assert_eq!(grid.buckets[7].len(), 1);
        grid.resolve_collisions(&mut balloons);
        let gap = (balloons[0].x - balloons[1].x).abs();
        assert!(gap >= 12.0, "cross-cell overlap not resolved: {gap}");
    }

    #[test]
    fn grid_reuses_buckets_across_frames() {
        let balloons = [Balloon::new(1, 50.0, 50.0, 0.0, 0.0, 5.0, 0)];
        let mut grid = CollisionGrid::new(25.0);
        grid.rebuild(&balloons, 100.0, 100.0);
        let first_len = grid.buckets.len();
        grid.rebuild(&balloons, 100.0, 100.0);
        assert_eq!(grid.buckets.len(), first_len);
        assert_eq!(grid.cols(), 4);
        assert_eq!(grid.rows(), 4);
    }
}
