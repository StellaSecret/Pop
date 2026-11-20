use serde::Serialize;

use crate::engine::balloon::{Balloon, BalloonState, VIEW_STRIDE};
use crate::engine::config::{
    level_for_score, speed_multiplier, target_for_level, Difficulty, Mode, SNAPSHOT_HEADER,
};
use crate::engine::map::MapId;
use crate::engine::obstacle::{Obstacle, VIEW_STRIDE as OBSTACLE_VIEW_STRIDE};
use crate::engine::physics::{integrate, resolve_obstacles, resolve_walls, CollisionGrid};
use crate::engine::rng::Rng;
use crate::engine::rules::ScoreKeeper;

use crate::engine::config::header;

/// Duration of the pop animation, in seconds.
const POP_FADE: f32 = 0.22;

/// Result of one click, returned to the UI as a small JSON object.
#[derive(Clone, Debug, Serialize)]
pub struct PopResult {
    pub popped: bool,
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub color_index: u8,
    pub points: u32,
    pub combo: u32,
    pub obstacle_hit: bool,
    pub obstacle_destroyed: bool,
}

impl PopResult {
    fn miss() -> Self {
        Self {
            popped: false,
            id: 0,
            x: 0.0,
            y: 0.0,
            color_index: 0,
            points: 0,
            combo: 0,
            obstacle_hit: false,
            obstacle_destroyed: false,
        }
    }
}

/// Rendering-independent game simulation.
pub struct Game {
    width: f32,
    height: f32,
    difficulty: Difficulty,
    balloons: Vec<Balloon>,
    score: ScoreKeeper,
    rng: Rng,
    grid: CollisionGrid,
    snapshot: Vec<f32>,
    running: bool,
    next_id: u32,
    spawn_timer: f32,
    elapsed: f32,
    target_override: Option<u32>,
    mode: Mode,
    completed: bool,
    finish_time: f32,
    map: MapId,
    obstacles: Vec<Obstacle>,
}

impl Game {
    #[must_use]
    pub fn new(width: f32, height: f32, difficulty: Difficulty, seed: u64) -> Self {
        let cell_size = difficulty.params().max_radius * 2.0;
        let mut game = Self {
            width: width.max(1.0),
            height: height.max(1.0),
            difficulty,
            balloons: Vec::new(),
            score: ScoreKeeper::new(10),
            rng: Rng::new(seed),
            grid: CollisionGrid::new(cell_size),
            snapshot: Vec::new(),
            running: true,
            next_id: 1,
            spawn_timer: 0.0,
            elapsed: 0.0,
            target_override: None,
            mode: Mode::Arcade,
            completed: false,
            finish_time: 0.0,
            map: MapId::Night,
            obstacles: Vec::new(),
        };
        game.obstacles = game.build_obstacles();
        game.fill_initial_balloons();
        game.rebuild_snapshot();
        game
    }

    #[must_use]
    pub const fn width(&self) -> f32 {
        self.width
    }

    #[must_use]
    pub const fn height(&self) -> f32 {
        self.height
    }

    #[must_use]
    pub const fn difficulty(&self) -> Difficulty {
        self.difficulty
    }

    #[must_use]
    pub const fn is_running(&self) -> bool {
        self.running
    }

    #[must_use]
    pub const fn mode(&self) -> Mode {
        self.mode
    }

    #[must_use]
    pub const fn is_completed(&self) -> bool {
        self.completed
    }

    #[must_use]
    pub const fn finish_time(&self) -> f32 {
        self.finish_time
    }

    #[must_use]
    pub const fn map(&self) -> MapId {
        self.map
    }

    #[must_use]
    pub fn obstacle_count(&self) -> usize {
        self.obstacles.iter().filter(|o| o.is_alive()).count()
    }

    #[must_use]
    pub fn active_count(&self) -> usize {
        self.balloons.iter().filter(|b| b.is_active()).count()
    }

    #[must_use]
    pub const fn records(&self) -> usize {
        self.balloons.len()
    }

    #[must_use]
    pub const fn score(&self) -> u32 {
        self.score.score()
    }

    #[must_use]
    pub fn snapshot(&self) -> &[f32] {
        &self.snapshot
    }

