# QA Dashboard — delivery plan

## Goal

Deliver a reusable QA reporting platform for Playwright + Allure + k6 projects. It must run only relevant checks, preserve a reliable report history, present functional and performance results in one private dashboard, and support controlled manual launches from that dashboard.

This document describes the v1 scope for the next delivery iteration. The target is a working, verified implementation in one focused day; deployment integrations that depend on external frontend/backend pipelines are prepared last.

## Target architecture

```text
GitHub event / schedule / manual dashboard launch
                    ↓
             Detect changed areas
                    ↓
    API / UI / integrations / k6 test jobs
                    ↓
          Raw reports stored as CI artifacts
                    ↓
      One sequential publish-and-deploy job
                    ↓
 reports branch → Cloudflare Worker → private dashboard
```

Only one job writes to the `reports` branch. Test jobs may run in parallel, but they never publish history themselves. This prevents merge conflicts and avoids lost reports.

## 1. Package contract and configuration

Extend `@asevrin/qa-dashboard` so that a consuming project configures, rather than forks, the platform.

- Support report types: `api`, `ui`, `integrations`, `performance`.
- Support per-run type, environment, source directory and metadata.
- Support configurable retention and functional quality gates.
- Add configurable performance thresholds.
- Allow one publish job to process several downloaded artifacts sequentially.
- Keep UI, Worker, report parsing, templates and CLI inside the package.
- Version and tag the package after verification, then update `rush-tests` to that tag.

Example performance defaults:

| Metric | Ready | At risk | Blocked |
|---|---:|---:|---:|
| Error rate | `< 1%` | `1–3%` | `≥ 3%` |
| p95 | `< 800 ms` | `800–1500 ms` | `≥ 1500 ms` |
| p99 | `< 1500 ms` | `1500–3000 ms` | `≥ 3000 ms` |

These are placeholders, not product SLOs. They must be editable in project configuration after baseline runs.

## 2. Test selection by changed paths

Use a standard GitHub Actions path-filter step. Do not run all suites when a change cannot affect them.

| Changed paths in `rush-tests` | Selected suite |
|---|---|
| `tests/api/**`, `src/api/**` | API |
| `tests/ui/**` | UI |
| `tests/integration/**` | Integrations |
| `performance/**`, `scripts/generate-k6-routes.js` | Relevant k6 scenario |
| `src/core/**`, `playwright.config.ts`, dependency files, dashboard config | API + UI + integrations |
| Documentation-only changes | No test job |

Shared configuration must deliberately select all functional suites: it is safer and clearer than trying to infer impact from shared fixtures, environment handling or reporters.

## 3. Workflow modes

One workflow supports these sources of truth:

| Trigger | Test scope | Publish to dashboard |
|---|---|---:|
| Pull request | Changed suites only | No; artifacts only |
| Push to `main` | Changed suites only | Yes |
| Manual dispatch | User-selected suite and environment | Yes |
| Nightly schedule | Full API + UI + integrations regression | Yes |
| k6 manual dispatch / scheduled smoke | Selected performance scenario | Yes |

Performance tests do not run on every push or every application deployment by default. They create real load and should remain explicitly controlled.

## 4. CI job topology

```text
detect-changes
  ├─ api-tests
  ├─ ui-tests
  ├─ integration-tests
  └─ k6-performance
         ↓
  publish-reports-and-deploy
```

Each test job:

1. Runs only when selected by path filters or manual input.
2. Generates its own Allure report or k6 report.
3. Uploads the generated report and metadata as a GitHub artifact.
4. Preserves artifacts even when tests fail.

The final job:

1. Downloads all available artifacts.
2. Builds each report into history sequentially.
3. Makes one commit to the `reports` branch.
4. Deploys the Cloudflare Worker once.
5. Sends Slack notifications for newly failing functional tests; performance notifications can be added after baseline validation.
6. Marks the workflow failed only after reports have been preserved.

## 5. Functional dashboard coverage

- API runs appear under API.
- UI runs appear under UI.
- Integration runs appear under Integrations.
- All displays every functional run.
- Regression comparison is scoped to the same report type and environment.
- Allure detail pages retain Dashboard and logout navigation.
- Existing filters, search, trend tooltip, pagination, dark/light theme and GitHub release context remain intact.

## 6. Performance reporting

For every k6 run, keep:

- scenario: `public`, `auth`, `mixed`;
- environment, time, commit, branch and workflow link;
- VUs and duration;
- p95, p99, error rate and requests per second;
- configured thresholds and calculated quality gate;
- raw JSON metrics and a detailed HTML report.

Add a Performance section to the dashboard with:

- latest metrics;
- trend charts for p95, p99, error rate and RPS;
- filters by scenario, environment and period;
- links to individual HTML reports;
- Ready / At risk / Blocked status.

Performance data must be modelled separately from Allure test cases. It is not a failed/passed test suite.

## 7. Dashboard-triggered test runs — out of scope

The dashboard is read-only. It does not trigger GitHub Actions workflows and does not store GitHub dispatch credentials. Manual test launches remain available only through GitHub Actions.

## 8. Application deployment triggers — final step

Prepare the QA workflow for external dispatch. When actual frontend/backend deployment pipelines are stable:

- backend deployment dispatches API + integrations;
- frontend deployment dispatches UI;
- coordinated release dispatches the required smoke or full regression;
- deployment environment, commit SHA and deployment link are included in report metadata.

Use `repository_dispatch` or reusable `workflow_call` contracts. Do not copy the QA pipeline into product repositories.

## 9. Verification and documentation

Before release:

- unit-test quality gates, retention, regression comparison, k6 normalization and path-selection rules;
- test API-only, UI-only, shared-change, documentation-only, full manual and k6 manual runs;
- verify reports survive failed test runs;
- verify one report history commit is produced for multi-suite runs;
- verify Cloudflare login/logout, protected run-dispatch endpoint and dark/light theme;
- verify GitHub and Cloudflare secrets never enter logs, generated history or browser code;
- update package README and consuming-project setup documentation;
- create and push the release tag only after all checks pass.

## Out of scope

- Final product-specific SLO/threshold tuning; only configurable defaults are included now.
- Direct integration with frontend/backend deployment workflows until those pipelines are ready.
- TMS functionality (manual cases, checklists, runs and automation mapping). That is a separate future product which can later consume this reporting data.
