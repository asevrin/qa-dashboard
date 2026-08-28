const priorities = new Set(["critical", "high", "medium", "low"]);
const executionScopes = new Set(["smoke", "core", "full"]);
const caseStatuses = new Set(["draft", "ready", "archived"]);
const automationStatuses = new Set(["manual", "automated", "to_be_automated"]);
const planStatuses = new Set(["draft", "active", "archived"]);
const runStatuses = new Set(["in_progress", "completed", "aborted"]);
const runCaseResults = new Set(["pending", "passed", "failed", "blocked", "skipped"]);
const defectStatuses = new Set(["open", "in_progress", "resolved", "wont_fix"]);
const maxTitleLength = 500;
const maxTextLength = 20_000;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=UTF-8",
      ...headers,
    },
  });
}

function string(value, fallback = "", maximum = maxTextLength) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= maximum ? trimmed : null;
}

function enumValue(value, values, fallback) {
  if (value === undefined) return fallback;
  return typeof value === "string" && values.has(value) ? value : null;
}

function identifier(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
    ? value
    : null;
}

function validateSuite(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const name = string(body.name, "", maxTitleLength);
  const description = string(body.description);
  const parentId = body.parentId === null ? null : body.parentId === undefined ? null : identifier(body.parentId);
  if (!name || description === null || parentId === null && body.parentId !== null && body.parentId !== undefined) return null;
  return { name, description, parentId };
}

function validateCase(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const caseKey = string(body.caseKey, "", 80);
  const suiteId = identifier(body.suiteId);
  const title = string(body.title, "", maxTitleLength);
  const expectedResult = string(body.expectedResult);
  const preconditions = string(body.preconditions);
  const notes = string(body.notes);
  const priority = enumValue(body.priority, priorities, "medium");
  const executionScope = enumValue(body.executionScope, executionScopes, "core");
  const status = enumValue(body.status, caseStatuses, "ready");
  const automationStatus = enumValue(body.automationStatus, automationStatuses, "manual");
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map((tag) => string(tag, "", 60)).filter(Boolean))] : null;
  const steps = body.steps === undefined ? [] : Array.isArray(body.steps) && body.steps.length <= 200
    ? body.steps.map((step) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) return null;
      const action = string(step.action, "");
      const testData = string(step.testData);
      const expectedResult = string(step.expectedResult);
      return action && testData !== null && expectedResult !== null ? { action, testData, expectedResult } : null;
    })
    : null;
  if (!caseKey || !/^[A-Z][A-Z0-9_]*-\d{1,8}$/.test(caseKey) || !suiteId || !title || expectedResult === null || preconditions === null || notes === null || !priority || !executionScope || !status || !automationStatus || !tags || !steps || steps.some((step) => !step)) return null;
  return { caseKey, suiteId, title, expectedResult, preconditions, notes, priority, executionScope, status, automationStatus, tags, steps };
}

function validatePlan(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const name = string(body.name, "", maxTitleLength);
  const description = string(body.description);
  const status = enumValue(body.status, planStatuses, "active");
  const caseIds = Array.isArray(body.caseIds) && body.caseIds.length <= 1_000
    ? [...new Set(body.caseIds.map(identifier))]
    : null;
  if (!name || description === null || !status || !caseIds || caseIds.some((id) => !id)) return null;
  return { name, description, status, caseIds };
}

function validateRun(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const planId = identifier(body.planId);
  const name = string(body.name, "", maxTitleLength);
  const environment = string(body.environment, "", 200);
  const buildLabel = string(body.buildLabel, "", 500);
  const executorName = string(body.executorName, "", 200);
  if (!planId || !name || !environment || buildLabel === null || executorName === null) return null;
  return { planId, name, environment, buildLabel, executorName };
}

function validateRunCaseResult(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const result = enumValue(body.result, runCaseResults, null);
  const resultComment = string(body.resultComment);
  const duration = body.durationSeconds === undefined || body.durationSeconds === null ? null : Number.isInteger(body.durationSeconds) && body.durationSeconds >= 0 && body.durationSeconds <= 86_400 ? body.durationSeconds : null;
  if (!result || resultComment === null || (body.durationSeconds !== undefined && body.durationSeconds !== null && duration === null)) return null;
  return { result, resultComment, durationSeconds: duration };
}