    /// Advances the simulation by `dt` seconds. Large or negative deltas are
    /// discarded so a backgrounded tab can never explode the physics.
    pub fn update(&mut self, dt: f32) {
        if !self.running || !dt.is_finite() || dt <= 0.0 {
            self.rebuild_snapshot();
            return;
        }
        let dt = dt.min(0.05);
        self.elapsed += dt;
        self.score.update(dt);

        self.age_popped(dt);
        if self.mode == Mode::Challenge && self.balloons.is_empty() {
            self.completed = true;
            self.finish_time = self.elapsed;
            self.running = false;
            self.rebuild_snapshot();
            return;
        }
        self.spawn(dt);

        integrate(&mut self.balloons, dt, self.width, self.height);
        resolve_obstacles(&mut self.balloons, &self.obstacles);
        self.grid.rebuild(&self.balloons, self.width, self.height);
        self.grid.resolve_collisions(&mut self.balloons);
        resolve_obstacles(&mut self.balloons, &self.obstacles);
        for balloon in self.balloons.iter_mut().filter(|b| b.is_active()) {
            resolve_walls(balloon, self.width, self.height);
        }

        self.rebuild_snapshot();
    }

    pub fn pop_at(&mut self, x: f32, y: f32) -> PopResult {
        self.hit_at(x, y, 1)
    }

    pub fn hit_at(&mut self, x: f32, y: f32, damage: u32) -> PopResult {
        if let Some(index) = self
            .balloons
            .iter()
            .rposition(|b| b.is_active() && b.contains_point(x, y))
        {
            let balloon = &mut self.balloons[index];
            balloon.state = BalloonState::Popped;
            balloon.pop_progress = 0.0;
            balloon.vx = 0.0;
            balloon.vy = 0.0;
            let points = self.score.register_pop();

            let result = PopResult {
                popped: true,
                id: balloon.id,
                x: balloon.x,
                y: balloon.y,
                color_index: balloon.color_index,
                points,
                combo: self.score.combo(),
                obstacle_hit: false,
                obstacle_destroyed: false,
            };
            self.rebuild_snapshot();
            return result;
        }

        if let Some(index) = self
            .obstacles
            .iter()
            .rposition(|o| o.is_alive() && o.contains_point(x, y))
        {
            let (ox, oy, destroyed) = {
                let obstacle = &mut self.obstacles[index];
                (obstacle.x, obstacle.y, obstacle.damage(damage))
            };
            let result = PopResult {
                popped: false,
                id: 0,
                x: ox,
                y: oy,
                color_index: 0,
                points: 0,
                combo: self.score.combo(),
                obstacle_hit: true,
                obstacle_destroyed: destroyed,
            };
            if destroyed {
                self.obstacles.remove(index);
            }
            self.rebuild_snapshot();
            return result;
        }

        PopResult::miss()
    }

    pub fn resize(&mut self, width: f32, height: f32) {
        self.width = width.max(1.0);
        self.height = height.max(1.0);
        for obstacle in &mut self.obstacles {
            obstacle.layout(self.width, self.height);
        }
        for balloon in &mut self.balloons {
            resolve_walls(balloon, self.width, self.height);
        }
        resolve_obstacles(&mut self.balloons, &self.obstacles);
        self.grid.rebuild(&self.balloons, self.width, self.height);
        self.rebuild_snapshot();
    }

    pub fn set_map(&mut self, map: MapId) {
        self.map = map;
        self.restart();
    }

    pub fn set_difficulty(&mut self, difficulty: Difficulty) {
        self.difficulty = difficulty;
        self.grid = CollisionGrid::new(difficulty.params().max_radius * 2.0);
        self.restart();
    }

    /// Starts a fixed-population round: no respawn, finished when cleared.
    pub fn start_challenge(&mut self, count: u32) {
        self.mode = Mode::Challenge;
        self.target_override = Some(count.min(crate::engine::config::MAX_BALLOONS));
        self.restart();
    }

    /// Returns to the endless arcade round and clears the balloon override.
    pub fn set_arcade_mode(&mut self) {
        self.mode = Mode::Arcade;
        self.target_override = None;
        self.restart();
    }

    /// Overrides the target balloon count. `None` restores automatic scaling
    /// based on the current difficulty and level.
    pub fn set_target_override(&mut self, target: Option<u32>) {
        let target = target.map(|t| t.min(crate::engine::config::MAX_BALLOONS));
        if let Some(limit) = target {
            let mut excess = self.active_count().saturating_sub(limit as usize);
            self.balloons.retain(|balloon| {
                if excess > 0 && balloon.is_active() {
                    excess -= 1;
                    false
                } else {
                    true
                }
            });
        }
        self.target_override = target;
        self.rebuild_snapshot();
    }

    pub fn pause(&mut self) {
        self.running = false;
    }

    pub fn resume(&mut self) {
        self.running = true;
    }

