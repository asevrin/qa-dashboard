# Manual TMS

Manual TMS shares the private Worker login and stores repository data in a consumer-owned Cloudflare D1 database.

## Included workflow

- Test repository with suites, stable Case IDs, properties, tags and instruction-only steps.
- Test plans with ordered case selection.
- Test runs with immutable case and step snapshots.
- Case-level Passed, Failed, Blocked, Skipped and Pending results.
- Evidence as external Google Drive links and defects linked to Failed or Blocked run cases.
- Read-only completed and aborted runs, run summaries and defect lifecycle tracking.
- CSV export and safe CSV import from the Test repository screen.

## CSV import and export

Export creates one CSV containing these columns:

`case_id`, `suite_path`, `title`, `priority`, `scope`, `status`, `automation`, `preconditions`, `expected_result`, `notes`, `tags`, `steps`.

`suite_path`, `tags` and `steps` are JSON values stored inside CSV cells. Import validates this exact header, creates missing suites, creates only new Case IDs and skips existing Case IDs without overwriting them. Importing does not alter plans or historical runs.

For the current checklist conversion, each Google Sheet tab maps to one TMS suite; the spreadsheet's functional `Scope` value is stored as a tag.

## Checklist synchronization

`Synchronize CSV` maintains a source checklist whose stable `case_id` values already exist in TMS. It previews new, updated, unchanged, and archive-candidate cases before any changes are applied. Applying the sync creates new IDs and updates matching IDs in place; existing plans retain their links and historical runs retain their immutable snapshots.

TMS records the CSV file and synchronized content fingerprint for every source-managed case, and keeps a recent sync audit in the dialog. Only cases previously synchronized from the same CSV file become archive candidates. They are archived only when the user explicitly selects the archive confirmation in the preview; no case is deleted automatically.

## Local development

```bash
pnpm tms:db:local
pnpm tms:dev
```

Open `http://localhost:8787/tms/`. Local D1 state and `tms/dev/.dev.vars` are intentionally ignored by git.
