# Test runs contract

## Creation

A test run is created from exactly one active test plan. The API copies the plan's ordered cases into `tms_run_cases` at that moment, including the case key, title, priority, scope, preconditions, expected result, notes, and serialized steps.

The source repository can change after a run starts; it never changes the run snapshot.

## Result model

Results are recorded per run case only:

- `pending`
- `passed`
- `failed`
- `blocked`
- `skipped`

Steps are instructions. They do not have individual execution results in the first release.

`failed` and `blocked` accept a result comment. Evidence is an external Google Drive URL. A defect may link back to a failed or blocked run case.

## Run lifecycle

- A new run starts as `in_progress`.
- It becomes `completed` through an explicit completion action.
- Pending cases remain visible in the final summary; completing with pending cases requires an explicit confirmation in the UI.
- A completed or aborted run is read-only. Results, evidence, and defects cannot be added afterwards; reopening is not in the initial endpoint set.
