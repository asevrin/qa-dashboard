#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { CONFIG_FILE, defaults } = require("../lib/config.cjs");
const { buildReportSite } = require("../lib/build-report-site.cjs");
const { createReportSecrets } = require("../lib/create-report-secrets.cjs");
const { notifySlack } = require("../lib/notify-slack.cjs");
const { publishPerformance } = require("../lib/publish-performance.cjs");

const packageRoot = path.resolve(__dirname, "..");
const rootDirectory = process.cwd();
const [command, ...argumentsList] = process.argv.slice(2);

function option(name, fallback) {
  const prefix = `--${name}=`;
  const value = argumentsList.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return argumentsList.includes(`--${name}`);
}

function buildOptions() {
  return {
    source: option("source"),
    type: option("type"),
    environment: option("environment"),
    name: option("name"),
    runId: option("run-id"),
    status: option("status"),
  };
}

function performanceOptions() {
  return {
    summary: option("summary"),
    html: option("html"),
    scenario: option("scenario"),
    environment: option("environment"),
    runId: option("run-id"),
    status: option("status"),
    name: option("name"),
  };
}

function replaceTokens(template, tokens) {
  return Object.entries(tokens).reduce(
    (content, [token, value]) => content.replaceAll(`{{${token}}}`, value),
    template,
  );
}

function writeTemplate(templateName, targetPath, tokens, force) {
  if (fs.existsSync(targetPath) && !force)
    throw new Error(`${path.relative(rootDirectory, targetPath)} already exists. Use --force to replace it.`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const source = fs.readFileSync(path.join(packageRoot, "templates", templateName), "utf8");
  fs.writeFileSync(targetPath, replaceTokens(source, tokens));
}

function addGitignoreEntries() {
  const target = path.join(rootDirectory, ".gitignore");
  const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  const entries = ["allure-report/", "allure-results/", "reports-site/", ".report-secrets.json"];
  const missing = entries.filter((entry) => !existing.split(/\r?\n/).includes(entry));
  if (missing.length) fs.appendFileSync(target, `${existing && !existing.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`);
}

function init() {
  const force = hasFlag("force");
  const projectName = option("project-name", path.basename(rootDirectory));
  const workerName = option("worker-name", "qa-reports");
  const testCommand = option("test-command", "pnpm test");
  const reportType = option("report-type", defaults.reportType);
  const environment = option("environment", defaults.environment);
  const tokens = {
    PROJECT_NAME: projectName,
    WORKER_NAME: workerName,
    TEST_COMMAND: testCommand,
    REPORT_TYPE: reportType,
    ENVIRONMENT: environment,
  };

  writeTemplate("qa-dashboard.config.json", path.join(rootDirectory, CONFIG_FILE), tokens, force);
  writeTemplate("wrangler.jsonc", path.join(rootDirectory, "qa-dashboard.wrangler.jsonc"), tokens, force);
  writeTemplate("github-workflow.yml", path.join(rootDirectory, ".github/workflows/qa-dashboard.yml"), tokens, force);
  addGitignoreEntries();

  console.log(`QA Dashboard initialized for ${projectName}.`);
  console.log("Next: create the reports branch, add GitHub secrets, then commit the generated files.");
}

function help() {
  console.log(`Usage:
  qa-dashboard init [--project-name=NAME] [--worker-name=NAME] [--test-command='pnpm test:api'] [--report-type=api] [--environment=Staging] [--force]
  qa-dashboard build [--source=PATH] [--type=api|ui|integrations] [--environment=NAME] [--run-id=ID] [--status=success|failure] [--name=REPORT_NAME]
  qa-dashboard publish-performance --summary=PATH --scenario=public|auth|mixed [--html=PATH] [--environment=NAME] [--run-id=ID] [--status=success|failure]
  qa-dashboard create-secrets [output-file]
  qa-dashboard notify-slack <reports.json>

Run \"qa-dashboard init\" from the root of a Playwright + Allure test repository.`);
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") return help();
  if (command === "init") return init();
  if (command === "build") {
    const result = buildReportSite({ rootDirectory, options: buildOptions() });
    return console.log(`Published ${result.reportId}; retained ${result.retention.kept} reports.`);
  }
  if (command === "publish-performance") {
    const run = publishPerformance({ rootDirectory, options: performanceOptions() });
    return console.log(`Published performance run ${run.id}; gate: ${run.gate}.`);
  }
  if (command === "create-secrets") return createReportSecrets(argumentsList[0] || ".report-secrets.json");
  if (command === "notify-slack") return notifySlack(argumentsList[0]);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
