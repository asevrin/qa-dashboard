-- Plans define reusable selections. Runs and run cases are immutable execution snapshots.
CREATE TABLE IF NOT EXISTS tms_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_plan_cases (
  plan_id TEXT NOT NULL REFERENCES tms_plans(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES tms_cases(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  PRIMARY KEY(plan_id, case_id),
  UNIQUE(plan_id, position)
);

CREATE TABLE IF NOT EXISTS tms_runs (
  id TEXT PRIMARY KEY,
  run_number INTEGER NOT NULL UNIQUE,
  plan_id TEXT REFERENCES tms_plans(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  environment TEXT NOT NULL,
  build_label TEXT NOT NULL DEFAULT '',
  executor_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'aborted')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tms_runs_status_started ON tms_runs(status, started_at DESC);

CREATE TABLE IF NOT EXISTS tms_run_cases (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES tms_runs(id) ON DELETE CASCADE,
  source_case_id TEXT REFERENCES tms_cases(id) ON DELETE SET NULL,
  case_key TEXT NOT NULL,
  title TEXT NOT NULL,
  expected_result TEXT NOT NULL DEFAULT '',
  preconditions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  execution_scope TEXT NOT NULL CHECK (execution_scope IN ('smoke', 'core', 'full')),
  steps_json TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'passed', 'failed', 'blocked', 'skipped')),
  result_comment TEXT NOT NULL DEFAULT '',
  result_duration_seconds INTEGER,
  executed_at TEXT,
  UNIQUE(run_id, position)
);

CREATE INDEX IF NOT EXISTS idx_tms_run_cases_run_result ON tms_run_cases(run_id, result, position);

CREATE TABLE IF NOT EXISTS tms_defects (
  id TEXT PRIMARY KEY,
  defect_number INTEGER NOT NULL UNIQUE,
  run_case_id TEXT REFERENCES tms_run_cases(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
  steps_to_reproduce TEXT NOT NULL DEFAULT '',
  actual_result TEXT NOT NULL DEFAULT '',
  expected_result TEXT NOT NULL DEFAULT '',
  external_issue_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tms_defects_status_severity ON tms_defects(status, severity, created_at DESC);


CREATE TABLE IF NOT EXISTS tms_evidence_links (
  id TEXT PRIMARY KEY,
  run_case_id TEXT REFERENCES tms_run_cases(id) ON DELETE CASCADE,
  defect_id TEXT REFERENCES tms_defects(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((run_case_id IS NOT NULL) != (defect_id IS NOT NULL))
);
