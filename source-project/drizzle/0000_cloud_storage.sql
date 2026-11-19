CREATE TABLE app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  rev INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE app_backups (
  backup_day TEXT PRIMARY KEY NOT NULL,
  rev INTEGER NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
