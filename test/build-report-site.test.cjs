const test = require("node:test");
const assert = require("node:assert/strict");
const { requireReportIdentity } = require("../lib/build-report-site.cjs");

test("creates a report ID that remains unique across suite types", () => {
  const createdAt = "2026-08-27T10:00:00.000Z";
  const environment = { RUN_ID: "42", TEST_STATUS: "success" };

  assert.equal(
    requireReportIdentity(environment, "api", createdAt),
    "2026-08-27-api-run-42-success",
  );
  assert.equal(
    requireReportIdentity(environment, "ui", createdAt),
    "2026-08-27-ui-run-42-success",
  );
});

test("accepts an explicit report name", () => {
  assert.equal(
    requireReportIdentity({ REPORT_NAME: "manual-ui-run" }, "ui", "2026-08-27T10:00:00.000Z"),
    "manual-ui-run",
  );
});

test("requires a run identity when no explicit report name is supplied", () => {
  assert.throws(
    () => requireReportIdentity({}, "api", "2026-08-27T10:00:00.000Z"),
    /REPORT_NAME or both RUN_ID and TEST_STATUS are required/,
  );
});
