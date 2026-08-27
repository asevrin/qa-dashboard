const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { publishPerformance } = require("../lib/publish-performance.cjs");

test("publishes normalized k6 metrics and keeps the source summary", () => {
  const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qa-dashboard-"));
  const summary = path.resolve(__dirname, "fixtures/k6-summary.json");
  fs.writeFileSync(
    path.join(rootDirectory, "qa-dashboard.config.json"),
    JSON.stringify({ reportsSiteDirectory: "reports-site/site" }),
  );

  const run = publishPerformance({
    rootDirectory,
    options: {
      summary,
      scenario: "public",
      environment: "Staging",
      runId: "9",
      status: "success",
    },
  });

  assert.equal(run.gate, "ready");
  assert.equal(run.p95, 420);
  assert.equal(run.p99, 810);
  assert.equal(run.requestsPerSecond, 20);
  assert.ok(run.id.includes("performance-public-run-9-success"));
  assert.ok(
    fs.existsSync(
      path.join(rootDirectory, "reports-site/site/performance", run.id, "summary.json"),
    ),
  );
  const index = JSON.parse(
    fs.readFileSync(path.join(rootDirectory, "reports-site/site/dashboard-data/performance.json"), "utf8"),
  );
  assert.equal(index.runs[0].id, run.id);
});
