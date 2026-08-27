const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./config.cjs");
const { enrichReports, sortNewestFirst } = require("./report-domain.cjs");
const {
  copyDirectory,
  listReports,
  readJson,
  writeReportMetadata,
} = require("./report-archive.cjs");
const { injectNavigation, publishPortalAssets } = require("./site-assets.cjs");
const { listPerformanceRuns } = require("./performance-archive.cjs");

function requireReportIdentity(environment, reportType, createdAt) {
  const runId = environment.RUN_ID;
  const testStatus = environment.TEST_STATUS;
  if (environment.REPORT_NAME) return environment.REPORT_NAME;
  if (!runId || !testStatus)
    throw new Error("REPORT_NAME or both RUN_ID and TEST_STATUS are required");
  return `${createdAt.slice(0, 10)}-${reportType}-run-${runId}-${testStatus}`;
}

function githubContext(environment, createdAt, config) {
  const server = environment.GITHUB_SERVER_URL;
  const repository = environment.GITHUB_REPOSITORY;
  const repositoryUrl = server && repository ? `${server}/${repository}` : "";
  const commit = environment.GITHUB_SHA || "";
  const branch = environment.GITHUB_REF_NAME || "";

  return {
    createdAt,
    runId: environment.RUN_ID,
    type: environment.REPORT_TYPE || config.reportType,
    environment: environment.REPORT_ENVIRONMENT || config.environment,
    branch,
    commit: commit.slice(0, 7),
    commitUrl: repositoryUrl && commit ? `${repositoryUrl}/commit/${commit}` : "",
    branchUrl: repositoryUrl && branch ? `${repositoryUrl}/tree/${branch}` : "",
    workflowUrl:
      repositoryUrl && environment.GITHUB_RUN_ID
        ? `${repositoryUrl}/actions/runs/${environment.GITHUB_RUN_ID}`
        : "",
  };
}

function buildReportSite({
  rootDirectory = process.cwd(),
  environment = process.env,
  options = {},
} = {}) {
  const config = loadConfig(rootDirectory);
  const runEnvironment = {
    ...environment,
    RUN_ID: options.runId || environment.RUN_ID,
    TEST_STATUS: options.status || environment.TEST_STATUS,
  };
  const createdAt = new Date().toISOString();
  const reportEnvironment = options.environment || runEnvironment.REPORT_ENVIRONMENT || config.environment;
  const reportType = String(options.type || runEnvironment.REPORT_TYPE || config.reportType).toLowerCase();
  if (!config.reportTypes.includes(reportType))
    throw new Error(`Unsupported report type: ${reportType}. Allowed: ${config.reportTypes.join(", ")}`);

  const reportId = options.name || requireReportIdentity(runEnvironment, reportType, createdAt);
  const sourceReport = path.resolve(rootDirectory, options.source || config.allureReportDirectory);
  const site = path.resolve(rootDirectory, config.reportsSiteDirectory);
  const packageRoot = path.resolve(__dirname, "..");
  const reportsDirectory = path.join(site, "reports");
  const latestDirectory = path.join(site, "latest");

  if (!fs.existsSync(sourceReport))
    throw new Error(`Allure report directory does not exist: ${sourceReport}`);

  copyDirectory(sourceReport, path.join(reportsDirectory, reportId));
  copyDirectory(sourceReport, latestDirectory);

  const newReportDirectory = path.join(reportsDirectory, reportId);
  const summary = readJson(path.join(sourceReport, "widgets/summary.json"), {});
  writeReportMetadata(
    newReportDirectory,
    {
      ...githubContext(runEnvironment, createdAt, config),
      type: reportType,
      environment: reportEnvironment,
    },
    summary,
  );

  const archivedReports = listReports(reportsDirectory).sort(sortNewestFirst);
  const staleReports = archivedReports.slice(config.retentionLimit);
  staleReports.forEach((report) =>
    fs.rmSync(path.join(reportsDirectory, report.id), { force: true, recursive: true }),
  );

  const reports = enrichReports(archivedReports.slice(0, config.retentionLimit), config.qualityGates);
  const performanceRuns = listPerformanceRuns(path.join(site, "performance"));
  publishPortalAssets({
    portalDirectory: path.join(packageRoot, "portal"),
    siteDirectory: site,
    generatedAt: createdAt,
    reports,
    performanceRuns,
    retention: {
      kept: reports.length,
      removed: staleReports.length,
      limit: config.retentionLimit,
    },
  });

  [latestDirectory, ...reports.map((report) => path.join(reportsDirectory, report.id))].forEach(injectNavigation);
  return { reportId, reports, retention: { kept: reports.length, removed: staleReports.length } };
}

module.exports = { buildReportSite, requireReportIdentity };
