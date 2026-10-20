CREATE TABLE high_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  player_name TEXT NOT NULL CHECK (length(player_name) BETWEEN 1 AND 30),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= total),
  total INTEGER NOT NULL CHECK (total BETWEEN 1 AND 100),
  accuracy REAL GENERATED ALWAYS AS (1.0 * score / total) STORED,
  created_at INTEGER NOT NULL
);
-- Scores deliberately outlive their game sessions; no FK to the expiring session.
CREATE INDEX high_scores_rank ON high_scores(accuracy DESC, score DESC, created_at, id);
CREATE INDEX high_scores_quiz_rank ON high_scores(quiz_id, accuracy DESC, score DESC, created_at, id);
