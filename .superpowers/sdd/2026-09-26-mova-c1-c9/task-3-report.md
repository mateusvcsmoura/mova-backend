# C3 — blocked payment and sandbox refund

## Final state

A valid signed paid webhook received after the tenant is blocked is acknowledged
idempotently. It does not confirm the reservation, issue an unlock code, or
permit rental start. It records an append-only sandbox-only trace:
`PAGAMENTO_RECEBIDO`, `ESTORNO_SOLICITADO`, `ESTORNO_FALHOU`, and
`ESTORNO_CONCLUIDO` when the first simulated refund attempt fails.

The dedicated refund gateway is a deterministic sandbox simulator: it has no
credentials, balance, or transfer operation. `PAGAMENTO_SANDBOX_ESTORNO_FALHA_UNICA=true`
is a test-only switch that makes the first attempt fail. A second attempt runs
automatically, and deterministic idempotency keys prevent duplicate financial
records or repeated retries when the signed webhook is delivered again.

The Pix UI wording remains explicitly illustrative/simulated; this task makes
no claim that a real refund or money movement occurred.

## Test safety

Before destructive tests, sanitized checks confirmed:

- `DATABASE_URL_TEST` and `DIRECT_URL_TEST`: `localhost:5433/mova_test`
- development URLs: `localhost:5433/mova_dev`
- test commands force `NODE_ENV=test`

Only `mova_test` was used. The test reset now deletes
`EventoFinanceiroSandbox` before `Reserva`, respecting its foreign key and
retaining per-file isolation.

## RED/GREEN evidence

- RED: `NODE_ENV=test SEND_REAL_EMAIL=false npx.cmd vitest run
  test/pagamento/webhook.test.ts --maxWorkers=1` failed at the new scenario.
  The partial implementation produced only received/requested/completed events;
  `ESTORNO_FALHOU` was absent.
- GREEN: the same webhook file passed with **8 tests**.
- Relevant E2E: `test/e2e/jornada-reserva-pagamento.test.ts` passed with
  **2 tests**. The added journey creates the reservation by API, blocks the
  tenant, sends the signed webhook, verifies no confirmation/unlock code, and
  verifies automatic sandbox retry.
- Payment regression: `npx.cmd vitest run test/pagamento --maxWorkers=1`
  passed with **30 tests**. `npx.cmd tsc --noEmit` passed.

## Full-suite note

The serial full-suite attempt encountered unrelated pre-existing failures in
`test/re-review/blocker-h04.test.ts`: **6 failed / 22 tests** (undefined test
fixtures and a capacity assertion). The focused C3 proof and E2E journey are
green; C1, C2, and C8 were not changed to conceal those failures.
