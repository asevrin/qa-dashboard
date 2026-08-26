# QA Dashboard

A reusable, private Allure report portal for Playwright test projects. It keeps report history in Git, deploys a static dashboard to Cloudflare Workers, protects it with a custom login, and provides filtering, trends, quality gates, regression comparison, pagination, dark mode, and optional Slack alerts.

The package is deliberately separate from the test framework. A test repository owns only its configuration, generated GitHub workflow, and Cloudflare deployment name.

## What it provides

- a dashboard for API and UI Allure runs, with search, filters, pagination and theme selection;
- up to 30 historical reports by default, sorted by creation time rather than folder name;
- Allure report navigation back to the dashboard;
- regression analysis against the previous run of the same type and environment;
- `Ready`, `At risk`, and `Blocked` quality gates;
- a Cloudflare Worker with a real HTML login form and seven-day signed session;
- optional Slack notification when a compatible run introduces new failures.

## Requirements

- Node.js 20+ and pnpm;
- a test project that generates a standard `allure-report/` directory;
- GitHub Actions and a `reports` branch in the same repository;
- a Cloudflare account with a Workers subdomain.

## Install in a test repository

Until the package is published to npm, install a tagged GitHub release:

```bash
pnpm add -D github:asevrin/qa-dashboard#v0.1.0
```

From the root of the test repository, initialize it. Choose a globally unique Worker name and replace the test command when necessary:

```bash
pnpm exec qa-dashboard init \
  --project-name="Client X" \
  --worker-name="client-x-qa-reports" \
  --test-command="pnpm test:api" \
  --report-type=api \
  --environment=Staging
```

The command creates:

```text
qa-dashboard.config.json
qa-dashboard.wrangler.jsonc
.github/workflows/qa-dashboard.yml
```

It also adds generated data and the temporary secrets file to `.gitignore`. It never overwrites an existing generated file unless `--force` is explicitly passed.

## One-time repository setup

Create the archive branch once, before the first Actions run:

```bash
git switch --orphan reports
git rm -rf .
git commit --allow-empty -m "Initialize QA report archive"
git push origin reports
git switch main
```

Create these GitHub repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Required | Purpose |
|---|---:|---|
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare Workers edit token |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `REPORTS_USERNAME` | Yes | Portal login username |
| `REPORTS_PASSWORD` | Yes | Portal login password |
| `REPORTS_SESSION_SECRET` | Yes | Cookie-signing secret, e.g. `openssl rand -hex 32` |
| `SLACK_WEBHOOK_URL` | No | Enables Slack notifications for new failures |
| `REPORTS_PORTAL_URL` | No | Adds an Open dashboard button to Slack |

Your test target secrets (for example `API_BASE_URL`) remain specific to the test project. Add them to the `Run tests` workflow step, rather than to this package.

The generated Worker configuration uses `workers.dev`. The first workflow deployment creates or updates the Worker. Do not put a Cloudflare Access policy in front of it when using this package’s built-in login form: Access would block visitors before they reach the form.

## Workflow adaptation

The generated workflow is a working API example. Edit only the project-specific parts:

1. Add test target environment variables to **Run tests**, if required.
2. Change the test command by regenerating the workflow with `init --force`, or edit that one step.
3. Change `REPORT_TYPE` and `REPORT_ENVIRONMENT` for the job.

For UI and API suites, use separate jobs (or duplicate the publishing part) and set `REPORT_TYPE: ui` / `REPORT_TYPE: api`. Each job needs a distinct Allure output directory if they run in parallel.

The workflow intentionally uses this command for Wrangler:

```bash
npm exec --yes --package=wrangler@4 -- wrangler deploy --config=qa-dashboard.wrangler.jsonc --secrets-file=.report-secrets.json
```

The `--` separator matters: it ensures `--config` is passed to Wrangler rather than npm.

## Configuration

`qa-dashboard.config.json` belongs to the consuming test repository:

```json
{
  "projectName": "Client X",
  "reportType": "api",
  "environment": "Staging",
  "allureReportDirectory": "allure-report",
  "reportsSiteDirectory": "reports-site/site",
  "retentionLimit": 30,
  "qualityGates": {
    "readyPassRate": 95,
    "blockedPassRate": 85
  }
}
```

`Ready` means no failed/broken tests, pass rate at or above `readyPassRate`, and no newly failing test. `Blocked` means a newly failing test or pass rate below `blockedPassRate`. Other outcomes are `At risk`.

## Local commands

```bash
pnpm exec qa-dashboard build
pnpm exec qa-dashboard create-secrets .report-secrets.json
pnpm exec qa-dashboard notify-slack reports-site/site/dashboard-data/reports.json
```

`build` requires `RUN_ID` and `TEST_STATUS`, unless `REPORT_NAME` is supplied. The GitHub workflow provides these automatically.

## Development and release

Clone this repository and run:

```bash
pnpm test
pnpm run check
```

Release a new version with a Git tag after the changes are merged:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Consumer repositories then update the git dependency to that tag. Publishing to npm or GitHub Packages can be added later without changing the package API.
