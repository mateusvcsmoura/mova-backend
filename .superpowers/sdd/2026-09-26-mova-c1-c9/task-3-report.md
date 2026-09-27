# C3 — pagamento bloqueado e estorno sandbox

## Estado

Implementação parcial entregue: o webhook assinado para locatário bloqueado é
reconhecido idempotentemente e não confirma a reserva, não gera código e não
permite início. A resposta é 200 para conter reentregas, com uma trilha
append-only exclusivamente simulada (`PAGAMENTO_RECEBIDO`,
`ESTORNO_SOLICITADO`, `ESTORNO_CONCLUIDO`). Nenhuma integração ou alegação de
transferência real foi adicionada; o modal Pix também foi explicitado como
ilustrativo.

## Segurança de execução

Antes da migração e dos testes destrutivos foi confirmado:

- `NODE_ENV=test`
- `DATABASE_URL_TEST` e `DIRECT_URL_TEST` em `localhost:5433/mova_test`
- Prisma aplicou a migração no banco `mova_test`.

## RED/GREEN observado

- RED: `test/pagamento/webhook.test.ts --maxWorkers=1` falhou como esperado:
  webhook válido de bloqueado retornava 403 em vez de reconhecer o recebimento.
- GREEN: o mesmo arquivo passou com 7 testes.
- Frontend: `src/pages/Pagamento.test.jsx` passou com 33 testes em 4 arquivos.
- Backend: `prisma generate` e `tsc` passaram.

## Limitação remanescente

O fluxo de falha e retry de estorno ainda não foi modelado: esta entrega
simula somente estorno concluído. Portanto C3 ainda não satisfaz integralmente
o critério de `ESTORNO_FALHOU` seguido de retry, nem a jornada E2E dedicada.