function validateEvidence(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const label = string(body.label, "", 500);
  const url = string(body.url, "", 2_000);
  try { if (!label || !url || new URL(url).protocol !== "https:" || !new URL(url).hostname.endsWith("google.com")) return null; } catch { return null; }
  return { label, url };
}

function validateDefect(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const title = string(body.title, "", maxTitleLength);
  const severity = enumValue(body.severity, priorities, "medium");
  const stepsToReproduce = string(body.stepsToReproduce);
  const actualResult = string(body.actualResult);
  const expectedResult = string(body.expectedResult);
  if (!title || !severity || stepsToReproduce === null || actualResult === null || expectedResult === null) return null;
  return { title, severity, stepsToReproduce, actualResult, expectedResult };
}

function validateDefectUpdate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const status = enumValue(body.status, defectStatuses, null);
  const externalIssueUrl = string(body.externalIssueUrl, "", 2_000);
  try {
    if (!status || externalIssueUrl === null || (externalIssueUrl && new URL(externalIssueUrl).protocol !== "https:")) return null;
  } catch {
    return null;
  }
  return { status, externalIssueUrl };
}

function database(env) {
  return env.QA_TMS_DB && typeof env.QA_TMS_DB.prepare === "function"
    ? env.QA_TMS_DB
    : null;
}

async function readRepository(db) {
  const [suites, cases, tags, steps] = await db.batch([
    db.prepare("SELECT id, parent_id AS parentId, name, description, position FROM tms_suites ORDER BY parent_id, position, name"),
    db.prepare("SELECT id, case_key AS caseKey, suite_id AS suiteId, title, expected_result AS expectedResult, preconditions, notes, priority, execution_scope AS executionScope, status, automation_status AS automationStatus, updated_at AS updatedAt FROM tms_cases ORDER BY case_key"),
    db.prepare("SELECT case_id AS caseId, tag FROM tms_case_tags ORDER BY tag"),
    db.prepare("SELECT case_id AS caseId, position, action, test_data AS testData, expected_result AS expectedResult FROM tms_case_steps ORDER BY case_id, position"),
  ]);
  const tagsByCase = new Map();
  for (const row of tags.results) tagsByCase.set(row.caseId, [...(tagsByCase.get(row.caseId) || []), row.tag]);
  const stepsByCase = new Map();
  for (const row of steps.results) stepsByCase.set(row.caseId, [...(stepsByCase.get(row.caseId) || []), { action: row.action, testData: row.testData, expectedResult: row.expectedResult }]);
  return {
    suites: suites.results,
    cases: cases.results.map((item) => ({ ...item, tags: tagsByCase.get(item.id) || [], steps: stepsByCase.get(item.id) || [] })),
  };
}

async function createSuite(db, input) {
  const id = crypto.randomUUID();
  if (input.parentId) {
    const parent = await db.prepare("SELECT id FROM tms_suites WHERE id = ?1").bind(input.parentId).first();
    if (!parent) return json({ error: "Parent suite was not found" }, 404);
  }
  const position = (await db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM tms_suites WHERE parent_id IS ?1").bind(input.parentId).first()).position;
  await db.prepare("INSERT INTO tms_suites (id, parent_id, name, description, position) VALUES (?1, ?2, ?3, ?4, ?5)").bind(id, input.parentId, input.name, input.description, position).run();
  return json({ id, ...input, position }, 201);
}

async function createCase(db, input) {
  const suite = await db.prepare("SELECT id FROM tms_suites WHERE id = ?1").bind(input.suiteId).first();
  if (!suite) return json({ error: "Suite was not found" }, 404);
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare("INSERT INTO tms_cases (id, case_key, suite_id, title, expected_result, preconditions, notes, priority, execution_scope, status, automation_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)").bind(id, input.caseKey, input.suiteId, input.title, input.expectedResult, input.preconditions, input.notes, input.priority, input.executionScope, input.status, input.automationStatus),
      ...input.tags.map((tag) => db.prepare("INSERT INTO tms_case_tags (case_id, tag) VALUES (?1, ?2)").bind(id, tag)),
      ...input.steps.map((step, position) => db.prepare("INSERT INTO tms_case_steps (id, case_id, position, action, test_data, expected_result) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(crypto.randomUUID(), id, position, step.action, step.testData, step.expectedResult)),
    ]);
  } catch (error) {
    if (/UNIQUE constraint failed: tms_cases.case_key/i.test(String(error))) return json({ error: "Case ID already exists" }, 409);
    throw error;
  }
  return json({ id, ...input }, 201);
}

