# QA Dashboard

A reusable, private QA reporting portal for Playwright and k6 projects. It keeps report history in Git, deploys a static dashboard to Cloudflare Workers, protects it with a custom login, and provides functional and performance trends, quality gates, regression comparison, pagination, dark mode, and optional Slack alerts.

The package is deliberately separate from the test framework. A test repository owns only its configuration, generated GitHub workflow, and Cloudflare deployment name.

## What it provides

- a dashboard for API, UI and integration Allure runs, with search, filters, pagination and theme selection;
- a performance section for k6 runs, including p95, p99, error rate, RPS, quality gates and HTML report links;
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
pnpm add -D github:asevrin/qa-dashboard#v0.2.0
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
| `K6_AUTH_PASSWORD` | No | Password for k6 authenticated scenarios, if that project uses one |

Your test target secrets (for example `API_BASE_URL`) remain specific to the test project. Add them to the `Run tests` workflow step, rather than to this package.

The generated Worker configuration uses `workers.dev`. The first workflow deployment creates or updates the Worker. Do not put a Cloudflare Access policy in front of it when using this package’s built-in login form: Access would block visitors before they reach the form.

## Manual TMS database

Manual TMS is optional and uses a consumer-owned D1 database. Create the database in the consumer Cloudflare account, then add its real ID to `qa-dashboard.wrangler.jsonc`:

```jsonc
"d1_databases": [{
  "binding": "QA_TMS_DB",
  "database_name": "client-x-qa-tms",
  "database_id": "<Cloudflare D1 database ID>",
  "migrations_dir": "./node_modules/@asevrin/qa-dashboard/tms/migrations"
}]
```

Apply the migrations before the first Worker deploy. The package ships the migrations under `tms/migrations`; without this binding the TMS API deliberately returns `503` instead of writing report data.

### Local Manual TMS

From this package repository, apply local migrations and start the Worker:

```bash
pnpm tms:db:local
pnpm tms:dev
```

Open `http://localhost:8787/tms/`. The local D1 database is intentionally separate from any remote Cloudflare D1 database.

## Workflow adaptation

The generated workflow has independent API, UI, integration and performance jobs. It uses path filters for functional test changes, provides manual suite/environment/scenario inputs, and keeps a nightly full functional regression plus a k6 smoke run.

Edit only the project-specific parts:

1. Add test target secrets to every relevant functional job.
2. Adjust path filters to the repository’s actual folders.
3. Remove a job if that project does not have the corresponding suite.
4. Keep k6 manual/scheduled unless the target environment explicitly allows automated load tests.

Test jobs upload artifacts. The single `publish-reports` job downloads them, builds history sequentially, commits once to `reports`, and deploys once. This is what prevents parallel Git conflicts.

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
  "reportTypes": ["api", "ui", "integrations"],
  "environment": "Staging",
  "allureReportDirectory": "allure-report",
  "reportsSiteDirectory": "reports-site/site",
  "retentionLimit": 30,
  "performanceRetentionLimit": 30,
  "qualityGates": {
    "readyPassRate": 95,
    "blockedPassRate": 85
  },
  "performanceGates": {
    "readyErrorRate": 0.01,
    "blockedErrorRate": 0.03,
    "readyP95Ms": 800,
    "blockedP95Ms": 1500,
    "readyP99Ms": 1500,
    "blockedP99Ms": 3000
  }
}
```

`Ready` means no failed/broken tests, pass rate at or above `readyPassRate`, and no newly failing test. `Blocked` means a newly failing test or pass rate below `blockedPassRate`. Other outcomes are `At risk`.

## Local commands

```bash
pnpm exec qa-dashboard build
pnpm exec qa-dashboard build --source=allure-ui --type=ui --environment=Staging --run-id=42 --status=success
pnpm exec qa-dashboard publish-performance --summary=performance-results/public/summary.json --html=performance-results/public/report.html --scenario=public --environment=Staging --run-id=42 --status=success
pnpm exec qa-dashboard create-secrets .report-secrets.json
pnpm exec qa-dashboard notify-slack reports-site/site/dashboard-data/reports.json
```

`build` requires `RUN_ID` and `TEST_STATUS`, unless `REPORT_NAME` is supplied. The CLI also accepts `--source`, `--type`, `--environment`, `--run-id` and `--status`, which are used by the sequential publisher job.

## Development and release

Clone this repository and run:

```bash
pnpm test
pnpm run check
```

Release a new version with a Git tag after the changes are merged:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Consumer repositories then update the git dependency to that tag. Publishing to npm or GitHub Packages can be added later without changing the package API.
