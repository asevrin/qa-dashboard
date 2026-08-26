const test = require("node:test");
const assert = require("node:assert/strict");
const { enrichReports } = require("../lib/report-domain.cjs");

function report(overrides = {}) {
  return {
    id: "run",
    createdAt: "2026-08-27T10:00:00.000Z",
    runId: 1,
    type: "api",
    environment: "Staging",
    total: 10,
    passed: 10,
    failed: 0,
    broken: 0,
    tests: [{ name: "creates user", status: "passed" }],
    ...overrides,
  };
}

test("marks a newly failing test as blocked", () => {
  const reports = enrichReports([
    report({
      id: "current",
      runId: 2,
      createdAt: "2026-08-27T11:00:00.000Z",
      passed: 9,
      failed: 1,
      tests: [{ name: "creates user", status: "failed" }],
    }),
    report({ id: "previous" }),
  ]);

  assert.deepEqual(reports[0].delta.newFailures, ["creates user"]);
  assert.equal(reports[0].gate, "blocked");
});

test("keeps a clean run ready", () => {
  const [cleanReport] = enrichReports([report()]);
  assert.equal(cleanReport.gate, "ready");
});

test("marks persistent failures as at risk", () => {
  const [current] = enrichReports([
    report({
      id: "current",
      runId: 2,
      createdAt: "2026-08-27T11:00:00.000Z",
      passed: 9,
      failed: 1,
      tests: [{ name: "creates user", status: "failed" }],
    }),
    report({
      id: "previous",
      passed: 9,
      failed: 1,
      tests: [{ name: "creates user", status: "failed" }],
    }),
  ]);
  assert.equal(current.gate, "at-risk");
});