async function updateCase(db, id, input) {
  const existing = await db.prepare("SELECT id FROM tms_cases WHERE id = ?1").bind(id).first();
  if (!existing) return json({ error: "Test case was not found" }, 404);
  const suite = await db.prepare("SELECT id FROM tms_suites WHERE id = ?1").bind(input.suiteId).first();
  if (!suite) return json({ error: "Suite was not found" }, 404);
  await db.batch([
    db.prepare("UPDATE tms_cases SET suite_id = ?2, title = ?3, expected_result = ?4, preconditions = ?5, notes = ?6, priority = ?7, execution_scope = ?8, status = ?9, automation_status = ?10, updated_at = CURRENT_TIMESTAMP WHERE id = ?1").bind(id, input.suiteId, input.title, input.expectedResult, input.preconditions, input.notes, input.priority, input.executionScope, input.status, input.automationStatus),
    db.prepare("DELETE FROM tms_case_tags WHERE case_id = ?1").bind(id),
    ...input.tags.map((tag) => db.prepare("INSERT INTO tms_case_tags (case_id, tag) VALUES (?1, ?2)").bind(id, tag)),
    db.prepare("DELETE FROM tms_case_steps WHERE case_id = ?1").bind(id),
    ...input.steps.map((step, position) => db.prepare("INSERT INTO tms_case_steps (id, case_id, position, action, test_data, expected_result) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(crypto.randomUUID(), id, position, step.action, step.testData, step.expectedResult)),
  ]);
  return json({ id, ...input });
}

async function deleteCase(db, id) {
  const existing = await db.prepare("SELECT id FROM tms_cases WHERE id = ?1").bind(id).first();
  if (!existing) return json({ error: "Test case was not found" }, 404);
  const plan = await db.prepare("SELECT p.name FROM tms_plan_cases pc JOIN tms_plans p ON p.id = pc.plan_id WHERE pc.case_id = ?1 LIMIT 1").bind(id).first();
  if (plan) return json({ error: `Remove this test case from plan “${plan.name}” before deleting it.` }, 409);
  await db.batch([
    db.prepare("DELETE FROM tms_case_tags WHERE case_id = ?1").bind(id),
    db.prepare("DELETE FROM tms_case_steps WHERE case_id = ?1").bind(id),
    db.prepare("DELETE FROM tms_cases WHERE id = ?1").bind(id),
  ]);
  return json({ id });
}

async function readPlans(db) {
  const [plans, planCases] = await db.batch([
    db.prepare("SELECT id, name, description, status, created_at AS createdAt, updated_at AS updatedAt FROM tms_plans ORDER BY updated_at DESC, name"),
    db.prepare("SELECT plan_id AS planId, case_id AS caseId, position FROM tms_plan_cases ORDER BY plan_id, position"),
  ]);
  const caseIdsByPlan = new Map();
  for (const row of planCases.results) caseIdsByPlan.set(row.planId, [...(caseIdsByPlan.get(row.planId) || []), row.caseId]);
  return plans.results.map((plan) => ({ ...plan, caseIds: caseIdsByPlan.get(plan.id) || [] }));
}

async function savePlan(db, id, input, isNew) {
  if (input.caseIds.length) {
    const placeholders = input.caseIds.map((_, index) => `?${index + 1}`).join(", ");
    const found = await db.prepare(`SELECT id FROM tms_cases WHERE id IN (${placeholders})`).bind(...input.caseIds).all();
    if (found.results.length !== input.caseIds.length) return json({ error: "One or more selected test cases were not found" }, 404);
  }
  if (!isNew) {
    const existing = await db.prepare("SELECT id FROM tms_plans WHERE id = ?1").bind(id).first();
    if (!existing) return json({ error: "Test plan was not found" }, 404);
  }
  const statements = [
    isNew
      ? db.prepare("INSERT INTO tms_plans (id, name, description, status) VALUES (?1, ?2, ?3, ?4)").bind(id, input.name, input.description, input.status)
      : db.prepare("UPDATE tms_plans SET name = ?2, description = ?3, status = ?4, updated_at = CURRENT_TIMESTAMP WHERE id = ?1").bind(id, input.name, input.description, input.status),
  ];
  if (!isNew) statements.push(db.prepare("DELETE FROM tms_plan_cases WHERE plan_id = ?1").bind(id));
  statements.push(...input.caseIds.map((caseId, position) => db.prepare("INSERT INTO tms_plan_cases (plan_id, case_id, position) VALUES (?1, ?2, ?3)").bind(id, caseId, position)));
  await db.batch(statements);
  return json({ id, ...input }, isNew ? 201 : 200);
}

async function createRun(db, input) {
  const plan = await db.prepare("SELECT id FROM tms_plans WHERE id = ?1 AND status = 'active'").bind(input.planId).first();
  if (!plan) return json({ error: "Active test plan was not found" }, 404);
  const selected = await db.prepare("SELECT c.id, c.case_key AS caseKey, c.title, c.expected_result AS expectedResult, c.preconditions, c.notes, c.priority, c.execution_scope AS executionScope, pc.position FROM tms_plan_cases pc JOIN tms_cases c ON c.id = pc.case_id WHERE pc.plan_id = ?1 AND c.status != 'archived' ORDER BY pc.position").bind(input.planId).all();
  if (!selected.results.length) return json({ error: "Test plan has no runnable test cases" }, 400);
  const ids = selected.results.map((item) => item.id);
  const placeholders = ids.map((_, index) => `?${index + 1}`).join(", ");
  const steps = await db.prepare(`SELECT case_id AS caseId, position, action, test_data AS testData, expected_result AS expectedResult FROM tms_case_steps WHERE case_id IN (${placeholders}) ORDER BY case_id, position`).bind(...ids).all();
  const stepsByCase = new Map();
  for (const step of steps.results) stepsByCase.set(step.caseId, [...(stepsByCase.get(step.caseId) || []), { action: step.action, testData: step.testData, expectedResult: step.expectedResult }]);
  const numberRow = await db.prepare("UPDATE tms_sequences SET value = value + 1 WHERE name = 'run' RETURNING value AS runNumber").first();
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO tms_runs (id, run_number, plan_id, name, environment, build_label, executor_name) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)").bind(id, numberRow.runNumber, input.planId, input.name, input.environment, input.buildLabel, input.executorName),
    ...selected.results.map((item) => db.prepare("INSERT INTO tms_run_cases (id, run_id, source_case_id, case_key, title, expected_result, preconditions, notes, priority, execution_scope, steps_json, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)").bind(crypto.randomUUID(), id, item.id, item.caseKey, item.title, item.expectedResult, item.preconditions, item.notes, item.priority, item.executionScope, JSON.stringify(stepsByCase.get(item.id) || []), item.position)),
  ]);
  return json({ id, runNumber: numberRow.runNumber, ...input, caseCount: selected.results.length }, 201);
}

