const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const api = import(pathToFileURL(path.resolve(__dirname, "../worker/tms-api.mjs")).href);

test("accepts a legacy checklist case while preserving its case ID", async () => {
  const { validateCase } = await api;
  assert.deepEqual(validateCase({
    caseKey: "AUTH-001",
    suiteId: "auth-suite",
    title: "Guest user opens Login dialog from the header",
    expectedResult: "Login dialog is visible",
    priority: "critical",
    executionScope: "smoke",
    tags: ["Login", "Smoke", "Login"],
    steps: [{ action: "Open Login", testData: "Guest", expectedResult: "Dialog is visible" }],
  }), {
    caseKey: "AUTH-001",
    suiteId: "auth-suite",
    title: "Guest user opens Login dialog from the header",
    expectedResult: "Login dialog is visible",
    preconditions: "",
    notes: "",
    priority: "critical",
    executionScope: "smoke",
    status: "ready",
    automationStatus: "manual",
    tags: ["Login", "Smoke"],
    steps: [{ action: "Open Login", testData: "Guest", expectedResult: "Dialog is visible" }],
  });
});

test("rejects malformed manual case IDs and unsupported checklist values", async () => {
  const { validateCase } = await api;
  assert.equal(validateCase({ caseKey: "auth 1", suiteId: "auth", title: "Case" }), null);
  assert.equal(validateCase({ caseKey: "AUTH-1", suiteId: "auth", title: "Case", priority: "urgent" }), null);
});

test("accepts a root suite or a nested suite", async () => {
  const { validateSuite } = await api;
  assert.deepEqual(validateSuite({ name: "Auth" }), { name: "Auth", description: "", parentId: null });
  assert.deepEqual(validateSuite({ name: "Login", parentId: "auth-suite" }), { name: "Login", description: "", parentId: "auth-suite" });
});

test("retains all editable repository fields", async () => {
  const { validateCase } = await api;
  assert.deepEqual(validateCase({
    caseKey: "AUTH-002", suiteId: "suite_2", title: "Can reset password", expectedResult: "Reset email arrives", preconditions: "Registered user", notes: "Check spam folder", priority: "high", executionScope: "smoke", status: "draft", automationStatus: "to_be_automated", tags: ["Auth", "Email"], steps: [{ action: "Open reset form", testData: "qa@example.com", expectedResult: "Email is accepted" }],
  }), {
    caseKey: "AUTH-002", suiteId: "suite_2", title: "Can reset password", expectedResult: "Reset email arrives", preconditions: "Registered user", notes: "Check spam folder", priority: "high", executionScope: "smoke", status: "draft", automationStatus: "to_be_automated", tags: ["Auth", "Email"], steps: [{ action: "Open reset form", testData: "qa@example.com", expectedResult: "Email is accepted" }],
  });
});

test("rejects a step without an action", async () => {
  const { validateCase } = await api;
  assert.equal(validateCase({ caseKey: "AUTH-003", suiteId: "suite_3", title: "Invalid step", steps: [{ action: "", testData: "", expectedResult: "" }] }), null);
});

test("accepts an ordered test plan selection", async () => {
  const { validatePlan } = await api;
  assert.deepEqual(validatePlan({ name: "Release smoke", description: "Before production deploy", caseIds: ["case_a", "case_b", "case_a"] }), {
    name: "Release smoke", description: "Before production deploy", status: "active", caseIds: ["case_a", "case_b"],
  });
  assert.equal(validatePlan({ name: "Broken", caseIds: "case_a" }), null);
});

test("validates the metadata required to start a run", async () => {
  const { validateRun, validateRunCaseResult } = await api;
  assert.deepEqual(validateRun({ planId: "plan_1", name: "Release smoke", environment: "Staging", buildLabel: "v1.2.3", executorName: "QA" }), { planId: "plan_1", name: "Release smoke", environment: "Staging", buildLabel: "v1.2.3", executorName: "QA" });
  assert.equal(validateRun({ planId: "plan_1", name: "Missing environment", environment: "" }), null);
  assert.deepEqual(validateRunCaseResult({ result: "failed", resultComment: "Login is unavailable", durationSeconds: 42 }), { result: "failed", resultComment: "Login is unavailable", durationSeconds: 42 });
});

test("returns evidence and defects with their immutable run case", async () => {
  const { readRun } = await api;
  const run = { id: "run_1", runNumber: 1, name: "Smoke", environment: "Staging" };
  const runCases = [{ id: "run_case_1", caseKey: "AUTH-001", title: "Signs in", stepsJson: "[]" }];
  const evidence = [{ id: "evidence_1", runCaseId: "run_case_1", label: "Screenshot", url: "https://drive.google.com/file/d/1" }];
  const defects = [{ id: "defect_1", runCaseId: "run_case_1", defectNumber: 7, title: "Login fails", severity: "high", status: "open", externalIssueUrl: "" }];
  const db = {
    prepare(sql) {
      const result = sql.includes("FROM tms_evidence_links") ? evidence : sql.includes("FROM tms_defects") ? defects : sql.includes("FROM tms_run_cases") ? runCases : null;
      return { bind() { return { first: async () => run, all: async () => ({ results: result || [] }) }; } };
    },
  };
  const response = await readRun(db, "run_1");
  const payload = await response.json();
  assert.deepEqual(payload.cases[0].evidence, evidence);
  assert.deepEqual(payload.cases[0].defects, defects);
  assert.deepEqual(payload.cases[0].steps, []);
});

test("validates defect lifecycle updates", async () => {
  const { validateDefectUpdate } = await api;
  assert.deepEqual(validateDefectUpdate({ status: "resolved", externalIssueUrl: "https://linear.app/team/issue/QA-7" }), { status: "resolved", externalIssueUrl: "https://linear.app/team/issue/QA-7" });
  assert.equal(validateDefectUpdate({ status: "closed", externalIssueUrl: "" }), null);
  assert.equal(validateDefectUpdate({ status: "open", externalIssueUrl: "http://tracker.local/1" }), null);
});
