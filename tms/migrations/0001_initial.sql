-- The manual TMS is intentionally project-local: each deployed Worker binds one D1 database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tms_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_suites (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES tms_suites(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tms_suites_parent_position
  ON tms_suites(parent_id, position, name);

CREATE TABLE IF NOT EXISTS tms_cases (
  id TEXT PRIMARY KEY,
  case_key TEXT NOT NULL UNIQUE,
  suite_id TEXT NOT NULL REFERENCES tms_suites(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  expected_result TEXT NOT NULL DEFAULT '',
  preconditions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  execution_scope TEXT NOT NULL DEFAULT 'core' CHECK (execution_scope IN ('smoke', 'core', 'full')),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'archived')),
  automation_status TEXT NOT NULL DEFAULT 'manual' CHECK (automation_status IN ('manual', 'automated', 'to_be_automated')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tms_cases_suite ON tms_cases(suite_id, case_key);
CREATE INDEX IF NOT EXISTS idx_tms_cases_status_scope ON tms_cases(status, execution_scope);

CREATE TABLE IF NOT EXISTS tms_case_steps (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES tms_cases(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  action TEXT NOT NULL,
  test_data TEXT NOT NULL DEFAULT '',
  expected_result TEXT NOT NULL DEFAULT '',
  UNIQUE(case_id, position)
);

CREATE TABLE IF NOT EXISTS tms_case_tags (
  case_id TEXT NOT NULL REFERENCES tms_cases(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY(case_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tms_case_tags_tag ON tms_case_tags(tag);