async function readRuns(db) {
  const runs = await db.prepare("SELECT r.id, r.run_number AS runNumber, r.plan_id AS planId, r.name, r.environment, r.build_label AS buildLabel, r.executor_name AS executorName, r.status, r.started_at AS startedAt, r.completed_at AS completedAt, COUNT(rc.id) AS caseCount, SUM(CASE WHEN rc.result = 'passed' THEN 1 ELSE 0 END) AS passedCount, SUM(CASE WHEN rc.result = 'failed' THEN 1 ELSE 0 END) AS failedCount, SUM(CASE WHEN rc.result = 'blocked' THEN 1 ELSE 0 END) AS blockedCount, SUM(CASE WHEN rc.result = 'skipped' THEN 1 ELSE 0 END) AS skippedCount FROM tms_runs r LEFT JOIN tms_run_cases rc ON rc.run_id = r.id GROUP BY r.id ORDER BY r.started_at DESC").all();
  return runs.results.map((run) => ({ ...run, caseCount: Number(run.caseCount), passedCount: Number(run.passedCount), failedCount: Number(run.failedCount), blockedCount: Number(run.blockedCount), skippedCount: Number(run.skippedCount) }));
}

async function readRun(db, id) {
  const run = await db.prepare("SELECT id, run_number AS runNumber, plan_id AS planId, name, environment, build_label AS buildLabel, executor_name AS executorName, status, started_at AS startedAt, completed_at AS completedAt FROM tms_runs WHERE id = ?1").bind(id).first();
  if (!run) return json({ error: "Test run was not found" }, 404);
  const cases = await db.prepare("SELECT id, source_case_id AS sourceCaseId, case_key AS caseKey, title, expected_result AS expectedResult, preconditions, notes, priority, execution_scope AS executionScope, steps_json AS stepsJson, position, result, result_comment AS resultComment, result_duration_seconds AS resultDurationSeconds, executed_at AS executedAt FROM tms_run_cases WHERE run_id = ?1 ORDER BY position").bind(id).all();
  const [evidence, defects] = await Promise.all([
    db.prepare("SELECT e.id, e.run_case_id AS runCaseId, e.label, e.url, e.created_at AS createdAt FROM tms_evidence_links e JOIN tms_run_cases rc ON rc.id = e.run_case_id WHERE rc.run_id = ?1 ORDER BY e.created_at").bind(id).all(),
    db.prepare("SELECT d.id, d.run_case_id AS runCaseId, d.defect_number AS defectNumber, d.title, d.severity, d.status, d.external_issue_url AS externalIssueUrl, d.created_at AS createdAt FROM tms_defects d JOIN tms_run_cases rc ON rc.id = d.run_case_id WHERE rc.run_id = ?1 ORDER BY d.created_at").bind(id).all(),
  ]);
  const evidenceByCase = new Map();
  for (const item of evidence.results) evidenceByCase.set(item.runCaseId, [...(evidenceByCase.get(item.runCaseId) || []), item]);
  const defectsByCase = new Map();
  for (const item of defects.results) defectsByCase.set(item.runCaseId, [...(defectsByCase.get(item.runCaseId) || []), item]);
  return json({
    ...run,
    cases: cases.results.map((item) => ({
      ...item,
      evidence: evidenceByCase.get(item.id) || [],
      defects: defectsByCase.get(item.id) || [],
      steps: JSON.parse(item.stepsJson),
      stepsJson: undefined,
    })),
  });
}

