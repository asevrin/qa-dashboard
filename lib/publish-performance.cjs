const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./config.cjs");
const { listReports } = require("./report-archive.cjs");
const { enrichReports, sortNewestFirst } = require("./report-domain.cjs");
const { listPerformanceRuns, writePerformanceRun } = require("./performance-archive.cjs");
const { normalizeK6Summary, performanceGate } = require("./performance-domain.cjs");
const { publishPortalAssets } = require("./site-assets.cjs");

function githubContext(environment) {
  const server = environment.GITHUB_SERVER_URL;
  const repository = environment.GITHUB_REPOSITORY;
  const repositoryUrl = server && repository ? `${server}/${repository}` : "";
  const commit = environment.GITHUB_SHA || "";
  const branch = environment.GITHUB_REF_NAME || "";
  return {
    branch,
    branchUrl: repositoryUrl && branch ? `${repositoryUrl}/tree/${branch}` : "",
    commit: commit.slice(0, 7),
    commitUrl: repositoryUrl && commit ? `${repositoryUrl}/commit/${commit}` : "",
    workflowUrl:
      repositoryUrl && environment.GITHUB_RUN_ID
        ? `${repositoryUrl}/actions/runs/${environment.GITHUB_RUN_ID}`
        : "",
  };
}

function requireOptions(options) {
  const missing = ["summary", "scenario"].filter((name) => !options[name]);
  if (missing.length) throw new Error(`Missing required performance options: ${missing.join(", ")}`);
}

function publishPerformance({ rootDirectory = process.cwd(), environment = process.env, options = {} } = {}) {
  requireOptions(options);
  const config = loadConfig(rootDirectory);
  const summaryPath = path.resolve(rootDirectory, options.summary);
  if (!fs.existsSync(summaryPath)) throw new Error(`k6 summary does not exist: ${summaryPath}`);

  const createdAt = new Date().toISOString();
  const runId = options.runId || environment.RUN_ID || "manual";
  const status = options.status || environment.TEST_STATUS || "success";
  const scenario = String(options.scenario).toLowerCase();
  const runIdPart = String(runId).replace(/[^a-zA-Z0-9_-]/g, "-");
  const id = options.name || `${createdAt.slice(0, 10)}-performance-${scenario}-run-${runIdPart}-${status}`;
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const metrics = normalizeK6Summary(summary);
  const site = path.resolve(rootDirectory, config.reportsSiteDirectory);
  const directory = path.join(site, "performance");
  const run = {
    id,
    createdAt,
    runId: String(runId),
    status,
    scenario,
    environment: options.environment || environment.REPORT_ENVIRONMENT || config.environment,
    ...githubContext(environment),
    ...metrics,
    gate: performanceGate(metrics, config.performanceGates),
  };

  writePerformanceRun(
    path.join(directory, id),
    run,
    summaryPath,
    options.html ? path.resolve(rootDirectory, options.html) : "",
  );

  const runs = listPerformanceRuns(directory)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .slice(0, config.performanceRetentionLimit);
  const retained = new Set(runs.map((item) => item.id));
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !retained.has(entry.name))
      fs.rmSync(path.join(directory, entry.name), { force: true, recursive: true });
  }

  const reports = enrichReports(
    listReports(path.join(site, "reports")).sort(sortNewestFirst).slice(0, config.retentionLimit),
    config.qualityGates,
  );
  publishPortalAssets({
    portalDirectory: path.resolve(__dirname, "../portal"),
    siteDirectory: site,
    generatedAt: createdAt,
    reports,
    performanceRuns: runs,
    retention: { kept: reports.length, limit: config.retentionLimit },
  });
  return run;
}

module.exports = { publishPerformance };
