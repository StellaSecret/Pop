/// Time window during which a new pop keeps the combo alive (seconds).
pub const COMBO_WINDOW: f32 = 2.0;

/// Score & combo rules, deliberately free of any rendering concerns.
#[derive(Clone, Debug)]
pub struct ScoreKeeper {
    score: u32,
    combo: u32,
    max_combo: u32,
    base_points: u32,
    combo_timer: f32,
}

impl ScoreKeeper {
    #[must_use]
    pub const fn new(base_points: u32) -> Self {
        Self {
            score: 0,
            combo: 0,
            max_combo: 0,
            base_points,
            combo_timer: 0.0,
        }
    }

    #[must_use]
    pub const fn score(&self) -> u32 {
        self.score
    }

    #[must_use]
    pub const fn combo(&self) -> u32 {
        self.combo
    }

    #[must_use]
    pub const fn max_combo(&self) -> u32 {
        self.max_combo
    }

    /// Advances the combo timeout. Call once per simulation step.
    pub fn update(&mut self, dt: f32) {
        if self.combo == 0 {
            return;
        }
        self.combo_timer -= dt;
        if self.combo_timer <= 0.0 {
            self.combo = 0;
            self.combo_timer = 0.0;
        }
    }

    /// Registers a successful pop and returns the points awarded.
    pub fn register_pop(&mut self) -> u32 {
        self.combo = if self.combo_timer > 0.0 {
            self.combo.saturating_add(1)
        } else {
            1
        };
        self.combo_timer = COMBO_WINDOW;
        self.max_combo = self.max_combo.max(self.combo);

        let points = self.base_points * Self::combo_multiplier(self.combo);
        self.score = self.score.saturating_add(points);
        points
    }

    /// Multiplier for the current combo length: 1x, 2x, 3x, ...
    #[must_use]
    pub const fn combo_multiplier(combo: u32) -> u32 {
        if combo == 0 {
            1
        } else {
            let multiplier = (combo - 1) / 3 + 1;
            if multiplier > 8 {
                8
            } else {
                multiplier
            }
        }
    }

    pub fn reset(&mut self) {
        self.score = 0;
        self.combo = 0;
        self.max_combo = 0;
        self.combo_timer = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::{ScoreKeeper, COMBO_WINDOW};

    #[test]
    fn first_pop_awards_base_points() {
        let mut keeper = ScoreKeeper::new(10);
        assert_eq!(keeper.register_pop(), 10);
        assert_eq!(keeper.score(), 10);
        assert_eq!(keeper.combo(), 1);
    }

    #[test]
    fn combo_increases_multiplier() {
        let mut keeper = ScoreKeeper::new(10);
        for _ in 0..3 {
            keeper.register_pop();
        }
        assert_eq!(keeper.combo(), 3);
        assert_eq!(keeper.register_pop(), 20);
        assert_eq!(keeper.combo(), 4);
    }

    #[test]
    fn combo_expires_after_window() {
        let mut keeper = ScoreKeeper::new(10);
        keeper.register_pop();
        keeper.update(COMBO_WINDOW * 0.5);
        assert_eq!(keeper.combo(), 1);
        keeper.update(COMBO_WINDOW * 0.5 + 0.01);
        assert_eq!(keeper.combo(), 0);
        assert_eq!(keeper.register_pop(), 10);
    }

    #[test]
    fn reset_clears_everything() {
        let mut keeper = ScoreKeeper::new(10);
        keeper.register_pop();
        keeper.register_pop();
        keeper.reset();
        assert_eq!(
            (keeper.score(), keeper.combo(), keeper.max_combo()),
            (0, 0, 0)
        );
    }
}
