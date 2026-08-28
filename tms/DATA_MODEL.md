# Manual TMS data model

## Test repository

| Entity | Core fields | Rules |
|---|---|---|
| Suite | name, parent, description | Nested tree; a suite cannot be deleted while it contains cases or child suites. |
| Test case | stable case ID, title, priority, execution scope, status, automation status, preconditions, expected result, notes, tags, steps | Existing IDs such as `AUTH-001` are preserved. `Smoke`, `Core`, and `Full` are execution scopes, not suites. |
| Step | action, test data, expected result, position | Optional for imported checklist cases; standard manual cases can have many. |

## Test plans and runs

| Entity | Core fields | Rules |
|---|---|---|
| Test plan | name, description, status, ordered cases | Reusable selection for Smoke, Regression, or release testing. |
| Test run | run number, plan, environment, build, executor, lifecycle status | A run starts from one active test plan. |
| Run case | case snapshot, position, result, comment, duration, execution timestamp | The snapshot never changes after run creation. Results: Pending, Passed, Failed, Blocked, Skipped. |

## Defects and evidence

| Entity | Core fields | Rules |
|---|---|---|
| Defect | defect number, linked failed or blocked run case, severity, lifecycle status, steps, actual/expected, optional external HTTPS URL | Creating a defect does not mutate the historical run result. |
| Evidence link | run case, label, URL | Stores only a Google Drive link; images and videos are never uploaded to Cloudflare. |

## First-release defaults

- Environments are typed per run (`Staging`, `Production`, or another explicit value), not maintained in a settings page yet.
- Executor is typed per run because the current private portal uses shared basic authentication.
- Test case IDs remain stable after creation; the UI will not offer renaming in the initial release.
