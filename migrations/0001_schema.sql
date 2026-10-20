CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT NOT NULL
);
CREATE TABLE questions (
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  image_url TEXT NOT NULL,
  PRIMARY KEY (quiz_id, id),
  UNIQUE (quiz_id, label)
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  quiz_title TEXT NOT NULL,
  rounds TEXT NOT NULL CHECK (json_valid(rounds)),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
