CREATE TABLE entity_records (
  collection TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  rev INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (collection, entity_id)
);
--> statement-breakpoint
CREATE TABLE record_meta (id INTEGER PRIMARY KEY CHECK (id = 1), migrated INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE record_write_guard (id INTEGER PRIMARY KEY CHECK (id = 1), ok INTEGER NOT NULL CHECK (ok = 1));
