-- Monotonic counters avoid duplicate human-readable numbers under concurrent requests.
CREATE TABLE IF NOT EXISTS tms_sequences (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO tms_sequences (name, value) VALUES ('run', 0);
INSERT OR IGNORE INTO tms_sequences (name, value) VALUES ('defect', 0);

UPDATE tms_sequences
SET value = MAX(value, (SELECT COALESCE(MAX(run_number), 0) FROM tms_runs))
WHERE name = 'run';

UPDATE tms_sequences
SET value = MAX(value, (SELECT COALESCE(MAX(defect_number), 0) FROM tms_defects))
WHERE name = 'defect';
