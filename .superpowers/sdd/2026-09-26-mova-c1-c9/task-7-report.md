# Task 7 report — C8 errors and 404 distinction

Status: complete.

## Changes

- Backend business, validation, and internal errors now include `code`, `message`, and the correlated `requestId`. Explicit domain codes remain intact; uncoded `HttpError`s receive `BUSINESS_ERROR`.
- Validation details expose only field paths and messages, not submitted values. Internal error logs include the request ID and error type, while request logs omit URLs and health logs omit error messages.
- Unmatched `/api` requests return a JSON 404 error envelope. Existing health response fields and session/auth error handlers were left intact.
- Frontend API failures remain `ApiError`s, now carrying `requestId`; browser logs omit request paths and response messages. The wildcard page route renders a local 404 page and keeps the requested URL.

## RED / GREEN

- Backend RED: `npm.cmd test -- --maxWorkers=1 test/security/error-handler.test.ts test/health/observability.test.ts test/health/health.test.ts` — 8 failures and 4 passes across 12 tests. Failures showed the missing envelope/request ID, Express's default API 404, and unsafe error logs.
- Backend GREEN: same command — 3 files passed, 12/12 tests.
- Frontend RED: `npm.cmd run test:run -- --configLoader runner --root . --maxWorkers=1 src/services/apiClient.test.js src/App.flow.test.jsx -t "404|rota invalida|token da rota"` — 3 expected failures: API errors lacked request IDs, logs included route tokens, and the wildcard route redirected to login.
- Frontend GREEN: `npm.cmd run test:run -- --configLoader runner --root . --maxWorkers=1 src/services/apiClient.test.js src/App.flow.test.jsx` — 8 files passed, 79/79 tests.

## Additional verification

- Backend TypeScript compile: `npm.cmd run compile` — passed.
- Frontend production build: `npm.cmd run build -- --configLoader runner` — passed.
- Backend test setup used the configured local `localhost/mova_test` database.
- `git diff --check` passed in both repositories before commit.

## Commits

- Backend implementation (`main`): `4f8af7639a574b16de936359b52a3912048a92b7`
- Frontend implementation (`develop`): `cd6f2e4e35185f4a69d808292d5f7cdf76afe072`

## Notes

The default Vite/Vitest esbuild config loader tried to access a parent directory outside the workspace and failed with `Access is denied`. The runner config loader worked for both the focused frontend tests and production build; repository configuration was not changed.
