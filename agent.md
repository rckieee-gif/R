# Agent Guide

This repo is the Octavio Poultry Farm Manager workspace. It contains the Vite/React frontend at the root and the Express backend in `farm-backend/`.

## Product Context

Octavio Poultry Farm Manager tracks poultry batch lifecycles, daily logs, feed, mortality, inventory, employee assignments, harvests, ledger records, and farm analytics.

Primary users:

- Farm owner and operation managers reviewing batch performance, finances, and daily operations.
- Data-entry staff logging feed, mortality, weights, harvests, and inventory from phone or tablet.
- Public viewers with read-only access to the current batch.

Design should feel reliable, structured, and fast. Prefer clear operational data over decorative UI.

## Main Commands

Frontend, from the repo root:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

Focused frontend tests:

```bash
npx vitest run src/__tests__/DailyLog.test.jsx
npx vitest run src/__tests__/TodayOperations.test.jsx
```

Backend, from the repo root:

```bash
npm --prefix farm-backend run test:unit
npm --prefix farm-backend run test:regression
npm --prefix farm-backend run test:idempotency
npm --prefix farm-backend run test:isolation
```

## Project Layout

- `src/app/`: app shell and routing.
- `src/features/`: feature screens such as batches, daily logs, dashboard, inventory, ledger, analytics, employees, and harvest.
- `src/shared/`: shared components, hooks, utilities, API client, and domain helpers.
- `src/__tests__/`: frontend tests.
- `farm-backend/`: backend API, migrations, seed scripts, tests, and AI helper code.

## Important Domain Rules

### Explicit DOC Arrival

- Do not treat `totalChicksLoaded` or planned loading rows as confirmed arrival.
- Use `actualChicksArrived` and `getArrivalMetrics(..., { requireExplicitArrival: true })` when a surface needs actual placed/arrived birds.
- Pre-arrival and delayed trucking states must stay neutral until arrived DOC is explicitly recorded.
- Preserve DOA, net placed, arrived DOC, and arrival sample weight when passing batch context into assistant/backend flows.

### Batch Age

- Batch age starts at Day 0 when chicks are unloaded in the building.
- Day 0 is the arrival/unloading date. Day 1 is the following date.
- Use `getAgeDay(startDate, logDate)` from `src/shared/utils/broilerTargets.js`.

### Feed Targets

- Feed targets follow the guide in `BROILER_TARGETS`.
- Day 30 target feed to date is 46.64 bags per 1,000 birds.
- Daily log feed variance should compare cumulative actual feed to the guide target for the chosen day.

### Daily Logs

- Daily log entries are per building and employee share.
- Saving must prevent duplicate submissions while a request is in flight.
- Editing existing daily logs should happen in a modal and must not replace the new-entry draft.
- The daily log history surface is an overview data sheet with filters and a feed variance panel, not a timeline-first event log.

### Today Operations Checklist

- Required closeout tasks drive progress.
- Optional checks such as average weight, abnormal warnings, and weather should not block required progress.

## Engineering Guidelines

- Follow existing feature patterns and Tailwind token classes.
- Keep edits focused on the requested behavior.
- Do not revert unrelated user changes.
- Add or update focused tests when behavior changes.
- Prefer structured helpers already in `src/shared/utils/` over ad hoc calculations.
- Keep mobile and field-use workflows readable with large tap targets and direct labels.

## Verification Expectations

For frontend behavior changes, run the focused test file first, then lint and build when the surface is user-facing:

```bash
npx vitest run <focused-test-file>
npx eslint <changed-files>
npm run build
```

For backend behavior changes, run the relevant backend unit/regression script from the root with `npm --prefix farm-backend ...`.

For docs-only changes, `git diff --check` is usually enough.

## Deployment Notes

- Frontend builds with Vite and outputs to `dist/`.
- Local frontend dev proxies `/api` to `http://localhost:5000` when `VITE_API_BASE` is blank.
- Set `VITE_API_BASE` for deployed backend environments.