async function updateRunCase(db, runId, runCaseId, input) {
  const run = await db.prepare("SELECT status FROM tms_runs WHERE id = ?1").bind(runId).first();
  if (!run) return json({ error: "Test run was not found" }, 404);
  if (run.status !== "in_progress") return json({ error: "Completed or aborted runs are read-only" }, 409);
  const existing = await db.prepare("SELECT id FROM tms_run_cases WHERE id = ?1 AND run_id = ?2").bind(runCaseId, runId).first();
  if (!existing) return json({ error: "Run case was not found" }, 404);
  await db.prepare("UPDATE tms_run_cases SET result = ?3, result_comment = ?4, result_duration_seconds = ?5, executed_at = CASE WHEN ?3 = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END WHERE id = ?1 AND run_id = ?2").bind(runCaseId, runId, input.result, input.resultComment, input.durationSeconds).run();
  return json({ id: runCaseId, ...input });
}

async function completeRun(db, id, force) {
  const run = await db.prepare("SELECT status FROM tms_runs WHERE id = ?1").bind(id).first();
  if (!run) return json({ error: "Test run was not found" }, 404);
  if (run.status !== "in_progress") return json({ error: "Only in-progress runs can be completed" }, 409);
  const pending = await db.prepare("SELECT COUNT(*) AS count FROM tms_run_cases WHERE run_id = ?1 AND result = 'pending'").bind(id).first();
  if (Number(pending.count) && !force) return json({ error: "Run still has pending test cases", pendingCount: Number(pending.count) }, 409);
  const updated = await db.prepare("UPDATE tms_runs SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'in_progress' AND (?2 OR NOT EXISTS (SELECT 1 FROM tms_run_cases WHERE run_id = ?1 AND result = 'pending'))").bind(id, force ? 1 : 0).run();
  if (!updated.meta.changes) return json({ error: "Run state changed before completion" }, 409);
  return json({ id, status: "completed", pendingCount: Number(pending.count) });
}

async function abortRun(db, id) {
  const run = await db.prepare("SELECT status FROM tms_runs WHERE id = ?1").bind(id).first();
  if (!run) return json({ error: "Test run was not found" }, 404);
  if (run.status !== "in_progress") return json({ error: "Only in-progress runs can be aborted" }, 409);
  await db.prepare("UPDATE tms_runs SET status = 'aborted', completed_at = CURRENT_TIMESTAMP WHERE id = ?1").bind(id).run();
  return json({ id, status: "aborted" });
}

