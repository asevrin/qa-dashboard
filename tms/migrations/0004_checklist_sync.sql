CREATE TABLE IF NOT EXISTS tms_case_sources (
  case_id TEXT PRIMARY KEY REFERENCES tms_cases(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tms_case_sources_source_file
  ON tms_case_sources(source_file);

CREATE TABLE IF NOT EXISTS tms_sync_runs (
  id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tms_sync_runs_applied_at
  ON tms_sync_runs(applied_at DESC);
