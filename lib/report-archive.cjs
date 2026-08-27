const fs = require("fs");
const path = require("path");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function copyDirectory(source, destination) {
  fs.rmSync(destination, { force: true, recursive: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function fallbackMetadata(id) {
  const match = id.match(
    /(?:(\d{4}-\d{2}-\d{2})-(?:(api|ui|integrations)-)?run-)?(\d+)-(success|failure)$/,
  );
  return {
    id,
    createdAt: match?.[1]
      ? `${match[1]}T00:00:00.000Z`
      : new Date(0).toISOString(),
    runId: Number(match?.[3]) || 0,
    status: match?.[4] === "success" ? "passed" : "failed",
    type: match?.[2] || "api",
    environment: "Unknown",
  };
}

function readTests(reportDirectory, metadata) {
  if (Array.isArray(metadata.tests)) return metadata.tests;
  return readJson(
    path.join(reportDirectory, "widgets/status-chart.json"),
    [],
  ).map((test) => ({
    name: test.name,
    status: test.status,
  }));
}

function readReport(reportsDirectory, id) {
  const directory = path.join(reportsDirectory, id);
  const metadata = {
    ...fallbackMetadata(id),
    ...readJson(path.join(directory, ".qa-report.json"), {}),
  };
  const summary = readJson(path.join(directory, "widgets/summary.json"), {});
  const statistic = summary.statistic || {};
  const time = summary.time || {};

  return {
    ...metadata,
    id,
    href: `./reports/${encodeURIComponent(id)}/`,
    reportName: summary.reportName || "Allure Report",
    createdAt: metadata.createdAt || new Date(0).toISOString(),
    runId: Number(metadata.runId) || 0,
    duration: Number(time.duration) || 0,
    startedAt: Number(time.start) || null,
    total: Number(statistic.total) || 0,
    passed: Number(statistic.passed) || 0,
    failed: Number(statistic.failed) || 0,
    broken: Number(statistic.broken) || 0,
    skipped: Number(statistic.skipped) || 0,
    unknown: Number(statistic.unknown) || 0,
    type: String(metadata.type || "api").toLowerCase(),
    environment: String(metadata.environment || "Unknown"),
    branch: metadata.branch || "",
    commit: metadata.commit || "",
    workflowUrl: metadata.workflowUrl || "",
    commitUrl: metadata.commitUrl || "",
    branchUrl: metadata.branchUrl || "",
    tests: readTests(directory, metadata),
  };
}

function listReports(reportsDirectory) {
  if (!fs.existsSync(reportsDirectory)) return [];
  return fs
    .readdirSync(reportsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readReport(reportsDirectory, entry.name));
}

function writeReportMetadata(reportDirectory, context, summary) {
  const statistic = summary.statistic || {};
  fs.writeFileSync(
    path.join(reportDirectory, ".qa-report.json"),
    JSON.stringify({
      ...context,
      status:
        Number(statistic.failed || 0) + Number(statistic.broken || 0) > 0
          ? "failed"
          : "passed",
      tests: readTests(reportDirectory, {}),
    }),
  );
}

module.exports = { copyDirectory, listReports, readJson, writeReportMetadata };