    pub fn restart(&mut self) {
        self.balloons.clear();
        self.score.reset();
        self.next_id = 1;
        self.spawn_timer = 0.0;
        self.elapsed = 0.0;
        self.running = true;
        self.completed = false;
        self.finish_time = 0.0;
        self.obstacles = self.build_obstacles();
        self.fill_initial_balloons();
        self.rebuild_snapshot();
    }

    fn build_obstacles(&self) -> Vec<Obstacle> {
        self.map
            .obstacles()
            .iter()
            .enumerate()
            .map(|(index, def)| {
                let mut obstacle = Obstacle::new(
                    index as u32 + 1,
                    def.nx,
                    def.ny,
                    def.radius,
                    def.hp,
                    def.kind,
                );
                obstacle.layout(self.width, self.height);
                obstacle
            })
            .collect()
    }

    fn fill_initial_balloons(&mut self) {
        let target = self.target_count() as usize;
        for _ in 0..target {
            self.spawn_balloon();
        }
        self.spawn_timer = self.spawn_interval();
    }

    fn target_count(&self) -> u32 {
        self.target_override.unwrap_or_else(|| {
            target_for_level(
                self.difficulty.params().target_count,
                level_for_score(self.score.score()),
            )
        })
    }

    fn spawn_interval(&self) -> f32 {
        let level = level_for_score(self.score.score());
        (self.difficulty.params().spawn_interval / speed_multiplier(level)).max(0.08)
    }

    fn spawn(&mut self, dt: f32) {
        let target = self.target_count() as usize;
        if self.mode == Mode::Challenge || self.active_count() >= target {
            return;
        }
        self.spawn_timer -= dt;
        let mut guard = 0;
        while self.active_count() < target && self.spawn_timer <= 0.0 && guard < 8 {
            self.spawn_balloon();
            self.spawn_timer += self.spawn_interval();
            guard += 1;
        }
        if self.spawn_timer < 0.0 {
            self.spawn_timer = 0.0;
        }
    }

    fn spawn_balloon(&mut self) {
        let params = self.difficulty.params();
        let radius = self.rng.range_f32(params.min_radius, params.max_radius);
        let (x, y) = self.find_spawn_position(radius);
        let angle = self.rng.range_f32(0.0, std::f32::consts::TAU);
        let speed = (params.base_speed + self.rng.range_f32(0.0, params.speed_variance))
            * speed_multiplier(level_for_score(self.score.score()));
        let color_index = self.rng.range_u32(0, 7) as u8;
        let id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1).max(1);