async function readRunCaseState(db, runId, runCaseId) {
  return db.prepare("SELECT rc.id, rc.result, r.status AS runStatus FROM tms_run_cases rc JOIN tms_runs r ON r.id = rc.run_id WHERE rc.id = ?1 AND rc.run_id = ?2").bind(runCaseId, runId).first();
}

async function addEvidence(db, runId, runCaseId, input) {
  const runCase = await readRunCaseState(db, runId, runCaseId);
  if (!runCase) return json({ error: "Run case was not found" }, 404);
  if (runCase.runStatus !== "in_progress") return json({ error: "Completed or aborted runs are read-only" }, 409);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO tms_evidence_links (id, run_case_id, label, url) VALUES (?1, ?2, ?3, ?4)").bind(id, runCaseId, input.label, input.url).run();
  return json({ id, ...input }, 201);
}

async function createDefect(db, runId, runCaseId, input) {
  const runCase = await readRunCaseState(db, runId, runCaseId);
  if (!runCase) return json({ error: "Run case was not found" }, 404);
  if (runCase.runStatus !== "in_progress") return json({ error: "Completed or aborted runs are read-only" }, 409);
  if (!['failed', 'blocked'].includes(runCase.result)) return json({ error: "Defects can be created only for failed or blocked cases" }, 409);
  const row = await db.prepare("UPDATE tms_sequences SET value = value + 1 WHERE name = 'defect' RETURNING value AS number").first();
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO tms_defects (id, defect_number, run_case_id, title, severity, steps_to_reproduce, actual_result, expected_result) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(id, row.number, runCaseId, input.title, input.severity, input.stepsToReproduce, input.actualResult, input.expectedResult).run();
  return json({ id, defectNumber: row.number, ...input }, 201);
}

async function readDefects(db) {
  const defects = await db.prepare("SELECT d.id, d.defect_number AS defectNumber, d.title, d.severity, d.status, d.steps_to_reproduce AS stepsToReproduce, d.actual_result AS actualResult, d.expected_result AS expectedResult, d.external_issue_url AS externalIssueUrl, d.created_at AS createdAt, rc.id AS runCaseId, rc.case_key AS caseKey, rc.title AS caseTitle, r.id AS runId, r.run_number AS runNumber, r.name AS runName, r.status AS runStatus FROM tms_defects d LEFT JOIN tms_run_cases rc ON rc.id = d.run_case_id LEFT JOIN tms_runs r ON r.id = rc.run_id ORDER BY CASE d.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END, d.created_at DESC").all();
  return defects.results;
}

async function updateDefect(db, id, input) {
  const defect = await db.prepare("SELECT id FROM tms_defects WHERE id = ?1").bind(id).first();
  if (!defect) return json({ error: "Defect was not found" }, 404);
  await db.prepare("UPDATE tms_defects SET status = ?2, external_issue_url = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1").bind(id, input.status, input.externalIssueUrl).run();
  return json({ id, ...input });
}

export async function handleTmsRequest(request, env, url) {
  if (!url.pathname.startsWith("/api/tms")) return null;
  const db = database(env);
  if (!db) return json({ error: "Manual TMS is not configured" }, 503);
  if (request.method !== "GET" && request.headers.get("Origin") !== url.origin)
    return json({ error: "Invalid request origin" }, 403);

  if (url.pathname === "/api/tms/repository") {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
    return json(await readRepository(db));
  }
  if (url.pathname === "/api/tms/suites") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
    const input = validateSuite(await request.json().catch(() => null));
    return input ? createSuite(db, input) : json({ error: "Invalid suite" }, 400);
  }
  if (url.pathname === "/api/tms/cases") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
    const input = validateCase(await request.json().catch(() => null));
    return input ? createCase(db, input) : json({ error: "Invalid test case" }, 400);
  }
  if (url.pathname === "/api/tms/plans") {
    if (request.method === "GET") return json(await readPlans(db));
    if (request.method === "POST") {
      const input = validatePlan(await request.json().catch(() => null));
      return input ? savePlan(db, crypto.randomUUID(), input, true) : json({ error: "Invalid test plan" }, 400);
    }
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
  }
  if (url.pathname === "/api/tms/runs") {
    if (request.method === "GET") return json(await readRuns(db));
    if (request.method === "POST") {
      const input = validateRun(await request.json().catch(() => null));
      return input ? createRun(db, input) : json({ error: "Invalid test run" }, 400);
    }
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
  }
  if (url.pathname === "/api/tms/defects") {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
    return json(await readDefects(db));
  }
  const runMatch = url.pathname.match(/^\/api\/tms\/runs\/([a-zA-Z0-9_-]{1,80})$/);
  if (runMatch) {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
    return readRun(db, runMatch[1]);
  }
  const completeMatch = url.pathname.match(/^\/api\/tms\/runs\/([a-zA-Z0-9_-]{1,80})\/complete$/);
  if (completeMatch) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
    const body = await request.json().catch(() => null);
    if (body !== null && (typeof body !== "object" || Array.isArray(body) || (body.force !== undefined && typeof body.force !== "boolean"))) return json({ error: "Invalid completion request" }, 400);
    return completeRun(db, completeMatch[1], body?.force === true);
  }
  const abortMatch = url.pathname.match(/^\/api\/tms\/runs\/([a-zA-Z0-9_-]{1,80})\/abort$/);
  if (abortMatch) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
    return abortRun(db, abortMatch[1]);
  }
  const runCaseMatch = url.pathname.match(/^\/api\/tms\/runs\/([a-zA-Z0-9_-]{1,80})\/cases\/([a-zA-Z0-9_-]{1,80})$/);
  if (runCaseMatch) {
    if (request.method !== "PATCH") return json({ error: "Method not allowed" }, 405, { Allow: "PATCH" });
    const input = validateRunCaseResult(await request.json().catch(() => null));
    return input ? updateRunCase(db, runCaseMatch[1], runCaseMatch[2], input) : json({ error: "Invalid run case result" }, 400);
  }
  const evidenceMatch = url.pathname.match(/^\/api\/tms\/runs\/([a-zA-Z0-9_-]{1,80})\/cases\/([a-zA-Z0-9_-]{1,80})\/evidence$/);
  if (evidenceMatch) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
    const input = validateEvidence(await request.json().catch(() => null));
    return input ? addEvidence(db, evidenceMatch[1], evidenceMatch[2], input) : json({ error: "Invalid Google Drive evidence link" }, 400);
  }
  const defectMatch = url.pathname.match(/^\/api\/tms\/runs\/([a-zA-Z0-9_-]{1,80})\/cases\/([a-zA-Z0-9_-]{1,80})\/defects$/);
  if (defectMatch) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
    const input = validateDefect(await request.json().catch(() => null));
    return input ? createDefect(db, defectMatch[1], defectMatch[2], input) : json({ error: "Invalid defect" }, 400);
  }
  const defectUpdateMatch = url.pathname.match(/^\/api\/tms\/defects\/([a-zA-Z0-9_-]{1,80})$/);
  if (defectUpdateMatch) {
    if (request.method !== "PATCH") return json({ error: "Method not allowed" }, 405, { Allow: "PATCH" });
    const input = validateDefectUpdate(await request.json().catch(() => null));
    return input ? updateDefect(db, defectUpdateMatch[1], input) : json({ error: "Invalid defect update" }, 400);
  }
  const caseMatch = url.pathname.match(/^\/api\/tms\/cases\/([a-zA-Z0-9_-]{1,80})$/);
  if (caseMatch) {
    if (request.method === "DELETE") return deleteCase(db, caseMatch[1]);
    if (request.method !== "PATCH") return json({ error: "Method not allowed" }, 405, { Allow: "PATCH, DELETE" });
    const input = validateCase(await request.json().catch(() => null));
    return input ? updateCase(db, caseMatch[1], input) : json({ error: "Invalid test case" }, 400);
  }
  const planMatch = url.pathname.match(/^\/api\/tms\/plans\/([a-zA-Z0-9_-]{1,80})$/);
  if (planMatch) {
    if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405, { Allow: "PUT" });
    const input = validatePlan(await request.json().catch(() => null));
    return input ? savePlan(db, planMatch[1], input, false) : json({ error: "Invalid test plan" }, 400);
  }
  return json({ error: "TMS endpoint was not found" }, 404);
}

export { readRun, validateCase, validateDefectUpdate, validatePlan, validateRun, validateRunCaseResult, validateSuite };