        self.balloons.push(Balloon::new(
            id,
            x,
            y,
            angle.cos() * speed,
            angle.sin() * speed,
            radius,
            color_index,
        ));
    }

    fn find_spawn_position(&mut self, radius: f32) -> (f32, f32) {
        let min_x = radius.min(self.width * 0.5);
        let max_x = (self.width - radius).max(min_x);
        let min_y = radius.min(self.height * 0.5);
        let max_y = (self.height - radius).max(min_y);

        for _ in 0..12 {
            let x = self.rng.range_f32(min_x, max_x);
            let y = self.rng.range_f32(min_y, max_y);
            let clear_balloons = self.balloons.iter().all(|other| {
                !other.is_active() || {
                    let dx = other.x - x;
                    let dy = other.y - y;
                    let min = other.radius + radius + 2.0;
                    dx * dx + dy * dy > min * min
                }
            });
            let clear_obstacles = self.obstacles.iter().all(|obstacle| {
                let dx = obstacle.x - x;
                let dy = obstacle.y - y;
                let min = obstacle.radius + radius + 4.0;
                dx * dx + dy * dy > min * min
            });
            if clear_balloons && clear_obstacles {
                return (x, y);
            }
        }
        (
            self.rng.range_f32(min_x, max_x),
            self.rng.range_f32(min_y, max_y),
        )
    }

    fn age_popped(&mut self, dt: f32) {
        self.balloons.retain_mut(|balloon| {
            if balloon.state == BalloonState::Popped {
                balloon.pop_progress += dt / POP_FADE;
                balloon.pop_progress < 1.0
            } else {
                true
            }
        });
    }

    fn rebuild_snapshot(&mut self) {
        let records = self.balloons.len();
        let obstacle_records = self.obstacles.len();
        let needed =
            SNAPSHOT_HEADER + records * VIEW_STRIDE + obstacle_records * OBSTACLE_VIEW_STRIDE;
        if self.snapshot.len() != needed {
            self.snapshot.resize(needed, 0.0);
        }

        let level = level_for_score(self.score.score());
        let active = self.active_count();
        let view = &mut self.snapshot;
        view[header::SCORE] = self.score.score() as f32;
        view[header::COMBO] = self.score.combo() as f32;
        view[header::MAX_COMBO] = self.score.max_combo() as f32;
        view[header::LEVEL] = level as f32;
        view[header::ACTIVE] = active as f32;
        view[header::RECORDS] = records as f32;
        view[header::ELAPSED] = self.elapsed;
        view[header::COMPLETED] = if self.completed { 1.0 } else { 0.0 };
        view[header::FINISH_TIME] = self.finish_time;
        view[header::OBSTACLES] = obstacle_records as f32;

        let mut offset = SNAPSHOT_HEADER;
        for balloon in &self.balloons {
            balloon.write_view(view, offset);
            offset += VIEW_STRIDE;
        }
        for obstacle in &self.obstacles {
            obstacle.write_view(view, offset);
            offset += OBSTACLE_VIEW_STRIDE;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Game;
    use crate::engine::balloon::{view, BalloonState, VIEW_STRIDE};
    use crate::engine::config::{header, Difficulty, Mode, SNAPSHOT_HEADER};
    use crate::engine::map::MapId;
    use crate::engine::obstacle::VIEW_STRIDE as OBSTACLE_VIEW_STRIDE;

    fn game() -> Game {
        Game::new(800.0, 600.0, Difficulty::Easy, 1234)
    }

    #[test]
    fn spawns_target_number_of_balloons() {
        let game = game();
        assert_eq!(game.active_count(), 60);
        assert_eq!(game.records(), 60);
        assert_eq!(game.snapshot().len(), SNAPSHOT_HEADER + 60 * VIEW_STRIDE);
    }

    #[test]
    fn pop_at_marks_balloon_and_awards_points() {
        let mut game = game();
        let (x, y, id) = {
            let b = &game.balloons[0];
            (b.x, b.y, b.id)
        };
        let result = game.pop_at(x, y);
        assert!(result.popped);
        assert_eq!(result.id, id);
        assert_eq!(result.points, 10);
        assert_eq!(game.score(), 10);
        assert_eq!(game.balloons[0].state, BalloonState::Popped);
        assert_eq!(game.active_count(), 59);
    }

    #[test]
    fn pop_at_miss_returns_no_points() {
        let mut game = Game::new(100.0, 100.0, Difficulty::Easy, 7);
        game.balloons.clear();
        let result = game.pop_at(50.0, 50.0);
        assert!(!result.popped);
        assert_eq!(game.score(), 0);
    }

    #[test]
    fn popped_balloons_are_removed_after_fade() {
        let mut game = game();
        let (x, y) = (game.balloons[0].x, game.balloons[0].y);
        game.pop_at(x, y);
        for _ in 0..10 {
            game.update(0.05);
        }
        assert_eq!(
            game.balloons
                .iter()
                .filter(|b| b.state == BalloonState::Popped)
                .count(),
            0
        );
    }

    #[test]
    fn resize_keeps_balloons_inside() {
        let mut game = game();
        game.resize(120.0, 90.0);
        for balloon in &game.balloons {
            assert!(balloon.x >= balloon.radius.min(60.0) - 0.001);
            assert!(balloon.x <= 120.0 - balloon.radius.min(60.0) + 0.001);
            assert!(balloon.y >= balloon.radius.min(45.0) - 0.001);
            assert!(balloon.y <= 90.0 - balloon.radius.min(45.0) + 0.001);
        }
    }

    #[test]
    fn pause_freezes_simulation() {
        let mut game = game();
        game.pause();
        let before = game.balloons[0].x;
        game.update(0.05);
        assert_eq!(game.balloons[0].x, before);
        assert!(!game.is_running());
    }

    #[test]
    fn restart_resets_score_and_population() {
        let mut game = game();
        let (x, y) = (game.balloons[0].x, game.balloons[0].y);
        game.pop_at(x, y);
        game.restart();
        assert_eq!(game.score(), 0);
        assert_eq!(game.active_count(), 60);
        assert!(game.is_running());
    }

    #[test]
    fn snapshot_header_reports_stats() {
        let mut game = Game::new(800.0, 600.0, Difficulty::Easy, 1);
        let (x, y) = (game.balloons[0].x, game.balloons[0].y);
        game.pop_at(x, y);
        let view = game.snapshot();
        assert_eq!(view[header::SCORE], 10.0);
        assert_eq!(view[header::COMBO], 1.0);
        assert_eq!(view[header::ACTIVE], 59.0);
        assert_eq!(view[header::RECORDS], game.records() as f32);
        assert_eq!(view[SNAPSHOT_HEADER + view::STATE], 1.0);
    }

    #[test]
    fn target_override_is_clamped() {
        let mut game = game();
        game.set_target_override(Some(10_000));
        game.restart();
        assert_eq!(
            game.active_count(),
            crate::engine::config::MAX_BALLOONS as usize
        );
    }

    #[test]
    fn lowering_target_removes_surplus_balloons() {
        let mut game = Game::new(800.0, 600.0, Difficulty::Insane, 1234);
        assert_eq!(game.active_count(), 200);
        game.set_target_override(Some(60));
        assert_eq!(game.active_count(), 60);
        assert_eq!(game.snapshot()[header::ACTIVE], 60.0);
    }

    #[test]
    fn challenge_has_fixed_population_and_no_respawn() {
        let mut game = Game::new(800.0, 600.0, Difficulty::Easy, 9);
        game.start_challenge(5);
        assert_eq!(game.mode(), Mode::Challenge);
        assert_eq!(game.active_count(), 5);
        let (x, y) = {
            let b = &game.balloons[0];
            (b.x, b.y)
        };
        assert!(game.pop_at(x, y).popped);
        for _ in 0..40 {
            game.update(0.05);
        }
        assert_eq!(game.active_count(), 4);
        assert!(!game.is_completed());
    }

    #[test]
    fn challenge_completes_and_records_finish_time() {
        let mut game = Game::new(800.0, 600.0, Difficulty::Easy, 9);
        game.start_challenge(2);
        let coords: Vec<(f32, f32)> = game.balloons.iter().map(|b| (b.x, b.y)).collect();
        for (x, y) in coords {
            assert!(game.pop_at(x, y).popped);
        }
        for _ in 0..10 {
            game.update(0.05);
        }
        assert!(game.is_completed());
        assert!(!game.is_running());
        assert!(game.finish_time() > 0.0);
        assert_eq!(game.snapshot()[header::COMPLETED], 1.0);
        assert_eq!(game.snapshot()[header::FINISH_TIME], game.finish_time());
    }

    #[test]
    fn map_switch_creates_obstacles_and_snapshot_records() {
        let mut game = game();
        assert_eq!(game.map(), MapId::Night);
        assert_eq!(game.obstacle_count(), 0);

        game.set_map(MapId::Forest);
        assert_eq!(game.map(), MapId::Forest);
        assert_eq!(game.obstacle_count(), 6);
        assert_eq!(game.snapshot()[header::OBSTACLES], 6.0);
        assert_eq!(
            game.snapshot().len(),
            SNAPSHOT_HEADER + 60 * VIEW_STRIDE + 6 * OBSTACLE_VIEW_STRIDE
        );
    }

    #[test]
    fn spawned_balloons_avoid_obstacles() {
        let mut game = game();
        game.set_map(MapId::Forest);
        assert!(game.obstacles.iter().all(|obstacle| {
            game.balloons
                .iter()
                .all(|balloon| !obstacle.blocks(balloon, 0.0))
        }));
    }

    #[test]
    fn hit_at_damages_and_destroys_obstacles() {
        let mut game = game();
        game.set_map(MapId::Forest);
        let (x, y, radius) = {
            let obstacle = &game.obstacles[0];
            (obstacle.x, obstacle.y, obstacle.radius)
        };

        let first = game.hit_at(x, y, 1);
        assert!(first.obstacle_hit);
        assert!(!first.obstacle_destroyed);
        assert!(!first.popped);
        assert_eq!(game.obstacle_count(), 6);

        let second = game.hit_at(x + radius * 0.5, y, 1);
        assert!(second.obstacle_hit);
        assert!(second.obstacle_destroyed);
        assert_eq!(game.obstacle_count(), 5);
        assert_eq!(game.snapshot()[header::OBSTACLES], 5.0);
    }

    #[test]
    fn resize_keeps_obstacles_inside() {
        let mut game = game();
        game.set_map(MapId::House);
        game.resize(360.0, 240.0);
        for obstacle in &game.obstacles {
            assert!(obstacle.x >= obstacle.radius - 0.01);
            assert!(obstacle.x <= 360.0 - obstacle.radius + 0.01);
            assert!(obstacle.y >= obstacle.radius - 0.01);
            assert!(obstacle.y <= 240.0 - obstacle.radius + 0.01);
        }
    }
}
